// src/modules/settings/shared.tsx
// Shared primitives used across all settings tabs, polished for premium aesthetics.
import { useState, type ReactNode, type InputHTMLAttributes } from 'react';
import { themeColors } from '@/utils/themeColors';

// ─── Field wrapper ─────────────────────────────────────────────────────────────

interface SettingsFieldProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function SettingsField({ label, description, htmlFor, children }: SettingsFieldProps) {
  return (
    <div
      className="flex flex-col lg:flex-row lg:items-start gap-3 py-5 transition-colors duration-150"
      style={{ borderBottom: `1px solid ${themeColors.border}` }}
    >
      <div className="lg:w-60 flex-shrink-0 pt-0.5">
        <label
          htmlFor={htmlFor}
          className="text-sm font-bold font-brand block tracking-tight"
          style={{ color: themeColors.text }}
        >
          {label}
        </label>
        {description && (
          <p
            className="text-xs font-brand mt-1 leading-relaxed"
            style={{ color: themeColors.muted }}
          >
            {description}
          </p>
        )}
      </div>
      <div className="flex-1 w-full lg:max-w-xl">{children}</div>
    </div>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────────

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8 last:mb-0 animate-fade-in-up">
      <h3
        className="text-[10px] font-bold font-brand uppercase tracking-[0.2em] mb-2.5 pl-1"
        style={{ color: themeColors.muted }}
      >
        {title}
      </h3>
      <div
        className="rounded-2xl border px-5 divide-y divide-brand-border transition-all duration-300"
        style={{
          background: themeColors.surface,
          borderColor: themeColors.border,
          boxShadow: 'var(--ui-card-shadow)',
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ─── Toggle switch ─────────────────────────────────────────────────────────────

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, label, disabled }: ToggleSwitchProps) {
  const [active, setActive] = useState(false);

  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => !disabled && setActive(true)}
      onPointerUp={() => setActive(false)}
      onPointerLeave={() => setActive(false)}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex w-12 h-6.5 rounded-full transition-all duration-300 items-center',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
      style={{
        background: checked ? 'var(--color-brand-primary)' : 'rgba(var(--color-brand-primary-rgb), 0.15)',
        border: `1.5px solid ${checked ? 'var(--color-brand-primary)' : themeColors.border}`,
        boxShadow: checked
          ? '0 2px 10px rgba(var(--color-brand-primary-rgb), 0.35)'
          : 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
        transform: active ? 'scale(0.94)' : 'none',
        outlineColor: 'var(--color-brand-primary)',
      }}
    >
      <span
        aria-hidden="true"
        className="absolute w-4.5 h-4.5 rounded-full bg-white shadow-md transition-all duration-300 ease-out"
        style={{
          left: checked ? 'calc(100% - 22px)' : '4px',
          boxShadow: checked ? '0 1px 4px rgba(0,0,0,0.25)' : '0 1px 2px rgba(0,0,0,0.15)',
          transform: active ? 'scaleX(1.15)' : 'none',
        }}
      />
    </button>
  );
}

// ─── Masked input (API keys, secrets) ─────────────────────────────────────────

interface MaskedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  value: string;
  onChange: (v: string) => void;
}

export function MaskedInput({ value, onChange, placeholder, id, ...rest }: MaskedInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex gap-2 w-full max-w-md">
      <input
        {...rest}
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        spellCheck={false}
        className="
          flex-1 px-4 py-2.5 rounded-xl border font-mono text-sm
          placeholder:text-brand-muted placeholder:font-sans
          focus:outline-none transition-all duration-200
        "
        style={{
          background: themeColors.input,
          borderColor: focused ? 'var(--color-brand-primary)' : themeColors.border,
          color: themeColors.inputText,
          boxShadow: focused ? '0 0 0 3px rgba(var(--color-brand-primary-rgb), 0.18)' : 'none',
        }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        className="
          px-3.5 rounded-xl border text-xs font-brand font-semibold transition-all duration-150
          active:scale-95 flex items-center justify-center
        "
        style={{
          borderColor: themeColors.border,
          color: themeColors.muted,
          background: themeColors.surfaceAlt,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = themeColors.text;
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = themeColors.muted;
          (e.currentTarget as HTMLButtonElement).style.borderColor = themeColors.border;
        }}
      >
        {visible ? (
          <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ─── Standard text input ───────────────────────────────────────────────────────

export function SettingsInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  const { className, onFocus, onBlur, ...rest } = props;

  return (
    <input
      {...rest}
      onFocus={(e) => { setFocused(true); onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); onBlur?.(e); }}
      className={[
        'w-full max-w-md px-4 py-2.5 rounded-xl border',
        'font-brand text-sm transition-all duration-200 focus:outline-none',
        className ?? '',
      ].join(' ')}
      style={{
        background: themeColors.input,
        borderColor: focused ? 'var(--color-brand-primary)' : themeColors.border,
        color: themeColors.inputText,
        boxShadow: focused ? '0 0 0 3px rgba(var(--color-brand-primary-rgb), 0.18)' : 'none',
      }}
    />
  );
}

// ─── Select ────────────────────────────────────────────────────────────────────

export function SettingsSelect(props: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const [focused, setFocused] = useState(false);
  const { children, className, onFocus, onBlur, ...rest } = props;

  return (
    <div className="relative w-full max-w-md">
      <select
        {...rest}
        onFocus={(e) => { setFocused(true); onFocus?.(e as any); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e as any); }}
        className={[
          'w-full px-4 py-2.5 rounded-xl border appearance-none',
          'font-brand text-sm focus:outline-none cursor-pointer transition-all duration-200',
          className ?? '',
        ].join(' ')}
        style={{
          background: themeColors.input,
          borderColor: focused ? 'var(--color-brand-primary)' : themeColors.border,
          color: themeColors.inputText,
          boxShadow: focused ? '0 0 0 3px rgba(var(--color-brand-primary-rgb), 0.18)' : 'none',
          paddingRight: '2.5rem',
        }}
      >
        {children}
      </select>
      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: themeColors.muted }}>
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </div>
    </div>
  );
}
