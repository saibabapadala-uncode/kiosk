// src/modules/catalog/ProductModal.tsx
//
// Product Detail modal — replicates kiosk_straunt_storefront quick-view flow exactly.
//
// Flow:
//   1. Product card tapped → modal opens with catalog snapshot (instant)
//   2. loadProductDetail() called → POST variants/search?filter=products__id
//   3. Response parsed:
//        variants[]       → size/option selector (hidden when single-variant)
//        modifierGroups[] → from products__modifier in first row
//   4. User selects options → price updates in real-time
//   5. Add to Cart → cartStore.addItem with variant.id (=variants__id) + modifiers
//
// UI: full-height Ionic modal, sticky image header, scrollable body, sticky CTA footer.

import { useState, useEffect, useMemo, useCallback } from 'react';
import { IonModal, IonContent } from '@ionic/react';
import type { Product, ModifierGroup, ModifierOption } from '@/types/catalog';
import type { ProductDetail, VariantData } from '@/services/catalog.service';
import { loadProductDetail } from '@/services/catalog.service';
import { useCartStore } from '@/store/cartStore';
import { formatPrice } from '@/utils/format';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  product: Product | null;
  isOpen:  boolean;
  onClose: () => void;
}

type SelectionMap = Record<string, string[]>; // groupId → optionIds[]

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

// ─── Loading shimmer ──────────────────────────────────────────────────────────

