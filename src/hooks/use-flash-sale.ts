import { useState, useEffect, useCallback, useRef } from "react";
import {
  Product,
  CartItem,
  products as initialProducts,
  simulateStockChange,
  simulateAddToCart,
  SALE_END_TIME,
  RESERVATION_DURATION_MS,
} from "@/lib/flash-sale-data";
import { toast } from "sonner";

export function useFlashSale() {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [now, setNow] = useState(Date.now());
  const addingRef = useRef<Set<string>>(new Set());

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Simulate near-real-time stock changes every 3s
  useEffect(() => {
    const id = setInterval(() => {
      setProducts((prev) => simulateStockChange(prev));
    }, 3000);
    return () => clearInterval(id);
  }, []);

  // Auto-remove expired reservations
  useEffect(() => {
    setCart((prev) => {
      const expired = prev.filter(
        (item) => now - item.reservedAt >= RESERVATION_DURATION_MS && !item.syncing
      );
      if (expired.length > 0) {
        expired.forEach((item) =>
          toast.info(`Reservation expired for ${item.product.name}`)
        );
        // Return stock
        setProducts((prods) =>
          prods.map((p) => {
            const exp = expired.find((e) => e.product.id === p.id);
            return exp ? { ...p, remainingStock: Math.min(p.totalStock, p.remainingStock + 1) } : p;
          })
        );
        return prev.filter(
          (item) => !(now - item.reservedAt >= RESERVATION_DURATION_MS && !item.syncing)
        );
      }
      return prev;
    });
  }, [now]);

  const saleTimeLeft = Math.max(0, SALE_END_TIME - now);
  const isCartFull = (productId: string) => cart.some((c) => c.product.id === productId);

  const addToCart = useCallback(
    async (productId: string) => {
      if (addingRef.current.has(productId)) return;
      addingRef.current.add(productId);

      const product = products.find((p) => p.id === productId);
      if (!product || product.remainingStock <= 0 || isCartFull(productId)) {
        addingRef.current.delete(productId);
        return;
      }

      // Optimistic: instantly add to cart and decrement stock
      const cartItem: CartItem = { product, reservedAt: Date.now(), syncing: true };
      setCart((prev) => [...prev, cartItem]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, remainingStock: p.remainingStock - 1 } : p
        )
      );

      try {
        await simulateAddToCart(productId);
        // Mark synced
        setCart((prev) =>
          prev.map((c) =>
            c.product.id === productId ? { ...c, syncing: false, reservedAt: Date.now() } : c
          )
        );
        toast.success(`${product.name} reserved for 5 minutes`);
      } catch {
        // Rollback
        setCart((prev) => prev.filter((c) => c.product.id !== productId));
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, remainingStock: p.remainingStock + 1 } : p
          )
        );
        toast.error(`Failed to reserve ${product.name}. Try again.`);
      } finally {
        addingRef.current.delete(productId);
      }
    },
    [products, cart]
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => {
      const item = prev.find((c) => c.product.id === productId);
      if (item) {
        setProducts((prods) =>
          prods.map((p) =>
            p.id === productId ? { ...p, remainingStock: Math.min(p.totalStock, p.remainingStock + 1) } : p
          )
        );
      }
      return prev.filter((c) => c.product.id !== productId);
    });
  }, []);

  return { products, cart, now, saleTimeLeft, addToCart, removeFromCart, isCartFull };
}
