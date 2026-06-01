// src/modules/cart/CartDrawer.tsx
import { useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cartStore';
import { useCartDrawerStore } from '@/store/cartDrawerStore';
import { useSessionStore } from '@/store/sessionStore';
import { formatPrice } from '@/utils/format';
import CartItem from './CartItem';
import CartSummary from './CartSummary';
import UpsellBanner from './UpsellBanner';

// ─── Floating cart button ──────────────────────────────────────────────────────

export function CartTriggerButton() {
  const open      = useCartDrawerStore((s) => s.open);
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));
  const total     = useCartStore((s) => s.total);

  if (itemCount === 0) return null;

  return (
    <button
      onClick={open}
      aria-label={`Open cart — ${itemCount} item${itemCount !== 1 ? 's' : ''}, ${formatPrice(total)}`}
      className="fixed bottom-8 right-8 z-[200] h-14 px-5 rounded-full text-white font-brand font-bold text-sm flex items-center gap-3 transition-all active:scale-95 animate-fade-in"
      style={{
        background:  'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
        boxShadow:   '0 8px 24px rgba(245,158,11,0.35)',
      }}
    >
      {/* Bag icon */}
      <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
        <line x1="3" y1="6" x2="21" y2="6"/>
        <path d="M16 10a4 4 0 01-8 0"/>
      </svg>
      <span>{itemCount} item{itemCount !== 1 ? 's' : ''}</span>
      <span className="border-l border-white/35 pl-3 tabular-nums">{formatPrice(total)}</span>
    </button>
  );
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyCart({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'var(--color-ui-surface-alt)', border: '1px solid var(--ui-glass-border)' }}
      >
        <svg aria-hidden="true" className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--color-brand-muted)' }}>
          <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 01-8 0"/>
        </svg>
      </div>
      <p className="text-lg font-bold font-brand mb-1" style={{ color: 'var(--color-brand-text)' }}>
        Your cart is empty
      </p>
      <p className="text-sm font-brand mb-6" style={{ color: 'var(--color-brand-muted)' }}>
        Add some items to get started
      </p>
      <button
        onClick={onClose}
        className="ui-btn-primary px-8 text-sm"
        style={{ padding: '0.75rem 2rem' }}
      >
        Browse Menu
      </button>
    </div>
  );
}

// ─── Drawer ────────────────────────────────────────────────────────────────────

export default function CartDrawer() {
  const { t } = useTranslation();
  const { isOpen, close } = useCartDrawerStore();
  const items       = useCartStore((s) => s.items);
  const itemCount   = items.reduce((n, i) => n + i.quantity, 0);
  const total       = useCartStore((s) => s.total);
  const startOrder  = useSessionStore((s) => s.startOrder);
  const orderState  = useSessionStore((s) => s.orderState);
  const history     = useHistory();

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  function handleCheckout() {
    if (orderState === 'idle') startOrder();
    close();
    history.push('/tip');
  }

  return (
    <>
      {/* Full-screen container */}
      <div
        className={[
          'fixed inset-0 z-[9000]',
          isOpen ? 'pointer-events-auto' : 'pointer-events-none',
        ].join(' ')}
        aria-hidden={!isOpen}
      >
        {/* Backdrop */}
        <div
          className={['absolute inset-0 transition-opacity duration-300', isOpen ? 'opacity-100' : 'opacity-0'].join(' ')}
          onClick={close}
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          aria-label="Close cart"
        />

        {/* Panel */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Your cart"
          className={[
            'absolute right-0 top-0 h-full flex flex-col',
            'w-full sm:max-w-sm lg:max-w-[440px]',
            'transition-transform duration-300 ease-in-out',
            isOpen ? 'translate-x-0' : 'translate-x-full',
          ].join(' ')}
          style={{
            background:    'var(--color-ui-card)',
            borderLeft:    '1px solid var(--ui-glass-border)',
            boxShadow:     'var(--ui-shadow)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--ui-glass-border)' }}
          >
            <div>
              <h2 className="text-lg font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
                {t('cart.yourOrder')}
              </h2>
              {itemCount > 0 && (
                <p className="text-xs font-brand" style={{ color: 'var(--color-brand-muted)' }}>
                  {t('cart.itemCount', { count: itemCount })}
                </p>
              )}
            </div>
            <button
              onClick={close}
              aria-label="Close cart"
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-ui-surface-alt)', color: 'var(--color-brand-muted)' }}
            >
              <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Content */}
          {items.length === 0 ? (
            <EmptyCart onClose={close} />
          ) : (
            <>
              <div className="flex-1 overflow-y-auto">
                {/* Items */}
                <div className="px-4 py-2">
                  {items.map((item) => (
                    <CartItem key={item.cartItemId} item={item} />
                  ))}
                </div>
                {/* Upsell */}
                <UpsellBanner />
              </div>

              {/* Footer */}
              <div
                className="flex-shrink-0 px-5 py-4"
                style={{ borderTop: '1px solid var(--ui-glass-border)', background: 'var(--color-ui-card)' }}
              >
                <CartSummary showTipPlaceholder className="mb-4" />
                <button
                  onClick={handleCheckout}
                  aria-label={`Checkout — ${formatPrice(total)}`}
                  className="ui-btn-primary w-full py-4 text-base"
                  style={{ borderRadius: 'var(--radius-2xl)' }}
                >
                  {t('cart.checkout', { total: formatPrice(total) })}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
