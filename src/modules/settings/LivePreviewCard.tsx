// src/modules/settings/LivePreviewCard.tsx
// Renders a live mini-kiosk preview using the current CSS custom properties.
// All colours/fonts update in real-time as the user tweaks settings.
import { useSettingsStore } from '@/store/settingsStore';
import { formatPrice } from '@/utils/format';

export default function LivePreviewCard() {
  const { theme, brandId } = useSettingsStore();
  const displayName = brandId.charAt(0).toUpperCase() + brandId.slice(1);

  return (
    <div
      aria-label="Live brand preview"
      className="rounded-brand overflow-hidden border-2 border-brand-border shadow-lg select-none"
      style={{ fontFamily: 'var(--font-brand)' }}
    >
      {/* Kiosk header bar */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ background: 'var(--color-brand-primary)' }}
      >
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt="Brand logo"
            className="h-7 w-auto object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}
          >
            {displayName[0]}
          </div>
        )}
        <span className="text-white font-bold text-sm">{displayName}</span>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white/30" />
          <div className="w-2 h-2 rounded-full bg-white/30" />
          <div className="w-2 h-2 rounded-full bg-white" />
        </div>
      </div>

      {/* Catalog area */}
      <div
        className="p-3 grid grid-cols-2 gap-2"
        style={{ background: 'var(--color-brand-bg)' }}
      >
        {[
          { name: 'Classic Burger', price: 12.99 },
          { name: 'Caesar Salad', price: 9.49 },
        ].map((item) => (
          <div
            key={item.name}
            className="overflow-hidden"
            style={{
              borderRadius: 'var(--radius-brand)',
              background: 'var(--color-brand-surface)',
              border: '1px solid var(--color-brand-border)',
            }}
          >
            {/* Image placeholder */}
            <div
              className="h-14"
              style={{ background: 'var(--color-brand-border)' }}
            />
            <div className="p-2">
              <p
                className="text-xs font-bold leading-tight"
                style={{ color: 'var(--color-brand-text)' }}
              >
                {item.name}
              </p>
              <div className="flex items-center justify-between mt-1.5">
                <span
                  className="text-xs font-bold"
                  style={{ color: 'var(--color-brand-primary)' }}
                >
                  {formatPrice(item.price)}
                </span>
                <div
                  className="text-white text-xs px-2 py-0.5 font-bold"
                  style={{
                    background: 'var(--color-brand-primary)',
                    borderRadius: 'var(--radius-brand)',
                  }}
                >
                  + Add
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cart CTA strip */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'var(--color-brand-surface)',
          borderTop: '1px solid var(--color-brand-border)',
        }}
      >
        <span className="text-xs" style={{ color: 'var(--color-brand-muted)' }}>
          2 items
        </span>
        <div
          className="text-white text-xs px-3 py-1.5 font-bold"
          style={{
            background: 'var(--color-brand-primary)',
            borderRadius: 'var(--radius-brand)',
          }}
        >
          Checkout — {formatPrice(22.48)}
        </div>
      </div>
    </div>
  );
}
