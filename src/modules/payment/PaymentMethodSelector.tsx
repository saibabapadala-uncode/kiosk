// src/modules/payment/PaymentMethodSelector.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Premium kiosk payment-method picker.
//
// Designed for US restaurant / retail self-service kiosks:
//   • Three large touch-friendly cards (≥ 120 px height each)
//   • Spring-scale tap feedback (active:scale-95)
//   • Animated entrance (staggered card-in fade)
//   • Full light + dark mode via CSS vars
//   • Landscape: 3-col row  |  Portrait: vertically stacked
//   • ADA: role="radio" cards, aria-checked, visible focus ring
//   • Hides Phone Pay / QR Pay when brand has no altPayment config

import { useCallback }          from 'react';
import { useTranslation }       from 'react-i18next';
import { usePaymentStore }      from '@/store/paymentStore';
import { altPaymentAvailable }  from '@/services/altPayment.service';
import { formatPrice }          from '@/utils/format';
import { useCartStore }         from '@/store/cartStore';
import { useIsLandscape }       from '@/hooks/useOrientation';
import type { PaymentMethod }   from '@/types/altPayment';

// ─── Animated entrance keyframes ─────────────────────────────────────────────

const ANIM_CSS = `
  @keyframes pm-card-in {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
`;

// ─── Card Icon SVGs ───────────────────────────────────────────────────────────

function CardIcon({ size = 40 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="4" y="10" width="40" height="28" rx="5" stroke="currentColor" strokeWidth="2.5"/>
      <rect x="4" y="18" width="40" height="7" fill="currentColor" opacity="0.25"/>
      <rect x="10" y="30" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="24" y="30" width="6"  height="4" rx="1.5" fill="currentColor" opacity="0.45"/>
      {/* Chip */}
      <rect x="10" y="13" width="8" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.8"/>
      <line x1="10" y1="16" x2="18" y2="16" stroke="currentColor" strokeWidth="1.2"/>
      <line x1="14" y1="13" x2="14" y2="19" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function PhoneIcon({ size = 40 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none">
      <rect x="12" y="4" width="24" height="40" rx="5" stroke="currentColor" strokeWidth="2.5"/>
      <circle cx="24" cy="38" r="2" fill="currentColor" opacity="0.7"/>
      <rect x="18" y="9" width="12" height="3" rx="1.5" fill="currentColor" opacity="0.4"/>
      {/* Wireless / tap signal */}
      <path d="M30 22 Q33 19 33 24 Q33 29 30 26" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" opacity="0.6"/>
      <path d="M33 18 Q38 15 38 24 Q38 33 33 30" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" opacity="0.4"/>
      {/* Card outline on screen */}
      <rect x="16" y="16" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" opacity="0.8"/>
      <line x1="16" y1="21" x2="32" y2="21" stroke="currentColor" strokeWidth="1.4" opacity="0.5"/>
    </svg>
  );
}

function QrIcon({ size = 40 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 48 48" fill="none">
      {/* Top-left square */}
      <rect x="6"  y="6"  width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2.2"/>
      <rect x="10" y="10" width="6"  height="6"  rx="1" fill="currentColor"/>
      {/* Top-right square */}
      <rect x="28" y="6"  width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2.2"/>
      <rect x="32" y="10" width="6"  height="6"  rx="1" fill="currentColor"/>
      {/* Bottom-left square */}
      <rect x="6"  y="28" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="2.2"/>
      <rect x="10" y="32" width="6"  height="6"  rx="1" fill="currentColor"/>
      {/* Bottom-right dots */}
      <rect x="28" y="28" width="5" height="5" rx="1" fill="currentColor" opacity="0.8"/>
      <rect x="35" y="28" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="28" y="35" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
      <rect x="35" y="35" width="5" height="5" rx="1" fill="currentColor" opacity="0.9"/>
      {/* Scan line hint */}
      <line x1="6" y1="24" x2="20" y2="24" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2"/>
      <line x1="24" y1="6" x2="24" y2="20" stroke="currentColor" strokeWidth="2" strokeDasharray="3 2"/>
    </svg>
  );
}

// ─── Accepted-brands row ──────────────────────────────────────────────────────

function CardBrandsRow() {
  const logos = ['VISA', 'MC', 'AMEX', 'DISC'];
  const colors: Record<string, string> = {
    VISA: '#1A1F71', MC: '#EB001B', AMEX: '#2E77BC', DISC: '#FF6600',
  };
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, justifyContent: 'center' }}>
      {logos.map((l) => (
        <span key={l} style={{
          display:        'inline-flex',
          alignItems:     'center',
          justifyContent: 'center',
          height:         20,
          padding:        '0 6px',
          borderRadius:   4,
          background:     colors[l],
          color:          '#FFFFFF',
          fontSize:       '0.52rem',
          fontWeight:     900,
          letterSpacing:  '0.05em',
          fontFamily:     'var(--font-brand)',
          flexShrink:     0,
        }}>
          {l}
        </span>
      ))}
    </div>
  );
}

