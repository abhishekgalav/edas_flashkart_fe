import { Product } from "@/lib/flash-sale-data";
import { Loader2 } from "lucide-react";

interface ProductCardProps {
  product: Product;
  inCart: boolean;
  syncing?: boolean;
  onAdd: () => void;
  index: number;
}

export function ProductCard({ product, inCart, syncing, onAdd, index }: ProductCardProps) {
  const stockPercent = (product.remainingStock / product.totalStock) * 100;
  const lowStock = stockPercent < 25;
  const outOfStock = product.remainingStock <= 0;
  const discount = Math.round((1 - product.price / product.originalPrice) * 100);

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-lg border bg-background transition-all duration-300 hover:shadow-card-hover hover:border-primary/40 active:scale-[0.98]"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-surface">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute left-2 top-2 rounded bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
          -{discount}%
        </span>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {product.category}
        </span>
        <h3 className="text-sm font-semibold leading-tight text-foreground">
          {product.name}
        </h3>

        <div className="flex items-baseline gap-2">
          <span className="font-mono-timer text-lg font-semibold text-foreground">
            ${product.price}
          </span>
          <span className="font-mono-timer text-xs text-muted-foreground line-through">
            ${product.originalPrice}
          </span>
        </div>

        {/* Stock bar */}
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono-timer text-[10px] uppercase tracking-wider text-muted-foreground">
              Stock
            </span>
            <span className={`font-mono-timer text-[10px] ${lowStock ? "text-primary font-semibold" : "text-muted-foreground"}`}>
              {product.remainingStock}/{product.totalStock}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface-alt">
            <div
              className={`h-full rounded-full transition-all duration-600 ease-out ${lowStock ? "bg-primary" : "bg-success"}`}
              style={{ width: `${stockPercent}%` }}
            />
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onAdd}
          disabled={inCart || outOfStock}
          className={`mt-3 flex h-9 w-full items-center justify-center gap-2 rounded text-xs font-semibold uppercase tracking-wider transition-all duration-200 active:scale-[0.97] ${
            outOfStock
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : inCart
              ? "border border-primary bg-transparent text-primary"
              : "bg-primary text-primary-foreground hover:-translate-y-px hover:shadow-card-hover"
          }`}
        >
          {syncing ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Syncing
            </>
          ) : outOfStock ? (
            "Sold Out"
          ) : inCart ? (
            "Reserved ✓"
          ) : (
            "Add to Cart"
          )}
        </button>
      </div>
    </div>
  );
}
