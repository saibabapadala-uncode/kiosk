// src/App.tsx
import { useEffect } from 'react';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Route, Redirect } from 'react-router-dom';

import { BrandProvider } from '@/providers/BrandProvider';
import KioskShell from '@/modules/kiosk/KioskShell';
import { ErrorBoundary } from '@/utils/errorBoundary';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';

import AttractScreen       from '@/screens/AttractScreen';
import CatalogScreen       from '@/screens/CatalogScreen';
import CartScreen          from '@/screens/CartScreen';
import TipScreen           from '@/screens/TipScreen';
import PaymentScreen       from '@/screens/PaymentScreen';
import OrderConfirmation   from '@/screens/OrderConfirmation';
import SettingsScreen      from '@/screens/SettingsScreen';
import LoginScreen         from '@/screens/LoginScreen';
import ChannelSelectScreen from '@/screens/ChannelSelectScreen';

setupIonicReact({ mode: 'md', animated: true, rippleEffect: true });

// ─── Bootstrap: restores persisted auth + channel before routing ──────────────

function AppBootstrap() {
  const bootstrapAuth        = useAuthStore((s) => s.bootstrap);
  const bootstrapChannel     = useKioskChannelStore((s) => s.bootstrap);
  const bootstrapStoreConfig = useStoreConfigStore((s) => s.bootstrap);

  useEffect(() => {
    void Promise.all([
      bootstrapAuth(),
      bootstrapChannel(),
      bootstrapStoreConfig(),
    ]);
  }, [bootstrapAuth, bootstrapChannel, bootstrapStoreConfig]);

  return null;
}

// ─── Root redirect — resolves landing route from auth + channel state ─────────

function RootRedirect() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const channel         = useKioskChannelStore((s) => s.channel);

  if (isBootstrapping) return null;             // wait for hydration
  if (!isAuthenticated) return <Redirect to="/login" />;
  if (!channel)         return <Redirect to="/channel-select" />;
  return <Redirect to="/attract" />;
}

// ─── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <BrandProvider>
        <IonApp>
          <IonReactRouter>
            <AppBootstrap />

            <KioskShell>
              <IonRouterOutlet>
                {/* Auth screens — no idle timer, no cart overlays */}
                <Route exact path="/login"          component={LoginScreen} />
                <Route exact path="/channel-select" component={ChannelSelectScreen} />

                {/* Kiosk flow */}
                <Route exact path="/attract"      component={AttractScreen} />
                <Route exact path="/menu"         component={CatalogScreen} />
                <Route exact path="/cart"         component={CartScreen} />
                <Route exact path="/tip"          component={TipScreen} />
                <Route exact path="/payment"      component={PaymentScreen} />
                <Route exact path="/confirmation" component={OrderConfirmation} />
                <Route exact path="/settings"     component={SettingsScreen} />

                {/* Auth-aware root */}
                <Route exact path="/" component={RootRedirect} />
              </IonRouterOutlet>
            </KioskShell>
          </IonReactRouter>
        </IonApp>
      </BrandProvider>
    </ErrorBoundary>
  );
}
