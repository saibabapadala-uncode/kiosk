// src/modules/catalog/ProductCard.tsx
// Card behaviour mirrors the reference:
//   • is_single_variant AND no modifiers → direct "Add to Cart" with variant_ids[0]
//   • has modifiers OR is NOT single variant → open Product Detail modal
// Source reference: addToCart handler in assets — if (!is_single_variant || modifier?.modifiers.length > 0) return;

import type { Product } from '@/types/catalog';
import { formatPrice } from '@/utils/format';
import { useCartStore } from '@/store/cartStore';

interface ProductCardProps {
  product: Product;
  onOpenModal: (product: Product) => void;
}

export default function ProductCard({ product, onOpenModal }: ProductCardProps) {
  const addItem = useCartStore((s) => s.addItem);

  // Mirror: !is_single_variant || modifier?.modifiers.length > 0
  const needsModal = !product.isSingleVariant || product.modifierGroups.length > 0 || product.variants.length > 0;

  function handleAdd(e: React.MouseEvent) {
    e.stopPropagation();
    if (!product.available) return;
    if (needsModal) { onOpenModal(product); return; }

    // Single-variant, no modifiers: direct add using variant_ids[0] as the variant ID
    // Source: product.id = product.variant_ids[0]; then addToCart
    const variantId = product.variantIds[0];
    addItem({
      productId:  product.id,
      name:       product.name,
      basePrice:  product.basePrice,
      imageUrl:   product.imageUrl,
      variant:    variantId ? { id: variantId, name: product.name, price: product.basePrice } : undefined,
    });
  }

  const price = formatPrice(product.basePrice);

  return (
    <article
      onClick={() => product.available && onOpenModal(product)}
      className={[
        'group relative flex flex-col overflow-hidden cursor-pointer ui-card',
        'transition-all duration-200 hover:-translate-y-1 hover:shadow-xl active:scale-[0.97]',
        !product.available && 'opacity-50 cursor-not-allowed',
      ].filter(Boolean).join(' ')}
      style={{ borderRadius: 'var(--radius-2xl)' }}
      aria-label={product.name}
    >
      {/* ── Image area ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden" style={{ flex: '0 0 60%', minHeight: '160px' }}>
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center text-5xl"
            style={{ background: 'linear-gradient(135deg,var(--color-brand-surface),var(--color-brand-border))' }}
          >
            🍽
          </div>
        )}

        {/* Gradient overlay with product name */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 px-3 pb-3 pt-8">
          <h3 className="text-white font-bold font-brand text-sm lg:text-base leading-tight line-clamp-2 drop-shadow-sm">
            {product.name}
          </h3>
        </div>

        {/* Top badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 pointer-events-none">
          {product.popular && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold text-white"
              style={{ background: '#f59e0b', boxShadow: '0 2px 8px rgba(245,158,11,0.45)' }}>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              Popular
            </span>
          )}
          {!product.available && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-black/70 text-white">
              Unavailable
            </span>
          )}
        </div>

        {/* Dietary badges — top right */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 pointer-events-none">
          {product.isVeg && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
              style={{ background: '#16a34a' }}>V</span>
          )}
          {product.isVegan && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
              style={{ background: '#15803d' }}>VE</span>
          )}
          {product.isGlutenFree && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
              style={{ background: '#7c3aed' }}>GF</span>
          )}
        </div>

        {/* Calorie badge */}
        {product.calories != null && (
          <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold font-brand"
              style={{ background: 'rgba(0,0,0,0.60)', color: 'rgba(255,255,255,0.85)' }}>
              {product.calories} cal
            </span>
          </div>
        )}
      </div>

      {/* ── Bottom info area ───────────────────────────────────────── */}
      {/* price gets flex-1 min-w-0 so 3+ digit prices never push the button off */}
      <div className="flex items-center px-3 py-3 gap-2" style={{ flex: '1 1 auto' }}>
        <span
          className="font-extrabold font-brand text-sm leading-none flex-1 min-w-0"
          style={{ color: 'var(--color-brand-primary)' }}
        >
          {price}
        </span>

        {product.available ? (
          needsModal ? (
            <button
              onClick={handleAdd}
              aria-label={`Customize ${product.name}`}
              className="ui-btn-ghost flex items-center gap-1 px-3 py-2 text-xs font-semibold font-brand flex-shrink-0"
              style={{ minHeight: 'auto', borderRadius: 'var(--radius-xl)' }}
            >
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
              </svg>
              Customize
            </button>
          ) : (
            <button
              onClick={handleAdd}
              aria-label={`Add ${product.name} to cart`}
              className="ui-btn-primary flex items-center gap-1 px-3.5 py-2 text-xs font-semibold flex-shrink-0"
              style={{ minHeight: 'auto', borderRadius: 'var(--radius-xl)' }}
            >
              <svg aria-hidden="true" className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add
            </button>
          )
        ) : (
          <span
            className="text-xs font-brand px-3 py-2 rounded-xl flex-shrink-0"
            style={{ color: 'var(--color-brand-muted)', background: 'var(--color-brand-surface)' }}
          >
            Unavailable
          </span>
        )}
      </div>
    </article>
  );
}
