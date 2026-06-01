// src/screens/LoginScreen.tsx
// Kiosk login — 4 steps following the ext-store activation flow:
//
//  Step 1  email       → checkUser (verify account exists)
//  Step 2  password    → login → then auto-load stores
//  Step 3  stores      → show store list (skip if only 1, auto-select)
//  Step 4  channels    → show kiosk channels for selected store
//                         (filter by KIOSK_CHANNEL_TYPE_ID = 3880391793436453)
//                         (skip if only 1, auto-select → /attract)
//
// Loading states are shown as a full-card spinner between transitions.

import { IonPage, IonContent } from '@ionic/react';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useSettingsStore } from '@/store/settingsStore';
import { useKioskChannelStore, type KioskChannel } from '@/store/kioskChannelStore';
import { checkUser, login, getStoredCredentials } from '@/services/auth.service';
import { getStores, getKioskSalesChannels, type MerchantStore, type MerchantSalesChannel } from '@/services/store.service';
import { loadStoreDetails } from '@/services/storefront.service';
import { useStoreConfigStore } from '@/store/storeConfigStore';
import { logger } from '@/utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | 'email'
  | 'password'
  | 'loading'       // full-card spinner while fetching stores / channels
  | 'store-select'
  | 'channel-select';

// ─── Icons ─────────────────────────────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

// ─── Spinner ────────────────────────────────────────────────────────────────────

function Spinner({ size = 'md', variant = 'white' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'white' | 'amber' }) {
  const cls = size === 'sm' ? 'w-4 h-4 border-2' : size === 'lg' ? 'w-10 h-10 border-[3px]' : 'w-5 h-5 border-2';
  const style = variant === 'amber'
    ? { borderColor: '#FDE68A', borderTopColor: '#F59E0B' }
    : { borderColor: 'rgba(255,255,255,0.30)', borderTopColor: 'white' };
  return <div className={`${cls} rounded-full animate-spin`} style={style} />;
}

// ─── Reusable plain-text button (resets all Ionic CSS variable overrides) ──────

function TextBtn({
  onClick, children, className = '', style,
}: {
  onClick: () => void; children: React.ReactNode; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className}
      style={{
        background: 'transparent', border: 'none', padding: 0, margin: 0,
        boxShadow: 'none', outline: 'none', cursor: 'pointer',
        fontFamily: 'var(--font-brand)', lineHeight: 1,
        '--background': 'transparent', '--background-hover': 'transparent',
        '--background-activated': 'transparent', '--border-color': 'transparent',
        '--box-shadow': 'none',
        ...style,
      } as React.CSSProperties}
    >
      {children}
    </button>
  );
}

// ─── Selection card — white / amber active ─────────────────────────────────────

