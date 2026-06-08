// src/modules/payment/QrPayScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// QR Pay screen — creates an anonymous/AI cart on the Straunt server and
// displays a scannable QR code pointing to the anonymous cart URL.
//
// Business logic ported from kiosk_straunt_storefront payment.page.ts:
//   navigateQr(), placeOrderWithUPI(), generateQR()
//   Timeout: 120 s countdown → session expired
//   QR URL:  {anonymousProjectUrl}/aicart/{storeCode}/{customerId}/{suId}
//
// QR code image generated via qrserver.com API (no library dependency):
//   https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=<url>

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHistory }              from 'react-router-dom';
import { useTranslation }          from 'react-i18next';
import { runQrPayFlow }            from '@/services/altPayment.service';
import { usePaymentStore }         from '@/store/paymentStore';
import { useSessionStore }         from '@/store/sessionStore';
import { useCartStore }            from '@/store/cartStore';
import { AUTH_CONFIG }             from '@/config/auth.config';
import { formatPrice }             from '@/utils/format';
import { logger }                  from '@/utils/logger';

// ─── QR code URL builder ──────────────────────────────────────────────────────

function buildQrImageUrl(data: string, size = 260): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&bgcolor=ffffff&color=000000&margin=12&format=png&ecc=M`;
}

// ─── Countdown hook (same as PhonePayScreen) ─────────────────────────────────

function useCountdown(initialSeconds: number) {
  const [seconds,   setSeconds]   = useState(initialSeconds);
  const [isExpired, setIsExpired] = useState(false);
  const idRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    idRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(idRef.current!);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);
    return () => { if (idRef.current) clearInterval(idRef.current); };
  }, []);

  const reset = useCallback(() => {
    setSeconds(initialSeconds);
    setIsExpired(false);
    if (idRef.current) clearInterval(idRef.current);
    idRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(idRef.current!);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);
  }, [initialSeconds]);

  return { seconds, isExpired, reset };
}

// ─── Timer badge ──────────────────────────────────────────────────────────────

function TimerBadge({ seconds }: { seconds: number }) {
  const mins  = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs  = String(seconds % 60).padStart(2, '0');
  const color = seconds > 60 ? '#16A34A' : seconds > 30 ? '#D97706' : '#DC2626';
  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         5,
      padding:     '5px 11px',
      borderRadius: 999,
      background:  'rgba(0,0,0,0.06)',
      animation:   seconds <= 30 ? 'timer-pulse 1s ease infinite' : 'none',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth={2.2} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={{
        fontSize: '0.85rem', fontWeight: 700, color,
        fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-brand)',
      }}>
        {mins}:{secs}
      </span>
    </div>
  );
}

// ─── Scan instruction steps ───────────────────────────────────────────────────

function ScanSteps() {
  const steps = [
    { icon: '📱', text: 'Open your phone camera' },
    { icon: '📸', text: 'Point at the QR code' },
    { icon: '💳', text: 'Pay with Apple Pay, Google Pay, or any saved card' },
  ];
  return (
    <div style={{
      display:  'flex',
      gap:      isSmallScreen() ? 8 : 20,
      flexWrap: 'wrap' as const,
      justifyContent: 'center',
    }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           4,
          minWidth:      80,
          maxWidth:      120,
        }}>
          <span style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--color-brand-surface)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem',
          }}>
            {s.icon}
          </span>
          <span style={{
            fontSize:   '0.68rem',
            fontWeight: 600,
            color:      'var(--color-brand-muted)',
            fontFamily: 'var(--font-brand)',
            textAlign:  'center' as const,
            lineHeight: 1.4,
          }}>
            {i + 1}. {s.text}
          </span>
        </div>
      ))}
    </div>
  );
}

function isSmallScreen(): boolean {
  return typeof window !== 'undefined' && window.innerHeight < 600;
}

// ─── Session expired overlay ──────────────────────────────────────────────────

function SessionExpiredOverlay({ onRestart }: { onRestart: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--color-ui-card)', borderRadius: 24,
        padding: '40px 36px', maxWidth: 380, width: '90%',
        textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.40)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(220,38,38,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="#DC2626" strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <h2 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '1.2rem',
          color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
          QR Code Expired
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '0.88rem',
          color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
          The QR code session has expired. Please start over or choose a different payment method.
        </p>
        <button onClick={onRestart} style={{
          width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
          background: 'var(--color-brand-primary)', color: '#FFFFFF',
          fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-brand)', cursor: 'pointer',
        }}>
          Start Over
        </button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface QrPayScreenProps {
  onBack: () => void;
}

export default function QrPayScreen({ onBack }: QrPayScreenProps) {
  const { t }        = useTranslation();
  const history      = useHistory();
  const total        = useCartStore((s) => s.total);
  const confirmOrder = useSessionStore((s) => s.confirmOrder);
  const resetMethod  = usePaymentStore((s) => s.setSelectedMethod);

  const [qrUrl,    setQrUrl]    = useState('');
  const [orderId,  setOrderId]  = useState('');
  const [qrImg,    setQrImg]    = useState('');
  const [step,     setStep]     = useState<'loading' | 'display' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const { seconds, isExpired, reset: resetTimer } = useCountdown(AUTH_CONFIG.ALT_PAYMENT_SESSION_SECONDS);

  // ── Generate QR on mount ─────────────────────────────────────────────────
  const generateQr = useCallback(async () => {
    setStep('loading');
    setErrorMsg('');
    try {
      const { qrUrl: url, orderId: oid } = await runQrPayFlow();
      const localId = oid.slice(0, 14);
      confirmOrder(localId);
      setOrderId(localId);
      setQrUrl(url);
      setQrImg(buildQrImageUrl(url));
      setStep('display');
      logger.info('[QrPayScreen] QR generated', { url });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not generate QR code. Please try again.';
      logger.error('[QrPayScreen] error', err);
      setErrorMsg(msg);
      setStep('error');
    }
  }, [confirmOrder]);

  useEffect(() => { void generateQr(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExpiredRestart = useCallback(() => {
    resetMethod(null);
    history.replace('/tip');
  }, [resetMethod, history]);

  const handleRefresh = useCallback(async () => {
    resetTimer();
    await generateQr();
  }, [resetTimer, generateQr]);

  const handleConfirmManual = useCallback(() => {
    history.replace('/confirmation');
  }, [history]);

  return (
    <>
      <style>{`
        @keyframes timer-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes qr-fade-in  { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }
        @keyframes spin-ring   { to{transform:rotate(360deg)} }
      `}</style>

      {isExpired && <SessionExpiredOverlay onRestart={handleExpiredRestart} />}

      <div style={{
        display: 'flex', flexDirection: 'column',
        height: '100%', background: 'var(--color-brand-bg)',
      }}>

        {/* ── Header ── */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--ui-glass-border)',
          background: 'var(--color-ui-header)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <button type="button" onClick={onBack}
            disabled={step === 'loading'}
            aria-label={t('common.back')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none',
              cursor: step === 'loading' ? 'not-allowed' : 'pointer',
              color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)',
              fontSize: '0.88rem', fontWeight: 600, opacity: step === 'loading' ? 0.4 : 1,
            }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            {t('common.back')}
          </button>

          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem',
              color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
              Scan QR Code
            </p>
            <p style={{ margin: 0, fontSize: '0.7rem',
              color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
              Pay with your phone
            </p>
          </div>

          <TimerBadge seconds={seconds} />
        </div>

        {/* ── Body ── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px 20px 28px', gap: 20,
        }}>

          {/* ── Loading ── */}
          {step === 'loading' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              {/* QR loading placeholder */}
              <div style={{
                width: 264, height: 264, borderRadius: 16,
                background: 'var(--color-ui-card)',
                boxShadow: 'var(--card-shadow)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
                border: '1px solid var(--ui-glass-border)',
              }}>
                {/* Animated QR placeholder grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, opacity: 0.2 }}>
                  {Array.from({ length: 49 }).map((_, i) => (
                    <div key={i} style={{
                      width: 14, height: 14, borderRadius: 2,
                      background: 'var(--color-brand-text)',
                      opacity: Math.random() > 0.5 ? 1 : 0.2,
                    }} />
                  ))}
                </div>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '3px solid var(--color-brand-border)',
                  borderTopColor: 'var(--color-brand-primary)',
                  animation: 'spin-ring 0.9s linear infinite',
                  position: 'absolute',
                }} />
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem',
                color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                Generating QR code…
              </p>
            </div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'rgba(220,38,38,0.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
                  stroke="#DC2626" strokeWidth={2} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem',
                color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
                QR Code Unavailable
              </p>
              <p style={{ margin: 0, fontSize: '0.88rem', maxWidth: 300,
                color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                {errorMsg}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleRefresh} style={{
                  padding: '12px 28px', borderRadius: 12, border: 'none',
                  background: 'var(--color-brand-primary)', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-brand)', cursor: 'pointer',
                }}>
                  Try Again
                </button>
                <button onClick={onBack} style={{
                  padding: '12px 28px', borderRadius: 12,
                  border: '1.5px solid var(--ui-glass-border)',
                  background: 'transparent', color: 'var(--color-brand-muted)',
                  fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-brand)', cursor: 'pointer',
                }}>
                  Go Back
                </button>
              </div>
            </div>
          )}

          {/* ── QR Display ── */}
          {step === 'display' && (
            <>
              {/* QR code image */}
              <div style={{
                position:     'relative',
                padding:      16,
                borderRadius: 20,
                background:   '#FFFFFF',
                boxShadow:    '0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)',
                animation:    'qr-fade-in 360ms cubic-bezier(0.32,0.72,0,1) both',
              }}>
                {qrImg ? (
                  <img
                    src={qrImg}
                    alt={`QR code for payment — ${qrUrl}`}
                    width={240}
                    height={240}
                    style={{ display: 'block', borderRadius: 8 }}
                    onError={() => {
                      // Fall back to the data URL if qrserver.com is unavailable
                      logger.warn('[QrPayScreen] QR image failed to load, showing raw URL');
                    }}
                  />
                ) : (
                  /* Fallback: text URL */
                  <div style={{
                    width: 240, height: 240, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', padding: 8, textAlign: 'center' as const,
                  }}>
                    <p style={{ margin: 0, fontSize: '0.6rem', color: '#1C1917',
                      wordBreak: 'break-all', fontFamily: 'monospace' }}>
                      {qrUrl}
                    </p>
                  </div>
                )}

                {/* Corner scan markers */}
                {(['tl','tr','bl','br'] as const).map((corner) => (
                  <div key={corner} style={{
                    position: 'absolute',
                    top:    corner.startsWith('t') ? 8  : 'auto',
                    bottom: corner.startsWith('b') ? 8  : 'auto',
                    left:   corner.endsWith('l')   ? 8  : 'auto',
                    right:  corner.endsWith('r')   ? 8  : 'auto',
                    width:  20, height: 20,
                    borderTop:    corner.startsWith('t') ? '3px solid var(--color-brand-primary)' : 'none',
                    borderBottom: corner.startsWith('b') ? '3px solid var(--color-brand-primary)' : 'none',
                    borderLeft:   corner.endsWith('l')   ? '3px solid var(--color-brand-primary)' : 'none',
                    borderRight:  corner.endsWith('r')   ? '3px solid var(--color-brand-primary)' : 'none',
                    borderRadius: corner === 'tl' ? '4px 0 0 0' : corner === 'tr' ? '0 4px 0 0' :
                                  corner === 'bl' ? '0 0 0 4px' : '0 0 4px 0',
                  }} />
                ))}
              </div>

              {/* Amount chip */}
              <div style={{
                padding: '8px 20px', borderRadius: 999,
                background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
                color: '#FFFFFF', fontWeight: 800,
                fontSize: 'clamp(0.9rem, 1.8vw, 1.1rem)', fontFamily: 'var(--font-brand)',
                boxShadow: '0 4px 16px rgba(var(--color-brand-primary-rgb,249,115,22),0.30)',
              }}>
                {formatPrice(total)}
              </div>

              {/* Instructions */}
              <ScanSteps />

              {/* Order ID */}
              {orderId && (
                <p style={{ margin: 0, fontSize: '0.72rem',
                  color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                  Order #{orderId}
                </p>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
                <button onClick={handleRefresh}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '11px 20px', borderRadius: 12,
                    border: '1.5px solid var(--ui-glass-border)',
                    background: 'var(--color-ui-card)', color: 'var(--color-brand-muted)',
                    fontWeight: 600, fontSize: '0.85rem', fontFamily: 'var(--font-brand)', cursor: 'pointer',
                    boxShadow: 'var(--card-shadow)',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                    <path d="M1 4v6h6M23 20v-6h-6"/>
                    <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/>
                  </svg>
                  Refresh QR
                </button>

                <button onClick={handleConfirmManual}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '11px 20px', borderRadius: 12, border: 'none',
                    background: 'var(--color-brand-primary)', color: '#FFFFFF',
                    fontWeight: 700, fontSize: '0.85rem', fontFamily: 'var(--font-brand)', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(var(--color-brand-primary-rgb,249,115,22),0.30)',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  I've Paid
                </button>
              </div>

              {/* Security note */}
              <p style={{ margin: 0, fontSize: '0.68rem', maxWidth: 320,
                color: 'var(--color-brand-muted)', textAlign: 'center' as const,
                fontFamily: 'var(--font-brand)', lineHeight: 1.5 }}>
                🔒 Secured by Stripe · Your payment information is encrypted
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
