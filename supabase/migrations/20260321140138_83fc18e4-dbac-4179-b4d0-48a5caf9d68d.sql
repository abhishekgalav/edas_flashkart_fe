
-- A1: Database Design - All entities for FlashKart

-- 1. Profiles (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Flash Sale Events
CREATE TABLE public.flash_sale_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flash_sale_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active flash sales" ON public.flash_sale_events FOR SELECT USING (true);

-- 3. Products (linked to flash sale)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flash_sale_event_id UUID REFERENCES public.flash_sale_events(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  original_price NUMERIC(10,2) NOT NULL,
  sale_price NUMERIC(10,2) NOT NULL,
  total_stock INTEGER NOT NULL DEFAULT 0,
  reserved_stock INTEGER NOT NULL DEFAULT 0,
  sold_stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view products" ON public.products FOR SELECT USING (true);

-- 4. Cart
CREATE TABLE public.carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart" ON public.carts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 5. Cart Items (with reservation timeout)
CREATE TABLE public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  is_expired BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own cart items" ON public.cart_items FOR ALL
  USING (cart_id IN (SELECT id FROM public.carts WHERE user_id = auth.uid()))
  WITH CHECK (cart_id IN (SELECT id FROM public.carts WHERE user_id = auth.uid()));

-- 6. Orders
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. Order Items
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL,
  price_at_purchase NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own order items" ON public.order_items FOR SELECT
  USING (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));
CREATE POLICY "Users create own order items" ON public.order_items FOR INSERT
  WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid()));

-- 8. Inventory Log (audit trail for stock changes)
CREATE TABLE public.inventory_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id),
  change_type TEXT NOT NULL, -- 'reserve', 'release', 'purchase', 'expire'
  quantity_change INTEGER NOT NULL,
  previous_stock INTEGER,
  new_stock INTEGER,
  user_id UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own inventory logs" ON public.inventory_logs FOR SELECT USING (auth.uid() = user_id);

-- A2: Concurrency-safe reserve function (atomic, prevents overselling)
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_user_id UUID,
  p_product_id UUID,
  p_quantity INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available INTEGER;
  v_cart_id UUID;
  v_cart_item_id UUID;
  v_product RECORD;
BEGIN
  -- Lock the product row to prevent race conditions (SELECT FOR UPDATE)
  SELECT total_stock, reserved_stock, sold_stock, sale_price, name
  INTO v_product
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  v_available := v_product.total_stock - v_product.reserved_stock - v_product.sold_stock;

  IF v_available < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock', 'available', v_available);
  END IF;

  -- Update reserved stock atomically
  UPDATE public.products
  SET reserved_stock = reserved_stock + p_quantity
  WHERE id = p_product_id;

  -- Get or create cart
  SELECT id INTO v_cart_id FROM public.carts WHERE user_id = p_user_id;
  IF v_cart_id IS NULL THEN
    INSERT INTO public.carts (user_id) VALUES (p_user_id) RETURNING id INTO v_cart_id;
  END IF;

  -- Check if item already in cart
  SELECT id INTO v_cart_item_id FROM public.cart_items
  WHERE cart_id = v_cart_id AND product_id = p_product_id AND is_expired = false;

  IF v_cart_item_id IS NOT NULL THEN
    UPDATE public.cart_items
    SET quantity = quantity + p_quantity, expires_at = now() + interval '5 minutes', reserved_at = now()
    WHERE id = v_cart_item_id;
  ELSE
    INSERT INTO public.cart_items (cart_id, product_id, quantity)
    VALUES (v_cart_id, p_product_id, p_quantity)
    RETURNING id INTO v_cart_item_id;
  END IF;

  -- Log inventory change
  INSERT INTO public.inventory_logs (product_id, change_type, quantity_change, previous_stock, new_stock, user_id)
  VALUES (p_product_id, 'reserve', -p_quantity, v_available, v_available - p_quantity, p_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'cart_item_id', v_cart_item_id,
    'expires_at', (now() + interval '5 minutes'),
    'available_stock', v_available - p_quantity
  );
END;
$$;

