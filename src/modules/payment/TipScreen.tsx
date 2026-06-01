// src/modules/payment/TipScreen.tsx
import { useState, useCallback, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/store/cartStore';
import { useSessionStore } from '@/store/sessionStore';
import { formatPrice } from '@/utils/format';

type TipOption = '15' | '18' | '20' | 'custom' | 'none';

// ─── ATM numpad ────────────────────────────────────────────────────────────────

const PAD_ROWS = [[7, 8, 9], [4, 5, 6], [1, 2, 3]] as const;

function NumPad({ centValue, onPress, onBackspace, onClear }: {
  centValue: number;
  onPress: (d: number) => void;
  onBackspace: () => void;
  onClear: () => void;
}) {
  const dollars = (centValue / 100).toFixed(2);

  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[280px] mx-auto">
      {/* Display */}
      <div
        aria-live="polite"
        className="w-full py-3.5 px-6 text-center text-4xl font-bold font-brand tracking-wider"
        style={{
          background:    'var(--color-ui-surface-alt)',
          borderRadius:  'var(--radius-2xl)',
          color:         'var(--color-brand-primary)',
          border:        '2px solid var(--color-brand-primary)',
          boxShadow:     '0 0 0 4px rgba(245,158,11,0.12)',
        }}
      >
        ${dollars}
      </div>

      {/* Digits */}
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {PAD_ROWS.flat().map((d) => (
          <button
            key={d}
            onClick={() => onPress(d)}
            aria-label={String(d)}
            className="h-14 rounded-2xl font-bold font-brand text-xl transition-all active:scale-90"
            style={{
              background: 'var(--color-ui-card)',
              border:     '1px solid var(--ui-glass-border)',
              color:      'var(--color-brand-text)',
              boxShadow:  'var(--ui-card-shadow)',
            }}
          >
            {d}
          </button>
        ))}
        <button onClick={onClear} className="h-14 rounded-2xl font-bold font-brand text-xs transition-all active:scale-90"
          style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)', color: 'var(--color-brand-muted)' }}>
          CLR
        </button>
        <button onClick={() => onPress(0)} aria-label="0" className="h-14 rounded-2xl font-bold font-brand text-xl transition-all active:scale-90"
          style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)', color: 'var(--color-brand-text)' }}>
          0
        </button>
        <button onClick={onBackspace} aria-label="Delete" className="h-14 rounded-2xl flex items-center justify-center transition-all active:scale-90"
          style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)', color: 'var(--color-brand-muted)' }}>
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/>
            <line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Tip option card ───────────────────────────────────────────────────────────

function TipCard({ label, sublabel, selected, onClick }: {
  label: string; sublabel?: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="radio"
      aria-checked={selected}
      className="flex flex-col items-center justify-center h-24 rounded-2xl border-2 font-brand transition-all duration-150 active:scale-95 relative overflow-hidden"
      style={selected ? {
        background:   'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))',
        borderColor:  'transparent',
        boxShadow:    '0 6px 24px rgba(245,158,11,0.35)',
        color:        'white',
      } : {
        background:   'var(--color-ui-card)',
        borderColor:  'var(--ui-glass-border)',
        color:        'var(--color-brand-text)',
        boxShadow:    'var(--ui-card-shadow)',
      }}
    >
      {selected && (
        <div className="absolute top-2 right-2">
          <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      )}
      <span className="text-2xl font-bold leading-none">{label}</span>
      {sublabel && (
        <span className={['text-sm mt-1', selected ? 'text-white/80' : ''].join(' ')}
          style={!selected ? { color: 'var(--color-brand-muted)' } : {}}>
          {sublabel}
        </span>
      )}
    </button>
  );
}