function SelectCard({
  title, subtitle, badge, onClick, selected = false,
}: {
  title: string; subtitle?: string; badge?: string;
  onClick: () => void; selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 text-left rounded-2xl px-4 py-3.5 transition-all active:scale-[0.97]"
      style={selected ? {
        background: 'linear-gradient(135deg, #F59E0B, #F97316)',
        border:     '2px solid #F59E0B',
        boxShadow:  '0 4px 16px rgba(245,158,11,0.30)',
      } : {
        background: '#FFFFFF',
        border:     '1.5px solid #E5E7EB',
        boxShadow:  '0 1px 3px rgba(0,0,0,0.06)',
      }}
    >
      {/* Selection indicator */}
      <div
        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
        style={selected ? {
          background: 'rgba(255,255,255,0.25)',
          border:     '2px solid rgba(255,255,255,0.70)',
        } : {
          border:     '1.5px solid #D1D5DB',
          background: 'transparent',
        }}
      >
        {selected && (
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round"
            stroke="white">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold font-brand text-sm leading-tight truncate"
          style={{ color: selected ? 'white' : '#111827' }}>
          {title}
        </p>
        {subtitle && (
          <p className="font-brand text-xs mt-0.5 truncate"
            style={{ color: selected ? 'rgba(255,255,255,0.75)' : '#6B7280' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Badge */}
      {badge && (
        <span
          className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={selected
            ? { background: 'rgba(255,255,255,0.20)', color: 'white' }
            : { background: '#F3F4F6', color: '#6B7280' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const history  = useHistory();
  const { environment } = useBrand();
  const logoUrl  = useSettingsStore((s) => s.theme.logoUrl);
  const { channel, setChannel } = useKioskChannelStore();

  // Skip to attract if session already resolved
  useEffect(() => { if (channel) history.replace('/attract'); }, [channel, history]);

  // ── Core form state ──────────────────────────────────────────────────────────
  const [step,           setStep]           = useState<Step>('email');
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [showPwd,        setShowPwd]        = useState(false);
  const [loading,        setLoading]        = useState(false);  // CTA button spinner
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error,          setError]          = useState('');
  const [hasSaved,       setHasSaved]       = useState(false);

  // ── Store / channel state ────────────────────────────────────────────────────
  const [stores,          setStores]          = useState<MerchantStore[]>([]);
  const [selectedStore,   setSelectedStore]   = useState<MerchantStore | null>(null);
  const [channels,        setChannels]        = useState<MerchantSalesChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<MerchantSalesChannel | null>(null);
  const [confirming,      setConfirming]      = useState(false);

  const emailRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  // Restore stored credentials
  useEffect(() => {
    getStoredCredentials().then((creds) => {
      if (creds) { setHasSaved(true); setEmail(creds.email); }
    });
  }, []);

  useEffect(() => { emailRef.current?.focus(); }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /**
   * Map a MerchantSalesChannel + its store → the KioskChannel shape stored in
   * kioskChannelStore.
   */
  const toKioskChannel = useCallback(
    (ch: MerchantSalesChannel, store: MerchantStore): KioskChannel => ({
      id:                    String(ch.id),
      name:                  ch.name,
      code:                  ch.code,
      store_id:              String(store.id),
      store_name:            store.name,
      store_code:            store.code ?? '',
      sales_channel_type_id: String(ch.sales_channel_type_id),
      store_address:         ch.address,
      is_active:             Boolean(ch.is_active),
    }),
    [],
  );

  const loadChannels = useCallback(
    async (store: MerchantStore) => {
      setStep('loading');
      setLoadingMessage('Loading kiosk channels…');
      setError('');

      let chs: MerchantSalesChannel[] = [];
      try {
        chs = await getKioskSalesChannels(store.id);
      } catch (err) {
        logger.error('[login] getKioskSalesChannels failed', err);
        setError('Failed to load kiosk channels. Please try again.');
        setStep('store-select');
        return;
      }

      if (chs.length === 0) {
        setError('No kiosk channels are configured for this store. Contact your administrator.');
        setStep('store-select');
        return;
      }

      if (chs.length === 1) {
        const kc = toKioskChannel(chs[0], store);
        setChannel(kc);
        if (kc.code) {
          useStoreConfigStore.getState().clear();
          void loadStoreDetails(kc.code).catch((err) =>
            logger.warn('[login] prefetch store details failed', err),
          );
        }
        history.replace('/attract');
        return;
      }

      setChannels(chs);
      setSelectedChannel(chs[0]);
      setStep('channel-select');
    },
    [history, setChannel, toKioskChannel],
  );

  const loadStores = useCallback(async () => {
    setStep('loading');
    setLoadingMessage('Loading your stores…');
    setError('');

    let fetchedStores: MerchantStore[] = [];
    try {
      fetchedStores = await getStores();
    } catch (err) {
      logger.error('[login] getStores failed', err);
      setError('Failed to load stores. Please check your connection and try again.');
      setStep('password');
      return;
    }

    if (fetchedStores.length === 0) {
      setError('No stores found for your account. Contact your administrator.');
      setStep('password');
      return;
    }

    if (fetchedStores.length === 1) {
      setSelectedStore(fetchedStores[0]);
      await loadChannels(fetchedStores[0]);
      return;
    }

    setStores(fetchedStores);
    setStep('store-select');
  }, [loadChannels]);

  const handleNext = useCallback(async () => {
    const trimmed = email.trim();
    if (!trimmed) { setError('Please enter your email or username.'); return; }
    setError('');
    setLoading(true);
    const result = await checkUser(trimmed);
    setLoading(false);
    if (result.exists) {
      setStep('password');
      setTimeout(() => passwordRef.current?.focus(), 100);
    } else {
      setError(result.error ?? 'User not found. Check your email or username.');
    }
  }, [email]);

  const handleLogin = useCallback(async () => {
    if (!password.trim()) { setError('Please enter your password.'); return; }
    setError('');
    setLoading(true);
    setLoadingMessage('Signing in…');

    const authResult = await login(email.trim(), password);
    setLoading(false);

    if (!authResult.success) {
      setError(authResult.error ?? 'Login failed. Please try again.');
      return;
    }

    await loadStores();
  }, [email, password, loadStores]);

  const handleStoreSelect = useCallback(
    async (store: MerchantStore) => {
      setSelectedStore(store);
      await loadChannels(store);
    },
    [loadChannels],
  );

  const handleChannelConfirm = useCallback(async () => {
    if (!selectedChannel || !selectedStore) return;
    setConfirming(true);
    const kc = toKioskChannel(selectedChannel, selectedStore);
    setChannel(kc);
    if (kc.code) {
      useStoreConfigStore.getState().clear();
      void loadStoreDetails(kc.code).catch((err) =>
        logger.warn('[login] prefetch store details failed', err),
      );
    }
    await new Promise((r) => setTimeout(r, 300));
    history.replace('/attract');
  }, [selectedChannel, selectedStore, setChannel, toKioskChannel, history]);

  const handleBackToEmail = useCallback(() => {
    setStep('email');
    setPassword('');
    setError('');
    setTimeout(() => emailRef.current?.focus(), 100);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (step === 'email')    void handleNext();
    if (step === 'password') void handleLogin();
  };

  const subHeading =
    step === 'email'          ? 'Sign in to manage this kiosk'   :
    step === 'password'       ? `Welcome back, ${email}`          :
    step === 'loading'        ? loadingMessage                    :
    step === 'store-select'   ? 'Select your store'               :
    /* channel-select */        'Select your kiosk channel';

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        {/* Warm white page background */}
        <div
          className="relative flex items-center justify-center w-full h-full overflow-hidden"
          style={{ background: 'linear-gradient(150deg, #FFFFFF 0%, #FFFBF0 60%, #FEF3C7 100%)' }}
        >
          {/* Decorative amber blobs */}
          <div aria-hidden="true" className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full animate-float"
              style={{ background: 'rgba(254,243,199,0.55)' }} />
            <div className="absolute -bottom-20 -left-12 w-72 h-72 rounded-full animate-float-slow"
              style={{ background: 'rgba(253,230,138,0.35)' }} />
            <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full animate-float-slower"
              style={{ background: 'rgba(254,215,170,0.25)' }} />
          </div>

          {/* White card */}
          <div
            className="relative z-10 flex flex-col items-center w-full max-w-md mx-4 animate-fade-in-up"
            style={{
              background:    '#FFFFFF',
              border:        '1px solid #E5E7EB',
              borderRadius:  '1.75rem',
              boxShadow:     '0 8px 40px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
            }}
          >
            {/* Brand header */}
            <div className="flex flex-col items-center px-8 pt-8 pb-5 w-full">
              {logoUrl ? (
                <img src={logoUrl} alt={environment.displayName}
                  className="h-12 w-auto object-contain mb-3 drop-shadow-sm"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
              ) : (
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white text-2xl font-brand mb-3"
                  style={{
                    background: 'linear-gradient(135deg, #F59E0B, #F97316)',
                    boxShadow:  '0 4px 16px rgba(245,158,11,0.30)',
                  }}
                >
                  {environment.displayName[0]}
                </div>
              )}
              <h1 className="text-2xl font-bold font-brand" style={{ color: '#111827' }}>
                {environment.displayName}
              </h1>
              <p className="text-sm font-brand mt-0.5 text-center" style={{ color: '#6B7280' }}>
                {subHeading}
              </p>
            </div>

            {/* Divider */}
            <div className="w-full px-8">
              <div style={{ height: '1px', background: '#F3F4F6' }} />
            </div>

            {/* Form body */}
            <div className="flex flex-col w-full px-8 py-6 gap-4">

              {/* Error banner */}
              {error && (
                <div
                  className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm font-brand animate-fade-in"
                  style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
                  role="alert"
                >
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  {error}
                </div>
              )}

              {/* ── STEP: email ──────────────────────────────────────────── */}
              {step === 'email' && (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="login-email"
                    className="text-xs font-semibold font-brand uppercase tracking-wider"
                    style={{ color: '#374151' }}>
                    Email or Username
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#9CA3AF' }}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <input
                      id="login-email" ref={emailRef} type="email" value={email}
                      onChange={(e) => { setEmail(e.target.value.replace(/\s/g, '')); setError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter email or username"
                      autoComplete="email" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                      className="w-full pl-10 pr-4 py-3.5 rounded-xl font-brand text-base focus:outline-none transition-colors"
                      style={{
                        background: '#F9FAFB',
                        border:     '1.5px solid #E5E7EB',
                        color:      '#111827',
                      }}
                    />
                  </div>
                  {hasSaved && email && (
                    <p className="text-xs font-brand flex items-center gap-1" style={{ color: '#6B7280' }}>
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      Stored credentials loaded
                    </p>
                  )}
                </div>
              )}

              {/* ── STEP: password ───────────────────────────────────────── */}
              {step === 'password' && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password"
                      className="text-xs font-semibold font-brand uppercase tracking-wider"
                      style={{ color: '#374151' }}>
                      Password
                    </label>
                    <TextBtn
                      onClick={handleBackToEmail}
                      className="text-xs hover:opacity-80 transition-opacity"
                      style={{ color: '#F59E0B', fontSize: '0.75rem', fontWeight: 600 } as React.CSSProperties}
                    >
                      ← Change user
                    </TextBtn>
                  </div>

                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: '#9CA3AF' }}>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                      </svg>
                    </div>
                    <input
                      id="login-password" ref={passwordRef}
                      type={showPwd ? 'text' : 'password'} value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      onKeyDown={handleKeyDown}
                      placeholder="Enter password" autoComplete="current-password"
                      className="w-full pl-10 pr-12 py-3.5 rounded-xl font-brand text-base focus:outline-none"
                      style={{
                        background: '#F9FAFB',
                        border:     '1.5px solid #E5E7EB',
                        color:      '#111827',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((v) => !v)}
                      aria-label={showPwd ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute', right: '0.875rem', top: '50%',
                        transform: 'translateY(-50%)', background: 'transparent',
                        border: 'none', padding: '0.25rem', margin: 0,
                        boxShadow: 'none', outline: 'none', cursor: 'pointer',
                        color: '#9CA3AF', lineHeight: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        '--background': 'transparent', '--background-hover': 'transparent',
                        '--background-activated': 'transparent', '--border-color': 'transparent',
                        '--box-shadow': 'none',
                      } as React.CSSProperties}
                    >
                      <EyeIcon open={showPwd} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: loading ─────────────────────────────────────────── */}
              {step === 'loading' && (
                <div className="flex flex-col items-center justify-center gap-4 py-6 animate-fade-in">
                  <Spinner size="lg" variant="amber" />
                  <p className="font-brand text-sm" style={{ color: '#374151' }}>{loadingMessage}</p>
                </div>
              )}

              {/* ── STEP: store-select ────────────────────────────────────── */}
              {step === 'store-select' && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  <p className="text-xs font-brand" style={{ color: '#6B7280' }}>
                    {stores.length} store{stores.length !== 1 ? 's' : ''} found
                  </p>
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto no-scrollbar">
                    {stores.map((store) => (
                      <SelectCard
                        key={store.id}
                        title={store.name}
                        subtitle={[store.code, store.address, store.city].filter(Boolean).join(' · ')}
                        onClick={() => void handleStoreSelect(store)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* ── STEP: channel-select ──────────────────────────────────── */}
              {step === 'channel-select' && selectedStore && (
                <div className="flex flex-col gap-3 animate-fade-in">
                  {/* Store context */}
                  <div
                    className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
                    style={{ background: '#F9FAFB', border: '1px solid #E5E7EB' }}
                  >
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                      style={{ color: '#9CA3AF' }}>
                      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span className="text-xs font-brand truncate flex-1" style={{ color: '#374151' }}>
                      {selectedStore.name}
                    </span>
                    <TextBtn
                      onClick={() => setStep('store-select')}
                      style={{ color: '#F59E0B', fontSize: '0.7rem', fontWeight: 600 } as React.CSSProperties}
                    >
                      Change
                    </TextBtn>
                  </div>

                  <p className="text-xs font-brand" style={{ color: '#6B7280' }}>
                    {channels.length} kiosk channel{channels.length !== 1 ? 's' : ''} available
                  </p>

                  <div className="flex flex-col gap-2 max-h-52 overflow-y-auto no-scrollbar">
                    {channels.map((ch) => {
                      const subtitle = ch.address
                        ? ch.address
                        : ch.description && ch.description !== ch.name
                          ? ch.description
                          : ch.code && ch.code !== ch.name
                            ? ch.code
                            : undefined;
                      return (
                        <SelectCard
                          key={String(ch.id)}
                          title={ch.name}
                          subtitle={subtitle}
                          badge={ch.code && ch.code !== ch.name ? ch.code : undefined}
                          selected={String(selectedChannel?.id) === String(ch.id)}
                          onClick={() => setSelectedChannel(ch)}
                        />
                      );
                    })}
                  </div>

                  <button
                    onClick={handleChannelConfirm}
                    disabled={!selectedChannel || confirming}
                    className="ui-btn-primary w-full py-4 text-base mt-1"
                    style={{
                      borderRadius: '0.875rem',
                      opacity: (!selectedChannel || confirming) ? 0.55 : 1,
                      cursor:  (!selectedChannel || confirming) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {confirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <Spinner size="sm" /> Launching…
                      </span>
                    ) : 'Launch Kiosk'}
                  </button>
                </div>
              )}

              {/* ── Primary CTA (email + password steps) ─────────────────── */}
              {(step === 'email' || step === 'password') && (
                <button
                  onClick={step === 'email' ? handleNext : handleLogin}
                  disabled={loading}
                  className="ui-btn-primary w-full py-4 text-base"
                  style={{ borderRadius: '0.875rem', opacity: loading ? 0.75 : 1 }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner /> {loadingMessage || (step === 'email' ? 'Checking…' : 'Signing in…')}
                    </span>
                  ) : step === 'email' ? 'Continue' : 'Sign In'}
                </button>
              )}
            </div>

            {/* Footer */}
            <div className="w-full px-8 pb-6 text-center">
              <p className="text-xs font-brand" style={{ color: '#9CA3AF' }}>
                Kiosk Application · {environment.displayName}
              </p>
            </div>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
}
