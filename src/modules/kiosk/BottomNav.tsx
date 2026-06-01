// src/modules/kiosk/BottomNav.tsx
// Mobile / tablet bottom navigation. Hidden on lg+ (kiosk mode).
import { useLocation, useHistory } from 'react-router-dom';
import { useCartStore } from '@/store/cartStore';
import { useCartDrawerStore } from '@/store/cartDrawerStore';

interface NavItemProps {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
  icon: React.ReactNode;
}

function NavItem({ label, active, badge, onClick, icon }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={[
        'flex flex-col items-center gap-1 flex-1 py-2 transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary',
        active ? 'text-brand-primary' : 'text-brand-muted',
      ].join(' ')}
    >
      <div className="relative">
        {icon}
        {badge != null && badge > 0 && (
          <span
            aria-label={`${badge} items`}
            className="
              absolute -top-1.5 -right-1.5
              min-w-[18px] h-[18px] rounded-full
              bg-brand-error text-white text-[10px] font-bold
              flex items-center justify-center px-0.5
            "
          >
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-semibold font-brand">{label}</span>
    </button>
  );
}

export default function BottomNav() {
  const history = useHistory();
  const { pathname } = useLocation();
  const open = useCartDrawerStore((s) => s.open);
  const itemCount = useCartStore((s) => s.items.reduce((n, i) => n + i.quantity, 0));

  return (
    <nav
      aria-label="Main navigation"
      className="
        block lg:hidden
        fixed bottom-0 left-0 right-0 z-50
        flex items-stretch
        bg-brand-surface border-t border-brand-border
        safe-area-bottom
      "
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <NavItem
        label="Menu"
        active={pathname === '/menu'}
        onClick={() => history.push('/menu')}
        icon={
          <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        }
      />

      <NavItem
        label="Cart"
        active={pathname === '/cart'}
        badge={itemCount}
        onClick={open}
        icon={
          <svg aria-hidden="true" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
        }
      />
    </nav>
  );
}