function LoadingShimmer() {
  return (
    <div className="animate-pulse px-5 pt-4">
      <div className="h-5 rounded-full w-3/4 mb-3" style={{ background: 'var(--color-brand-border)' }} />
      <div className="h-3 rounded-full w-full mb-2"  style={{ background: 'var(--color-brand-border)' }} />
      <div className="h-3 rounded-full w-5/6 mb-6"  style={{ background: 'var(--color-brand-border)' }} />
      {[1, 2, 3].map((i) => (
        <div key={i} className="mb-5">
          <div className="h-4 rounded-full w-1/3 mb-3" style={{ background: 'var(--color-brand-border)', animationDelay: `${i * 80}ms` }} />
          {[1, 2, 3].map((j) => (
            <div key={j} className="h-14 rounded-2xl mb-2" style={{ background: 'var(--color-brand-border)', animationDelay: `${(i + j) * 60}ms` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Modifier option row ──────────────────────────────────────────────────────

function OptionRow({
  option, isSelected, isDisabled, isRadio, onToggle,
}: {
  option: ModifierOption; isSelected: boolean; isDisabled: boolean; isRadio: boolean; onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => !isDisabled && onToggle()}
      disabled={isDisabled}
      aria-checked={isSelected}
      role={isRadio ? 'radio' : 'checkbox'}
      className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-120 active:scale-[0.98]"
      style={{
        border:     `2px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--color-brand-border)'}`,
        background: isSelected
          ? `rgba(var(--color-brand-primary-rgb),0.09)`
          : 'var(--color-brand-surface)',
        opacity:    isDisabled ? 0.42 : 1,
        cursor:     isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Indicator circle/square */}
        <span aria-hidden="true"
          className="flex-shrink-0 flex items-center justify-center w-5 h-5"
          style={{
            borderRadius:  isRadio ? '50%' : '5px',
            border:        `2px solid ${isSelected ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)'}`,
            background:    isSelected ? 'var(--color-brand-primary)' : 'transparent',
            transition:    'all 120ms',
          }}
        >
          {isSelected && (
            isRadio
              ? <span className="w-2 h-2 rounded-full bg-white" />
              : <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"
                  stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 6l3 3 5-5"/>
                </svg>
          )}
        </span>
        <span className="text-sm font-medium font-brand" style={{ color: 'var(--color-brand-text)' }}>
          {option.name}
        </span>
      </div>
      {option.price > 0 && (
        <span className="text-sm font-bold font-brand flex-shrink-0 ml-2"
          style={{ color: isSelected ? 'var(--color-brand-primary)' : 'var(--color-brand-muted)' }}>
          +{formatPrice(option.price)}
        </span>
      )}
    </button>
  );
}

// ─── Modifier group section ────────────────────────────────────────────────────

function ModifierSection({
  group, selected, onToggle,
}: {
  group: ModifierGroup; selected: string[]; onToggle: (gId: string, oId: string) => void;
}) {
  const isRadio = group.maxSelections === 1;
  const atMax   = selected.length >= group.maxSelections;
  const isMet   = !group.required || selected.length >= Math.max(group.minSelections, 1);

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold font-brand uppercase tracking-wider"
            style={{ color: 'var(--color-brand-text)' }}>
            {group.name}
          </h3>
          {group.required && !isMet && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ background: '#ef4444' }}>Required</span>
          )}
          {group.required && isMet && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: 'rgba(34,197,94,0.15)', color: '#16a34a' }}>✓ Done</span>
          )}
          {!group.required && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
              Optional
            </span>
          )}
        </div>
        <span className="text-xs font-brand flex-shrink-0" style={{ color: 'var(--color-brand-muted)' }}>
          {isRadio ? 'Pick 1'
            : group.maxSelections === group.minSelections
              ? `Pick ${group.minSelections}`
              : `Up to ${group.maxSelections}`}
        </span>
      </div>

      {/* Options */}
      <div className="flex flex-col gap-2" role={isRadio ? 'radiogroup' : 'group'} aria-label={group.name}>
        {group.options.map((opt) => (
          <OptionRow
            key={opt.id}
            option={opt}
            isSelected={selected.includes(opt.id)}
            isDisabled={!opt.available || (!selected.includes(opt.id) && atMax && !isRadio)}
            isRadio={isRadio}
            onToggle={() => onToggle(group.id, opt.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Variant size selector ────────────────────────────────────────────────────

function VariantSelector({
  variants, selectedId, onSelect,
}: {
  variants: VariantData[]; selectedId: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-bold font-brand uppercase tracking-wider mb-3"
        style={{ color: 'var(--color-brand-text)' }}>
        Choose Size
      </h3>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Select size">
        {variants.map((v) => {
          const isSel = v.id === selectedId;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSel}
              onClick={() => v.available && onSelect(v.id)}
              className="px-4 py-3 rounded-2xl font-semibold font-brand text-sm transition-all duration-120 active:scale-95"
              style={{
                border:     `2px solid ${isSel ? 'var(--color-brand-primary)' : 'var(--color-brand-border)'}`,
                background: isSel ? 'var(--color-brand-primary)' : 'var(--color-brand-surface)',
                color:      isSel ? 'white' : 'var(--color-brand-text)',
                opacity:    v.available ? 1 : 0.4,
                cursor:     v.available ? 'pointer' : 'not-allowed',
              }}
            >
              {v.name} — {formatPrice(v.price)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quantity stepper ─────────────────────────────────────────────────────────

function Stepper({ qty, onChange }: { qty: number; onChange: (q: number) => void }) {
  const btnBase: React.CSSProperties = {
    width: '48px', height: '48px', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.5rem', fontWeight: 700, transition: 'all 120ms',
    cursor: 'pointer', border: 'none',
  };
  return (
    <div className="flex items-center gap-5">
      <button type="button" onClick={() => onChange(Math.max(1, qty - 1))} disabled={qty <= 1}
        style={{ ...btnBase, background: qty <= 1 ? 'var(--color-brand-surface)' : 'var(--color-brand-border)', color: qty <= 1 ? 'var(--color-brand-border)' : 'var(--color-brand-text)' }}>
        −
      </button>
      <span className="text-2xl font-bold font-brand w-8 text-center"
        style={{ color: 'var(--color-brand-text)' }}>{qty}</span>
      <button type="button" onClick={() => onChange(Math.min(20, qty + 1))}
        style={{ ...btnBase, background: 'var(--color-brand-primary)', color: 'white' }}>
        +
      </button>
    </div>
  );
}

// ─── Main modal ────────────────────────────────────────────────────────────────

export default function ProductModal({ product, isOpen, onClose }: Props) {
  const addItem = useCartStore((s) => s.addItem);

  // Async product detail (from variants/search)
  const [detail,     setDetail]     = useState<ProductDetail | null>(null);
  const [detailErr,  setDetailErr]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);

  // Selections
  const [selections,       setSelections]       = useState<SelectionMap>({});
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [qty,              setQty]              = useState(1);
  const [notes,            setNotes]            = useState('');

  // ── Load product detail when modal opens ──────────────────────────────────
  useEffect(() => {
    if (!isOpen || !product) return;

    // Reset state for new product
    setDetail(null);
    setDetailErr(null);
    setSelections({});
    setSelectedVariantId(product.variantIds[0] ?? '');
    setQty(1);
    setNotes('');
    setLoading(true);

    loadProductDetail(product)
      .then((d) => {
        setDetail(d);
        setSelections(buildDefaults(d.modifierGroups));
        // Default to first available variant
        if (d.variants.length > 0) {
          setSelectedVariantId(d.variants[0].id);
        } else if (product.variantIds[0]) {
          setSelectedVariantId(product.variantIds[0]);
        }
      })
      .catch((err) => {
        console.error('[ProductModal] loadProductDetail error', err);
        setDetailErr(err instanceof Error ? err.message : 'Failed to load product details');
        // Fallback: use catalog data modifiers if API fails
        setSelections(buildDefaults(product.modifierGroups));
      })
      .finally(() => setLoading(false));
  }, [isOpen, product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleOption = useCallback((groupId: string, optionId: string) => {
    const groups = detail?.modifierGroups ?? product?.modifierGroups ?? [];
    const group  = groups.find((g) => g.id === groupId);
    if (!group) return;

    setSelections((prev) => {
      const cur = prev[groupId] ?? [];
      if (cur.includes(optionId))
        return { ...prev, [groupId]: cur.filter((id) => id !== optionId) };
      if (group.maxSelections === 1)
        return { ...prev, [groupId]: [optionId] }; // radio
      if (cur.length < group.maxSelections)
        return { ...prev, [groupId]: [...cur, optionId] };
      return prev;
    });
  }, [detail, product]);

  // Selected variant object
  const activeVariant = useMemo(() => {
    if (!detail?.variants.length) return undefined;
    return detail.variants.find((v) => v.id === selectedVariantId);
  }, [detail, selectedVariantId]);

  // Real-time price
  const unitPrice = useMemo(() => {
    if (!product) return 0;
    const groups  = detail?.modifierGroups ?? product.modifierGroups;
    const base    = activeVariant?.price ?? detail?.basePrice ?? product.basePrice;
    const modExtra = groups.flatMap((g) =>
      (selections[g.id] ?? []).map((oId) => g.options.find((o) => o.id === oId)?.price ?? 0),
    ).reduce((s, p) => s + p, 0);
    return Math.round((base + modExtra) * 100) / 100;
  }, [product, detail, activeVariant, selections]);

  // Validation
  const isValid = useMemo(() => {
    if (!product) return false;
    const groups = detail?.modifierGroups ?? product.modifierGroups;
    return groups
      .filter((g) => g.required)
      .every((g) => (selections[g.id]?.length ?? 0) >= Math.max(g.minSelections, 1));
  }, [product, detail, selections]);

  function handleAddToCart() {
    if (!product || !isValid) return;

    const groups = detail?.modifierGroups ?? product.modifierGroups;
    const modifiers = groups.flatMap((g) =>
      (selections[g.id] ?? []).map((oId) => {
        const opt = g.options.find((o) => o.id === oId)!;
        return { id: opt.id, name: opt.name, price: opt.price };
      }),
    );

    // Source: product.id = product.variant_ids[0] → cart variant ID is the actual variant ID
    const variantId = selectedVariantId || product.variantIds[0];

    for (let i = 0; i < qty; i++) {
      addItem({
        productId:  product.id,
        name:       detail?.name ?? product.name,
        basePrice:  product.basePrice,
        imageUrl:   detail?.imageUrl ?? product.imageUrl,
        variant:    variantId
          ? { id: variantId, name: activeVariant?.name ?? product.name, price: unitPrice }
          : undefined,
        modifiers,
        specialInstructions: notes || undefined,
      });
    }

    onClose();
  }

  if (!product) return null;

  const displayName  = detail?.name        ?? product.name;
  const displayDesc  = detail?.description ?? product.description;
  const displayImage = detail?.imageUrl    ?? product.imageUrl;
  const displayGroups = detail?.modifierGroups ?? product.modifierGroups;
  const hasModifiers = displayGroups.length > 0;
  const totalPrice   = unitPrice * qty;

  // Dietary flags
  const isVeg          = detail?.isVeg        ?? product.isVeg;
  const isVegan        = detail?.isVegan       ?? product.isVegan;
  const isGlutenFree   = detail?.isGlutenFree  ?? product.isGlutenFree;
  const allergens      = detail?.allergens ?? product.allergens;
  const calories       = detail?.calories  ?? product.calories;

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      aria-label={`Customize ${displayName}`}
    >
      {/* ── Sticky header ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4 flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--ui-glass-border)',
          background:   'var(--color-brand-bg)',
          position:     'sticky', top: 0, zIndex: 20,
        }}
      >
        <h2 className="text-lg font-bold font-brand line-clamp-1 flex-1"
          style={{ color: 'var(--color-brand-text)' }}>
          {displayName}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="w-10 h-10 rounded-full flex items-center justify-center ml-3 flex-shrink-0 transition-all active:scale-90"
          style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ───────────────────────────────────────────── */}
      <IonContent style={{ '--background': 'var(--color-brand-bg)' }}>

        {/* Product image */}
        {displayImage && (
          <div className="w-full overflow-hidden" style={{ aspectRatio: '16/7', maxHeight: '260px' }}>
            <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
          </div>
        )}

        {/* Loading shimmer — shown while variants/search is in-flight */}
        {loading && <LoadingShimmer />}

        {/* Error state */}
        {detailErr && !loading && (
          <div className="px-5 pt-4 pb-2">
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth={2} strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-xs font-brand" style={{ color: '#ef4444' }}>
                {detailErr} — Showing available options
              </p>
            </div>
          </div>
        )}

        {!loading && (
          <div className="px-5 pb-4" style={{ paddingTop: displayImage ? '1rem' : '0.5rem' }}>

            {/* Product info */}
            <div className="mb-5">
              {/* Dietary badges */}
              {(isVeg || isVegan || isGlutenFree) && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {isVeg && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                      style={{ background: '#16a34a' }}>🌿 Veg</span>
                  )}
                  {isVegan && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                      style={{ background: '#15803d' }}>🌱 Vegan</span>
                  )}
                  {isGlutenFree && (
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                      style={{ background: '#7c3aed' }}>GF</span>
                  )}
                </div>
              )}

              {/* Base price + calories */}
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl font-bold font-brand"
                  style={{ color: 'var(--color-brand-primary)' }}>
                  {formatPrice(activeVariant?.price ?? detail?.basePrice ?? product.basePrice)}
                </span>
                {calories != null && (
                  <span className="text-sm font-brand px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--color-brand-surface)', color: 'var(--color-brand-muted)' }}>
                    {calories} cal
                  </span>
                )}
              </div>

              {/* Description */}
              {displayDesc && (
                <p className="text-sm font-brand leading-relaxed"
                  style={{ color: 'var(--color-brand-muted)' }}>
                  {displayDesc}
                </p>
              )}

              {/* Allergens */}
              {allergens.length > 0 && (
                <p className="text-xs font-brand mt-2"
                  style={{ color: 'var(--color-brand-muted)' }}>
                  <span className="font-bold">Allergens: </span>
                  {allergens.join(', ')}
                </p>
              )}
            </div>

            {/* Divider before options */}
            {(detail?.variants.length || hasModifiers) ? (
              <div className="mb-5" style={{ borderTop: '1px solid var(--ui-glass-border)' }} />
            ) : null}

            {/* Variant size selector — only shown when product has multiple variants */}
            {(detail?.variants ?? []).length > 0 && (
              <VariantSelector
                variants={detail!.variants}
                selectedId={selectedVariantId}
                onSelect={(id) => {
                  setSelectedVariantId(id);
                  // Reset modifier selections when size changes (price context changes)
                  setSelections(buildDefaults(detail?.modifierGroups ?? []));
                }}
              />
            )}

            {/* Modifier groups */}
            {displayGroups.map((group) => (
              <ModifierSection
                key={group.id}
                group={group}
                selected={selections[group.id] ?? []}
                onToggle={toggleOption}
              />
            ))}

            {/* Special instructions */}
            <div className="mb-5">
              <label htmlFor="prod-notes"
                className="block text-sm font-bold font-brand uppercase tracking-wider mb-2"
                style={{ color: 'var(--color-brand-text)' }}>
                Special Instructions
              </label>
              <textarea
                id="prod-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="E.g. no onions, extra sauce on the side…"
                maxLength={200}
                rows={2}
                className="w-full px-4 py-3 rounded-2xl text-sm font-brand resize-none focus:outline-none transition-colors"
                style={{
                  border:     '1.5px solid var(--color-brand-border)',
                  background: 'var(--color-brand-surface)',
                  color:      'var(--color-brand-text)',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--color-brand-primary)')}
                onBlur={(e)  => (e.target.style.borderColor = 'var(--color-brand-border)')}
              />
            </div>

            {/* Quantity stepper */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-bold font-brand uppercase tracking-wider"
                style={{ color: 'var(--color-brand-text)' }}>
                Quantity
              </span>
              <Stepper qty={qty} onChange={setQty} />
            </div>

            {/* Validation hint */}
            {!isValid && hasModifiers && !loading && (
              <p className="text-xs font-brand text-center mb-2 animate-fade-in"
                style={{ color: '#ef4444' }}>
                Please complete all required selections above
              </p>
            )}
          </div>
        )}
      </IonContent>

      {/* ── Sticky footer — Add to Cart ──────────────────────────────── */}
      <div
        className="px-5 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid var(--ui-glass-border)', background: 'var(--color-brand-bg)' }}
      >
        {loading ? (
          /* Shimmer CTA while loading */
          <div className="w-full h-14 rounded-2xl animate-pulse"
            style={{ background: 'var(--color-brand-border)' }} />
        ) : (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!isValid}
            aria-label={`Add ${qty} × ${displayName} to cart — ${formatPrice(totalPrice)}`}
            className="w-full py-4 rounded-2xl font-bold font-brand text-base transition-all duration-150 active:scale-[0.98]"
            style={{
              background: isValid
                ? 'linear-gradient(135deg,var(--color-brand-primary),var(--color-brand-secondary))'
                : 'var(--color-brand-border)',
              color:     isValid ? 'white' : 'var(--color-brand-muted)',
              cursor:    isValid ? 'pointer' : 'not-allowed',
              boxShadow: isValid
                ? `0 6px 24px rgba(var(--color-brand-primary-rgb),0.36)`
                : 'none',
            }}
          >
            {isValid
              ? `Add ${qty > 1 ? `${qty} × ` : ''}to Cart — ${formatPrice(totalPrice)}`
              : 'Select required options to continue'}
          </button>
        )}
      </div>
    </IonModal>
  );
}
