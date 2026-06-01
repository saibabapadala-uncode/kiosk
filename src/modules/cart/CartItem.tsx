// src/modules/cart/CartItem.tsx — visual layer only, all logic preserved
import { useCartStore, type CartItem as CartItemType } from '@/store/cartStore';
import { formatPrice } from '@/utils/format';

interface CartItemProps { item: CartItemType; }

export default function CartItem({ item }: CartItemProps) {
  const updateQty  = useCartStore((s) => s.updateQty);
  const removeItem = useCartStore((s) => s.removeItem);
  const modsSummary = item.modifiers.map((m) => m.name).join(', ');

  return (
    <article
      className="flex gap-3 py-3"
      style={{ borderBottom: '1px solid var(--ui-glass-border)' }}
      aria-label={item.name}
    >
      {/* Thumbnail */}
      <div
        className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden"
        style={{ background: 'var(--color-ui-surface-alt)', border: '1px solid var(--ui-glass-border)' }}
      >
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">🍽</div>
        )}
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold font-brand leading-tight line-clamp-1" style={{ color: 'var(--color-brand-text)' }}>
          {item.name}
        </p>
        {item.variant && (
          <p className="text-xs font-brand mt-0.5" style={{ color: 'var(--color-brand-muted)' }}>
            {item.variant.name}
          </p>
        )}
        {modsSummary && (
          <p className="text-xs font-brand mt-0.5 line-clamp-1" style={{ color: 'var(--color-brand-muted)' }}>
            {modsSummary}
          </p>
        )}

        {/* Qty stepper */}
        <div className="flex items-center gap-2 mt-2" role="group" aria-label={`Quantity for ${item.name}`}>
          <button
            onClick={() => updateQty(item.cartItemId, item.quantity - 1)}
            aria-label={item.quantity === 1 ? `Remove ${item.name}` : `Decrease quantity`}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'var(--color-ui-surface-alt)', border: '1px solid var(--ui-glass-border)', color: 'var(--color-brand-muted)' }}
          >
            {item.quantity === 1 ? (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" style={{ color: 'var(--color-brand-error)' }}>
                <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/>
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            )}
          </button>
          <span className="w-5 text-center text-sm font-bold font-brand tabular-nums" aria-live="polite" style={{ color: 'var(--color-brand-primary)' }}>
            {item.quantity}
          </span>
          <button
            onClick={() => updateQty(item.cartItemId, item.quantity + 1)}
            aria-label={`Increase quantity`}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
            style={{ background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))', color: 'white', border: 'none' }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Price + remove */}
      <div className="flex flex-col items-end justify-between flex-shrink-0">
        <button
          onClick={() => removeItem(item.cartItemId)}
          aria-label={`Remove ${item.name}`}
          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all active:scale-90"
          style={{ color: 'var(--color-brand-muted)' }}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <span className="text-sm font-bold font-brand tabular-nums" style={{ color: 'var(--color-brand-primary)' }}>
          {formatPrice(item.lineTotal)}
        </span>
      </div>
    </article>
  );
}