-- Release expired reservations function
CREATE OR REPLACE FUNCTION public.release_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_item IN
    SELECT ci.id, ci.product_id, ci.quantity, ci.cart_id
    FROM public.cart_items ci
    JOIN public.carts c ON c.id = ci.cart_id
    WHERE ci.is_expired = false AND ci.expires_at < now()
    FOR UPDATE OF ci
  LOOP
    -- Release reserved stock
    UPDATE public.products
    SET reserved_stock = GREATEST(reserved_stock - v_item.quantity, 0)
    WHERE id = v_item.product_id;

    -- Mark expired
    UPDATE public.cart_items SET is_expired = true WHERE id = v_item.id;

    -- Log
    INSERT INTO public.inventory_logs (product_id, change_type, quantity_change, user_id)
    VALUES (v_item.product_id, 'expire', v_item.quantity, NULL);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- A3: Checkout function (atomic, with idempotency)
CREATE OR REPLACE FUNCTION public.checkout(
  p_user_id UUID,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
  v_order_id UUID;
  v_total NUMERIC(10,2) := 0;
  v_item RECORD;
  v_existing_order UUID;
BEGIN
  -- Idempotency check: prevent duplicate orders (D3 fix)
  SELECT id INTO v_existing_order FROM public.orders WHERE idempotency_key = p_idempotency_key;
  IF v_existing_order IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'order_id', v_existing_order, 'duplicate', true);
  END IF;

  -- Release expired reservations first
  PERFORM public.release_expired_reservations();

  -- Get cart
  SELECT id INTO v_cart_id FROM public.carts WHERE user_id = p_user_id;
  IF v_cart_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No cart found');
  END IF;

  -- Check for valid (non-expired) items
  IF NOT EXISTS (SELECT 1 FROM public.cart_items WHERE cart_id = v_cart_id AND is_expired = false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cart is empty or all items expired');
  END IF;

  -- Create order
  INSERT INTO public.orders (user_id, idempotency_key)
  VALUES (p_user_id, p_idempotency_key)
  RETURNING id INTO v_order_id;

  -- Process each cart item
  FOR v_item IN
    SELECT ci.id, ci.product_id, ci.quantity, p.sale_price, p.name
    FROM public.cart_items ci
    JOIN public.products p ON p.id = ci.product_id
    WHERE ci.cart_id = v_cart_id AND ci.is_expired = false
    FOR UPDATE OF ci
  LOOP
    -- Move from reserved to sold
    UPDATE public.products
    SET reserved_stock = GREATEST(reserved_stock - v_item.quantity, 0),
        sold_stock = sold_stock + v_item.quantity
    WHERE id = v_item.product_id;

    -- Create order item
    INSERT INTO public.order_items (order_id, product_id, quantity, price_at_purchase)
    VALUES (v_order_id, v_item.product_id, v_item.quantity, v_item.sale_price);

    v_total := v_total + (v_item.sale_price * v_item.quantity);

    -- Log
    INSERT INTO public.inventory_logs (product_id, change_type, quantity_change, user_id)
    VALUES (v_item.product_id, 'purchase', -v_item.quantity, p_user_id);

    -- Remove cart item
    DELETE FROM public.cart_items WHERE id = v_item.id;
  END LOOP;

  -- Update order total
  UPDATE public.orders SET total_amount = v_total WHERE id = v_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', v_order_id, 'total', v_total);
END;
$$;

-- Enable realtime for products (stock updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;

-- Seed flash sale event
INSERT INTO public.flash_sale_events (name, start_time, end_time)
VALUES ('Flash Drop — Limited Edition', now(), now() + interval '24 hours');

-- Seed products
INSERT INTO public.products (flash_sale_event_id, name, description, image_url, original_price, sale_price, total_stock)
SELECT
  (SELECT id FROM public.flash_sale_events LIMIT 1),
  name, description, image_url, original_price, sale_price, total_stock
FROM (VALUES
  ('Wireless Noise-Cancel Headphones', 'Premium ANC with 40h battery', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400', 349.99, 179.00, 100),
  ('Mechanical Keyboard RGB', 'Hot-swappable switches, aluminum frame', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400', 199.99, 89.00, 75),
  ('Smart Fitness Watch', 'Heart rate, GPS, 7-day battery', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400', 299.99, 149.00, 50),
  ('Portable SSD 1TB', 'USB-C, 1050MB/s read speed', 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=400', 159.99, 79.00, 120),
  ('Drone 4K Camera', 'Foldable, 30min flight, obstacle avoid', 'https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=400', 799.99, 399.00, 30),
  ('Smart LED Desk Lamp', 'Wireless charging base, adjustable temp', 'https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400', 89.99, 39.00, 200)
) AS t(name, description, image_url, original_price, sale_price, total_stock);
