// src/modules/settings/SettingsScreen.tsx
import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useKioskName } from '@/hooks/useKioskName';
import { logout } from '@/services/auth.service';
import BrandThemeTab from './tabs/BrandThemeTab';
import ApiConfigTab from './tabs/ApiConfigTab';
import PaymentTab from './tabs/PaymentTab';
import KioskBehaviorTab from './tabs/KioskBehaviorTab';
import LocalizationTab from './tabs/LocalizationTab';
import { themeColors } from '@/utils/themeColors';

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
  const kioskName = useKioskName();
  const user      = useAuthStore((s) => s.user);
  const channel   = useKioskChannelStore((s) => s.channel);
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
      <div className="flex items-center gap-3 px-6 py-4 border-b border-brand-border bg-brand-surface flex-shrink-0 shadow-sm">
        <button
          onClick={() => history.goBack()}
          aria-label="Back"
          className="
            w-9 h-9 rounded-xl flex items-center justify-center
            text-brand-muted hover:text-brand-text hover:bg-brand-surface-alt
            active:scale-95 transition-all flex-shrink-0 border border-brand-border
          "
        >
          <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <polyline points="15,18 9,12 15,6" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-extrabold font-brand text-brand-text leading-tight tracking-tight">Settings</h1>
          <p className="text-xs text-brand-muted font-brand font-medium">{kioskName} Kiosk</p>
        </div>

        {/* Session info + sign-out */}
        <div className="flex items-center gap-2.5 flex-shrink-0">
          {user && (
            <div className="hidden sm:flex flex-col items-end mr-1">
              <span className="text-xs font-bold font-brand text-brand-text leading-none">{user.name}</span>
              {channel && (
                <span className="text-[10px] font-brand text-brand-muted leading-none mt-1">{channel.name}</span>
              )}
            </div>
          )}
          {channel && (
            <button
              onClick={handleSwitchKiosk}
              aria-label="Switch kiosk channel"
              className="px-3.5 py-2 rounded-xl text-xs font-brand font-bold transition-all active:scale-95 border hover:opacity-90"
              style={{
                background: 'var(--color-brand-surface-alt)',
                color: themeColors.text,
                borderColor: themeColors.border,
                boxShadow: 'var(--ui-card-shadow)',
              }}
            >
              Switch Kiosk
            </button>
          )}
          <button
            onClick={handleSignOut}
            aria-label="Sign out"
            className="px-3.5 py-2 rounded-xl text-xs font-brand font-bold transition-all active:scale-95 border hover:opacity-90"
            style={{
              background: 'rgba(239,68,68,0.08)',
              color: 'var(--color-brand-error)',
              borderColor: 'rgba(239,68,68,0.20)',
              boxShadow: '0 2px 8px rgba(239,68,68,0.05)',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <nav
        aria-label="Settings tabs"
        className="flex overflow-x-auto no-scrollbar border-b border-brand-border bg-brand-surface flex-shrink-0 px-4 gap-1.5"
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
                'flex items-center gap-2 px-4 py-3.5 text-sm font-bold font-brand relative',
                'whitespace-nowrap flex-shrink-0 transition-all duration-200 outline-none',
                'border-b-2',
                isActive
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-brand-muted hover:text-brand-text',
              ].join(' ')}
            >
              <span aria-hidden="true" className={isActive ? 'animate-bounce-short' : ''}>{tab.icon}</span>
              {/* Full label on kiosk, short on mobile */}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>

              {isActive && (
                <div
                  className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                  style={{ background: 'var(--color-brand-primary)' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab panels */}
      <div className="flex-1 overflow-y-auto bg-brand-bg/40" role="tabpanel" id={`settings-panel-${activeTab}`} aria-label={TABS.find(t => t.id === activeTab)?.label}>
        {activeTab === 'brand'        && <BrandThemeTab />}
        {activeTab === 'api'          && <ApiConfigTab />}
        {activeTab === 'payment'      && <PaymentTab />}
        {activeTab === 'kiosk'        && <KioskBehaviorTab />}
        {activeTab === 'localization' && <LocalizationTab />}
      </div>
      <style>{`
        .animate-bounce-short {
          animation: bounce-short 1s ease infinite alternate;
        }
        @keyframes bounce-short {
          from { transform: translateY(0); }
          to { transform: translateY(-2px); }
        }
      `}</style>
    </div>
  );
}
