// src/screens/ChannelSelectScreen.tsx
// Kiosk sales-channel selection — displays data from the live API.
//
// Flow
//   1. Fetch stores  (getStores)
//      • 0 stores → error
//      • 1 store  → skip store-select, go straight to step 2
//      • N stores → show store picker
//   2. Fetch kiosk channels for the chosen store  (getKioskSalesChannels)
//      • 0 channels → error (with "pick a different store" option when N > 1)
//      • 1 channel  → auto-select → /attract
//      • N channels → show channel picker
//   3. Confirm → /attract
//
// No static / mock data is used.  The entire response chain comes from
// store.service.ts which hits the live gateway API.

import { IonPage, IonContent } from '@ionic/react';
import { useEffect, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore, type KioskChannel } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import {
  getStores, getKioskSalesChannels,
  type MerchantStore, type MerchantSalesChannel,
} from '@/services/store.service';
import { loadStoreDetails } from '@/services/storefront.service';
import { logout } from '@/services/auth.service';
import { logger } from '@/utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'store-select' | 'channel-select' | 'error';

// ─── Mapper ────────────────────────────────────────────────────────────────────

function toKioskChannel(ch: MerchantSalesChannel, store: MerchantStore): KioskChannel {
  return {
    id:                    String(ch.id),
    name:                  ch.name,
    code:                  ch.code,
    store_id:              String(store.id),
    store_name:            store.name,
    store_code:            store.code ?? '',
    sales_channel_type_id: String(ch.sales_channel_type_id),
    store_address:         ch.address,
    is_active:             Boolean(ch.is_active),
  };
}

// ─── Store card ────────────────────────────────────────────────────────────────

