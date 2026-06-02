// src/modules/catalog/ProductModal.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Portrait  → createPortal custom bottom sheet (95 dvh, no IonModal quirks)
//             PortraitHeader  flex-shrink:0 — thumbnail + name + live price
//             scrollable body flex:1         — accordion modifier sections
//             StickyFooter    flex-shrink:0  — qty + total + Add-to-Cart
//             The footer CANNOT be hidden — it lives outside the scroll layer.
//
// Landscape → createPortal into a container div owned by CatalogScreen,
//             which lives inside the normal flex layout (70% grid / 30% panel).
//             This eliminates card overlap and position:fixed fights entirely.
//
// Accordion modifier behaviour
//   ≥ 3 total sections  → accordion, required groups auto-expanded
//   < 3 total sections  → always open (no collapse toggle shown)
//   Auto-advance        → completing a required radio group expands the next
//                         incomplete required group + scrolls it into view.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal }                                       from 'react-dom';
import type { Product, ModifierGroup, ModifierOption }        from '@/types/catalog';
import type { ProductDetail, VariantData }                    from '@/services/catalog.service';
import { loadProductDetail }                                  from '@/services/catalog.service';
import { useCartStore }                                       from '@/store/cartStore';
import { formatPrice }                                        from '@/utils/format';
import { useIsLandscape }                                     from '@/hooks/useOrientation';

// ─── Shared keyframe CSS ───────────────────────────────────────────────────────

const ANIM_CSS = `
  @keyframes pm-sheet-up {
    from { transform: translateY(100%); }
    to   { transform: translateY(0);    }
  }
  @keyframes pm-fade-in {
    from { opacity: 0; transform: translateY(5px); }
    to   { opacity: 1; transform: translateY(0);   }
  }
  @keyframes pm-chip-pop {
    0%   { transform: scale(0.88); }
    55%  { transform: scale(1.07); }
    100% { transform: scale(1);    }
  }
  .pm-body { animation: pm-fade-in 180ms ease forwards; }
`;

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  bg:        '#FAFAF7',
  rowBg:     '#F4F3EF',
  border:    '#E8E6E0',
  text:      '#1C1917',
  sub:       '#57534E',
  muted:     '#A8A29E',
  amber:     '#C2720A',
  amberTint: 'rgba(194,114,10,0.09)',
  amberDark: '#A35F07',
  ctaBtn:    '#E8A420',
  ctaText:   '#FFFFFF',
  ctaShadow: '0 6px 24px rgba(232,164,32,0.40)',
  green:     '#16A34A',
  greenBg:   'rgba(22,163,74,0.09)',
  red:       '#DC2626',
  redBg:     'rgba(220,38,38,0.07)',
  white:     '#FFFFFF',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  product:            Product | null;
  isOpen:             boolean;
  onClose:            () => void;
  /** DOM node owned by CatalogScreen for the landscape panel slot */
  landscapeContainer: HTMLDivElement | null;
}

type SelectionMap = Record<string, string[]>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDefaults(groups: ModifierGroup[]): SelectionMap {
  const map: SelectionMap = {};
  for (const g of groups) {
    map[g.id] = g.options
      .filter((o) => o.default && o.available)
      .map((o) => o.id)
      .slice(0, g.maxSelections);
  }
  return map;
}

function isGroupMet(g: ModifierGroup, sel: string[]): boolean {
  return !g.required || sel.length >= Math.max(g.minSelections, 1);
}

// ─── Dynamic portrait sheet height ───────────────────────────────────────────
// Calculates how tall the bottom sheet should be based on the total number of
// modifier sections and their option counts.  Uses dvh so the browser accounts
// for the mobile viewport (address-bar excluded), with a vh fallback.
//
//  0 sections              → 52 %   (just product info + CTA)
//  1 section, ≤ 3 options  → 58 %
//  1 section, ≤ 6 options  → 65 %
//  1 section, > 6 options  → 72 %
//  2 sections, ≤ 8 opts    → 74 %
//  2 sections, ≤ 14 opts   → 82 %
//  2 sections, > 14 opts   → 87 %
//  3 sections, ≤ 14 opts   → 86 %
//  3 sections, > 14 opts   → 91 %
//  4 sections              → 92 %
//  5+ sections             → 95 %

function sheetHeight(groups: ModifierGroup[], hasVariants: boolean): string {
  const sections = groups.length + (hasVariants ? 1 : 0);
  // Estimate option count; add 3 for variants (Small / Medium / Large etc.)
  const opts     = groups.reduce((n, g) => n + g.options.length, 0) + (hasVariants ? 3 : 0);

  if (sections === 0)                       return '52dvh';
  if (sections === 1 && opts <= 3)          return '58dvh';
  if (sections === 1 && opts <= 6)          return '65dvh';
  if (sections === 1)                       return '72dvh';
  if (sections === 2 && opts <= 8)          return '74dvh';
  if (sections === 2 && opts <= 14)         return '82dvh';
  if (sections === 2)                       return '87dvh';
  if (sections === 3 && opts <= 14)         return '86dvh';
  if (sections === 3)                       return '91dvh';
  if (sections === 4)                       return '92dvh';
  return '95dvh';
}

