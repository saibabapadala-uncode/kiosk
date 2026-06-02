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
        background:     'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(6px)',
        padding:        '24px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        style={{
          background:    '#FFFFFF',
          borderRadius:  '24px',
          boxShadow:     '0 24px 64px rgba(0,0,0,0.22)',
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
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'linear-gradient(135deg,#F59E0B,#F97316)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px',
            boxShadow: '0 4px 14px rgba(245,158,11,0.35)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          </div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#111827', letterSpacing: '-0.02em' }}>
            Staff Access
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#6B7280' }}>
            Enter your 4-digit PIN to continue
          </p>
          {/* Hint shown only while the factory-default PIN has not been changed */}
          {staffPin === '1234' && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 10,
              background: '#FFFBEB', border: '1px solid #FDE68A',
              display: 'flex', alignItems: 'flex-start', gap: 7,
            }}>
              <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>⚠️</span>
              <p style={{ margin: 0, fontSize: '0.76rem', color: '#92400E', lineHeight: 1.45 }}>
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
            return (
              <div key={i} style={{
                width:        filled ? 18 : 14,
                height:       filled ? 18 : 14,
                borderRadius: '50%',
                background:   filled ? (error ? '#DC2626' : '#F59E0B') : 'transparent',
                border:       `2px solid ${filled ? (error ? '#DC2626' : '#F59E0B') : '#D1D5DB'}`,
                transition:   'all 150ms cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            );
          })}
        </div>

        {/* Error */}
        <div style={{ height: 18, display: 'flex', alignItems: 'center' }}>
          {error && (
            <p style={{ margin: 0, fontSize: '0.78rem', color: '#DC2626', fontWeight: 600 }}>
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
                  border: '1.5px solid #E5E7EB',
                  background: isBack ? '#F9FAFB' : '#FFFFFF',
                  color: '#111827',
                  fontWeight: isBack ? 500 : 700,
                  fontSize:   isBack ? '1.1rem' : '1.4rem',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'transform 100ms, background 100ms',
                  userSelect: 'none',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
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
            color: '#9CA3AF', fontWeight: 500,
            cursor: 'pointer', borderRadius: 8,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
