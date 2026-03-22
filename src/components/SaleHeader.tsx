import { formatTime } from "@/lib/format-time";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";
import { LogOut, User, Package } from "lucide-react";

interface SaleHeaderProps {
  saleTimeLeft: number;
  cartCount: number;
}

export function SaleHeader({ saleTimeLeft, cartCount }: SaleHeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur-sm">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse-coral" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Live Now
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sale Ends
          </span>
          <span className="font-mono-timer text-sm font-medium text-foreground">
            {formatTime(saleTimeLeft)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Reserved
            </span>
            <span className="font-mono-timer inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
              {cartCount}
            </span>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to="/orders"
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-colors"
                title="My Orders"
              >
                <Package className="h-3.5 w-3.5" />
              </Link>
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                {user.email}
              </span>
              <button
                onClick={signOut}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground active:scale-95 transition-colors"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              to="/auth"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <User className="h-3.5 w-3.5" />
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
