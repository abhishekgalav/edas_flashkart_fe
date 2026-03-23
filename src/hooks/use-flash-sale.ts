import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/services/api";

export const RESERVATION_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  totalStock: number;
  remainingStock: number;
  image: string;
}

export interface CartItem {
  id: string;
  product: Product;
  reservedAt: number;
  expiresAt: number;
  quantity: number;
  syncing: boolean;
}

export function useFlashSale() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [saleEvent, setSaleEvent] = useState<{ startTime: number; endTime: number } | null>(null);
  const [saleTimeLeft, setSaleTimeLeft] = useState<number>(0);
  const addingRef = useRef<Set<number>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);

  // Tick every second
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Fetch flash sale event
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await api.get("/flash-sale-events/active");
        if (res.data.success) {
          setSaleEvent({
            startTime: new Date(res.data.data.startTime).getTime(),
            endTime: new Date(res.data.data.endTime).getTime(),
          });
        }
      } catch (err) {
        toast.error("Failed to fetch flash sale event");
      }
    };
    fetchEvent();
  }, []);

  // Update saleTimeLeft
  useEffect(() => {
    if (!saleEvent) return;

    const interval = setInterval(() => {
      setSaleTimeLeft(Math.max(0, saleEvent.endTime - Date.now()));
    }, 1000);

    return () => clearInterval(interval);
  }, [saleEvent]);

  useEffect(() => {
    if (!saleEvent) return;

    if (saleTimeLeft === 0) {
      handleSaleEnd();
    }
  }, [saleTimeLeft]);

  const handleSaleEnd = async () => {
    try {
      // 1️⃣ Refresh products
      const productRes = await api.get("/flash-sale-events/active");

      if (productRes.data.success) {
        const data = productRes.data.data.products.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          originalPrice: Number(p.original_price),
          totalStock: p.totalStock,
          remainingStock: p.totalStock,
          image: p.image,
        }));
        setProducts(data);
      }

      // 2️⃣ Refresh cart (important)
      const cartRes = await api.get("/carts");
      if (cartRes.data.success && cartRes.data.data) {
        const cartData = cartRes.data.data;

        const items = cartData.items.map((i: any) => ({
          id: `cart-${i.productId}`,
          product: {
            id: i.productId,
            name: i.name,
            price: Number(i.price),
            originalPrice: Number(i.original_price),
            totalStock: i.totalStock,
            remainingStock: i.totalStock,
            image: i.image,
          },
          quantity: i.quantity,
          reservedAt: Date.now(),
          expiresAt: new Date(cartData.expiresAt).getTime(),
          syncing: false,
        }));

        setCart(items);
      }

      toast.info("Flash sale ended. Data refreshed.");
    } catch (err) {
      console.error("Failed to refresh after sale end");
    }
  };

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const res = await api.get("/carts");

        if (res.data.success && res.data.data) {
          const cartData = res.data.data;

          const items: CartItem[] = cartData.items.map((i: any) => ({
            id: `cart-${i.productId}`, // stable id (remove Date.now())
            product: {
              id: i.productId,
              name: i.name,
              price: Number(i.price),
              originalPrice: Number(i.original_price),
              totalStock: i.totalStock,
              remainingStock: i.totalStock - i.quantity, // optional improvement
              image: i.image,
            },
            quantity: i.quantity,
            reservedAt: Date.now(),
            expiresAt: new Date(cartData.expiresAt).getTime(),
            syncing: false,
          }));

          setCart(items);
        }
      } catch {
        toast.error("Failed to fetch cart");
      }
    };

    fetchCart();
  }, []); // <-- run only once

  // Fetch flash sale products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        const res = await api.get("/flash-sale-events/active");
        if (res.data.success) {
          const data = res.data.data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            price: Number(p.price),
            originalPrice: Number(p.original_price),
            totalStock: p.totalStock,
            remainingStock: p.totalStock,
            image: p.image,
          }));
          setProducts(data);
        }
      } catch {
        toast.error("Failed to fetch products");
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Remove expired reservations
  // useEffect(() => {
  //   setCart((prev) =>
  //     prev.filter((item) => {
  //       const expired = now >= item.expiresAt && !item.syncing;
  //       if (expired) toast.info(`Reservation expired for ${item.product.name}`);
  //       return !expired;
  //     })
  //   );
  // }, [now]);

  useEffect(() => {
    const expiredItems = cart.filter(
      (item) => now >= item.expiresAt && !item.syncing
    );

    if (expiredItems.length === 0) return;

    expiredItems.forEach(async (item) => {
      try {
        await api.delete(`/carts/remove/${item.product.id}`);
        toast.info(`Reservation expired for ${item.product.name}`);
      } catch (err) {
        console.error("Failed to sync expiry with backend");
      }
    });

    // Remove from local state AFTER API call
    setCart((prev) =>
      prev.filter((item) => now < item.expiresAt || item.syncing)
    );
  }, [now, cart]);

  const isCartFull = (productId: number) =>
    cart.some((c) => c.product.id === productId && !c.syncing);

  const addToCart = useCallback(
    async (productId: number, quantity = 1) => {
      const product = products.find((p) => p.id === productId);
      if (!product || product.remainingStock < quantity || isCartFull(productId)) return;
      if (addingRef.current.has(productId)) return;
      addingRef.current.add(productId);

      const tempId = `cart-${productId}-${Date.now()}`;
      const optimisticItem: CartItem = {
        id: tempId,
        product,
        reservedAt: Date.now(),
        expiresAt: Date.now() + RESERVATION_DURATION_MS,
        quantity,
        syncing: true,
      };
      setCart((prev) => [...prev, optimisticItem]);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId ? { ...p, remainingStock: p.remainingStock - quantity } : p
        )
      );

      try {
        const res = await api.post("/carts/reserve", { productId, quantity });
        if (res.data.success) {
          setCart((prev) =>
            prev.map((c) =>
              c.id === tempId
                ? {
                  ...c,
                  id: `cart-${productId}-${Date.now()}`,
                  syncing: false,
                  expiresAt: Date.now() + res.data.data.expiresIn * 1000,
                }
                : c
            )
          );
          toast.success(res.data.data.message);
        } else throw new Error(res.data.message);
      } catch (err: any) {
        setCart((prev) => prev.filter((c) => c.id !== tempId));
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, remainingStock: p.remainingStock + quantity } : p
          )
        );
        toast.error(err.message || "Failed to reserve product");
      } finally {
        addingRef.current.delete(productId);
      }
    },
    [products, cart]
  );


  const removeFromCart = useCallback(
    async (productId: number) => {
      const item = cart.find((c) => c.product.id === productId);
      if (!item) return;

      // Optimistically update local state
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, remainingStock: p.remainingStock + item.quantity }
            : p
        )
      );

      // Call API to remove item from server/cart
      try {
        await api.delete(`/carts/remove/${productId}`);
        // Optionally, show a success message
        // toast.success(`${item.product.name} removed from cart`);
      } catch (err: any) {
        // Rollback local state if API fails
        setCart((prev) => [...prev, item]);
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? { ...p, remainingStock: p.remainingStock - item.quantity }
              : p
          )
        );
        toast.error(err.response?.data?.message || "Failed to remove item from cart");
      }
    },
    [cart, products]
  );



const checkout = useCallback(async () => {
  if (loading) return;

  if (cart.length === 0) {
    return { success: false, error: "Cart is empty" };
  }

  setLoading(true);

  const idempotencyKey = crypto.randomUUID(); // ✅ better

  try {
    const res = await api.post("/orders/checkout", { idempotencyKey });

    if (res.data?.success) {
      setCart([]);

      return {
        success: true,
        orderId: res.data.data.id,
        total: res.data.data.totalAmount,
      };
    } else {
      return {
        success: false,
        error: res.data?.message || "Checkout failed",
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err.response?.data?.message || "Checkout failed",
    };
  } finally {
    setLoading(false);
  }
}, [cart, loading]);

  return {
    products,
    cart,
    now,
    saleTimeLeft,
    addToCart,
    removeFromCart,
    isCartFull,
    checkout,
    loading,
    checkingOut,
  };
}