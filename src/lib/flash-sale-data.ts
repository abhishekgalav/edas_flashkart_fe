export interface Product {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  totalStock: number;
  remainingStock: number;
  category: string;
}

export interface CartItem {
  product: Product;
  reservedAt: number;
  syncing?: boolean;
}

const SALE_DURATION_MS = 2 * 60 * 60 * 1000; // 2 hours
export const SALE_END_TIME = Date.now() + SALE_DURATION_MS;
export const RESERVATION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export const products: Product[] = [
  {
    id: "p1",
    name: "Aero Wireless Headphones",
    price: 79,
    originalPrice: 149,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=400&fit=crop",
    totalStock: 100,
    remainingStock: 67,
    category: "Audio",
  },
  {
    id: "p2",
    name: "Carbon Fiber Watch Band",
    price: 34,
    originalPrice: 89,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&h=400&fit=crop",
    totalStock: 50,
    remainingStock: 23,
    category: "Accessories",
  },
  {
    id: "p3",
    name: "Matte Black Water Bottle",
    price: 22,
    originalPrice: 45,
    image: "https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=400&h=400&fit=crop",
    totalStock: 200,
    remainingStock: 142,
    category: "Lifestyle",
  },
  {
    id: "p4",
    name: "Precision Mechanical Keyboard",
    price: 119,
    originalPrice: 219,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=400&h=400&fit=crop",
    totalStock: 75,
    remainingStock: 18,
    category: "Tech",
  },
  {
    id: "p5",
    name: "Minimalist Desk Lamp",
    price: 55,
    originalPrice: 110,
    image: "https://images.unsplash.com/photo-1507473885765-e6ed057ab6fe?w=400&h=400&fit=crop",
    totalStock: 60,
    remainingStock: 41,
    category: "Home",
  },
  {
    id: "p6",
    name: "Ultra-Thin Power Bank",
    price: 29,
    originalPrice: 59,
    image: "https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=400&h=400&fit=crop",
    totalStock: 150,
    remainingStock: 89,
    category: "Tech",
  },
];

// Simulate random stock decrements
export function simulateStockChange(products: Product[]): Product[] {
  return products.map((p) => {
    if (p.remainingStock > 0 && Math.random() < 0.15) {
      return { ...p, remainingStock: Math.max(0, p.remainingStock - Math.floor(Math.random() * 3 + 1)) };
    }
    return p;
  });
}

// Simulate API call for add to cart
export function simulateAddToCart(productId: string): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      // 90% success rate
      if (Math.random() < 0.9) {
        resolve({ success: true });
      } else {
        reject(new Error("Failed to reserve item. Please try again."));
      }
    }, 300 + Math.random() * 400);
  });
}
