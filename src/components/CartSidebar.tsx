import { CartItem } from "@/lib/flash-sale-data";
import { formatTime } from "@/lib/format-time";
import { X, ShoppingCart, Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";

interface CartSidebarProps {
  cart: CartItem[];
  now: number;
  onRemove: (productId: string) => void;
  onCheckout: () => Promise<{ success: boolean; orderId?: string; total?: number; error?: string }>;
}

export function CartSidebar({ cart, now, onRemove, onCheckout }: CartSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderComplete, setOrderComplete] = useState<{ orderId: string; total: number } | null>(null);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setCheckingOut(true);
    try {
      const result = await onCheckout();
      if (result.success) {
        setOrderComplete({ orderId: result.orderId!, total: result.total! });
        toast.success("Order placed successfully!");
      } else {
        toast.error(result.error || "Checkout failed");
      }
    } catch {
      toast.error("Checkout failed. Please try again.");
    } finally {
      setCheckingOut(false);
    }
  };

  if (orderComplete) {
    return (
      <aside className="flex h-fit flex-col items-center gap-3 rounded-lg border bg-background px-4 py-8 text-center">
        <CheckCircle className="h-10 w-10 text-success" />
        <h2 className="text-sm font-bold text-foreground">Order Confirmed</h2>
        <p className="font-mono-timer text-xs text-muted-foreground">
          #{orderComplete.orderId.slice(0, 8)}
        </p>
        <p className="font-mono-timer text-lg font-semibold text-foreground">
          ${orderComplete.total.toFixed(2)}
        </p>
        <button
          onClick={() => setOrderComplete(null)}
          className="mt-2 text-xs font-medium text-primary hover:underline"
        >
          Continue Shopping
        </button>
      </aside>
    );
  }

  return (
    <aside className="flex h-fit flex-col rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground">
          Your Cart
        </h2>
        <span className="ml-auto font-mono-timer text-xs text-muted-foreground">
          {cart.length} item{cart.length !== 1 ? "s" : ""}
        </span>
      </div>

      {cart.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="text-2xl">🛒</span>
          <p className="text-xs text-muted-foreground">
            No items reserved. Add products before stock runs out.
          </p>
        </div>
      ) : (
        <div className="flex flex-col divide-y">
          {cart.map((item) => {
            const remaining = Math.max(0, item.expiresAt - now);
            const urgency = remaining < 30000;

            return (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 transition-all duration-300"
              >
                <img
                  src={item.product.image}
                  alt={item.product.name}
                  className="h-10 w-10 rounded object-cover"
                />
                <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                  <span className="truncate text-xs font-semibold text-foreground">
                    {item.product.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-timer text-xs text-foreground">
                      ${item.product.price}
                    </span>
                    {item.syncing ? (
                      <span className="text-[10px] text-muted-foreground">Syncing…</span>
                    ) : (
                      <span
                        className={`font-mono-timer text-[10px] ${
                          urgency ? "text-primary animate-pulse-coral font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        {formatTime(remaining)}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => onRemove(item.product.id)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="border-t px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="font-mono-timer text-sm font-semibold text-foreground">${total.toFixed(2)}</span>
          </div>
          <button
            onClick={handleCheckout}
            disabled={checkingOut}
            className="flex h-9 w-full items-center justify-center gap-2 rounded bg-secondary text-xs font-semibold uppercase tracking-wider text-secondary-foreground transition-all hover:-translate-y-px hover:shadow-card-hover active:scale-[0.97] disabled:opacity-50"
          >
            {checkingOut ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                Processing
              </>
            ) : user ? (
              "Checkout"
            ) : (
              "Sign in to Checkout"
            )}
          </button>
        </div>
      )}
    </aside>
  );
}
