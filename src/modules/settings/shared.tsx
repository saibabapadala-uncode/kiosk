// src/modules/settings/shared.tsx
// Shared primitives used across all settings tabs.
import { useState, type ReactNode, type InputHTMLAttributes } from 'react';

// ─── Field wrapper ─────────────────────────────────────────────────────────────

interface SettingsFieldProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function SettingsField({ label, description, htmlFor, children }: SettingsFieldProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-2 py-4 border-b border-brand-border last:border-b-0">
      <div className="lg:w-52 flex-shrink-0 pt-0.5">
        <label
          htmlFor={htmlFor}
          className="text-sm font-bold font-brand text-brand-text block"
        >
          {label}
        </label>
        {description && (
          <p className="text-xs text-brand-muted font-brand mt-0.5 leading-snug">{description}</p>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────────

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-bold font-brand text-brand-muted uppercase tracking-widest mb-1 pt-2">
        {title}
      </h3>
      <div className="rounded-brand border border-brand-border bg-brand-surface px-4 divide-y divide-brand-border">
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
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        'relative inline-flex w-12 h-6 rounded-full transition-colors duration-200',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary',
        checked ? 'bg-brand-primary' : 'bg-brand-border',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-7' : 'translate-x-1',
        ].join(' ')}
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

  return (
    <div className="flex gap-2 w-full">
      <input
        {...rest}
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="
          flex-1 px-3 py-2 rounded-brand border border-brand-border
          bg-brand-bg text-brand-text font-brand text-sm font-mono
          placeholder:text-brand-muted placeholder:font-sans
          focus:outline-none focus:border-brand-primary
        "
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide value' : 'Show value'}
        className="
          px-3 rounded-brand border border-brand-border
          text-brand-muted hover:text-brand-text hover:bg-brand-surface
          text-xs font-brand transition-colors
        "
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
  return (
    <input
      {...props}
      className={[
        'w-full px-3 py-2 rounded-brand border border-brand-border',
        'bg-brand-bg text-brand-text font-brand text-sm',
        'placeholder:text-brand-muted',
        'focus:outline-none focus:border-brand-primary',
        props.className ?? '',
      ].join(' ')}
    />
  );
}

// ─── Select ────────────────────────────────────────────────────────────────────

export function SettingsSelect(props: InputHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const { children, ...rest } = props;
  return (
    <select
      {...rest}
      className={[
        'w-full px-3 py-2 rounded-brand border border-brand-border',
        'bg-brand-bg text-brand-text font-brand text-sm',
        'focus:outline-none focus:border-brand-primary',
        'cursor-pointer',
        props.className ?? '',
      ].join(' ')}
    >
      {children}
    </select>
  );
}
