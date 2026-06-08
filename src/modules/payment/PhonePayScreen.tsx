// src/modules/payment/PhonePayScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Phone Pay screen — collects a 10-digit US mobile number, sends it to the
// Straunt gateway to obtain a customer access key, then places a kiosk order
// that triggers an SMS payment link (Apple Pay / Google Pay).
//
// Business logic ported from kiosk_straunt_storefront payment.page.ts:
//   navigateUPI(), placeOrderWithPhoneNumber(), navigateToOrderSumary()
//   Validation: /^[0-9]\d{9}$/.test(digits)
//   Timeout: 120 s countdown → session expired popup

import { useState, useEffect, useCallback, useRef } from 'react';
import { useHistory }                from 'react-router-dom';
import { useTranslation }            from 'react-i18next';
import { runPhonePayFlow }           from '@/services/altPayment.service';
import { usePaymentStore }           from '@/store/paymentStore';
import { useSessionStore }           from '@/store/sessionStore';
import { useCartStore }              from '@/store/cartStore';
import { AUTH_CONFIG }               from '@/config/auth.config';
import { formatPrice }               from '@/utils/format';
import { logger }                    from '@/utils/logger';

// ─── Countdown hook ───────────────────────────────────────────────────────────

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

  const stop = useCallback(() => {
    if (idRef.current) { clearInterval(idRef.current); idRef.current = null; }
  }, []);

  return { seconds, isExpired, stop };
}

// ─── Timer badge ──────────────────────────────────────────────────────────────

