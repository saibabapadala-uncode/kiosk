// src/modules/settings/SettingsScreen.tsx
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useBrand } from '@/hooks/useBrand';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { logout } from '@/services/auth.service';
import BrandThemeTab from './tabs/BrandThemeTab';
import ApiConfigTab from './tabs/ApiConfigTab';
import PaymentTab from './tabs/PaymentTab';
import KioskBehaviorTab from './tabs/KioskBehaviorTab';
import LocalizationTab from './tabs/LocalizationTab';

// ─── Tab definitions ───────────────────────────────────────────────────────────

type TabId = 'brand' | 'api' | 'payment' | 'kiosk' | 'localization';

interface Tab {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'brand',        label: 'Brand & Theme',   shortLabel: 'Brand',  icon: '🎨' },
  { id: 'api',          label: 'API Config',       shortLabel: 'API',    icon: '🔌' },
  { id: 'payment',      label: 'Payment / Stripe', shortLabel: 'Payment',icon: '💳' },
  { id: 'kiosk',        label: 'Kiosk Behavior',   shortLabel: 'Kiosk',  icon: '⚙️'  },
  { id: 'localization', label: 'Localization',      shortLabel: 'Locale', icon: '🌐' },
];

// ─── Settings screen ───────────────────────────────────────────────────────────

export default function SettingsScreenContent() {
  const history  = useHistory();
  const { environment } = useBrand();
  const user     = useAuthStore((s) => s.user);
  const channel  = useKioskChannelStore((s) => s.channel);
  const clearChannel = useKioskChannelStore((s) => s.clear);
  const [activeTab, setActiveTab] = useState<TabId>('brand');

  function handleSignOut() {
    logout();
    clearChannel();
    history.replace('/login');
  }

  function handleSwitchKiosk() {
    clearChannel();
    history.replace('/channel-select');
  }

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-brand-border bg-brand-surface flex-shrink-0">
        <button
          onClick={() => history.goBack()}
          aria-label="Back"
          className="
            w-9 h-9 rounded-full flex items-center justify-center
            text-brand-muted hover:bg-brand-border transition-colors flex-shrink-0
          "
        >
          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold font-brand text-brand-text leading-tight">Settings</h1>
          <p className="text-xs text-brand-muted font-brand">{environment.displayName} Kiosk</p>
        </div>

        {/* Session info + sign-out */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {user && (
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold font-brand text-brand-text leading-none">{user.name}</span>
              {channel && (
                <span className="text-[10px] font-brand text-brand-muted leading-none mt-0.5">{channel.name}</span>
              )}
            </div>
          )}
          {channel && (
            <button
              onClick={handleSwitchKiosk}
              aria-label="Switch kiosk channel"
              className="px-2.5 py-1.5 rounded-lg text-xs font-brand font-semibold transition-colors"
              style={{ background: 'var(--color-ui-surface-alt)', color: 'var(--color-brand-muted)', border: '1px solid var(--ui-glass-border)' }}
            >
              Switch Kiosk
            </button>
          )}
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="px-2.5 py-1.5 rounded-lg text-xs font-brand font-semibold transition-colors"
            style={{ background: 'rgba(239,68,68,0.10)', color: 'var(--color-brand-error)', border: '1px solid rgba(239,68,68,0.20)' }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <nav
        aria-label="Settings tabs"
        className="flex overflow-x-auto no-scrollbar border-b border-brand-border bg-brand-surface flex-shrink-0"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'flex items-center gap-1.5 px-4 py-3 text-sm font-semibold font-brand',
                'whitespace-nowrap flex-shrink-0 transition-colors',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary',
                'border-b-2',
                isActive
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-brand-muted hover:text-brand-text hover:border-brand-border',
              ].join(' ')}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {/* Full label on kiosk, short on mobile */}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Tab panels */}
      <div className="flex-1 overflow-y-auto" role="tabpanel" id={`settings-panel-${activeTab}`} aria-label={TABS.find(t => t.id === activeTab)?.label}>
        {activeTab === 'brand'        && <BrandThemeTab />}
        {activeTab === 'api'          && <ApiConfigTab />}
        {activeTab === 'payment'      && <PaymentTab />}
        {activeTab === 'kiosk'        && <KioskBehaviorTab />}
        {activeTab === 'localization' && <LocalizationTab />}
      </div>
    </div>
  );
}
