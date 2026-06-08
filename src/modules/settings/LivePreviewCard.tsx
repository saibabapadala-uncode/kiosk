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
      className="rounded-2xl overflow-hidden border border-brand-border shadow-xl select-none transition-all duration-300"
      style={{
        fontFamily: 'var(--font-brand)',
        boxShadow: 'var(--card-shadow-hover)',
      }}
    >
      {/* Kiosk header bar */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 transition-all duration-300"
        style={{ background: 'var(--color-brand-primary)' }}
      >
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt="Brand logo"
            className="h-7 w-auto object-contain transition-transform duration-300 hover:scale-105"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black uppercase tracking-wider transition-colors duration-300"
            style={{ background: 'rgba(255,255,255,0.22)', color: '#FFFFFF' }}
          >
            {displayName[0]}
          </div>
        )}
        <span className="text-white font-extrabold text-sm tracking-tight">{displayName}</span>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        </div>
      </div>

      {/* Catalog area */}
      <div
        className="p-3.5 grid grid-cols-2 gap-3 transition-colors duration-300"
        style={{ background: 'var(--color-brand-bg)' }}
      >
        {[
          { name: 'Classic Burger', price: 12.99 },
          { name: 'Caesar Salad', price: 9.49 },
        ].map((item) => (
          <div
            key={item.name}
            className="overflow-hidden transition-all duration-300"
            style={{
              borderRadius: 'var(--radius-brand-card)',
              background: 'var(--color-brand-surface)',
              border: '1px solid var(--color-brand-border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            {/* Image placeholder */}
            <div
              className="h-14 transition-colors duration-300"
              style={{ background: 'var(--color-brand-surface-alt)' }}
            />
            <div className="p-2.5">
              <p
                className="text-xs font-bold leading-tight"
                style={{ color: 'var(--color-brand-text)' }}
              >
                {item.name}
              </p>
              <div className="flex items-center justify-between mt-2.5">
                <span
                  className="text-xs font-extrabold"
                  style={{ color: 'var(--color-brand-primary)' }}
                >
                  {formatPrice(item.price)}
                </span>
                <div
                  className="text-white text-[10px] px-2.5 py-1 font-bold rounded-lg shadow-sm hover:opacity-90 transition-opacity cursor-pointer"
                  style={{
                    background: 'var(--color-brand-primary)',
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
        className="flex items-center justify-between px-4 py-3 transition-all duration-300"
        style={{
          background: 'var(--color-brand-surface)',
          borderTop: '1px solid var(--color-brand-border)',
        }}
      >
        <span className="text-xs font-medium" style={{ color: 'var(--color-brand-muted)' }}>
          2 items
        </span>
        <div
          className="text-white text-xs px-3.5 py-2 font-bold rounded-xl shadow-sm transition-all duration-200 active:scale-95"
          style={{
            background: 'var(--color-brand-primary)',
          }}
        >
          Checkout — {formatPrice(22.48)}
        </div>
      </div>
    </div>
  );
}