function PhoneBrandsRow() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
      {/* Apple Pay wordmark */}
      <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '-0.02em',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", var(--font-brand)',
        color: 'currentColor', opacity: 0.7, whiteSpace: 'nowrap' as const }}>
        Apple Pay
      </span>
      <span style={{ opacity: 0.4, fontSize: '0.6rem' }}>·</span>
      {/* Google Pay wordmark */}
      <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '-0.01em',
        fontFamily: '"Google Sans", Roboto, var(--font-brand)',
        color: 'currentColor', opacity: 0.7, whiteSpace: 'nowrap' as const }}>
        Google Pay
      </span>
    </div>
  );
}

// ─── Single method card ───────────────────────────────────────────────────────

interface MethodCardProps {
  id:           PaymentMethod;
  title:        string;
  description:  string;
  icon:         React.ReactNode;
  gradient:     string;
  accentRgb:    string;
  subRow?:      React.ReactNode;
  animDelay:    number;
  onSelect:     (m: PaymentMethod) => void;
  recommended?: boolean;
}

function MethodCard({
  id, title, description, icon, gradient, accentRgb,
  subRow, animDelay, onSelect, recommended,
}: MethodCardProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={false}
      aria-label={`Pay with ${title}`}
      onClick={() => onSelect(id)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            12,
        flex:           '1 1 0',
        minWidth:       0,
        minHeight:      150,
        padding:        '16px 12px 14px',
        borderRadius:   20,
        border:         '2px solid transparent',
        background:     'var(--color-ui-card)',
        boxShadow:      'var(--card-shadow)',
        cursor:         'pointer',
        position:       'relative',
        overflow:       'hidden',
        textAlign:      'center' as const,
        transition:     'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease',
        animation:      `pm-card-in 380ms cubic-bezier(0.32,0.72,0,1) ${animDelay}ms both`,
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform   = 'translateY(-4px) scale(1.01)';
        el.style.boxShadow   = `0 16px 40px rgba(${accentRgb},0.22), var(--card-shadow)`;
        el.style.borderColor = `rgba(${accentRgb},0.55)`;
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform   = '';
        el.style.boxShadow   = 'var(--card-shadow)';
        el.style.borderColor = 'transparent';
      }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.96)';
      }}
      onPointerUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = '';
      }}
      onPointerCancel={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = '';
      }}
    >
      {/* Gradient backdrop circle */}
      <div style={{
        position:   'absolute',
        top:        -30,
        insetInlineEnd: -30,
        width:      120,
        height:     120,
        borderRadius: '50%',
        background: gradient,
        opacity:    0.12,
        pointerEvents: 'none',
      }} />

      {/* "Best Choice" badge */}
      {recommended && (
        <span style={{
          position:     'absolute',
          top:          10,
          insetInlineStart: 10,
          padding:      '2px 8px',
          borderRadius: 999,
          background:   gradient,
          color:        '#FFFFFF',
          fontSize:     '0.58rem',
          fontWeight:   800,
          letterSpacing:'0.05em',
          textTransform:'uppercase' as const,
          fontFamily:   'var(--font-brand)',
        }}>
          Quick
        </span>
      )}

      {/* Icon circle */}
      <div style={{
        width:          56,
        height:         56,
        borderRadius:   '50%',
        background:     gradient,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
        boxShadow:      `0 8px 24px rgba(${accentRgb},0.30)`,
        color:          '#FFFFFF',
      }}>
        {icon}
      </div>

      {/* Title */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
        <span style={{
          fontWeight:    800,
          fontSize:      'clamp(0.95rem, 1.8vw, 1.1rem)',
          color:         'var(--color-brand-text)',
          lineHeight:    1.2,
          fontFamily:    'var(--font-brand)',
          letterSpacing: '-0.01em',
        }}>
          {title}
        </span>

        <span style={{
          fontSize:   'clamp(0.72rem, 1.3vw, 0.82rem)',
          color:      'var(--color-brand-muted)',
          lineHeight: 1.45,
          fontFamily: 'var(--font-brand)',
        }}>
          {description}
        </span>
      </div>

      {/* Sub-row: accepted brands / wallet logos */}
      {subRow && (
        <div style={{ width: '100%', color: `rgba(${accentRgb},0.8)` }}>
          {subRow}
        </div>
      )}

      {/* Bottom accent line */}
      <div style={{
        position:   'absolute',
        bottom:     0,
        left:       0,
        right:      0,
        height:     3,
        background: gradient,
        opacity:    0.6,
        borderRadius: '0 0 20px 20px',
      }} />
    </button>
  );
}

