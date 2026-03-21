import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Product,
  CartItem,
  FlashSaleEvent,
  RESERVATION_DURATION_MS,
  mapDbProduct,
} from "@/lib/flash-sale-data";
import { toast } from "sonner";

export function useFlashSale() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleEvent, setSaleEvent] = useState<FlashSaleEvent | null>(null);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const addingRef = useRef<Set<string>>(new Set());

  // Tick every second for timers
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch flash sale event
  useEffect(() => {
    async function fetchSaleEvent() {
      const { data } = await supabase
        .from("flash_sale_events")
        .select("*")
        .eq("is_active", true)
        .order("start_time", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setSaleEvent({
          id: data.id,
          name: data.name,
          startTime: new Date(data.start_time).getTime(),
          endTime: new Date(data.end_time).getTime(),
          isActive: data.is_active,
        });
      }
    }
    fetchSaleEvent();
  }, []);

  // Fetch products
  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: true });

      if (data && !error) {
        setProducts(data.map(mapDbProduct));
      }
      setLoading(false);
    }
    fetchProducts();
  }, []);

  // Real-time product stock updates (B1 requirement)
  useEffect(() => {
    const channel = supabase
      .channel("products-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const updated = mapDbProduct(payload.new);
          setProducts((prev) =>
            prev.map((p) => (p.id === updated.id ? updated : p))
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Fetch user's cart items
  useEffect(() => {
    if (!user) {
      setCart([]);
      return;
    }
    async function fetchCart() {
      // Get user's cart
      const { data: cartData } = await supabase
        .from("carts")
        .select("id")
        .eq("user_id", user!.id)
        .single();

      if (!cartData) return;

      const { data: items } = await supabase
        .from("cart_items")
        .select("*")
        .eq("cart_id", cartData.id)
        .eq("is_expired", false);

      if (items) {
        setCart(
          items.map((item: any) => {
            const product = products.find((p) => p.id === item.product_id);
            return {
              id: item.id,
              product: product || { id: item.product_id, name: "Loading...", price: 0, originalPrice: 0, image: "", totalStock: 0, remainingStock: 0, reservedStock: 0, soldStock: 0, category: "", description: null, flashSaleEventId: null },
              reservedAt: new Date(item.reserved_at).getTime(),
              expiresAt: new Date(item.expires_at).getTime(),
              quantity: item.quantity,
              syncing: false,
            };
          })
        );
      }
    }
    if (products.length > 0) fetchCart();
  }, [user, products.length]);

  // Auto-remove expired reservations from UI
  useEffect(() => {
    setCart((prev) => {
      const expired = prev.filter((item) => now >= item.expiresAt && !item.syncing);
      if (expired.length > 0) {
        expired.forEach((item) =>
          toast.info(`Reservation expired for ${item.product.name}`)
        );
        return prev.filter((item) => !(now >= item.expiresAt && !item.syncing));
      }
      return prev;
    });
  }, [now]);

  // Release expired reservations server-side periodically
  useEffect(() => {
    const id = setInterval(async () => {
      await supabase.rpc("release_expired_reservations");
    }, 15000); // every 15s
    return () => clearInterval(id);
  }, []);

  const saleTimeLeft = saleEvent
    ? Math.max(0, saleEvent.endTime - now)
    : 0;

  const isCartFull = (productId: string) =>
    cart.some((c) => c.product.id === productId && !c.syncing);

  // A2: Concurrency-safe cart reservation with optimistic UI (B3)
  const addToCart = useCallback(
    async (productId: string) => {
      if (!user) {
        toast.error("Sign in to reserve items");
        return;
      }
      if (addingRef.current.has(productId)) return;
      addingRef.current.add(productId);

      const product = products.find((p) => p.id === productId);
      if (!product || product.remainingStock <= 0 || isCartFull(productId)) {
        addingRef.current.delete(productId);
        return;
      }

      // B3: Optimistic UI — instantly update
      const tempId = `temp-${productId}`;
      const optimisticItem: CartItem = {
        id: tempId,
        product,
        reservedAt: Date.now(),
        expiresAt: Date.now() + RESERVATION_DURATION_MS,
        quantity: 1,
        syncing: true,
      };
      setCart((prev) => [...prev, optimisticItem]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, remainingStock: p.remainingStock - 1 } : p
        )
      );

      try {
        // Call atomic DB function (SELECT FOR UPDATE prevents overselling)
        const { data, error } = await supabase.rpc("reserve_stock", {
          p_user_id: user.id,
          p_product_id: productId,
          p_quantity: 1,
        });

        if (error) throw new Error(error.message);
        const result = data as any;
        if (!result.success) throw new Error(result.error);

        // Replace optimistic item with real data
        setCart((prev) =>
          prev.map((c) =>
            c.id === tempId
              ? {
                  ...c,
                  id: result.cart_item_id,
                  syncing: false,
                  reservedAt: Date.now(),
                  expiresAt: new Date(result.expires_at).getTime(),
                }
              : c
          )
        );
        toast.success(`${product.name} reserved for 5 minutes`);
      } catch (err: any) {
        // B3: Rollback on failure
        setCart((prev) => prev.filter((c) => c.id !== tempId));
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, remainingStock: p.remainingStock + 1 } : p
          )
        );
        toast.error(err.message || `Failed to reserve ${product.name}`);
      } finally {
        addingRef.current.delete(productId);
      }
    },
    [products, cart, user]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      const item = cart.find((c) => c.product.id === productId);
      if (!item) return;

      // Optimistic remove
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, remainingStock: p.remainingStock + 1 } : p
        )
      );

      // Delete from DB (stock release happens via trigger/function)
      if (!item.id.startsWith("temp-")) {
        await supabase.from("cart_items").delete().eq("id", item.id);
        // Release reserved stock
        await supabase
          .from("products")
          .update({ reserved_stock: Math.max(0, (products.find(p => p.id === productId)?.reservedStock || 1) - 1) })
          .eq("id", productId);
      }
    },
    [cart, products]
  );

  // A3: Checkout with idempotency
  const checkout = useCallback(async () => {
    if (!user) return { success: false, error: "Not signed in" };
    if (cart.length === 0) return { success: false, error: "Cart is empty" };

    const idempotencyKey = `${user.id}-${Date.now()}`;

    const { data, error } = await supabase.rpc("checkout", {
      p_user_id: user.id,
      p_idempotency_key: idempotencyKey,
    });

    if (error) return { success: false, error: error.message };
    const result = data as any;

    if (result.success) {
      setCart([]);
      return { success: true, orderId: result.order_id, total: result.total };
    }
    return { success: false, error: result.error };
  }, [user, cart]);

  return {
    products,
    cart,
    now,
    saleTimeLeft,
    saleEvent,
    addToCart,
    removeFromCart,
    isCartFull,
    checkout,
    loading,
  };
}
