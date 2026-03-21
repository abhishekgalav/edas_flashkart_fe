import { useFlashSale } from "@/hooks/use-flash-sale";
import { SaleHeader } from "@/components/SaleHeader";
import { ProductCard } from "@/components/ProductCard";
import { CartSidebar } from "@/components/CartSidebar";
import { Loader2 } from "lucide-react";

const Index = () => {
  const {
    products,
    cart,
    now,
    saleTimeLeft,
    addToCart,
    removeFromCart,
    isCartFull,
    checkout,
    loading,
  } = useFlashSale();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface">
      <SaleHeader saleTimeLeft={saleTimeLeft} cartCount={cart.length} />

      <main className="container py-8">
        {/* Hero */}
        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground md:text-5xl" style={{ lineHeight: 1.1 }}>
            Flash Drop
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Limited stock. Reservation expires in 5 minutes. Move fast.
          </p>
        </div>

        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Product grid */}
          <div className="flex-1">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((product, i) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  inCart={isCartFull(product.id)}
                  syncing={cart.find((c) => c.product.id === product.id)?.syncing}
                  onAdd={() => addToCart(product.id)}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Cart sidebar */}
          <div className="w-full lg:w-80 lg:shrink-0">
            <div className="sticky top-20">
              <CartSidebar cart={cart} now={now} onRemove={removeFromCart} onCheckout={checkout} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
