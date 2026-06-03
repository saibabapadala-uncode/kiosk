// src/screens/BrandSelectScreen.tsx
// First screen of the kiosk — shown before login when no brand has been selected.
// Uses inline brand definitions to avoid circular dependency with environment files.

import { useState } from 'react';
import { IonPage, IonContent, useIonViewWillEnter } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useSettingsStore } from '@/store/settingsStore';
import type { BrandId } from '@/brands/types';

// ─── Inline brand definitions ─────────────────────────────────────────────────

const BRANDS = [
  {
    id:          'straunt' as BrandId,
    name:        'Straunt',
    type:        'Food & Dining',
    description: 'Full-service food ordering kiosk',
    primary:     '#F97316',
    secondary:   '#EA580C',
    icon:        '🍔',
  },
  {
    id:          'holiq' as BrandId,
    name:        'Holiq',
    type:        'Liquor & Spirits',
    description: 'Age-verified alcohol ordering (21+)',
    primary:     '#FD5056',
    secondary:   '#E94449',
    icon:        '🍾',
  },
  {
    id:          'restro' as BrandId,
    name:        'Restro',
    type:        'Restaurant',
    description: 'Fine dining & casual restaurant kiosk',
    primary:     '#16A34A',
    secondary:   '#15803D',
    icon:        '🍽',
  },
] as const;

type BrandEntry = (typeof BRANDS)[number];

// ─── Brand card ────────────────────────────────────────────────────────────────

