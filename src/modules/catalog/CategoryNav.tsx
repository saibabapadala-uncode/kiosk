// src/modules/catalog/CategoryNav.tsx
import { useEffect, useRef } from 'react';
import type { Category } from '@/types/catalog';

interface CategoryNavProps {
  categories: Category[];
  activeId: string | null;
  onChange: (id: string | null) => void;
}

export default function CategoryNav({ categories, activeId, onChange }: CategoryNavProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Scroll the active tab into view whenever it changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeId]);

  const tabs: Array<{ id: string | null; name: string }> = [
    { id: null, name: 'All' },
    ...categories.filter((c) => c.available).sort((a, b) => a.sortOrder - b.sortOrder),
  ];

  return (
    <nav
      aria-label="Menu categories"
      className="flex-shrink-0 bg-brand-surface border-b border-brand-border"
    >
      <div
        ref={scrollRef}
        className="flex overflow-x-auto gap-2 px-4 py-2 no-scrollbar"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id ?? '__all__'}
              ref={isActive ? activeRef : undefined}
              onClick={() => onChange(tab.id)}
              aria-pressed={isActive}
              aria-label={`Filter by ${tab.name}`}
              className={[
                'flex-shrink-0 px-5 rounded-full text-sm font-semibold font-brand',
                'transition-colors duration-150 touch-target whitespace-nowrap',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary',
                isActive
                  ? 'bg-brand-primary text-white'
                  : 'bg-brand-bg text-brand-text border border-brand-border hover:bg-brand-surface',
              ].join(' ')}
            >
              {tab.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
