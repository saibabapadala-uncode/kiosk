// src/modules/catalog/SearchBar.tsx
import { useRef } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function SearchBar({ value, onChange, placeholder = 'Search menu...' }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className="
        flex items-center gap-2 px-4 py-2
        bg-brand-surface border-b border-brand-border
      "
    >
      {/* Search icon */}
      <svg
        aria-hidden="true"
        className="w-5 h-5 text-brand-muted flex-shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      <label htmlFor="catalog-search" className="sr-only">
        Search menu items
      </label>

      <input
        id="catalog-search"
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        aria-label="Search menu items"
        className="
          flex-1 bg-transparent text-brand-text font-brand text-base
          placeholder:text-brand-muted
          focus:outline-none
        "
      />

      {/* Clear button */}
      {value && (
        <button
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          aria-label="Clear search"
          className="
            w-6 h-6 flex items-center justify-center rounded-full
            text-brand-muted hover:text-brand-text hover:bg-brand-border
            transition-colors flex-shrink-0
          "
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