function TimerBadge({ seconds }: { seconds: number }) {
  const mins  = String(Math.floor(seconds / 60)).padStart(2, '0');
  const secs  = String(seconds % 60).padStart(2, '0');
  const color =
    seconds > 60 ? '#16A34A'   // green
  : seconds > 30 ? '#D97706'   // amber
  :                '#DC2626';  // red

  return (
    <div style={{
      display:     'flex',
      alignItems:  'center',
      gap:         5,
      padding:     '5px 11px',
      borderRadius: 999,
      background:  `rgba(0,0,0,0.06)`,
      animation:   seconds <= 30 ? 'timer-pulse 1s ease infinite' : 'none',
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={color} strokeWidth={2.2} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span style={{
        fontSize:      '0.85rem',
        fontWeight:    700,
        color,
        fontVariantNumeric: 'tabular-nums',
        fontFamily:    'var(--font-brand)',
      }}>
        {mins}:{secs}
      </span>
    </div>
  );
}

// ─── US phone formatter ───────────────────────────────────────────────────────

/** Format raw digit string as (XXX) XXX-XXXX */
function formatUSPhone(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3)  return d.length ? `(${d}` : '';
  if (d.length <= 6)  return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ─── Large kiosk keypad ───────────────────────────────────────────────────────

const KEYS: Array<{ label: string; value: string; special?: 'delete' | 'confirm' }> = [
  { label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' },
  { label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' },
  { label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' },
  { label: '⌫', value: 'del', special: 'delete' },
  { label: '0', value: '0' },
  { label: '→', value: 'confirm', special: 'confirm' },
];

interface KeypadProps {
  onDigit:   (d: string) => void;
  onDelete:  () => void;
  onConfirm: () => void;
  canConfirm: boolean;
}

function Keypad({ onDigit, onDelete, onConfirm, canConfirm }: KeypadProps) {
  return (
    <div style={{
      display:             'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap:                 10,
      width:               '100%',
      maxWidth:            320,
      margin:              '0 auto',
    }}>
      {KEYS.map((key) => {
        const isConfirm = key.special === 'confirm';
        const isDelete  = key.special === 'delete';
        const disabled  = isConfirm && !canConfirm;

        return (
          <button
            key={key.value}
            type="button"
            disabled={disabled}
            aria-label={isDelete ? 'Delete' : isConfirm ? 'Confirm' : key.label}
            onClick={() => {
              if (isDelete)  { onDelete();  return; }
              if (isConfirm) { onConfirm(); return; }
              onDigit(key.value);
            }}
            style={{
              height:         64,
              borderRadius:   14,
              border:         isConfirm
                ? `2px solid ${disabled ? 'var(--color-brand-border)' : 'var(--color-brand-primary)'}`
                : '2px solid var(--ui-glass-border)',
              background:     isConfirm
                ? (disabled
                  ? 'var(--color-brand-surface)'
                  : 'var(--color-brand-primary)')
                : 'var(--color-ui-card)',
              color:          isConfirm
                ? (disabled ? 'var(--color-brand-muted)' : '#FFFFFF')
                : isDelete
                  ? 'var(--color-brand-error)'
                  : 'var(--color-brand-text)',
              fontWeight:     700,
              fontSize:       isConfirm || isDelete ? '1.3rem' : '1.5rem',
              fontFamily:     'var(--font-brand)',
              cursor:         disabled ? 'not-allowed' : 'pointer',
              boxShadow:      disabled || isDelete ? 'none' : 'var(--card-shadow)',
              transition:     'all 130ms ease',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
            }}
            onPointerDown={(e) => {
              if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.94)';
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
            }}
            onPointerCancel={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = '';
            }}
          >
            {key.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Expired overlay ──────────────────────────────────────────────────────────

function SessionExpiredOverlay({ onRestart }: { onRestart: () => void }) {
  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         9000,
      background:     'rgba(0,0,0,0.72)',
      backdropFilter: 'blur(6px)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background:   'var(--color-ui-card)',
        borderRadius: 24,
        padding:      '40px 36px',
        maxWidth:     380,
        width:        '90%',
        textAlign:    'center',
        boxShadow:    '0 24px 64px rgba(0,0,0,0.40)',
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
          Session Expired
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '0.88rem',
          color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
          Your payment session has timed out. Please start over.
        </p>
        <button onClick={onRestart}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'var(--color-brand-primary)', color: '#FFFFFF',
            fontWeight: 700, fontSize: '1rem', fontFamily: 'var(--font-brand)',
            cursor: 'pointer',
          }}>
          Start Over
        </button>
      </div>
    </div>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

interface PhonePayScreenProps {
  onBack: () => void;
}

export default function PhonePayScreen({ onBack }: PhonePayScreenProps) {
  const { t }          = useTranslation();
  const history        = useHistory();
  const total          = useCartStore((s) => s.total);
  const confirmOrder   = useSessionStore((s) => s.confirmOrder);
  const resetMethod    = usePaymentStore((s) => s.setSelectedMethod);

  const [digits,     setDigits]     = useState('');
  const [step,       setStep]       = useState<'input' | 'processing' | 'success' | 'error'>('input');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [successId,  setSuccessId]  = useState('');

  const { seconds, isExpired, stop } = useCountdown(AUTH_CONFIG.ALT_PAYMENT_SESSION_SECONDS);
  const canConfirm = digits.length === 10;

  // ── Auto-navigate to confirmation after success ───────────────────────────
  useEffect(() => {
    if (step !== 'success') return;
    const tid = setTimeout(() => {
      history.replace('/confirmation');
    }, 2_800);
    return () => clearTimeout(tid);
  }, [step, history]);

  // ── Session expired → back to method selector ─────────────────────────────
  const handleExpiredRestart = useCallback(() => {
    resetMethod(null);
    history.replace('/tip');
  }, [resetMethod, history]);

  // ── Keypad handlers ───────────────────────────────────────────────────────
  const handleDigit  = useCallback((d: string) => {
    setDigits((prev) => prev.length < 10 ? prev + d : prev);
  }, []);

  const handleDelete = useCallback(() => {
    setDigits((prev) => prev.slice(0, -1));
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!canConfirm) return;
    stop();
    setStep('processing');
    setErrorMsg('');
    try {
      const { orderId } = await runPhonePayFlow(digits);
      const localId = orderId.slice(0, 14);
      confirmOrder(localId);
      setSuccessId(localId);
      setStep('success');
      logger.info('[PhonePayScreen] success', { orderId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed. Please try again.';
      logger.error('[PhonePayScreen] error', err);
      setErrorMsg(msg);
      setStep('error');
    }
  }, [canConfirm, digits, stop, confirmOrder]);

  // ── Retry from error ──────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    setDigits('');
    setErrorMsg('');
    setStep('input');
  }, []);

  return (
    <>
      <style>{`
        @keyframes timer-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes success-pop {
          0%   { transform: scale(0.7); opacity: 0; }
          70%  { transform: scale(1.08); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      {isExpired && <SessionExpiredOverlay onRestart={handleExpiredRestart} />}

      <div style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        background:    'var(--color-brand-bg)',
      }}>

        {/* ── Header ── */}
        <div style={{
          flexShrink:    0,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          padding:       '14px 20px',
          borderBottom:  '1px solid var(--ui-glass-border)',
          background:    'var(--color-ui-header)',
          boxShadow:     '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <button type="button" onClick={onBack}
            disabled={step === 'processing'}
            aria-label={t('common.back')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: 'none', border: 'none', cursor: step === 'processing' ? 'not-allowed' : 'pointer',
              color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)',
              fontSize: '0.88rem', fontWeight: 600, opacity: step === 'processing' ? 0.4 : 1,
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
              Pay with Phone
            </p>
            <p style={{ margin: 0, fontSize: '0.7rem',
              color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
              Apple Pay · Google Pay
            </p>
          </div>

          <TimerBadge seconds={seconds} />
        </div>

        {/* ── Body ── */}
        <div style={{
          flex:          1,
          overflowY:     'auto',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          justifyContent:'center',
          padding:       '20px 20px 28px',
          gap:           20,
        }}>

          {/* ── Success state ── */}
          {step === 'success' && (
            <div style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'center',
              gap:           16,
              textAlign:     'center',
              animation:     'success-pop 400ms cubic-bezier(0.175,0.885,0.32,1.275) forwards',
            }}>
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'var(--color-brand-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 12px 32px rgba(22,163,74,0.35)',
              }}>
                <svg width="44" height="44" viewBox="0 0 48 48" fill="none"
                  stroke="white" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="10,24 20,34 38,14"/>
                </svg>
              </div>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.4rem',
                color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
                Payment Link Sent!
              </h2>
              <p style={{ margin: 0, fontSize: '0.92rem', maxWidth: 320,
                color: 'var(--color-brand-muted)', lineHeight: 1.55, fontFamily: 'var(--font-brand)' }}>
                We've sent a secure payment link to{' '}
                <strong style={{ color: 'var(--color-brand-text)' }}>
                  {formatUSPhone(digits)}
                </strong>
                .<br/>Open it on your phone to complete your payment.
              </p>
              {successId && (
                <div style={{
                  padding: '8px 20px', borderRadius: 999,
                  background: 'var(--color-brand-badge-bg)',
                  color: 'var(--color-brand-muted)', fontSize: '0.75rem', fontFamily: 'var(--font-brand)',
                }}>
                  Order #{successId}
                </div>
              )}
              <p style={{ fontSize: '0.78rem', color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                Redirecting in a moment…
              </p>
            </div>
          )}

          {/* ── Processing state ── */}
          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                border: '4px solid var(--color-brand-border)',
                borderTopColor: 'var(--color-brand-primary)',
                animation: 'spin-ring 0.9s linear infinite',
              }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '0.95rem',
                color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                Sending payment link…
              </p>
              <p style={{ margin: 0, fontSize: '0.78rem',
                color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                Please wait
              </p>
            </div>
          )}

          {/* ── Error state ── */}
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
                Unable to Send Link
              </p>
              <p style={{ margin: 0, fontSize: '0.88rem', maxWidth: 300,
                color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
                {errorMsg}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={handleRetry} style={{
                  padding: '12px 28px', borderRadius: 12, border: 'none',
                  background: 'var(--color-brand-primary)', color: '#FFFFFF',
                  fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-brand)',
                  cursor: 'pointer',
                }}>
                  Try Again
                </button>
                <button onClick={onBack} style={{
                  padding: '12px 28px', borderRadius: 12,
                  border: '1.5px solid var(--ui-glass-border)',
                  background: 'transparent', color: 'var(--color-brand-muted)',
                  fontWeight: 600, fontSize: '0.9rem', fontFamily: 'var(--font-brand)',
                  cursor: 'pointer',
                }}>
                  Go Back
                </button>
              </div>
            </div>
          )}

          {/* ── Input state ── */}
          {step === 'input' && (
            <>
              {/* Instruction */}
              <p style={{ margin: 0, textAlign: 'center', fontSize: '0.88rem', maxWidth: 300,
                color: 'var(--color-brand-muted)', lineHeight: 1.55, fontFamily: 'var(--font-brand)' }}>
                Enter your US mobile number to receive a secure payment link
              </p>

              {/* Phone display */}
              <div style={{
                width:         '100%',
                maxWidth:      320,
                padding:       '16px 20px',
                borderRadius:  16,
                background:    'var(--color-ui-card)',
                boxShadow:     'var(--card-shadow)',
                border:        digits.length === 10
                  ? '2px solid var(--color-brand-primary)'
                  : '2px solid var(--ui-glass-border)',
                display:       'flex',
                alignItems:    'center',
                gap:           10,
                transition:    'border-color 200ms ease',
              }}>
                {/* US flag + code */}
                <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>🇺🇸</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-brand-muted)',
                  fontFamily: 'var(--font-brand)', flexShrink: 0, fontWeight: 600 }}>
                  +1
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display:       'block',
                    fontSize:      'clamp(1.1rem, 2.5vw, 1.4rem)',
                    fontWeight:    700,
                    color:         digits.length > 0 ? 'var(--color-brand-text)' : 'var(--color-brand-border)',
                    fontFamily:    'var(--font-brand)',
                    letterSpacing: '0.06em',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {digits.length > 0 ? formatUSPhone(digits) : '(___) ___-____'}
                  </span>
                </div>
                {/* Blinking cursor */}
                {step === 'input' && digits.length < 10 && (
                  <div style={{
                    width: 2, height: 22, background: 'var(--color-brand-primary)',
                    borderRadius: 1, flexShrink: 0,
                    animation: 'cursor-blink 1s ease-in-out infinite',
                  }} />
                )}
              </div>

              {/* Order total hint */}
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-brand-muted)',
                fontFamily: 'var(--font-brand)', textAlign: 'center' }}>
                Total due: <strong style={{ color: 'var(--color-brand-primary)' }}>
                  {formatPrice(total)}
                </strong>
              </p>

              {/* Keypad */}
              <Keypad
                onDigit={handleDigit}
                onDelete={handleDelete}
                onConfirm={handleConfirm}
                canConfirm={canConfirm}
              />

              {/* Privacy note */}
              <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--color-brand-muted)',
                textAlign: 'center', maxWidth: 300, fontFamily: 'var(--font-brand)' }}>
                Your number is used only to send a one-time payment link and will not be stored.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
