// src/components/StaffPinModal.tsx
// Staff PIN gate for kiosk Settings access.
//
// Behaviour depends on staffPinEnabled (KioskSettings):
//   false (default) → bypass immediately; Settings always accessible after login.
//                     This is the correct starting state — staff enables PIN
//                     protection themselves once they've configured the device.
//   true            → show 4-digit numpad; wrong PIN shakes + clears.
//
// When PIN is disabled this component renders nothing and calls onSuccess()
// right away, so callers don't need any conditional logic.

import { useState, useEffect, useCallback } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { themeColors, themeRGBA } from '@/utils/themeColors';

const PIN_LENGTH = 4;

const PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['',  '0', '⌫'],
];

interface Props {
  isOpen:    boolean;
  onSuccess: () => void;
  onCancel:  () => void;
}

export default function StaffPinModal({ isOpen, onSuccess, onCancel }: Props) {
  const staffPinEnabled = useSettingsStore((s) => s.kiosk.staffPinEnabled);
  const staffPin        = useSettingsStore((s) => s.kiosk.staffPin);

  const [digits, setDigits] = useState('');
  const [shake,  setShake]  = useState(false);
  const [error,  setError]  = useState('');

  // If PIN protection is disabled, bypass immediately
  useEffect(() => {
    if (isOpen && !staffPinEnabled) {
      onSuccess();
    }
  }, [isOpen, staffPinEnabled, onSuccess]);

  // Reset state each time the modal opens
  useEffect(() => {
    if (isOpen && staffPinEnabled) {
      setDigits('');
      setError('');
      setShake(false);
    }
  }, [isOpen, staffPinEnabled]);

  const handleKey = useCallback((key: string) => {
    if (!isOpen || !staffPinEnabled) return;
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      setError('');
      return;
    }
    if (!/^\d$/.test(key)) return;

    setDigits((prev) => {
      const next = (prev + key).slice(0, PIN_LENGTH);
      if (next.length === PIN_LENGTH) {
        if (next === staffPin) {
          setTimeout(() => onSuccess(), 120);
        } else {
          setTimeout(() => {
            setShake(true);
            setError('Incorrect PIN — try again');
            setTimeout(() => { setShake(false); setDigits(''); }, 650);
          }, 80);
        }
      }
      return next;
    });
  }, [isOpen, staffPinEnabled, staffPin, onSuccess]);

  // Physical keyboard support
  useEffect(() => {
    if (!isOpen || !staffPinEnabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key))        handleKey(e.key);
      else if (e.key === 'Backspace') handleKey('⌫');
      else if (e.key === 'Escape')    onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, staffPinEnabled, handleKey, onCancel]);

  // Don't render anything when PIN gate is disabled or modal is closed
  if (!isOpen || !staffPinEnabled) return null;

  const overlayBg = 'var(--color-ui-overlay)';
  const bodyBg = themeColors.surface;
  const borderCol = themeColors.border;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Staff PIN entry"
      style={{
        position:       'fixed',
        inset:          0,
        zIndex:         9999,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        background:     overlayBg,
        backdropFilter: 'blur(6px)',
        padding:        '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background:    bodyBg,
          borderRadius:  '24px',
          boxShadow:     'var(--ui-shadow)',
          border:        `1px solid ${borderCol}`,
          padding:       '32px 28px 28px',
          width:         '100%',
          maxWidth:      '340px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '20px',
          animation:     shake ? 'pin-shake 550ms ease' : 'pin-appear 200ms ease',
        }}
      >
        <style>{`
          @keyframes pin-appear {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to   { opacity: 1; transform: scale(1)    translateY(0);   }
          }
          @keyframes pin-shake {
            0%,100% { transform: translateX(0);    }
            15%     { transform: translateX(-10px); }
            40%     { transform: translateX(9px);   }
            65%     { transform: translateX(-6px);  }
            85%     { transform: translateX(5px);   }
          }
          .pin-key:active { transform: scale(0.86) !important; }
        `}</style>

        {/* Header */}
        <div style={{ textAlign: 'center', width: '100%' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--gradient-cta)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 4px 14px rgba(var(--color-brand-primary-rgb),0.35)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: themeColors.text, letterSpacing: '-0.02em', fontFamily: 'var(--font-brand)' }}>
            Staff Access
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: themeColors.muted, fontFamily: 'var(--font-brand)' }}>
            Enter your 4-digit PIN to continue
          </p>
          {/* Hint shown only while the factory-default PIN has not been changed */}
          {staffPin === '1234' && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 12,
              background: themeRGBA('warning', 0.12), border: `1.5px solid ${themeRGBA('warning', 0.3)}`,
              display: 'flex', alignItems: 'flex-start', gap: 7,
              textAlign: 'left',
            }}>
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--color-brand-primary)', lineHeight: 1.45, fontFamily: 'var(--font-brand)' }}>
                Default PIN is active.&nbsp;
                <strong>Enter 1234</strong> to continue, then change it in
                Settings → Kiosk Behavior.
              </p>
            </div>
          )}
        </div>

        {/* Dot indicators */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < digits.length;
            const activeColor = error ? themeColors.error : themeColors.primary;
            return (
              <div key={i} style={{
                width:        filled ? 18 : 14,
                height:       filled ? 18 : 14,
                borderRadius: '50%',
                background:   filled ? activeColor : 'transparent',
                border:       `2px solid ${filled ? activeColor : themeColors.border}`,
                transition:   'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            );
          })}
        </div>

        {/* Error */}
        <div style={{ height: 18, display: 'flex', alignItems: 'center' }}>
          {error && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: themeColors.error, fontWeight: 600, fontFamily: 'var(--font-brand)' }}>
              {error}
            </p>
          )}
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, width: '100%' }}>
          {PAD_KEYS.flat().map((key, i) => {
            if (!key) return <div key={i} />;
            const isBack = key === '⌫';
            return (
              <button key={key + i} type="button" className="pin-key"
                onClick={() => handleKey(key)}
                aria-label={isBack ? 'Delete' : key}
                style={{
                  height: 64, borderRadius: 16,
                  border: `1.5px solid ${themeColors.border}`,
                  background: isBack ? themeColors.surfaceAlt : themeColors.surface,
                  color: themeColors.text,
                  fontWeight: isBack ? 500 : 700,
                  fontSize:   isBack ? '1.1rem' : '1.4rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 100ms, background 100ms',
                  userSelect: 'none',
                  boxShadow: 'var(--ui-card-shadow)',
                  fontFamily: 'var(--font-brand)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-primary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = themeColors.border;
                }}
              >
                {key}
              </button>
            );
          })}
        </div>

        {/* Cancel */}
        <button type="button" onClick={onCancel}
          style={{
            background: 'transparent', border: 'none',
            padding: '4px 16px', fontSize: '0.84rem',
            color: themeColors.muted, fontWeight: 500,
            cursor: 'pointer', borderRadius: 8,
            fontFamily: 'var(--font-brand)',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = themeColors.text; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = themeColors.muted; }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