function BrandCard({
  brand,
  selected,
  onClick,
}: {
  brand:    BrandEntry;
  selected: boolean;
  onClick:  () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`Select ${brand.name}`}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      style={{
        background:    '#FFFFFF',
        borderRadius:  '1.25rem',
        boxShadow:     selected
          ? `0 4px 24px ${brand.primary}33, 0 1px 4px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.04)',
        border:        selected
          ? `2.5px solid ${brand.primary}`
          : '1.5px solid #E5E7EB',
        minHeight:     '180px',
        padding:       '1.5rem',
        cursor:        'pointer',
        userSelect:    'none',
        display:       'flex',
        flexDirection: 'column',
        gap:           '0.75rem',
        transition:    'box-shadow 0.18s ease, border-color 0.18s ease, transform 0.12s ease',
        outline:       'none',
        position:      'relative',
      }}
      onPointerDown={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(0.97)'; }}
      onPointerUp={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
      onPointerLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; }}
    >
      {/* Selected checkmark */}
      {selected && (
        <div style={{
          position:       'absolute',
          top:            '0.875rem',
          right:          '0.875rem',
          width:          '1.5rem',
          height:         '1.5rem',
          borderRadius:   '50%',
          background:     brand.primary,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
          boxShadow:      `0 2px 6px ${brand.primary}55`,
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth={3.5} strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      {/* Brand icon */}
      <div style={{
        width:          '3rem',
        height:         '3rem',
        borderRadius:   '50%',
        background:     `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '1.375rem',
        lineHeight:     1,
        flexShrink:     0,
        boxShadow:      `0 2px 8px ${brand.primary}4D`,
      }} aria-hidden="true">
        {brand.icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontWeight: 700, fontSize: '1.0625rem', lineHeight: 1.2, color: '#111827', margin: 0 }}>
          {brand.name}
        </p>
        <p style={{
          fontSize:      '0.75rem',
          fontWeight:    600,
          color:         brand.primary,
          margin:        '0.25rem 0 0.375rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}>
          {brand.type}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#6B7280', margin: 0, lineHeight: 1.4 }}>
          {brand.description}
        </p>
      </div>

      {/* Color swatches */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <div style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: brand.primary, flexShrink: 0 }} />
        <div style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: brand.secondary, flexShrink: 0 }} />
        <span style={{ fontSize: '0.6875rem', color: '#9CA3AF', fontFamily: 'monospace', marginLeft: '0.125rem' }}>
          {brand.primary}
        </span>
      </div>

      {/* CTA button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        style={{
          width:        '100%',
          padding:      '0.625rem 1rem',
          borderRadius: '0.625rem',
          border:       'none',
          background:   selected
            ? `linear-gradient(135deg, ${brand.primary} 0%, ${brand.secondary} 100%)`
            : `${brand.primary}18`,
          color:        selected ? '#FFFFFF' : brand.primary,
          fontWeight:   600,
          fontSize:     '0.875rem',
          cursor:       'pointer',
          display:      'flex',
          alignItems:   'center',
          justifyContent: 'center',
          gap:          '0.5rem',
          transition:   'background 0.18s ease, color 0.18s ease',
          boxShadow:    selected ? `0 2px 8px ${brand.primary}40` : 'none',
          outline:      'none',
          flexShrink:   0,
        }}
      >
        {selected ? (
          <>
            Selected
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </>
        ) : 'Select'}
      </button>
    </div>
  );
}

// ─── Main screen ────────────────────────────────────────────────────────────────

export default function BrandSelectScreen() {
  const history     = useHistory();
  const selectBrand = useSettingsStore((s) => s.selectBrand);
  const storedBrand = useSettingsStore((s) => s.brandId) as BrandId | '';

  // Pre-select whichever brand is already active (e.g. when returning from login)
  const [selectedId, setSelectedId] = useState<BrandId | null>(
    storedBrand && BRANDS.some(b => b.id === storedBrand) ? storedBrand : null,
  );
  const [confirming, setConfirming] = useState(false);

  // Reset state every time this screen becomes active (Ionic keeps pages mounted)
  useIonViewWillEnter(() => {
    const current = useSettingsStore.getState().brandId as BrandId | '';
    setSelectedId(current && BRANDS.some(b => b.id === current) ? current : null);
    setConfirming(false);
  });

  function handleSelect(brandId: BrandId) {
    // First tap: highlight the brand
    if (selectedId !== brandId) {
      setSelectedId(brandId);
      return;
    }

    // Second tap on the already-selected brand (or "Continue" click): confirm and navigate
    handleConfirm(brandId);
  }

  function handleConfirm(brandId: BrandId) {
    if (confirming) return;
    setConfirming(true);

    // Apply brand config atomically (theme, API config, kiosk defaults, brandSelected = true)
    selectBrand(brandId);

    // Replace so /brand-select is removed from the stack.
    // Using history.replace prevents the back button from returning here with
    // a stale confirming/loading state.
    history.replace('/login');
  }

  return (
    <IonPage>
      <IonContent fullscreen scrollY>
        <div style={{
          minHeight:      '100%',
          background:     '#F8FAFC',
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          padding:        '2rem 1rem 3rem',
        }}>

          {/* Header */}
          <div style={{
            background:    '#FFFFFF',
            borderRadius:  '1.25rem',
            boxShadow:     '0 2px 12px rgba(0,0,0,0.07)',
            border:        '1px solid #E5E7EB',
            padding:       '2rem 2.5rem',
            textAlign:     'center',
            marginBottom:  '2rem',
            width:         '100%',
            maxWidth:      '56rem',
          }}>
            <h1 style={{
              margin:        0,
              fontSize:      'clamp(1.5rem, 4vw, 2rem)',
              fontWeight:    800,
              color:         '#111827',
              letterSpacing: '-0.02em',
              lineHeight:    1.2,
            }}>
              Choose Your Brand
            </h1>
            <p style={{ margin: '0.5rem 0 0', fontSize: '1rem', color: '#6B7280', lineHeight: 1.5 }}>
              {selectedId
                ? `${BRANDS.find(b => b.id === selectedId)?.name} selected — tap again to continue`
                : 'Tap a brand to select it, then tap again to continue'}
            </p>
          </div>

          {/* Brand cards grid */}
          <div style={{
            display:              'grid',
            gridTemplateColumns:  'repeat(auto-fit, minmax(260px, 1fr))',
            gap:                  '1.25rem',
            width:                '100%',
            maxWidth:             '56rem',
          }}>
            {BRANDS.map((brand) => (
              <BrandCard
                key={brand.id}
                brand={brand}
                selected={selectedId === brand.id}
                onClick={() => handleSelect(brand.id)}
              />
            ))}
          </div>

          {/* Continue button — shown once a brand is selected */}
          {selectedId && (
            <div style={{
              marginTop: '2rem',
              width:     '100%',
              maxWidth:  '56rem',
            }}>
              <button
                type="button"
                disabled={confirming}
                onClick={() => handleConfirm(selectedId)}
                style={{
                  width:        '100%',
                  minHeight:    '56px',
                  borderRadius: '1rem',
                  border:       'none',
                  background:   confirming ? '#9CA3AF' :
                    `linear-gradient(135deg, ${BRANDS.find(b => b.id === selectedId)!.primary} 0%, ${BRANDS.find(b => b.id === selectedId)!.secondary} 100%)`,
                  color:        '#FFFFFF',
                  fontWeight:   700,
                  fontSize:     '1.05rem',
                  cursor:       confirming ? 'not-allowed' : 'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  justifyContent: 'center',
                  gap:          '0.625rem',
                  transition:   'opacity 0.15s ease',
                  opacity:      confirming ? 0.7 : 1,
                  boxShadow:    confirming ? 'none' :
                    `0 6px 20px ${BRANDS.find(b => b.id === selectedId)!.primary}40`,
                }}
              >
                {confirming ? (
                  'Applying…'
                ) : (
                  <>
                    Continue with {BRANDS.find(b => b.id === selectedId)?.name}
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </>
                )}
              </button>
            </div>
          )}

          <div style={{ flex: 1, minHeight: '2rem' }} />

          <p style={{
            marginTop:     '2.5rem',
            fontSize:      '0.75rem',
            color:         '#9CA3AF',
            textAlign:     'center',
            letterSpacing: '0.01em',
          }}>
            Powered by AJR Kiosk
          </p>
        </div>

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </IonContent>
    </IonPage>
  );
}
