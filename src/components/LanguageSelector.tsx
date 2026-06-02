// src/components/LanguageSelector.tsx
// Globe icon + current language name + dropdown overlay.
// Persists the selection to settingsStore (which syncs i18next + dir attribute).
// Used on the AttractScreen header; can be embedded anywhere.

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation }  from 'react-i18next';
import { useSettingsStore } from '@/store/settingsStore';
import type { SupportedLocale } from '@/store/settingsStore';

// ─── Language catalogue ───────────────────────────────────────────────────────

export interface LangEntry {
  code:        SupportedLocale;
  /** Native name shown in the dropdown */
  nativeName:  string;
  /** Short abbreviation badge */
  abbr:        string;
  /** Flag emoji */
  flag:        string;
  dir:         'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LangEntry[] = [
  { code: 'en-US', nativeName: 'English',    abbr: 'EN', flag: '🇺🇸', dir: 'ltr' },
  { code: 'es-US', nativeName: 'Español',    abbr: 'ES', flag: '🇲🇽', dir: 'ltr' },
  { code: 'hi',    nativeName: 'हिन्दी',       abbr: 'HI', flag: '🇮🇳', dir: 'ltr' },
  { code: 'ta',    nativeName: 'தமிழ்',        abbr: 'TA', flag: '🇮🇳', dir: 'ltr' },
  { code: 'te',    nativeName: 'తెలుగు',       abbr: 'TE', flag: '🇮🇳', dir: 'ltr' },
  { code: 'kn',    nativeName: 'ಕನ್ನಡ',        abbr: 'KN', flag: '🇮🇳', dir: 'ltr' },
  { code: 'ml',    nativeName: 'മലയാളം',      abbr: 'ML', flag: '🇮🇳', dir: 'ltr' },
  { code: 'bn',    nativeName: 'বাংলা',        abbr: 'BN', flag: '🇧🇩', dir: 'ltr' },
  { code: 'ar',    nativeName: 'العربية',      abbr: 'AR', flag: '🇸🇦', dir: 'rtl' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface LanguageSelectorProps {
  /** Visual variant */
  variant?: 'header' | 'compact';
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LanguageSelector({ variant = 'header', className = '' }: LanguageSelectorProps) {
  const { t }             = useTranslation();
  const locale            = useSettingsStore((s) => s.localization.locale);
  const setLocalization   = useSettingsStore((s) => s.setLocalization);

  const [open, setOpen]   = useState(false);
  const containerRef      = useRef<HTMLDivElement>(null);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === locale) ?? SUPPORTED_LANGUAGES[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleSelect = useCallback((code: SupportedLocale) => {
    setLocalization({ locale: code });
    setOpen(false);
  }, [setLocalization]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ userSelect: 'none' }}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('attract.selectLanguage')}
        onClick={() => setOpen((v) => !v)}
        style={{
          display:     'flex',
          alignItems:  'center',
          gap:         8,
          padding:     '8px 14px',
          borderRadius: 999,
          background:  open ? '#FFFFFF' : 'rgba(255,255,255,0.92)',
          border:      `1.5px solid ${open ? '#E5E7EB' : 'rgba(0,0,0,0.08)'}`,
          boxShadow:   '0 2px 10px rgba(0,0,0,0.08)',
          cursor:      'pointer',
          transition:  'all 160ms',
          whiteSpace:  'nowrap',
        }}
      >
        {/* Globe */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke="#6B7280" strokeWidth={2} strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
        </svg>

        {/* Current language name */}
        {variant === 'header' && (
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', fontFamily: 'var(--font-brand)' }}>
            {current.nativeName}
          </span>
        )}
        {variant === 'compact' && (
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', fontFamily: 'var(--font-brand)' }}>
            {current.abbr}
          </span>
        )}

        {/* Chevron */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="#9CA3AF" strokeWidth={2.5} strokeLinecap="round"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 200ms' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div
          role="listbox"
          aria-label={t('attract.selectLanguage')}
          style={{
            position:     'absolute',
            top:          'calc(100% + 8px)',
            right:        0,
            minWidth:     220,
            background:   '#FFFFFF',
            borderRadius: 16,
            boxShadow:    '0 16px 48px rgba(0,0,0,0.16), 0 4px 12px rgba(0,0,0,0.08)',
            border:       '1px solid #E5E7EB',
            overflow:     'hidden',
            zIndex:       9000,
            animation:    'ls-drop-in 160ms cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <style>{`
            @keyframes ls-drop-in {
              from { opacity: 0; transform: translateY(-6px) scale(0.97); }
              to   { opacity: 1; transform: translateY(0)    scale(1);    }
            }
          `}</style>

          {/* Header */}
          <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid #F3F4F6' }}>
            <p style={{ margin: 0, fontSize: '0.7rem', fontWeight: 700, color: '#9CA3AF',
              textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-brand)' }}>
              {t('attract.selectLanguage')}
            </p>
          </div>

          {/* Language rows */}
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isSelected = lang.code === locale;
              return (
                <button
                  key={lang.code}
                  role="option"
                  aria-selected={isSelected}
                  type="button"
                  onClick={() => handleSelect(lang.code)}
                  dir={lang.dir}
                  style={{
                    display:     'flex',
                    alignItems:  'center',
                    width:       '100%',
                    padding:     '10px 16px',
                    gap:         12,
                    background:  isSelected ? '#FFF8EC' : 'transparent',
                    border:      'none',
                    cursor:      'pointer',
                    textAlign:   'left',
                    transition:  'background 100ms',
                    fontFamily:  'var(--font-brand)',
                  }}
                  onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = '#F9FAFB'; }}
                  onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                >
                  {/* Flag */}
                  <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>{lang.flag}</span>

                  {/* Native name */}
                  <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? '#D97706' : '#374151' }}>
                    {lang.nativeName}
                  </span>

                  {/* Abbr badge */}
                  <span style={{
                    flexShrink: 0, fontSize: '0.65rem', fontWeight: 700,
                    color:      isSelected ? '#D97706' : '#9CA3AF',
                    background: isSelected ? '#FEF3C7' : '#F3F4F6',
                    borderRadius: 6, padding: '2px 6px',
                  }}>
                    {lang.abbr}
                  </span>

                  {/* Check */}
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#D97706" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* More languages footer */}
          <div style={{ padding: '8px 16px 10px', borderTop: '1px solid #F3F4F6',
            display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#9CA3AF" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
            </svg>
            <span style={{ fontSize: '0.78rem', color: '#9CA3AF', fontFamily: 'var(--font-brand)' }}>
              {t('attract.moreLangs')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
