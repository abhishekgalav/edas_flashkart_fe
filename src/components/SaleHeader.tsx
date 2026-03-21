import { formatTime } from "@/lib/format-time";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "react-router-dom";
import { LogOut, User } from "lucide-react";

interface SaleHeaderProps {
  saleTimeLeft: number;
  cartCount: number;
}

export function SaleHeader({ saleTimeLeft, cartCount }: SaleHeaderProps) {
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

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reserved
          </span>
          <span className="font-mono-timer inline-flex h-6 w-6 items-center justify-center rounded bg-primary text-xs text-primary-foreground">
            {cartCount}
          </span>
        </div>
      </div>
    </header>
  );
}
