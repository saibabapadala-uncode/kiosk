// src/screens/CartScreen.tsx
// Full-page cart view — used on narrow screens or direct /cart navigation.
// Kiosk users primarily interact with CartDrawer; this is the routed fallback.
import { IonPage, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { formatPrice } from '@/utils/format';
import CartItem from '@/modules/cart/CartItem';
import CartSummary from '@/modules/cart/CartSummary';
import UpsellBanner from '@/modules/cart/UpsellBanner';

export default function CartScreen() {
  const { t }      = useTranslation();
  const history    = useHistory();
  const items      = useCartStore((s) => s.items);
  const total      = useCartStore((s) => s.total);
  const startOrder = useSessionStore((s) => s.startOrder);
  const orderState = useSessionStore((s) => s.orderState);

  function handleCheckout() {
    if (orderState === 'idle') startOrder();
    history.push('/tip');
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => history.push('/menu')} aria-label={t('cart.backToMenu')}>
              ← {t('catalog.allCategories')}
            </IonButton>
          </IonButtons>
          <IonTitle className="font-brand">{t('cart.yourOrder')}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen scrollY={items.length > 0}>
        <div className="flex flex-col min-h-full bg-brand-bg">
          {items.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center flex-1 py-20 px-8 text-center">
              <svg aria-hidden="true" className="w-20 h-20 text-brand-border mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 01-8 0" />
              </svg>
              <h2 className="text-xl font-bold font-brand text-brand-text mb-2">{t('cart.empty')}</h2>
              <p className="text-brand-muted font-brand mb-6">{t('cart.emptyHint')}</p>
              <button
                onClick={() => history.push('/menu')}
                className="px-10 py-4 rounded-brand bg-brand-primary text-white font-bold font-brand touch-target"
              >
                {t('cart.browseMenu')}
              </button>
            </div>
          ) : (
            <>
              {/* Item list */}
              <div className="px-4 pt-2">
                {items.map((item) => (
                  <CartItem key={item.cartItemId} item={item} />
                ))}
              </div>

              {/* Upsell */}
              <UpsellBanner />

              {/* Summary */}
              <div className="px-4 pt-4 pb-2">
                <CartSummary showTipPlaceholder />
              </div>

              {/* CTA */}
              <div className="px-4 pb-8 pt-2">
                <button
                  onClick={handleCheckout}
                  aria-label={t('cart.checkout', { total: formatPrice(total) })}
                  className="
                    w-full py-4 rounded-brand
                    bg-brand-primary text-white
                    text-lg font-bold font-brand
                    transition-all active:scale-95 touch-target
                    focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary
                  "
                >
                  {t('cart.checkout', { total: formatPrice(total) })}
                </button>
              </div>
            </>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
}
