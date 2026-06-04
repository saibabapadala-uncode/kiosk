// src/screens/ChannelSelectScreen.tsx
// Kiosk sales-channel selection — single-API flow.
//
// Flow
//   1. Call getKioskChannelsDirect() on mount
//      • 0 channels → error
//      • 1 channel  → auto-select → /attract
//      • N channels → show channel picker → confirm → /attract

import { IonPage, IonContent } from '@ionic/react';
import { useEffect, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useKioskName } from '@/hooks/useKioskName';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore, type KioskChannel } from '@/store/kioskChannelStore';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import {
  getKioskChannelsDirect,
  type MerchantSalesChannel,
} from '@/services/store.service';
import { loadStoreDetails } from '@/services/storefront.service';
import { logout } from '@/services/auth.service';
import { logger } from '@/utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'channel-select' | 'error';

// ─── Mapper ────────────────────────────────────────────────────────────────────

function toKioskChannel(ch: MerchantSalesChannel): KioskChannel {
  return {
    id:                    String(ch.id),
    name:                  ch.name,
    code:                  ch.code,
    store_id:              String(ch.store_id),
    store_name:            ch.store_name ?? ch.name,
    store_code:            ch.store_code ?? ch.code ?? '',
    sales_channel_type_id: String(ch.sales_channel_type_id),
    store_address:         ch.address,
    is_active:             Boolean(ch.is_active),
  };
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
        background: 'var(--gradient-cta)',
        border: '2px solid var(--color-brand-primary)',
        boxShadow: '0 8px 28px rgba(var(--color-brand-primary-rgb),0.32)',
      } : {
        background: 'var(--color-ui-card)',
        border: '1.5px solid var(--color-brand-border)',
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
      style={{ width: size, height: size, border: '3px solid var(--color-brand-surface)', borderTopColor: 'var(--color-brand-primary)' }} />
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function ChannelSelectScreen() {
  const history         = useHistory();
  const { environment } = useBrand();
  const kioskName       = useKioskName();
  const user            = useAuthStore((s) => s.user);
  const { setChannel, setAvailableChannels } = useKioskChannelStore();

  const [phase,      setPhase]      = useState<Phase>('loading');
  const [loadingMsg, setLoadingMsg] = useState('Loading kiosk channels…');
  const [error,      setError]      = useState('');

  const [channels,   setChannels]   = useState<KioskChannel[]>([]);
  const [selectedCh, setSelectedCh] = useState<KioskChannel | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ── Fetch channels ───────────────────────────────────────────────────────────
  const loadChannels = useCallback(async () => {
    setPhase('loading');
    setLoadingMsg('Loading kiosk channels…');
    setError('');

    try {
      const raw: MerchantSalesChannel[] = await getKioskChannelsDirect();

      if (raw.length === 0) {
        setError('No kiosk channels found for your account. Contact your administrator.');
        setPhase('error');
        return;
      }

      const mapped = raw.map(toKioskChannel);
      setChannels(mapped);
      setAvailableChannels(mapped);

      if (mapped.length === 1) {
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

  useEffect(() => { void loadChannels(); }, [loadChannels]);

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
  const stepLabel =
    phase === 'channel-select' ? 'Select Your Kiosk' :
    phase === 'loading'        ? loadingMsg            :
    'Setup Error';

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <div
          className="relative flex flex-col h-full overflow-hidden"
          style={{ background: 'linear-gradient(150deg, var(--color-brand-bg) 0%, var(--color-brand-surface) 60%, var(--color-brand-surface-alt) 100%)' }}
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
                <div className="w-1 h-4 rounded-full" style={{ background: 'var(--gradient-cta)' }} />
                <p className="text-xs font-brand font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  {kioskName} · Kiosk Setup
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
              style={{ background: 'var(--color-ui-card)', border: '1.5px solid var(--color-brand-border)', color: 'var(--color-brand-text)', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
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
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className="font-brand text-sm text-center max-w-sm" style={{ color: '#374151' }}>{error}</p>
                <button type="button" onClick={() => void loadChannels()}
                  className="ui-btn-primary px-6 py-3 text-sm" style={{ borderRadius: '0.875rem' }}>
                  Retry
                </button>
              </div>
            )}

            {/* ── Channel picker ─────────────────────────────────────────────── */}
            {phase === 'channel-select' && (
              <div className="flex flex-col flex-1 min-h-0 animate-fade-in-up">
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
