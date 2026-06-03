// src/components/AgeVerificationGate.tsx
// Full-screen age verification overlay for alcohol brands (e.g. Holiq).
// Shown on the AttractScreen when environment.businessRules.ageVerification.enabled is true.
// Once the customer confirms, the result is stored in sessionStore so the
// gate is not repeated within the same order session.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrand }        from '@/hooks/useBrand';
import { useSessionStore } from '@/store/sessionStore';
import { useBrandCSSVar }  from '@/hooks/useBrandCSSVar';

interface AgeVerificationGateProps {
  onConfirm: () => void;
  onDeny:    () => void;
}

export default function AgeVerificationGate({ onConfirm, onDeny }: AgeVerificationGateProps) {
  const { t } = useTranslation();
  const { environment } = useBrand();
  const setAgeVerified  = useSessionStore(s => s.setAgeVerified);
  const brandPrimaryRgb = useBrandCSSVar('--color-brand-primary-rgb');

  const config = environment.businessRules?.ageVerification;
  const minAge = config?.minAge ?? 21;
  const prompt = (config?.prompt ?? 'You must be {minAge} or older.').replace('{minAge}', String(minAge));
  const subtitle = config?.subtitle ?? 'By continuing, you confirm you meet the age requirement.';

  const [confirming, setConfirming] = useState(false);

  function handleConfirm() {
    setConfirming(true);
    setAgeVerified(true);
    onConfirm();
  }

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      zIndex:         9999,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'linear-gradient(160deg, var(--color-brand-bg) 0%, var(--color-brand-surface) 100%)',
      padding:        '24px',
    }}>
      <div style={{
        maxWidth:     480,
        width:        '100%',
        textAlign:    'center',
        animation:    'fade-in-up 0.45s ease-out both',
      }}>

        {/* Age icon */}
        <div style={{
          width:          96,
          height:         96,
          borderRadius:   '50%',
          background:     `rgba(${brandPrimaryRgb},0.10)`,
          border:         `2px solid rgba(${brandPrimaryRgb},0.20)`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          margin:         '0 auto 28px',
          fontSize:       '2.8rem',
        }}>
          🪪
        </div>

        {/* Min age badge */}
        <div style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          padding:        '6px 18px',
          borderRadius:   999,
          background:     'var(--gradient-cta)',
          color:          'var(--color-brand-text-inverse)',
          fontSize:       '0.8rem',
          fontWeight:     700,
          fontFamily:     'var(--font-brand)',
          marginBottom:   20,
          boxShadow:      `0 4px 16px rgba(${brandPrimaryRgb},0.30)`,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          {t('ageGate.ageBadge', 'Age Requirement: {{minAge}}+', { minAge })}
        </div>

        {/* Heading */}
        <h1 style={{
          margin:        '0 0 12px',
          fontSize:      'clamp(1.5rem, 4vw, 2rem)',
          fontWeight:    800,
          color:         'var(--color-brand-text)',
          letterSpacing: '-0.03em',
          lineHeight:    1.15,
          fontFamily:    'var(--font-brand)',
        }}>
          {t('ageGate.heading', 'Age Verification Required')}
        </h1>

        {/* Prompt */}
        <p style={{
          margin:     '0 0 8px',
          fontSize:   '1rem',
          color:      'var(--color-brand-text)',
          fontFamily: 'var(--font-brand)',
          lineHeight: 1.5,
        }}>
          {prompt}
        </p>

        {/* Subtitle */}
        <p style={{
          margin:     '0 0 36px',
          fontSize:   '0.875rem',
          color:      'var(--color-brand-muted)',
          fontFamily: 'var(--font-brand)',
          lineHeight: 1.5,
        }}>
          {subtitle}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Confirm */}
          <button
            onClick={handleConfirm}
            disabled={confirming}
            style={{
              width:        '100%',
              minHeight:    'var(--spacing-touch)',
              borderRadius: 'var(--radius-brand-button)',
              border:       'none',
              background:   'var(--gradient-cta)',
              color:        'var(--color-brand-text-inverse)',
              fontSize:     '1.05rem',
              fontWeight:   700,
              fontFamily:   'var(--font-brand)',
              cursor:       confirming ? 'not-allowed' : 'pointer',
              opacity:      confirming ? 0.7 : 1,
              transition:   'opacity var(--transition-base)',
              boxShadow:    `0 6px 20px rgba(${brandPrimaryRgb},0.35)`,
            }}
          >
            {t('ageGate.confirm', 'Yes, I am {{minAge}} or older', { minAge })}
          </button>

          {/* Deny */}
          <button
            onClick={onDeny}
            style={{
              width:        '100%',
              minHeight:    'var(--spacing-touch)',
              borderRadius: 'var(--radius-brand-button)',
              border:       '1.5px solid var(--color-brand-border)',
              background:   'transparent',
              color:        'var(--color-brand-muted)',
              fontSize:     '0.95rem',
              fontWeight:   600,
              fontFamily:   'var(--font-brand)',
              cursor:       'pointer',
              transition:   'background var(--transition-base)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-brand-surface)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            {t('ageGate.deny', 'No, I am under {{minAge}}', { minAge })}
          </button>
        </div>

        {/* Legal note */}
        <p style={{
          marginTop:  24,
          fontSize:   '0.72rem',
          color:      'var(--color-brand-muted)',
          fontFamily: 'var(--font-brand)',
          lineHeight: 1.5,
        }}>
          {t('ageGate.legal', 'The sale of alcohol to persons under {{minAge}} is prohibited by law.', { minAge })}
        </p>
      </div>
    </div>
  );
}
