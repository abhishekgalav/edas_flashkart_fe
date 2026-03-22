import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Loader2 } from "lucide-react";
import { SaleHeader } from "@/components/SaleHeader";

interface OrderItem {
  id: string;
  productName: string;
  productImage: string;
  quantity: number;
  priceAtPurchase: number;
}

interface Order {
  id: string;
  createdAt: string;
  totalAmount: number;
  status: string;
  items: OrderItem[];
}

export default function OrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    async function fetchOrders() {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (!ordersData || ordersData.length === 0) {
        setLoading(false);
        return;
      }

      const enriched: Order[] = [];

      for (const order of ordersData) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select("id, product_id, quantity, price_at_purchase")
          .eq("order_id", order.id);

        const items: OrderItem[] = [];

        if (itemsData) {
          for (const item of itemsData) {
            const { data: product } = await supabase
              .from("products")
              .select("name, image_url")
              .eq("id", item.product_id)
              .single();

            items.push({
              id: item.id,
              productName: product?.name || "Unknown Product",
              productImage: product?.image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400",
              quantity: item.quantity,
              priceAtPurchase: Number(item.price_at_purchase),
            });
          }
        }

        enriched.push({
          id: order.id,
          createdAt: order.created_at,
          totalAmount: Number(order.total_amount),
          status: order.status,
          items,
        });
      }

      setOrders(enriched);
      setLoading(false);
    }

    fetchOrders();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SaleHeader saleTimeLeft={0} cartCount={0} />

      <main className="container py-8">
        <button
          onClick={() => navigate("/")}
          className="mb-6 flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Sale
        </button>

        <h1 className="mb-6 text-2xl font-extrabold tracking-tight text-foreground md:text-3xl" style={{ lineHeight: 1.1 }}>
          Your Orders
        </h1>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-background px-6 py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No orders yet. Go grab some deals!</p>
            <button
              onClick={() => navigate("/")}
              className="mt-2 rounded bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-all hover:-translate-y-px hover:shadow-card-hover active:scale-[0.97]"
            >
              Shop Now
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.map((order) => (
              <div key={order.id} className="overflow-hidden rounded-lg border bg-background">
                {/* Order header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-surface px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono-timer text-[10px] uppercase tracking-wider text-muted-foreground">
                      Order #{order.id.slice(0, 8)}
                    </span>
                    <span className="rounded bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-mono-timer text-sm font-semibold text-foreground">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Order items */}
                <div className="divide-y">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-4 px-4 py-3">
                      <img
                        src={item.productImage}
                        alt={item.productName}
                        className="h-12 w-12 rounded object-cover"
                      />
                      <div className="flex flex-1 flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">{item.productName}</span>
                        <span className="text-[10px] text-muted-foreground">Qty: {item.quantity}</span>
                      </div>
                      <span className="font-mono-timer text-sm text-foreground">
                        ${(item.priceAtPurchase * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
