// src/modules/payment/TipScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Tip Selection — Step 1 of the two-screen checkout flow.
//
// Portrait  : stacked column — tip cards → optional numpad → summary → CTA
// Landscape : two-column split — left = tip cards + numpad
//                                right = order summary + CTA
//
// On "Continue": commits the tip to cartStore, transitions sessionStore to
// 'payment', then navigates to /payment (the method selector).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback, useMemo } from 'react';
import { useHistory }        from 'react-router-dom';
import { useTranslation }    from 'react-i18next';
import { useCartStore }      from '@/store/cartStore';
import { useSessionStore }   from '@/store/sessionStore';
import { useIsLandscape }    from '@/hooks/useOrientation';
import { formatPrice }       from '@/utils/format';

type TipOption = '15' | '18' | '20' | 'custom' | 'none';

// ─── ATM numpad ───────────────────────────────────────────────────────────────

const PAD_ROWS = [[7, 8, 9], [4, 5, 6], [1, 2, 3]] as const;

function NumPad({ centValue, onPress, onBackspace, onClear }: {
  centValue: number;
  onPress: (d: number) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const dollars = (centValue / 100).toFixed(2);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-xs mx-auto">
      {/* Display */}
      <div
        aria-live="polite"
        className="w-full py-3 px-6 text-center text-3xl font-bold font-brand tracking-wider"
        style={{
          background:   'var(--color-ui-surface-alt)',
          borderRadius: 'var(--radius-2xl)',
          color:        'var(--color-brand-primary)',
          border:       '2px solid var(--color-brand-primary)',
          boxShadow:    '0 0 0 4px rgba(245,158,11,0.10)',
        }}
      >
        ${dollars}
      </div>

      {/* Digits */}
      <div className="grid grid-cols-3 gap-2 w-full">
        {PAD_ROWS.flat().map((d) => (
          <button key={d} onClick={() => onPress(d)} aria-label={String(d)}
            className="h-12 rounded-xl font-bold font-brand text-xl transition-all active:scale-90"
            style={{
              background: 'var(--color-ui-card)',
              border:     '1px solid var(--ui-glass-border)',
              color:      'var(--color-brand-text)',
              boxShadow:  'var(--ui-card-shadow)',
              cursor:     'pointer',
            }}>
            {d}
          </button>
        ))}
        <button onClick={onClear}
          className="h-12 rounded-xl font-bold font-brand text-xs transition-all active:scale-90"
          style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)',
            color: 'var(--color-brand-muted)', cursor: 'pointer' }}>
          CLR
        </button>
        <button onClick={() => onPress(0)} aria-label="0"
          className="h-12 rounded-xl font-bold font-brand text-xl transition-all active:scale-90"
          style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)',
            color: 'var(--color-brand-text)', cursor: 'pointer' }}>
          0
        </button>
        <button onClick={onBackspace} aria-label="Delete"
          className="h-12 rounded-xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)',
            color: 'var(--color-brand-muted)', cursor: 'pointer' }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
            <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Tip option card ──────────────────────────────────────────────────────────