// ─── Summary row ───────────────────────────────────────────────────────────────

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={['flex justify-between font-brand py-1', bold ? 'text-base font-bold' : 'text-sm'].join(' ')}
      style={{ color: bold ? 'var(--color-brand-text)' : 'var(--color-brand-muted)' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function TipScreenContent() {
  const { t } = useTranslation();
  const history = useHistory();
  const { subtotal, taxAmount, taxRate, setTip } = useCartStore();
  const partySize = useSessionStore((s) => s.partySize);

  const [selected, setSelected]     = useState<TipOption | null>(null);
  const [customCents, setCustomCents] = useState(0);

  const tipPcts = useMemo<Record<'15' | '18' | '20', number>>(() => ({
    '15': Math.round(subtotal * 0.15 * 100) / 100,
    '18': Math.round(subtotal * 0.18 * 100) / 100,
    '20': Math.round(subtotal * 0.20 * 100) / 100,
  }), [subtotal]);

  const resolvedTip = useMemo(() => {
    if (!selected || selected === 'none') return 0;
    if (selected === 'custom') return customCents / 100;
    return tipPcts[selected];
  }, [selected, customCents, tipPcts]);

  const finalTotal = Math.round((subtotal + taxAmount + resolvedTip) * 100) / 100;
  const perPerson  = partySize > 1 ? resolvedTip / partySize : null;

  function selectOption(opt: TipOption) {
    setSelected(opt);
    if (opt !== 'custom') setTip(opt === 'none' ? 0 : tipPcts[opt as '15' | '18' | '20']);
  }

  const pressDigit    = useCallback((d: number) => setCustomCents((p) => Math.min(p * 10 + d, 99999)), []);
  const pressBackspace = useCallback(() => setCustomCents((p) => Math.floor(p / 10)), []);
  const pressClear    = useCallback(() => setCustomCents(0), []);

  function handleContinue() {
    if (!selected) return;
    if (selected === 'custom') setTip(customCents / 100);
    history.push('/payment');
  }

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--color-brand-bg)' }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-5 pb-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--ui-glass-border)' }}>
        <button onClick={() => history.goBack()}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'var(--color-ui-surface-alt)', color: 'var(--color-brand-muted)' }}
          aria-label="Back">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold font-brand" style={{ color: 'var(--color-brand-text)' }}>
            {t('tip.title')}
          </h1>
          <p className="text-sm font-brand" style={{ color: 'var(--color-brand-muted)' }}>
            {t('tip.subtotalLabel', { amount: formatPrice(subtotal) })}
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

        {/* Pct cards */}
        <div role="radiogroup" aria-label="Tip percentage" className="grid grid-cols-3 gap-3">
          {(['15', '18', '20'] as const).map((pct) => (
            <TipCard key={pct} label={`${pct}%`} sublabel={formatPrice(tipPcts[pct])} selected={selected === pct} onClick={() => selectOption(pct)} />
          ))}
        </div>

        {/* Custom + No tip */}
        <div className="grid grid-cols-2 gap-3">
          <TipCard
            label={t('tip.custom')}
            sublabel={selected === 'custom' ? formatPrice(customCents / 100) : t('tip.enterAmount')}
            selected={selected === 'custom'}
            onClick={() => selectOption('custom')}
          />
          <TipCard label={t('tip.noTip')} sublabel="$0.00" selected={selected === 'none'} onClick={() => selectOption('none')} />
        </div>

        {/* Numpad */}
        {selected === 'custom' && (
          <div className="p-4 rounded-2xl animate-pop-in" style={{ background: 'var(--color-ui-surface-alt)', border: '1px solid var(--ui-glass-border)' }}>
            <NumPad centValue={customCents} onPress={pressDigit} onBackspace={pressBackspace} onClear={pressClear} />
          </div>
        )}

        {/* Per-person */}
        {perPerson !== null && resolvedTip > 0 && (
          <p aria-live="polite" className="text-center text-sm font-brand" style={{ color: 'var(--color-brand-muted)' }}>
            {t('tip.perPerson', { amount: formatPrice(perPerson), count: partySize })}
          </p>
        )}

        {/* Order preview */}
        <div className="p-4 rounded-2xl" style={{ background: 'var(--color-ui-card)', border: '1px solid var(--ui-glass-border)', boxShadow: 'var(--ui-card-shadow)' }}>
          <Row label="Subtotal" value={formatPrice(subtotal)} />
          <Row label={`Tax (${(taxRate * 100).toFixed(2)}%)`} value={formatPrice(taxAmount)} />
          {resolvedTip > 0 && <Row label="Tip" value={formatPrice(resolvedTip)} />}
          <div style={{ borderTop: '1px solid var(--ui-glass-border)', marginTop: '0.5rem', paddingTop: '0.5rem' }}>
            <Row label="Total" value={formatPrice(finalTotal)} bold />
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0 px-5 pb-8 pt-3" style={{ borderTop: '1px solid var(--ui-glass-border)' }}>
        <button
          onClick={handleContinue}
          disabled={!selected}
          aria-label={selected ? `Continue to payment — ${formatPrice(finalTotal)}` : 'Choose a tip'}
          className="ui-btn-primary w-full py-4 text-base"
          style={{ borderRadius: 'var(--radius-2xl)', opacity: selected ? 1 : 0.4, cursor: selected ? 'pointer' : 'not-allowed' }}
        >
          {selected ? t('tip.continue', { total: formatPrice(finalTotal) }) : t('tip.chooseOption')}
        </button>
      </div>
    </div>
  );
}
