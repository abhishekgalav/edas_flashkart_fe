import { CartItem, RESERVATION_DURATION_MS } from "@/lib/flash-sale-data";
import { formatTime } from "@/lib/format-time";
import { X, ShoppingCart } from "lucide-react";

interface CartSidebarProps {
  cart: CartItem[];
  now: number;
  onRemove: (productId: string) => void;
}

export function CartSidebar({ cart, now, onRemove }: CartSidebarProps) {
  const total = cart.reduce((sum, item) => sum + item.product.price, 0);

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
            const elapsed = now - item.reservedAt;
            const remaining = Math.max(0, RESERVATION_DURATION_MS - elapsed);
            const urgency = remaining < 30000;

            return (
              <div
                key={item.product.id}
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
            <span className="font-mono-timer text-sm font-semibold text-foreground">${total}</span>
          </div>
          <button className="flex h-9 w-full items-center justify-center rounded bg-secondary text-xs font-semibold uppercase tracking-wider text-secondary-foreground transition-all hover:-translate-y-px hover:shadow-card-hover active:scale-[0.97]">
            Checkout
          </button>
        </div>
      )}
    </aside>
  );
}
