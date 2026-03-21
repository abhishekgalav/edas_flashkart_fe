// Types matching the database schema

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;        // sale_price
  originalPrice: number; // original_price
  image: string;
  totalStock: number;
  remainingStock: number; // total - reserved - sold
  reservedStock: number;
  soldStock: number;
  category: string;      // derived from flash sale event name
  flashSaleEventId: string | null;
}

export interface CartItem {
  id: string;           // cart_item id
  product: Product;
  reservedAt: number;   // timestamp ms
  expiresAt: number;    // timestamp ms
  quantity: number;
  syncing?: boolean;
}

export interface FlashSaleEvent {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
}

export const RESERVATION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Map DB row to Product
export function mapDbProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.sale_price),
    originalPrice: Number(row.original_price),
    image: row.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
    totalStock: row.total_stock,
    remainingStock: row.total_stock - row.reserved_stock - row.sold_stock,
    reservedStock: row.reserved_stock,
    soldStock: row.sold_stock,
    category: "Flash Sale",
    flashSaleEventId: row.flash_sale_event_id,
  };
}

// Map DB cart item row to CartItem (expects joined product)
export function mapDbCartItem(row: any, products: Product[]): CartItem | null {
  const product = products.find((p) => p.id === row.product_id);
  if (!product) return null;
  return {
    id: row.id,
    product,
    reservedAt: new Date(row.reserved_at).getTime(),
    expiresAt: new Date(row.expires_at).getTime(),
    quantity: row.quantity,
    syncing: false,
  };
}
