// src/modules/cart/UpsellBanner.tsx
import { useQuery } from '@tanstack/react-query';
import { useCartStore } from '@/store/cartStore';
import { getStaticRecommendations } from '@/services/static.catalog';
import { formatPrice } from '@/utils/format';
import type { Product } from '@/types/catalog';

// ─── Mini card for upsell items ────────────────────────────────────────────────

function UpsellCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  return (
    <article
      className="
        flex-shrink-0 w-36 rounded-brand overflow-hidden
        border border-brand-border bg-brand-surface
        flex flex-col
      "
    >
      <div className="aspect-square bg-brand-border overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-brand-muted text-2xl">
            🍽
          </div>
        )}
      </div>

      <div className="p-2 flex flex-col flex-1 gap-1">
        <p className="text-xs font-bold font-brand text-brand-text line-clamp-2 leading-snug">
          {product.name}
        </p>
        <p className="text-xs font-brand text-brand-primary font-semibold mt-auto">
          {formatPrice(product.basePrice)}
        </p>
        <button
          onClick={() =>
            addItem({
              productId: product.id,
              name: product.name,
              basePrice: product.basePrice,
              imageUrl: product.imageUrl,
            })
          }
          disabled={!product.available}
          aria-label={`Add ${product.name}`}
          className="
            mt-1 w-full py-1.5 rounded text-xs font-semibold font-brand
            bg-brand-primary text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-opacity active:opacity-70
          "
        >
          + Add
        </button>
      </div>
    </article>
  );
}

// ─── Banner ────────────────────────────────────────────────────────────────────

export default function UpsellBanner() {
  // ⚠️  Selector MUST return a primitive (string/number), not an array.
  // .map() inside a useSyncExternalStore snapshot always returns a new reference,
  // causing React to detect an "unstable" snapshot and retry infinitely (50×) → crash.
  const cartKeyStr = useCartStore(
    (s) => [...new Set(s.items.map((i) => i.productId))].sort().join(','),
  );

  const { data } = useQuery<Product[]>({
    queryKey: ['recommendations', cartKeyStr],
    queryFn: () => getStaticRecommendations(cartKeyStr ? cartKeyStr.split(',') : []),
    enabled: cartKeyStr.length > 0,
    staleTime: 5 * 60 * 1000,
    // Never surface errors to the UI — upsells are non-critical
    retry: 0,
    throwOnError: false,
  });

  if (!data?.length) return null;

  return (
    <section aria-labelledby="upsell-title" className="py-3 border-b border-brand-border" style={{ background: '#FFF8E7' }}>
      <h3
        id="upsell-title"
        className="text-xs font-bold font-brand text-brand-muted uppercase tracking-wider px-4 mb-2"
      >
        Add to your order
      </h3>

      <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
        {data.map((product) => (
          <UpsellCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