// ─── Accordion hook ───────────────────────────────────────────────────────────

function useAccordion(
  groups: ModifierGroup[],
  hasVariants: boolean,
  active: boolean,
): [Set<string>, (id: string) => void, (id: string) => void] {
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!active) { setOpen(new Set()); return; }
    const init = new Set<string>();
    if (hasVariants) init.add('__size__');
    groups.forEach((g) => { if (g.required) init.add(g.id); });
    if (!init.size) {
      const first = hasVariants ? '__size__' : groups[0]?.id;
      if (first) init.add(first);
    }
    setOpen(init);
  }, [groups.length, hasVariants, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback((id: string) => {
    setOpen((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);
  const expand = useCallback((id: string) => {
    setOpen((p) => new Set([...p, id]));
  }, []);

  return [open, toggle, expand];
}

// ─── Option chip (radio / small multi-select) ─────────────────────────────────

function Chip({ opt, sel, dis, radio, onToggle }: {
  opt: ModifierOption; sel: boolean; dis: boolean; radio: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" role={radio ? 'radio' : 'checkbox'} aria-checked={sel}
      onClick={() => !dis && onToggle()} disabled={dis}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 3, padding: '12px 8px',
        borderRadius: 14, minHeight: 66, textAlign: 'center', position: 'relative',
        border: `2px solid ${sel ? C.amber : C.border}`,
        background: sel ? C.amberTint : C.white,
        cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.4 : 1,
        transition: 'border-color 130ms, background 130ms',
        animation: sel ? 'pm-chip-pop 200ms ease' : undefined,
      }}
    >
      {sel && (
        <span style={{ position: 'absolute', top: 5, right: 6,
          width: 15, height: 15, borderRadius: '50%', background: C.amber,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="8" height="8" viewBox="0 0 12 12" fill="none"
            stroke="white" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l2.8 3L10 3"/>
          </svg>
        </span>
      )}
      <span style={{ fontWeight: sel ? 700 : 500, fontSize: 'clamp(0.76rem,1.7vw,0.86rem)',
        color: sel ? C.text : C.sub, lineHeight: 1.3, paddingTop: sel ? 4 : 0 }}>
        {opt.name}
      </span>
      <span style={{ fontSize: '0.67rem', fontWeight: sel ? 700 : 400,
        color: opt.price > 0 ? (sel ? C.amberDark : C.muted) : C.muted }}>
        {opt.price > 0 ? `+${formatPrice(opt.price)}` : 'Free'}
      </span>
    </button>
  );
}

// ─── Option row (checkbox / large lists) ──────────────────────────────────────

function Row({ opt, sel, dis, radio, last, onToggle }: {
  opt: ModifierOption; sel: boolean; dis: boolean;
  radio: boolean; last: boolean; onToggle: () => void;
}) {
  return (
    <button type="button" role={radio ? 'radio' : 'checkbox'} aria-checked={sel}
      onClick={() => !dis && onToggle()} disabled={dis}
      style={{
        display: 'flex', alignItems: 'center', width: '100%', minHeight: 54,
        padding: '12px 16px', gap: 12, textAlign: 'left', border: 'none',
        background: sel ? C.amberTint : C.white,
        borderBottom: last ? 'none' : `1px solid ${C.border}`,
        cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.38 : 1,
        transition: 'background 110ms',
      }}
    >
      <span aria-hidden="true" style={{
        flexShrink: 0, width: 22, height: 22,
        borderRadius: radio ? '50%' : 6,
        border: `2px solid ${sel ? C.amber : '#CDCAC6'}`,
        background: sel ? C.amber : C.white,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 120ms',
      }}>
        {sel && (radio
          ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.white, display: 'block' }} />
          : <svg width="11" height="11" viewBox="0 0 12 12" fill="none"
              stroke="white" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l2.8 3L10 3"/>
            </svg>
        )}
      </span>
      <span style={{ flex: 1, fontWeight: sel ? 600 : 400,
        color: sel ? C.text : C.sub, fontSize: 'clamp(0.84rem,1.7vw,0.96rem)', lineHeight: 1.35 }}>
        {opt.name}
      </span>
      <span style={{ flexShrink: 0, fontWeight: sel ? 700 : 400,
        fontSize: '0.82rem', color: opt.price > 0 ? (sel ? C.amber : C.muted) : C.muted }}>
        {opt.price > 0 ? `+${formatPrice(opt.price)}` : 'Free'}
      </span>
    </button>
  );
}

// ─── Accordion section ────────────────────────────────────────────────────────

function AccordionSection({ group, selected, onToggle, isOpen: isExp, onToggleOpen, useAccordion, sectionRef }: {
  group: ModifierGroup; selected: string[];
  onToggle: (gId: string, oId: string) => void;
  isOpen: boolean; onToggleOpen: (id: string) => void;
  useAccordion: boolean; sectionRef: (el: HTMLDivElement | null) => void;
}) {
  const radio  = group.maxSelections === 1;
  const atMax  = selected.length >= group.maxSelections;
  const met    = isGroupMet(group, selected);
  const chips  = group.options.length <= 8;
  const cols   = group.options.length <= 2 ? group.options.length
               : group.options.length >= 7 ? 3 : 2;
  const showBody = !useAccordion || isExp;

  const summary = selected.length > 0
    ? selected.map((id) => group.options.find((o) => o.id === id)?.name ?? '').filter(Boolean).join(' · ')
    : group.required ? 'Required — select an option' : 'None selected';

  return (
    <div ref={sectionRef} data-group-id={group.id}
      style={{
        marginBottom: 10, borderRadius: 16, overflow: 'hidden',
        border: `1.5px solid ${
          (!met && group.required) ? 'rgba(220,38,38,0.45)'
          : (met && selected.length > 0) ? 'rgba(22,163,74,0.35)'
          : isExp ? C.amber : C.border
        }`,
        transition: 'border-color 180ms',
      }}
    >
      {/* Header */}
      <button type="button"
        onClick={() => useAccordion && onToggleOpen(group.id)}
        style={{
          display: 'flex', alignItems: 'center', width: '100%',
          padding: '13px 15px', gap: 11, border: 'none',
          background: isExp ? C.amberTint : C.white,
          cursor: useAccordion ? 'pointer' : 'default',
          transition: 'background 140ms', textAlign: 'left',
        }}
      >
        {/* Status dot */}
        <span style={{
          flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          background: met && selected.length > 0 ? C.green : (!met && group.required) ? C.red : C.border,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 180ms',
        }}>
          {met && selected.length > 0 ? (
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
              stroke="white" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 6l2.8 3L10 3"/>
            </svg>
          ) : group.required ? (
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'block' }} />
          ) : null}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 'clamp(0.88rem,1.9vw,1rem)', color: C.text }}>
              {group.name}
            </span>
            <span style={{
              fontSize: '0.61rem', fontWeight: 700, borderRadius: 999, padding: '2px 7px',
              color:      group.required ? (met ? C.green : C.red) : C.muted,
              background: group.required ? (met ? C.greenBg : C.redBg) : 'rgba(0,0,0,0.05)',
            }}>
              {group.required ? (met ? '✓ Done' : 'Required') : 'Optional'}
            </span>
          </div>
          {!showBody && (
            <p style={{
              margin: '2px 0 0', fontSize: '0.72rem', lineHeight: 1.4,
              color: selected.length > 0 ? C.sub : (group.required ? C.red : C.muted),
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {summary}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
          {selected.length > 0 && !showBody && (
            <span style={{ fontSize: '0.69rem', fontWeight: 700, color: C.amber,
              background: C.amberTint, borderRadius: 999, padding: '2px 7px' }}>
              {selected.length}
            </span>
          )}
          {useAccordion && (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
              stroke={C.muted} strokeWidth={2.5} strokeLinecap="round"
              style={{ transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 190ms', flexShrink: 0 }}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>
      </button>

      {showBody && (
        <div className="pm-body"
          style={{ padding: '2px 13px 13px', background: C.rowBg }}>
          <p style={{ margin: '0 0 9px', fontSize: '0.69rem', color: C.muted, fontWeight: 500, textAlign: 'right' }}>
            {radio ? 'Pick 1' : group.required ? `Pick ${group.minSelections}–${group.maxSelections}` : `Up to ${group.maxSelections}`}
          </p>
          {chips ? (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
              {group.options.map((opt) => {
                const s = selected.includes(opt.id);
                const d = !opt.available || (!s && atMax && !radio);
                return <Chip key={opt.id} opt={opt} sel={s} dis={d} radio={radio} onToggle={() => onToggle(group.id, opt.id)} />;
              })}
            </div>
          ) : (
            <div style={{ borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden', background: C.white }}>
              {group.options.map((opt, idx) => {
                const s = selected.includes(opt.id);
                const d = !opt.available || (!s && atMax && !radio);
                return <Row key={opt.id} opt={opt} sel={s} dis={d} radio={radio}
                  last={idx === group.options.length - 1} onToggle={() => onToggle(group.id, opt.id)} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Variant accordion ────────────────────────────────────────────────────────

function VariantSection({ variants, selectedId, onSelect, isOpen: isExp, onToggleOpen, useAccordion, sectionRef }: {
  variants: VariantData[]; selectedId: string; onSelect: (id: string) => void;
  isOpen: boolean; onToggleOpen: (id: string) => void;
  useAccordion: boolean; sectionRef: (el: HTMLDivElement | null) => void;
}) {
  const cols    = variants.length <= 2 ? variants.length : variants.length <= 4 ? 2 : 3;
  const showBody = !useAccordion || isExp;
  const sel     = variants.find((v) => v.id === selectedId);

  return (
    <div ref={sectionRef} data-group-id="__size__"
      style={{
        marginBottom: 10, borderRadius: 16, overflow: 'hidden',
        border: `1.5px solid ${selectedId ? 'rgba(22,163,74,0.35)' : 'rgba(220,38,38,0.45)'}`,
        transition: 'border-color 180ms',
      }}
    >
      <button type="button" onClick={() => useAccordion && onToggleOpen('__size__')}
        style={{ display: 'flex', alignItems: 'center', width: '100%',
          padding: '13px 15px', gap: 11, border: 'none',
          background: isExp ? C.amberTint : C.white,
          cursor: useAccordion ? 'pointer' : 'default',
          transition: 'background 140ms', textAlign: 'left' }}
      >
        <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
          background: selectedId ? C.green : C.red,
          display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 180ms' }}>
          {selectedId
            ? <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round"><path d="M2 6l2.8 3L10 3"/></svg>
            : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'white', display: 'block' }} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontWeight: 700, fontSize: 'clamp(0.88rem,1.9vw,1rem)', color: C.text }}>Choose Size</span>
            <span style={{ fontSize: '0.61rem', fontWeight: 700, borderRadius: 999, padding: '2px 7px',
              color: selectedId ? C.green : C.red, background: selectedId ? C.greenBg : C.redBg }}>
              {selectedId ? '✓ Done' : 'Required'}
            </span>
          </div>
          {!showBody && sel && (
            <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: C.sub }}>{sel.name}</p>
          )}
        </div>
        {useAccordion && (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke={C.muted} strokeWidth={2.5} strokeLinecap="round"
            style={{ transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 190ms', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        )}
      </button>
      {showBody && (
        <div className="pm-body" style={{ padding: '2px 13px 13px', background: C.rowBg }}>
          <p style={{ margin: '0 0 9px', fontSize: '0.69rem', color: C.muted, fontWeight: 500, textAlign: 'right' }}>
            Required · Pick 1
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
            {variants.map((v) => {
              const isSel = v.id === selectedId;
              return (
                <button key={v.id} type="button" onClick={() => v.available && onSelect(v.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 3, padding: '12px 8px', borderRadius: 14,
                    minHeight: 66, textAlign: 'center', position: 'relative',
                    border: `2px solid ${isSel ? C.amber : C.border}`,
                    background: isSel ? C.amberTint : C.white,
                    cursor: v.available ? 'pointer' : 'not-allowed', opacity: v.available ? 1 : 0.38,
                    transition: 'border-color 130ms, background 130ms',
                    animation: isSel ? 'pm-chip-pop 200ms ease' : undefined,
                  }}
                >
                  {isSel && (
                    <span style={{ position: 'absolute', top: 5, right: 6, width: 15, height: 15,
                      borderRadius: '50%', background: C.amber, display: 'flex',
                      alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white"
                        strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 6l2.8 3L10 3"/>
                      </svg>
                    </span>
                  )}
                  <span style={{ fontWeight: isSel ? 700 : 500, fontSize: 'clamp(0.76rem,1.7vw,0.86rem)',
                    color: isSel ? C.text : C.sub, paddingTop: isSel ? 4 : 0 }}>
                    {v.name}
                  </span>
                  <span style={{ fontSize: '0.67rem', fontWeight: isSel ? 700 : 400,
                    color: v.price > 0 ? (isSel ? C.amberDark : C.muted) : C.muted }}>
                    {formatPrice(v.price)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ padding: '4px 0 0' }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse"
          style={{ marginBottom: 10, borderRadius: 16, height: 56,
            background: C.border, animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  );
}

// ─── Modifier body ────────────────────────────────────────────────────────────

interface BodyProps {
  detail: ProductDetail | null; product: Product; loading: boolean; detailErr: string | null;
  selections: SelectionMap; selectedVariantId: string; notes: string;
  isValid: boolean; useAccordion: boolean;
  onToggle: (gId: string, oId: string) => void;
  onSelectVariant: (id: string) => void;
  onNotesChange: (v: string) => void;
  accordionOpen: Set<string>;
  onToggleAccordion: (id: string) => void;
  sectionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

function ModifierBody(p: BodyProps) {
  const groups      = p.detail?.modifierGroups ?? p.product.modifierGroups;
  const hasVariants = (p.detail?.variants ?? []).length > 0;

  function ref(id: string) {
    return (el: HTMLDivElement | null) => { if (el) p.sectionRefs.current.set(id, el); };
  }

  return (
    <div style={{ padding: '14px 0 6px' }}>
      {p.detailErr && !p.loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
          borderRadius: 10, background: C.redBg, border: `1px solid rgba(220,38,38,0.16)`,
          marginBottom: 12, marginLeft: 14, marginRight: 14 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth={2} strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: '0.73rem', color: C.red, fontWeight: 500 }}>
            Using cached options — {p.detailErr.slice(0, 58)}
          </span>
        </div>
      )}

      {p.loading && <div style={{ padding: '0 14px' }}><Skeleton /></div>}

      {!p.loading && (
        <div style={{ padding: '0 14px' }}>
          {hasVariants && (
            <VariantSection
              variants={p.detail!.variants}
              selectedId={p.selectedVariantId}
              onSelect={p.onSelectVariant}
              isOpen={p.accordionOpen.has('__size__') || !p.useAccordion}
              onToggleOpen={p.onToggleAccordion}
              useAccordion={p.useAccordion}
              sectionRef={ref('__size__')}
            />
          )}
          {groups.map((g) => (
            <AccordionSection key={g.id} group={g}
              selected={p.selections[g.id] ?? []}
              onToggle={p.onToggle}
              isOpen={p.accordionOpen.has(g.id) || !p.useAccordion}
              onToggleOpen={p.onToggleAccordion}
              useAccordion={p.useAccordion}
              sectionRef={ref(g.id)}
            />
          ))}

          {!p.isValid && (groups.length > 0 || hasVariants) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px',
              borderRadius: 10, background: C.redBg, margin: '4px 0 10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.red} strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span style={{ fontSize: '0.75rem', color: C.red, fontWeight: 500 }}>
                Complete all required selections to continue
              </span>
            </div>
          )}

          {/* Special instructions */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ margin: '0 0 9px', fontWeight: 700, fontSize: 'clamp(0.88rem,1.9vw,0.98rem)', color: C.text }}>
              Special Instructions
            </p>
            <textarea value={p.notes} onChange={(e) => p.onNotesChange(e.target.value)}
              placeholder="Any requests? E.g. sauce on the side, extra napkins…"
              maxLength={200} rows={3}
              style={{ width: '100%', borderRadius: 12, border: `1px solid ${C.border}`,
                padding: '12px 14px', fontSize: '0.9rem', color: C.sub,
                fontFamily: 'var(--font-brand)', lineHeight: 1.55, background: C.white,
                outline: 'none', resize: 'none', display: 'block', boxSizing: 'border-box' }}
              onFocus={(e) => (e.target.style.borderColor = C.amber)}
              onBlur={(e)  => (e.target.style.borderColor = C.border)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sticky footer ────────────────────────────────────────────────────────────

function Footer({ qty, unit, valid, loading, onDec, onInc, onAdd }: {
  qty: number; unit: number; valid: boolean; loading: boolean;
  onDec: () => void; onInc: () => void; onAdd: () => void;
}) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px calc(14px + env(safe-area-inset-bottom, 0px)) 16px',
      background: C.white, borderTop: `1px solid ${C.border}`,
      boxShadow: '0 -4px 20px rgba(28,25,23,0.08)',
    }}>
      {/* Qty stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
        {(['−', qty, '+'] as const).map((item, i) => {
          if (i === 1) return (
            <span key="qty" style={{ fontWeight: 800, fontSize: '1.2rem', color: C.text, minWidth: 20, textAlign: 'center' }}>
              {qty}
            </span>
          );
          const dec = item === '−';
          const dis = dec ? qty <= 1 : false;
          return (
            <button key={item} type="button" onClick={dec ? onDec : onInc} disabled={dis}
              style={{ width: 42, height: 42, borderRadius: '50%',
                border: `1.5px solid ${dis ? C.border : C.border}`,
                background: dis ? C.rowBg : C.white,
                color: dis ? C.muted : C.text, fontWeight: 700, fontSize: '1.2rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: dis ? 'not-allowed' : 'pointer', flexShrink: 0,
                boxShadow: dis ? 'none' : '0 1px 4px rgba(0,0,0,0.10)' }}>
              {item}
            </button>
          );
        })}
      </div>

      {/* CTA */}
      {loading ? (
        <div className="animate-pulse" style={{ flex: 1, height: 56, borderRadius: 999, background: C.border }} />
      ) : (
        <button type="button" onClick={onAdd} disabled={!valid}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 7, height: 56, borderRadius: 999, border: 'none', fontWeight: 700,
            fontSize: 'clamp(0.9rem,2vw,1.02rem)', cursor: valid ? 'pointer' : 'not-allowed',
            transition: 'all 130ms', background: valid ? C.ctaBtn : C.rowBg,
            color: valid ? C.ctaText : C.muted, boxShadow: valid ? C.ctaShadow : 'none',
          }}
        >
          {valid ? (
            <>
              <span>Add to Cart</span>
              <span style={{ opacity: 0.6, fontSize: '0.78em' }}>·</span>
              <span style={{ fontWeight: 900 }}>{formatPrice(unit * qty)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"/>
                <polyline points="12 5 19 12 12 19"/>
              </svg>
            </>
          ) : (
            <span>Complete required selections</span>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Portrait header ──────────────────────────────────────────────────────────

// ─── Portrait header — compact, fixed height, never scrolls ──────────────────
// Shows thumbnail + 2-line max name + price + close. Nothing truncates layout.
// Full description / tags live in the scrollable body below.

function PortraitHeader({ imageUrl, name, price, onClose }: {
  imageUrl: string; name: string; price: number; onClose: () => void;
}) {
  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', background: C.white, borderBottom: `1px solid ${C.border}`,
    }}>
      {/* Thumbnail */}
      <div style={{ width: 56, height: 56, borderRadius: 12, overflow: 'hidden', flexShrink: 0, background: '#F0EDE8' }}>
        {imageUrl
          ? <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.7rem', background: 'linear-gradient(135deg,#FEF9EC,#FEF3C7)' }}>🍽</div>
        }
      </div>

      {/* Name + price — name limited to 2 lines so header height is predictable */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <h2 style={{
            margin: 0, fontWeight: 800, fontSize: 'clamp(0.9rem,2.1vw,1.08rem)',
            color: C.text, letterSpacing: '-0.015em', lineHeight: 1.25, flex: 1, minWidth: 0,
            // Clamp to 2 lines with ellipsis — keeps header height stable
            display: '-webkit-box', WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {name}
          </h2>
          <span style={{ flexShrink: 0, fontWeight: 800, fontSize: 'clamp(0.9rem,1.9vw,1.05rem)', color: C.amber, paddingTop: 1 }}>
            {formatPrice(price)}
          </span>
        </div>
      </div>

      {/* Close */}
      <button type="button" onClick={onClose} aria-label="Close"
        style={{ flexShrink: 0, width: 32, height: 32, borderRadius: '50%',
          border: `1px solid ${C.border}`, background: C.white,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth={2.5} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Landscape image header — only image + close, fixed height ────────────────
// All text (name, price, description, tags) moves into the scrollable body.

function LandscapeImageHeader({ imageUrl, name, onClose }: {
  imageUrl: string; name: string; onClose: () => void;
}) {
  return (
    <div style={{ flexShrink: 0, width: '100%', height: 'clamp(140px,18vw,180px)', position: 'relative', background: '#F0EDE8', overflow: 'hidden' }}>
      {imageUrl
        ? <img src={imageUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', background: 'linear-gradient(135deg,#FEF9EC,#FEF3C7)' }}>🍽</div>
      }
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.22) 0%,transparent 50%)' }} />
      <button type="button" onClick={onClose} aria-label="Close product detail"
        style={{ position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: '50%',
          background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Product info block — lives inside the scrollable area ────────────────────
// Full name, price, description, dietary tags, allergens — no truncation.
// Rendered at the top of the scroll container so long content is always reachable.

function ProductInfoBlock({ name, price, desc, calories, isVeg, isVegan, isGlutenFree, allergens, showName }: {
  name: string; price: number; desc: string; calories?: number;
  isVeg: boolean; isVegan: boolean; isGlutenFree: boolean; allergens: string[];
  /** portrait already shows name in the header — pass false to suppress it here */
  showName: boolean;
}) {
  const hasTags = calories != null || isVeg || isVegan || isGlutenFree || allergens.length > 0;
  const hasContent = showName || !!desc || hasTags;
  if (!hasContent) return null;

  return (
    <div style={{ padding: '14px 14px 4px', background: C.white, borderBottom: `1px solid ${C.border}` }}>
      {showName && (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: desc ? 8 : 6 }}>
          {/* Full name — wraps freely, no truncation */}
          <h2 style={{
            margin: 0, fontWeight: 800,
            fontSize: 'clamp(0.96rem,2vw,1.18rem)',
            color: C.text, letterSpacing: '-0.016em', lineHeight: 1.25, flex: 1,
          }}>
            {name}
          </h2>
          <span style={{ flexShrink: 0, fontWeight: 800, fontSize: 'clamp(0.92rem,1.8vw,1.08rem)', color: C.amber, paddingTop: 2 }}>
            {formatPrice(price)}
          </span>
        </div>
      )}

      {/* Full description — wraps freely */}
      {desc && (
        <p style={{ margin: `0 0 ${hasTags ? '8px' : '4px'}`, fontSize: '0.84rem', color: C.sub, lineHeight: 1.6 }}>
          {desc}
        </p>
      )}

      {/* Tags */}
      {hasTags && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, paddingBottom: 4 }}>
          {calories != null && (
            <span style={{ fontSize: '0.65rem', fontWeight: 600, color: C.muted, background: C.rowBg, border: `1px solid ${C.border}`, borderRadius: 999, padding: '2px 7px' }}>
              🔥 {calories} kcal
            </span>
          )}
          {isVeg  && <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#16a34a', background: 'rgba(22,163,74,0.1)', borderRadius: 999, padding: '2px 7px' }}>Vegetarian</span>}
          {isVegan && <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#15803d', background: 'rgba(21,128,61,0.1)', borderRadius: 999, padding: '2px 7px' }}>Vegan</span>}
          {isGlutenFree && <span style={{ fontSize: '0.64rem', fontWeight: 700, color: '#7c3aed', background: 'rgba(124,58,237,0.1)', borderRadius: 999, padding: '2px 7px' }}>Gluten-Free</span>}
          {allergens.length > 0 && (
            <span style={{ fontSize: '0.62rem', color: C.muted }}>Contains: {allergens.join(', ')}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProductModal({ product, isOpen, onClose, landscapeContainer }: Props) {
  const addItem     = useCartStore((s) => s.addItem);
  const isLandscape = useIsLandscape();

  // ── Core state ──────────────────────────────────────────────────────────────
  const [detail,            setDetail]            = useState<ProductDetail | null>(null);
  const [detailErr,         setDetailErr]         = useState<string | null>(null);
  const [loading,           setLoading]           = useState(false);
  const [selections,        setSelections]        = useState<SelectionMap>({});
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [qty,               setQty]               = useState(1);
  const [notes,             setNotes]             = useState('');
  const [fadeKey,           setFadeKey]           = useState(0);

  const displayGroups = detail?.modifierGroups ?? product?.modifierGroups ?? [];
  const hasVariants   = (detail?.variants ?? []).length > 0;
  const totalSections = displayGroups.length + (hasVariants ? 1 : 0);
  const accordionActive = totalSections >= 3;

  // Portrait sheet height — recalculates once detail loads (groups become known).
  // Kept in a memo so it only re-derives when the group/variant counts change,
  // not on every selection toggle.
  const portraitHeight = useMemo(
    () => sheetHeight(displayGroups, hasVariants),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [displayGroups.length, hasVariants],
  );

  const [accordionOpen, toggleAccordion, expandAccordion] = useAccordion(
    displayGroups, hasVariants, accordionActive,
  );

  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Load detail ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !product) return;
    sectionRefs.current.clear();
    setDetail(null); setDetailErr(null); setSelections({});
    setSelectedVariantId(product.variantIds[0] ?? '');
    setQty(1); setNotes(''); setLoading(true);
    setFadeKey((k) => k + 1);

    loadProductDetail(product)
      .then((d) => {
        setDetail(d);
        setSelections(buildDefaults(d.modifierGroups));
        if (d.variants.length > 0) setSelectedVariantId(d.variants[0].id);
        else if (product.variantIds[0]) setSelectedVariantId(product.variantIds[0]);
      })
      .catch((err) => {
        setDetailErr(err instanceof Error ? err.message : 'Failed to load');
        setSelections(buildDefaults(product.modifierGroups));
      })
      .finally(() => setLoading(false));
  }, [isOpen, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Toggle selection ─────────────────────────────────────────────────────────
  const toggleOption = useCallback((groupId: string, optionId: string) => {
    const groups = detail?.modifierGroups ?? product?.modifierGroups ?? [];
    const group  = groups.find((g) => g.id === groupId);
    if (!group) return;
    setSelections((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId)) return { ...prev, [groupId]: cur.filter((id) => id !== optionId) };
      if (group.maxSelections === 1) return { ...prev, [groupId]: [optionId] };
      if (cur.length < group.maxSelections) return { ...prev, [groupId]: [...cur, optionId] };
      return prev;
    });
  }, [detail, product]);

  // ── Auto-advance after completing a required radio group ─────────────────────
  const prevSel = useRef<SelectionMap>({});
  useEffect(() => {
    if (!accordionActive) return;
    const groups = detail?.modifierGroups ?? product?.modifierGroups ?? [];
    for (const g of groups) {
      if (!g.required || g.maxSelections !== 1) continue;
      const was = prevSel.current[g.id] ?? [];
      const now = selections[g.id] ?? [];
      if (was.length === 0 && now.length === 1) {
        const idx  = groups.indexOf(g);
        const next = groups.slice(idx + 1).find(
          (x) => x.required && (selections[x.id]?.length ?? 0) < 1,
        );
        if (next) {
          expandAccordion(next.id);
          setTimeout(() => {
            sectionRefs.current.get(next.id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 200);
        }
      }
    }
    prevSel.current = selections;
  }, [selections, accordionActive, detail, product, expandAccordion]);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const activeVariant = useMemo(() => {
    if (!detail?.variants.length) return undefined;
    return detail.variants.find((v) => v.id === selectedVariantId);
  }, [detail, selectedVariantId]);

  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const groups = detail?.modifierGroups ?? product.modifierGroups;
    const base   = activeVariant?.price ?? detail?.basePrice ?? product.basePrice;
    const extra  = groups
      .flatMap((g) => (selections[g.id] ?? []).map((oId) => g.options.find((o) => o.id === oId)?.price ?? 0))
      .reduce((s, p) => s + p, 0);
    return Math.round((base + extra) * 100) / 100;
  }, [product, detail, activeVariant, selections]);

  const isValid = useMemo(() => {
    if (!product) return false;
    const variantOk = (detail?.variants.length ?? 0) === 0 || !!selectedVariantId;
    const groupsOk  = (detail?.modifierGroups ?? product.modifierGroups)
      .filter((g) => g.required)
      .every((g) => (selections[g.id]?.length ?? 0) >= Math.max(g.minSelections, 1));
    return variantOk && groupsOk;
  }, [product, detail, selections, selectedVariantId]);

  // ── Add to cart ───────────────────────────────────────────────────────────────
  function handleAdd() {
    if (!product || !isValid) return;
    const groups    = detail?.modifierGroups ?? product.modifierGroups;
    const modifiers = groups.flatMap((g) =>
      (selections[g.id] ?? []).map((oId) => {
        const opt = g.options.find((o) => o.id === oId)!;
        return { id: opt.id, name: opt.name, price: opt.price };
      }),
    );
    const variantId = selectedVariantId || product.variantIds[0];
    for (let i = 0; i < qty; i++) {
      addItem({
        productId:  product.id,
        name:       detail?.name ?? product.name,
        basePrice:  product.basePrice,
        imageUrl:   detail?.imageUrl ?? product.imageUrl,
        variant:    variantId ? { id: variantId, name: activeVariant?.name ?? product.name, price: unitPrice } : undefined,
        modifiers,
        specialInstructions: notes || undefined,
      });
    }
    onClose();
  }

  if (!product) return null;

  const imgUrl       = detail?.imageUrl    || product.imageUrl;
  const name         = detail?.name        || product.name;
  const desc         = detail?.description || product.description;
  const basePrice    = activeVariant?.price ?? detail?.basePrice ?? product.basePrice;
  const allergens    = detail?.allergens   ?? product.allergens;
  const calories     = detail?.calories    ?? product.calories;
  const isVeg        = detail?.isVeg       ?? product.isVeg;
  const isVegan      = detail?.isVegan     ?? product.isVegan;
  const isGlutenFree = detail?.isGlutenFree ?? product.isGlutenFree;

  const bodyProps: BodyProps = {
    detail, product, loading, detailErr,
    selections, selectedVariantId, notes,
    isValid, useAccordion: accordionActive,
    onToggle: toggleOption,
    onSelectVariant: (id) => { setSelectedVariantId(id); setSelections(buildDefaults(detail?.modifierGroups ?? [])); },
    onNotesChange: setNotes,
    accordionOpen, onToggleAccordion: toggleAccordion, sectionRefs,
  };

  const footerProps = {
    qty, unit: unitPrice, valid: isValid, loading,
    onDec: () => setQty((q) => Math.max(1, q - 1)),
    onInc: () => setQty((q) => Math.min(20, q + 1)),
    onAdd: handleAdd,
  };

  // ────────────────────────────────────────────────────────────────────────────
  // LANDSCAPE — portal into the container div managed by CatalogScreen
  // ────────────────────────────────────────────────────────────────────────────
  if (isLandscape) {
    if (!landscapeContainer || !isOpen) return null;
    return createPortal(
      <>
        <style>{ANIM_CSS}</style>
        {/* Full-height flex column — container already has h-full + overflow-hidden */}
        <div key={fadeKey} className="pm-body"
          style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.white }}>

          {/* Fixed: image + close button only — no text, so height is constant */}
          <LandscapeImageHeader imageUrl={imgUrl} name={name} onClose={onClose} />

          {/* Scrollable: all text + modifiers together — nothing can be clipped */}
          <div className="no-scrollbar"
            style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: C.bg }}>
            <ProductInfoBlock
              name={name} price={basePrice} desc={desc}
              calories={calories} isVeg={isVeg} isVegan={isVegan}
              isGlutenFree={isGlutenFree} allergens={allergens}
              showName
            />
            <ModifierBody {...bodyProps} />
          </div>

          {/* Always-visible footer */}
          <Footer {...footerProps} />
        </div>
      </>,
      landscapeContainer,
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PORTRAIT — createPortal custom bottom sheet (no IonModal)
  // ────────────────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  return createPortal(
    <>
      <style>{ANIM_CSS}</style>

      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1100,
          background: 'rgba(0,0,0,0.48)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Customise ${name}`}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          height: portraitHeight,
          maxHeight: 'calc(100vh - 20px)',
          transition: 'height 260ms cubic-bezier(0.32,0.72,0,1)',
          zIndex: 1101,
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          animation: 'pm-sheet-up 280ms cubic-bezier(0.32,0.72,0,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
      >
        {/* Drag handle */}
        <div style={{ padding: '10px 0 0', display: 'flex', justifyContent: 'center', flexShrink: 0, background: C.bg }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#CDCAC6' }} />
        </div>

        {/* Fixed compact header: thumbnail + 2-line name (no desc) + price + close */}
        <PortraitHeader imageUrl={imgUrl} name={name} price={basePrice} onClose={onClose} />

        {/* Scrollable area: description + tags + all modifiers — nothing clipped */}
        <div className="no-scrollbar"
          style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', background: C.bg }}>
          <ProductInfoBlock
            name={name} price={basePrice} desc={desc}
            calories={calories} isVeg={isVeg} isVegan={isVegan}
            isGlutenFree={isGlutenFree} allergens={allergens}
            showName={false}
          />
          <ModifierBody {...bodyProps} />
        </div>

        {/* CTA footer — lives OUTSIDE the scroll container, always pinned */}
        <Footer {...footerProps} />
      </div>
    </>,
    document.body,
  );
}
