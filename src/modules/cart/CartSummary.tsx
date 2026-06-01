// src/modules/cart/CartSummary.tsx — visual layer only, all logic preserved
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice, formatPercent } from '@/utils/format';

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 font-brand"
      style={{
        fontSize:   bold ? '1rem' : '0.875rem',
        fontWeight: bold ? 700 : 400,
        color:      muted ? 'var(--color-brand-muted)' : bold ? 'var(--color-brand-text)' : 'var(--color-brand-text)',
      }}>
      <span>{label}</span>
      <span style={bold ? { color: 'var(--color-brand-primary)' } : {}}>{value}</span>
    </div>
  );
}

interface CartSummaryProps {
  showTipPlaceholder?: boolean;
  className?: string;
}

export default function CartSummary({ showTipPlaceholder, className }: CartSummaryProps) {
  const { subtotal, taxAmount, tipAmount, total } = useCartStore();
  const taxRate = useSettingsStore((s) => s.kiosk.taxRate);

  return (
    <div className={['space-y-0.5', className].filter(Boolean).join(' ')}>
      <Row label="Subtotal"              value={formatPrice(subtotal)}  muted />
      <Row label={`Tax (${formatPercent(taxRate)})`} value={formatPrice(taxAmount)} muted />
      {showTipPlaceholder && tipAmount === 0 ? (
        <Row label="Tip" value="Add on next step" muted />
      ) : tipAmount > 0 ? (
        <Row label="Tip" value={formatPrice(tipAmount)} muted />
      ) : null}
      <div style={{ borderTop: '1px solid var(--ui-glass-border)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
        <Row label="Total" value={formatPrice(total)} bold />
      </div>
    </div>
  );
}