function TipCard({ label, sublabel, selected, onClick, size = 'md' }: {
  label: string; sublabel?: string; selected: boolean;
  onClick: () => void; size?: 'sm' | 'md' | 'lg';
}) {
  const heights: Record<string, string> = { sm: '88px', md: '108px', lg: '120px' };
  return (
    <button
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className="flex flex-col items-center justify-center rounded-2xl border-2 font-brand transition-all duration-150 active:scale-95 relative overflow-hidden"
      style={{
        height:     heights[size],
        ...(selected ? {
          background:  'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
          borderColor: 'transparent',
          boxShadow:   '0 6px 24px rgba(245,158,11,0.35)',
          color:       '#FFFFFF',
        } : {
          background:  'var(--color-ui-card)',
          borderColor: 'var(--ui-glass-border)',
          color:       'var(--color-brand-text)',
          boxShadow:   'var(--ui-card-shadow)',
        }),
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-primary)';
      }}
      onMouseLeave={(e) => {
        if (!selected) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--ui-glass-border)';
      }}
    >
      {selected && (
        <span className="absolute top-2 right-2">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </span>
      )}
      <span className="text-2xl font-bold leading-none">{label}</span>
      {sublabel && (
        <span className="text-sm mt-1.5"
          style={{ color: selected ? 'rgba(255,255,255,0.82)' : 'var(--color-brand-muted)' }}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

// ─── Order summary rows ───────────────────────────────────────────────────────

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between font-brand py-1.5"
      style={{ color: highlight ? 'var(--color-brand-text)' : 'var(--color-brand-muted)',
        fontWeight: highlight ? 700 : 400, fontSize: highlight ? '1rem' : '0.875rem' }}>
      <span>{label}</span>
      <span style={{ color: highlight ? 'var(--color-brand-primary)' : undefined }}>{value}</span>
    </div>
  );
}

// ─── CTA button ───────────────────────────────────────────────────────────────

function CtaButton({ selected, finalTotal, onClick, t }: {
  selected: TipOption | null; finalTotal: number;
  onClick: () => void; t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!selected}
      aria-label={selected
        ? `Continue to payment — ${formatPrice(finalTotal)}`
        : 'Choose a tip option to continue'}
      className="w-full py-4 font-brand font-bold text-base rounded-2xl transition-all active:scale-95"
      style={{
        background:    selected
          ? 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))'
          : 'var(--color-brand-surface)',
        color:         selected ? '#FFFFFF' : 'var(--color-brand-muted)',
        border:        'none',
        boxShadow:     selected ? '0 6px 24px rgba(245,158,11,0.30)' : 'none',
        opacity:       selected ? 1 : 0.6,
        cursor:        selected ? 'pointer' : 'not-allowed',
        transition:    'all 200ms ease',
      }}
    >
      {selected
        ? t('tip.continue', { total: formatPrice(finalTotal) })
        : t('tip.chooseOption')}
    </button>
  );
}

// ─── Progress indicator ───────────────────────────────────────────────────────

function ProgressSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Tip', 'Payment', 'Done'];
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      {steps.map((label, i) => {
        const step  = i + 1;
        const done  = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div className="flex items-center gap-1.5">
              <div style={{
                width:         active || done ? 22 : 18,
                height:        active || done ? 22 : 18,
                borderRadius:  '50%',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                background:    done
                  ? 'var(--color-brand-success)'
                  : active
                    ? 'var(--color-brand-primary)'
                    : 'var(--color-brand-surface)',
                border:        active || done ? 'none' : '1.5px solid var(--color-brand-border)',
                flexShrink:    0,
                transition:    'all 200ms',
              }}>
                {done ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth={3} strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <span style={{
                    fontSize:   '0.6rem',
                    fontWeight: 800,
                    color:      active ? '#FFFFFF' : 'var(--color-brand-muted)',
                    fontFamily: 'var(--font-brand)',
                  }}>
                    {step}
                  </span>
                )}
              </div>
              <span style={{
                fontSize:   '0.7rem',
                fontWeight: active ? 700 : 400,
                color:      active ? 'var(--color-brand-text)' : 'var(--color-brand-muted)',
                fontFamily: 'var(--font-brand)',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div style={{
                width:      20,
                height:     1.5,
                background: done ? 'var(--color-brand-success)' : 'var(--color-brand-border)',
                margin:     '0 2px',
                flexShrink: 0,
                transition: 'background 200ms',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TipScreenContent() {
  const { t }           = useTranslation();
  const history         = useHistory();
  const isLandscape     = useIsLandscape();
  const { subtotal, taxAmount, taxRate, setTip } = useCartStore();
  const partySize       = useSessionStore((s) => s.partySize);
  const proceedToPayment = useSessionStore((s) => s.proceedToPayment);

  const [selected,     setSelected]     = useState<TipOption | null>(null);
  const [customCents,  setCustomCents]  = useState(0);

  const tipPcts = useMemo<Record<'15' | '18' | '20', number>>(() => ({
    '15': Math.round(subtotal * 0.15 * 100) / 100,
    '18': Math.round(subtotal * 0.18 * 100) / 100,
    '20': Math.round(subtotal * 0.20 * 100) / 100,
  }), [subtotal]);

  const resolvedTip = useMemo(() => {
    if (!selected || selected === 'none') return 0;
    if (selected === 'custom') return customCents / 100;
    return tipPcts[selected as '15' | '18' | '20'];
  }, [selected, customCents, tipPcts]);

  const finalTotal = Math.round((subtotal + taxAmount + resolvedTip) * 100) / 100;
  const perPerson  = partySize > 1 && resolvedTip > 0 ? resolvedTip / partySize : null;

  function selectOption(opt: TipOption) {
    setSelected(opt);
    if (opt !== 'custom') setTip(opt === 'none' ? 0 : tipPcts[opt as '15' | '18' | '20']);
  }

  const pressDigit     = useCallback((d: number) => setCustomCents((p) => Math.min(p * 10 + d, 99999)), []);
  const pressBackspace = useCallback(() => setCustomCents((p) => Math.floor(p / 10)), []);
  const pressClear     = useCallback(() => setCustomCents(0), []);

  function handleContinue() {
    if (!selected) return;
    if (selected === 'custom') setTip(customCents / 100);
    proceedToPayment();          // transition session state: ordering → payment
    history.push('/payment');
  }

  // ── Shared blocks ────────────────────────────────────────────────────────────

  const tipCards = (
    <div className="flex flex-col gap-3 w-full">
      {/* Percentage presets */}
      <div role="radiogroup" aria-label="Tip percentage"
        className="grid grid-cols-3 gap-3">
        {(['15', '18', '20'] as const).map((pct) => (
          <TipCard
            key={pct}
            label={`${pct}%`}
            sublabel={formatPrice(tipPcts[pct])}
            selected={selected === pct}
            onClick={() => selectOption(pct)}
            size={isLandscape ? 'sm' : 'lg'}
          />
        ))}
      </div>

      {/* Custom + No tip */}
      <div className="grid grid-cols-2 gap-3">
        <TipCard
          label={t('tip.custom')}
          sublabel={selected === 'custom' ? formatPrice(customCents / 100) : t('tip.enterAmount')}
          selected={selected === 'custom'}
          onClick={() => selectOption('custom')}
          size={isLandscape ? 'sm' : 'md'}
        />
        <TipCard
          label={t('tip.noTip')}
          sublabel="$0.00"
          selected={selected === 'none'}
          onClick={() => selectOption('none')}
          size={isLandscape ? 'sm' : 'md'}
        />
      </div>

      {/* Custom numpad */}
      {selected === 'custom' && (
        <div className="p-4 rounded-2xl"
          style={{ background: 'var(--color-ui-surface-alt)', border: '1px solid var(--ui-glass-border)' }}>
          <NumPad centValue={customCents} onPress={pressDigit}
            onBackspace={pressBackspace} onClear={pressClear} />
        </div>
      )}

      {/* Per-person hint */}
      {perPerson !== null && (
        <p aria-live="polite" className="text-center text-sm font-brand"
          style={{ color: 'var(--color-brand-muted)' }}>
          {t('tip.perPerson', { amount: formatPrice(perPerson), count: partySize })}
        </p>
      )}
    </div>
  );

  const orderSummary = (
    <div className="rounded-2xl p-4"
      style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)',
        boxShadow: 'var(--ui-card-shadow)' }}>
      <Row label={t('cart.subtotal')}                  value={formatPrice(subtotal)} />
      <Row label={`Tax (${(taxRate * 100).toFixed(2)}%)`} value={formatPrice(taxAmount)} />
      {resolvedTip > 0 && (
        <Row label={t('cart.tip')} value={formatPrice(resolvedTip)} />
      )}
      <div style={{ borderTop: '1px solid var(--ui-glass-border)', marginTop: 8, paddingTop: 8 }}>
        <Row label={t('cart.total')} value={formatPrice(finalTotal)} highlight />
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // LANDSCAPE layout — two columns, fixed-height
  // ─────────────────────────────────────────────────────────────────────────────

  if (isLandscape) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%',
        background: 'var(--color-brand-bg)' }}>

        {/* Header */}
        <div style={{
          flexShrink:    0,
          display:       'flex',
          alignItems:    'center',
          justifyContent:'space-between',
          padding:       '12px 20px',
          borderBottom:  '1px solid var(--ui-glass-border)',
          background:    'var(--color-ui-header)',
          boxShadow:     '0 2px 8px rgba(0,0,0,0.05)',
          gap:           16,
        }}>
          <button onClick={() => history.goBack()} aria-label={t('common.back')}
            style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--color-ui-surface-alt)', border: 'none',
              color: 'var(--color-brand-muted)', cursor: 'pointer',
            }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontWeight: 800, fontSize: '1rem',
              color: 'var(--color-brand-text)', fontFamily: 'var(--font-brand)' }}>
              {t('tip.title')}
            </h1>
            <p style={{ margin: 0, fontSize: '0.75rem',
              color: 'var(--color-brand-muted)', fontFamily: 'var(--font-brand)' }}>
              {t('tip.subtotalLabel', { amount: formatPrice(subtotal) })}
            </p>
          </div>

          <ProgressSteps current={1} />
        </div>

        {/* Two-column body */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

          {/* Left — tip options */}
          <div style={{
            flex:         '1 1 55%',
            overflowY:    'auto',
            padding:      '16px 16px 16px 20px',
            borderInlineEnd: '1px solid var(--ui-glass-border)',
            display:      'flex',
            flexDirection:'column',
            gap:           12,
          }}>
            {tipCards}
          </div>

          {/* Right — summary + CTA */}
          <div style={{
            flex:          '0 0 45%',
            display:       'flex',
            flexDirection: 'column',
            padding:       '16px 20px 20px',
            gap:           14,
            overflowY:     'auto',
          }}>
            {orderSummary}

            {/* Next-step label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="var(--color-brand-primary)" strokeWidth={2} strokeLinecap="round">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-brand)',
                color: 'var(--color-brand-muted)' }}>
                Next: Choose payment method
              </span>
            </div>

            <CtaButton selected={selected} finalTotal={finalTotal} onClick={handleContinue} t={t} />
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PORTRAIT layout — single column
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-brand-bg)' }}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--ui-glass-border)', background: 'var(--color-ui-header)' }}>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button onClick={() => history.goBack()} aria-label={t('common.back')}
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--color-ui-surface-alt)', border: 'none',
              color: 'var(--color-brand-muted)', cursor: 'pointer' }}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold font-brand leading-tight"
              style={{ color: 'var(--color-brand-text)' }}>
              {t('tip.title')}
            </h1>
            <p className="text-sm font-brand"
              style={{ color: 'var(--color-brand-muted)' }}>
              {t('tip.subtotalLabel', { amount: formatPrice(subtotal) })}
            </p>
          </div>
        </div>

        <ProgressSteps current={1} />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {tipCards}
        {orderSummary}

        {/* What comes next — visual hint */}
        <div className="flex items-center justify-center gap-2 pb-1"
          style={{ opacity: 0.55 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--color-brand-primary)" strokeWidth={2} strokeLinecap="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          <span className="text-xs font-brand" style={{ color: 'var(--color-brand-muted)' }}>
            Next: Choose payment method
          </span>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="flex-shrink-0 px-5 pb-8 pt-3"
        style={{ borderTop: '1px solid var(--ui-glass-border)' }}>
        <CtaButton selected={selected} finalTotal={finalTotal} onClick={handleContinue} t={t} />
      </div>
    </div>
  );
}