function StoreCard({
  store, selected, onSelect,
}: {
  store: MerchantStore; selected: boolean; onSelect: () => void;
}) {
  const subtitle = [store.code, store.city, store.state].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex items-center gap-4 w-full text-left rounded-2xl p-4 transition-all duration-150 active:scale-[0.97]"
      style={selected ? {
        background: 'linear-gradient(135deg,#F59E0B,#F97316)',
        border: '2px solid #F59E0B',
        boxShadow: '0 8px 28px rgba(245,158,11,0.32)',
      } : {
        background: '#FFFFFF',
        border: '1.5px solid #E5E7EB',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
        style={selected ? { background: 'rgba(255,255,255,0.22)' } : { background: '#F8F9FA', border: '1px solid #E5E7EB' }}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          style={{ color: selected ? 'white' : '#6B7280' }}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-bold font-brand text-base leading-tight truncate"
          style={{ color: selected ? 'white' : '#111827' }}>
          {store.name}
        </p>
        {subtitle && (
          <p className="text-sm font-brand mt-0.5 truncate"
            style={{ color: selected ? 'rgba(255,255,255,0.75)' : '#6B7280' }}>
            {subtitle}
          </p>
        )}
        {store.address && (
          <p className="text-xs font-brand mt-1 flex items-center gap-1 truncate"
            style={{ color: selected ? 'rgba(255,255,255,0.60)' : '#9CA3AF' }}>
            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {store.address}
          </p>
        )}
      </div>

      {/* Check */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
        style={selected
          ? { borderColor: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.22)' }
          : { borderColor: '#D1D5DB', background: 'transparent' }}>
        {selected && (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Channel card ──────────────────────────────────────────────────────────────

function ChannelCard({
  channel, selected, onSelect,
}: {
  channel: KioskChannel; selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex items-start gap-4 w-full text-left rounded-2xl p-4 transition-all duration-150 active:scale-[0.97]"
      style={selected ? {
        background: 'linear-gradient(135deg,#F59E0B,#F97316)',
        border: '2px solid #F59E0B',
        boxShadow: '0 8px 28px rgba(245,158,11,0.32)',
      } : {
        background: '#FFFFFF',
        border: '1.5px solid #E5E7EB',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center"
        style={selected ? { background: 'rgba(255,255,255,0.22)' } : { background: '#F8F9FA', border: '1px solid #E5E7EB' }}>
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          style={{ color: selected ? 'white' : '#6B7280' }}>
          <rect x="2" y="3" width="20" height="14" rx="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-bold font-brand text-base leading-tight truncate"
          style={{ color: selected ? 'white' : '#111827' }}>
          {channel.name}
        </p>
        <p className="text-sm font-brand mt-0.5 truncate"
          style={{ color: selected ? 'rgba(255,255,255,0.78)' : '#6B7280' }}>
          {channel.store_name}
        </p>
        {channel.store_address && (
          <p className="text-xs font-brand mt-1 flex items-center gap-1 truncate"
            style={{ color: selected ? 'rgba(255,255,255,0.60)' : '#9CA3AF' }}>
            <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
            {channel.store_address}
          </p>
        )}

        {/* Status */}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: channel.is_active ? '#22C55E' : '#D1D5DB' }} />
          <span className="text-xs font-brand"
            style={{ color: channel.is_active
              ? (selected ? 'rgba(255,255,255,0.85)' : '#15803D')
              : (selected ? 'rgba(255,255,255,0.55)' : '#9CA3AF') }}>
            {channel.is_active ? 'Online & Ready' : 'Offline'}
          </span>
          {channel.code && channel.code !== channel.name && (
            <span className="text-xs font-brand ml-1.5"
              style={{ color: selected ? 'rgba(255,255,255,0.45)' : '#D1D5DB' }}>
              · {channel.code}
            </span>
          )}
        </div>
      </div>

      {/* Check */}
      <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
        style={selected
          ? { borderColor: 'rgba(255,255,255,0.55)', background: 'rgba(255,255,255,0.22)' }
          : { borderColor: '#D1D5DB', background: 'transparent' }}>
        {selected && (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>
    </button>
  );
}

// ─── Spinner ───────────────────────────────────────────────────────────────────

function Spinner({ size = 48 }: { size?: number }) {
  return (
    <div className="animate-spin rounded-full flex-shrink-0"
      style={{ width: size, height: size, border: '3px solid #FDE68A', borderTopColor: '#F59E0B' }} />
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ChannelSelectScreen() {
  const history          = useHistory();
  const { environment }  = useBrand();
  const user             = useAuthStore((s) => s.user);
  const { setChannel, setAvailableChannels } = useKioskChannelStore();

  const [phase,          setPhase]          = useState<Phase>('loading');
  const [loadingMsg,     setLoadingMsg]     = useState('Loading your stores…');
  const [error,          setError]          = useState('');

  const [stores,         setStores]         = useState<MerchantStore[]>([]);
  const [selectedStore,  setSelectedStore]  = useState<MerchantStore | null>(null);

  const [channels,       setChannels]       = useState<KioskChannel[]>([]);
  const [selectedCh,     setSelectedCh]     = useState<KioskChannel | null>(null);
  const [confirming,     setConfirming]     = useState(false);

  // ── Step 2: fetch channels for a store ──────────────────────────────────────
  const loadChannels = useCallback(async (store: MerchantStore) => {
    setPhase('loading');
    setLoadingMsg(`Loading kiosk channels for ${store.name}…`);
    setError('');

    try {
      const raw: MerchantSalesChannel[] = await getKioskSalesChannels(store.id);

      if (raw.length === 0) {
        setError(`No kiosk channels found for ${store.name}. Please choose a different store or contact your administrator.`);
        setPhase('error');
        return;
      }

      const mapped = raw.map((ch) => toKioskChannel(ch, store));
      setChannels(mapped);
      setAvailableChannels(mapped);

      if (mapped.length === 1) {
        // Auto-select single channel
        const only = mapped[0];
        setChannel(only);
        if (only.code) {
          useStoreConfigStore.getState().clear();
          void loadStoreDetails(only.code).catch((e) =>
            logger.warn('[channel-select] prefetch store details failed', e),
          );
        }
        history.replace('/attract');
        return;
      }

      setSelectedCh(mapped[0]);
      setPhase('channel-select');
    } catch (err) {
      logger.error('[channel-select] loadChannels failed', err);
      setError('Failed to load kiosk channels. Please check your connection and try again.');
      setPhase('error');
    }
  }, [history, setAvailableChannels, setChannel]);

  // ── Step 1: fetch stores ─────────────────────────────────────────────────────
  const loadStores = useCallback(async () => {
    setPhase('loading');
    setLoadingMsg('Loading your stores…');
    setError('');

    try {
      const fetched = await getStores();

      if (fetched.length === 0) {
        setError('No stores found for your account. Contact your administrator.');
        setPhase('error');
        return;
      }

      if (fetched.length === 1) {
        setSelectedStore(fetched[0]);
        await loadChannels(fetched[0]);
        return;
      }

      setStores(fetched);
      setPhase('store-select');
    } catch (err) {
      logger.error('[channel-select] loadStores failed', err);
      setError('Failed to load stores. Please check your connection and try again.');
      setPhase('error');
    }
  }, [loadChannels]);

  useEffect(() => { void loadStores(); }, [loadStores]);

  // ── Confirm channel ──────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!selectedCh) return;
    setConfirming(true);
    setChannel(selectedCh);
    if (selectedCh.code) {
      useStoreConfigStore.getState().clear();
      void loadStoreDetails(selectedCh.code).catch((e) =>
        logger.warn('[channel-select] prefetch store details failed', e),
      );
    }
    await new Promise((r) => setTimeout(r, 350));
    history.replace('/attract');
  }, [selectedCh, setChannel, history]);

  // ── Sign out ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => { logout(); history.replace('/login'); }, [history]);

  // ── Derived label ─────────────────────────────────────────────────────────────
  const stepLabel = phase === 'store-select'
    ? 'Select Your Store'
    : phase === 'channel-select'
      ? 'Select Your Kiosk'
      : phase === 'loading'
        ? loadingMsg
        : 'Setup Error';

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div
          className="relative flex flex-col h-full overflow-hidden"
          style={{ background: 'linear-gradient(150deg, #FFFFFF 0%, #FFFBF0 60%, #FEF3C7 100%)' }}
        >
          {/* Decorative blobs */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full animate-float"
              style={{ background: 'rgba(254,243,199,0.55)' }} />
            <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full animate-float-slow"
              style={{ background: 'rgba(253,230,138,0.35)' }} />
          </div>

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div
            className="relative z-10 flex items-center justify-between px-6 pt-8 pb-5 flex-shrink-0"
            style={{ borderBottom: '1px solid #E5E7EB', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(12px)' }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg,#F59E0B,#F97316)' }} />
                <p className="text-xs font-brand font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  {environment.displayName} · Kiosk Setup
                </p>
              </div>
              <h1 className="text-2xl font-bold font-brand" style={{ color: '#111827' }}>
                {stepLabel}
              </h1>
              {user && (
                <p className="text-sm font-brand mt-0.5" style={{ color: '#6B7280' }}>
                  Signed in as&nbsp;
                  <span className="font-semibold" style={{ color: '#374151' }}>{user.name}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3.5 py-2 rounded-xl text-sm font-semibold font-brand transition-colors"
              style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              Sign Out
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div className="relative z-10 flex flex-col flex-1 min-h-0 px-6 pb-6 pt-5">

            {/* Loading */}
            {phase === 'loading' && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 animate-fade-in">
                <Spinner />
                <p className="font-brand text-sm text-center max-w-xs" style={{ color: '#374151' }}>
                  {loadingMsg}
                </p>
              </div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className="font-brand text-sm text-center max-w-sm" style={{ color: '#374151' }}>{error}</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => void loadStores()}
                    className="ui-btn-primary px-6 py-3 text-sm" style={{ borderRadius: '0.875rem' }}>
                    Retry
                  </button>
                  {stores.length > 1 && (
                    <button type="button" onClick={() => setPhase('store-select')}
                      className="px-6 py-3 text-sm font-semibold font-brand rounded-xl"
                      style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', color: '#374151' }}>
                      Choose Different Store
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Store picker ──────────────────────────────────────────────── */}
            {phase === 'store-select' && (
              <div className="flex flex-col flex-1 min-h-0 animate-fade-in-up">
                <p className="text-sm font-brand mb-4 flex-shrink-0" style={{ color: '#6B7280' }}>
                  {stores.length} store{stores.length !== 1 ? 's' : ''} available — select the one to configure
                </p>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                  {stores.map((store) => (
                    <StoreCard
                      key={String(store.id)}
                      store={store}
                      selected={String(selectedStore?.id) === String(store.id)}
                      onSelect={() => setSelectedStore(store)}
                    />
                  ))}
                </div>

                <div className="mt-5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => selectedStore && void loadChannels(selectedStore)}
                    disabled={!selectedStore}
                    className="ui-btn-primary w-full py-4 text-base"
                    style={{
                      borderRadius: '1rem',
                      opacity: !selectedStore ? 0.45 : 1,
                      cursor:  !selectedStore ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {selectedStore ? `Continue with "${selectedStore.name}"` : 'Select a store to continue'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Channel picker ─────────────────────────────────────────────── */}
            {phase === 'channel-select' && (
              <div className="flex flex-col flex-1 min-h-0 animate-fade-in-up">

                {/* Back to store picker (only if multiple stores) */}
                {stores.length > 1 && selectedStore && (
                  <div className="flex items-center gap-2 mb-4 flex-shrink-0">
                    <button type="button" onClick={() => setPhase('store-select')}
                      className="flex items-center gap-1.5 text-xs font-semibold font-brand"
                      style={{ background: 'transparent', border: 'none', color: '#F59E0B', cursor: 'pointer', padding: 0 }}>
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                        <polyline points="15 18 9 12 15 6"/>
                      </svg>
                      Change Store
                    </button>
                    <span className="text-xs font-brand" style={{ color: '#9CA3AF' }}>
                      · {selectedStore.name}
                    </span>
                  </div>
                )}

                <p className="text-sm font-brand mb-4 flex-shrink-0" style={{ color: '#6B7280' }}>
                  {channels.length} kiosk channel{channels.length !== 1 ? 's' : ''} available — choose one to launch
                </p>

                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                  {channels.map((ch) => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      selected={selectedCh?.id === ch.id}
                      onSelect={() => setSelectedCh(selectedCh?.id === ch.id ? null : ch)}
                    />
                  ))}
                </div>

                <div className="mt-5 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleConfirm()}
                    disabled={!selectedCh || confirming}
                    className="ui-btn-primary w-full py-4 text-base"
                    style={{
                      borderRadius: '1rem',
                      opacity: (!selectedCh || confirming) ? 0.45 : 1,
                      cursor:  (!selectedCh || confirming) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {confirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Launching…
                      </span>
                    ) : selectedCh ? (
                      `Launch "${selectedCh.name}"`
                    ) : (
                      'Select a kiosk to continue'
                    )}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
