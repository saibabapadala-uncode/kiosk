// src/screens/ChannelSelectScreen.tsx
// Kiosk Sales Channel selection screen.
// - Fetches available kiosk channels for the authenticated user.
// - Auto-selects if exactly one channel is found.
// - Shows a premium picker UI if multiple channels are available.
// - Stores the selected channel → navigates to /attract.
//
// When the real backend API is ready, ONLY kioskChannel.service.ts needs
// to change — this screen, the store, and the routing stay the same.

import { IonPage, IonContent } from '@ionic/react';
import { useEffect, useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore, type KioskChannel } from '@/store/kioskChannelStore';
import { getKioskChannels } from '@/services/kioskChannel.service';
import { logout } from '@/services/auth.service';

// ─── Channel card — white base, amber when selected ───────────────────────────

function ChannelCard({
  channel,
  selected,
  onSelect,
}: {
  channel: KioskChannel;
  selected: boolean;
  onSelect: (c: KioskChannel) => void;
}) {
  return (
    <button
      onClick={() => onSelect(channel)}
      aria-label={`Select ${channel.name}`}
      aria-pressed={selected}
      className="flex flex-col text-left w-full rounded-2xl p-5 transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 focus-visible:outline-none"
      style={selected ? {
        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
        border:     '2px solid #F59E0B',
        boxShadow:  '0 8px 32px rgba(245,158,11,0.35)',
      } : {
        background: '#FFFFFF',
        border:     '1.5px solid #E5E7EB',
        boxShadow:  '0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-start justify-between gap-3 w-full">
        {/* Icon */}
        <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center"
          style={selected
            ? { background: 'rgba(255,255,255,0.22)' }
            : { background: '#F8F9FA', border: '1px solid #E5E7EB' }}>
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
            style={{ color: selected ? 'rgba(255,255,255,0.80)' : '#6B7280' }}>
            {channel.store_name}
          </p>
          {channel.store_address && (
            <p className="text-xs font-brand mt-1 flex items-center gap-1"
              style={{ color: selected ? 'rgba(255,255,255,0.65)' : '#9CA3AF' }}>
              <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {channel.store_address}
            </p>
          )}
        </div>

        {/* Selection check */}
        <div className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center"
          style={selected
            ? { borderColor: 'rgba(255,255,255,0.60)', background: 'rgba(255,255,255,0.22)' }
            : { borderColor: '#D1D5DB', background: 'transparent' }}>
          {selected && (
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          )}
        </div>
      </div>

      {/* Status row */}
      <div className="flex items-center gap-1.5 mt-3">
        <div className="w-2 h-2 rounded-full" style={{ background: channel.is_active ? '#22C55E' : '#D1D5DB' }} />
        <span className="text-xs font-brand"
          style={{ color: channel.is_active
            ? (selected ? 'rgba(255,255,255,0.85)' : '#15803D')
            : (selected ? 'rgba(255,255,255,0.55)' : '#9CA3AF') }}>
          {channel.is_active ? 'Online & Ready' : 'Offline'}
        </span>
        {channel.store_code && (
          <span className="text-xs font-brand ml-2"
            style={{ color: selected ? 'rgba(255,255,255,0.45)' : '#D1D5DB' }}>
            · {channel.store_code}
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ChannelSelectScreen() {
  const history  = useHistory();
  const { environment } = useBrand();
  const user     = useAuthStore((s) => s.user);
  const { setChannel, setAvailableChannels, availableChannels } = useKioskChannelStore();

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [selected,   setSelected]   = useState<KioskChannel | null>(null);
  const [confirming, setConfirming] = useState(false);

  // ── Fetch channels on mount ────────────────────────────────────────────────
  const fetchChannels = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const channels = await getKioskChannels();
      setAvailableChannels(channels);

      if (channels.length === 0) {
        setError('No kiosk sales channels are available for your account. Contact your administrator.');
        setLoading(false);
        return;
      }

      if (channels.length === 1) {
        setChannel(channels[0]);
        history.replace('/attract');
        return;
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to load kiosk channels. Please check your connection.');
      setLoading(false);
    }
  }, [history, setAvailableChannels, setChannel]);

  useEffect(() => { void fetchChannels(); }, [fetchChannels]);

  // ── Confirm selection ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    if (!selected) return;
    setConfirming(true);
    setChannel(selected);
    await new Promise((r) => setTimeout(r, 400));
    history.replace('/attract');
  }, [selected, setChannel, history]);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    logout();
    history.replace('/login');
  }, [history]);

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        {/* Light background */}
        <div
          className="relative flex flex-col h-full overflow-hidden"
          style={{ background: 'linear-gradient(150deg, #FFFFFF 0%, #FFFBF0 60%, #FEF3C7 100%)' }}
        >

          {/* Decorative amber blobs */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full animate-float"
              style={{ background: 'rgba(254,243,199,0.55)' }} />
            <div className="absolute -bottom-16 -left-10 w-64 h-64 rounded-full animate-float-slow"
              style={{ background: 'rgba(253,230,138,0.35)' }} />
          </div>

          {/* Header */}
          <div
            className="relative z-10 flex items-center justify-between px-6 pt-8 pb-5 flex-shrink-0"
            style={{ borderBottom: '1px solid #E5E7EB', background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(12px)' }}
          >
            <div>
              {/* Amber accent label */}
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1 h-4 rounded-full" style={{ background: 'linear-gradient(180deg, #F59E0B, #F97316)' }} />
                <p className="text-xs font-brand font-semibold uppercase tracking-widest" style={{ color: '#9CA3AF' }}>
                  {environment.displayName} · Kiosk Setup
                </p>
              </div>
              <h1 className="text-2xl font-bold font-brand" style={{ color: '#111827' }}>
                Select Your Kiosk
              </h1>
              {user && (
                <p className="text-sm font-brand mt-0.5" style={{ color: '#6B7280' }}>
                  Signed in as&nbsp;<span className="font-semibold" style={{ color: '#374151' }}>{user.name}</span>
                </p>
              )}
            </div>
            <button
              onClick={handleLogout}
              aria-label="Sign out"
              className="px-3.5 py-2 rounded-xl text-sm font-semibold font-brand transition-colors"
              style={{ background: '#FFFFFF', border: '1.5px solid #E5E7EB', color: '#374151', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              Sign Out
            </button>
          </div>

          {/* Content */}
          <div className="relative z-10 flex flex-col flex-1 overflow-hidden px-6 pb-6 pt-5">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 animate-fade-in">
                <div className="w-12 h-12 rounded-full animate-spin"
                  style={{ border: '3px solid #FDE68A', borderTopColor: '#F59E0B' }} />
                <p className="font-brand text-sm" style={{ color: '#374151' }}>
                  Loading your kiosk channels…
                </p>
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="flex flex-col items-center justify-center flex-1 gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={1.5}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className="font-brand text-center max-w-sm" style={{ color: '#374151' }}>{error}</p>
                <button onClick={fetchChannels} className="ui-btn-primary px-8 py-3 text-sm" style={{ borderRadius: '0.875rem' }}>
                  Retry
                </button>
              </div>
            )}

            {/* Channel picker */}
            {!loading && !error && availableChannels.length > 1 && (
              <div className="flex flex-col flex-1 min-h-0 animate-fade-in-up">
                <p className="text-sm font-brand mb-4" style={{ color: '#6B7280' }}>
                  {availableChannels.length} kiosk channels available — choose one to launch
                </p>

                {/* Channel list */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pr-1">
                  {availableChannels.map((ch) => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      selected={selected?.id === ch.id}
                      onSelect={(c) => setSelected(selected?.id === c.id ? null : c)}
                    />
                  ))}
                </div>

                {/* Confirm CTA */}
                <div className="mt-5 flex-shrink-0">
                  <button
                    onClick={handleConfirm}
                    disabled={!selected || confirming}
                    className="ui-btn-primary w-full py-4 text-base"
                    style={{
                      borderRadius: '1rem',
                      opacity: (!selected || confirming) ? 0.45 : 1,
                      cursor:  (!selected || confirming) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {confirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Launching…
                      </span>
                    ) : selected ? (
                      `Launch "${selected.name}"`
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