// ─── Main selector ────────────────────────────────────────────────────────────

interface PaymentMethodSelectorProps {
  /** Called when user taps Back on TipScreen */
  onBack?: () => void;
}

export default function PaymentMethodSelector({ onBack }: PaymentMethodSelectorProps) {
  const { t }             = useTranslation();
  const setMethod         = usePaymentStore((s) => s.setSelectedMethod);
  const resetPayment      = usePaymentStore((s) => s.reset);
  const total             = useCartStore((s) => s.total);
  const hasAltPay         = altPaymentAvailable();
  const isLandscape       = useIsLandscape();

  const select = useCallback((m: PaymentMethod) => {
    // Reset flowState to 'idle' before mounting the payment view.
    // Without this, a stale 'canceled'/'failed' flowState causes CardPayView's
    // navigation effect to fire on mount and immediately navigate away.
    resetPayment();
    setMethod(m);
  }, [resetPayment, setMethod]);

  const methods: MethodCardProps[] = [
    {
      id:          'card',
      title:       'Credit / Debit Card',
      description: 'Tap, insert, or swipe your card at the reader',
      icon:        <CardIcon size={34} />,
      gradient:    'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
      accentRgb:   'var(--color-brand-primary-rgb, 249,115,22)',
      subRow:      <CardBrandsRow />,
      animDelay:   40,
      recommended: true,
      onSelect:    select,
    },
    ...(hasAltPay ? [
      {
        id:          'phone' as PaymentMethod,
        title:       'Pay with Phone',
        description: 'Get a secure payment link via SMS',
        icon:        <PhoneIcon size={34} />,
        gradient:    'linear-gradient(135deg, #4F46E5, #7C3AED)',
        accentRgb:   '79,70,229',
        subRow:      <PhoneBrandsRow />,
        animDelay:   120,
        onSelect:    select,
      },
      {
        id:          'qr' as PaymentMethod,
        title:       'QR Code',
        description: 'Scan with your phone camera to pay',
        icon:        <QrIcon size={34} />,
        gradient:    'linear-gradient(135deg, #0D9488, #059669)',
        accentRgb:   '13,148,136',
        animDelay:   200,
        onSelect:    select,
      },
    ] : []),
  ];

  return (
    <>
      <style>{ANIM_CSS}</style>

      <div style={{
        display:        'flex',
        flexDirection:  'column',
        height:         '100%',
        background:     'var(--color-brand-bg)',
        overflow:       'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{
          flexShrink:   0,
          display:      'flex',
          alignItems:   'center',
          justifyContent:'space-between',
          padding:      '8px 16px',
          borderBottom: '1px solid var(--ui-glass-border)',
          background:   'var(--color-ui-header)',
          boxShadow:    '0 2px 12px rgba(0,0,0,0.06)',
        }}>
          {/* Back */}
          {onBack && (
            <button type="button" onClick={onBack}
              aria-label={t('common.back')}
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         6,
                background:  'none',
                border:      'none',
                cursor:      'pointer',
                color:       'var(--color-brand-muted)',
                fontFamily:  'var(--font-brand)',
                fontSize:    '0.88rem',
                fontWeight:  600,
                padding:     '8px 0',
                flexShrink:  0,
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
              {t('common.back')}
            </button>
          )}

          {/* Title */}
          <div style={{ textAlign: onBack ? 'center' : 'left', flex: 1, minWidth: 0 }}>
            <h1 style={{
              margin:      0,
              fontWeight:  800,
              fontSize:    'clamp(1rem, 2.2vw, 1.3rem)',
              color:       'var(--color-brand-text)',
              fontFamily:  'var(--font-brand)',
              letterSpacing: '-0.02em',
            }}>
              How would you like to pay?
            </h1>
            <p style={{
              margin:   '2px 0 0',
              fontSize: '0.8rem',
              color:    'var(--color-brand-muted)',
              fontFamily: 'var(--font-brand)',
            }}>
              🔒 All payments are secure &amp; encrypted
            </p>
          </div>

          {/* Step 2 of 3 badge */}
          <div style={{
            flexShrink:  0,
            display:     'flex',
            alignItems:  'center',
            gap:          4,
            padding:     '4px 10px',
            borderRadius: 999,
            background:  'var(--color-brand-badge-bg)',
            border:      '1px solid var(--ui-glass-border)',
          }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700,
              color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)',
              whiteSpace: 'nowrap' }}>
              Step 2 of 3
            </span>
          </div>

          {/* Total chip — reinforces the committed amount */}
          <div style={{
            flexShrink:   0,
            padding:      '7px 14px',
            borderRadius: 999,
            background:   'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
            color:        '#FFFFFF',
            fontWeight:   800,
            fontSize:     'clamp(0.85rem, 1.6vw, 1rem)',
            fontFamily:   'var(--font-brand)',
            letterSpacing:'-0.01em',
            boxShadow:    '0 4px 14px rgba(var(--color-brand-primary-rgb,249,115,22),0.30)',
          }}>
            {formatPrice(total)}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{
          flex:        1,
          overflowY:   'auto',
          display:     'flex',
          flexDirection:'column',
          alignItems:  'center',
          justifyContent: 'center',
          padding:     isLandscape ? '8px 24px' : '16px 16px',
          gap:         12,
        }}>

          {/* Prompt */}
          <p style={{
            margin:        '0 0 4px',
            fontWeight:    600,
            fontSize:      'clamp(0.85rem, 1.5vw, 1rem)',
            color:         'var(--color-brand-muted)',
            fontFamily:    'var(--font-brand)',
            letterSpacing: '0.02em',
            textTransform: 'uppercase' as const,
            textAlign:     'center' as const,
          }}>
            Choose payment method
          </p>

          {/* Method cards */}
          <div style={{
            display:             'grid',
            // Portrait: 1 col if only card; 3 col with alt pay on wide screens
            gridTemplateColumns: isLandscape
              ? `repeat(${methods.length}, 1fr)`
              : methods.length === 1
                ? '1fr'
                : `repeat(${Math.min(methods.length, 3)}, 1fr)`,
            gap:      isLandscape ? 16 : 12,
            width:    '100%',
            maxWidth: isLandscape ? 860 : 640,
          }}>
            {methods.map((m) => (
              <MethodCard key={m.id} {...m} />
            ))}
          </div>

          {/* Security footer */}
          <div style={{
            display:    'flex',
            alignItems: 'center',
            gap:        8,
            marginTop:  8,
            opacity:    0.6,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--color-brand-success)" strokeWidth={2} strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span style={{
              fontSize:   '0.72rem',
              color:      'var(--color-brand-muted)',
              fontFamily: 'var(--font-brand)',
            }}>
              All payments secured · PCI DSS compliant · 256-bit encryption
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
