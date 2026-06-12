import { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/authStore';
import { useKioskChannelStore } from '@/store/kioskChannelStore';
import { useKioskName } from '@/hooks/useKioskName';
import { logout } from '@/services/auth.service';
import BrandThemeTab from './tabs/BrandThemeTab';
import ApiConfigTab from './tabs/ApiConfigTab';
import PaymentTab from './tabs/PaymentTab';
import PrintersTab from './tabs/PrintersTab';
import KioskBehaviorTab from './tabs/KioskBehaviorTab';
import LocalizationTab from './tabs/LocalizationTab';
import { themeColors, themeRGBA } from '@/utils/themeColors';

type TabId = 'brand' | 'api' | 'payment' | 'printers' | 'kiosk' | 'localization';

function IconPalette({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r="1" /><circle cx="17.5" cy="10.5" r="1" /><circle cx="8.5" cy="7.5" r="1" /><circle cx="6.5" cy="12.5" r="1" />
      <path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-2.4a1.6 1.6 0 0 0 0 3.2h.6A4.8 4.8 0 0 1 12 22z" />
    </svg>
  );
}

function IconPlug({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6" /><path d="M15 2v6" /><path d="M8 7h8a2 2 0 0 1 2 2v1a6 6 0 0 1-6 6v6" /><path d="M12 22h0" />
    </svg>
  );
}

function IconCard({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" />
    </svg>
  );
}

function IconPrinter({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function IconSettings({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7.1 3l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V2a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 20.7 6l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H22a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function IconGlobe({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" />
    </svg>
  );
}

const TAB_CONFIG: Array<{
  id: TabId;
  labelKey: string;
  subtitle: string;
  icon: (props: { size?: number; color?: string }) => JSX.Element;
}> = [
  { id: 'brand',    labelKey: 'settings.brand',        subtitle: 'Colors, look and visual style',              icon: IconPalette  },
  { id: 'api',      labelKey: 'settings.api',          subtitle: 'App connection and backend access',          icon: IconPlug     },
  { id: 'payment',  labelKey: 'settings.paymentDevices', subtitle: 'Stripe reader setup and payment controls',  icon: IconCard     },
  { id: 'printers', labelKey: 'settings.printers',     subtitle: 'Pair and manage receipt printers',           icon: IconPrinter  },
  { id: 'kiosk',    labelKey: 'settings.kiosk',        subtitle: 'Kiosk behavior and hardware options',        icon: IconSettings },
  { id: 'localization', labelKey: 'settings.localization', subtitle: 'Language, currency and regional formats', icon: IconGlobe   },
];

// Fallback label when translation key is missing
const TAB_LABELS: Record<TabId, string> = {
  brand:        'Brand & Theme',
  api:          'API Config',
  payment:      'Payment Devices',
  printers:     'Printers',
  kiosk:        'Kiosk Behavior',
  localization: 'Localization',
};

export default function SettingsScreenContent() {
  const { t } = useTranslation();
  const history = useHistory();
  const kioskName = useKioskName();
  const user = useAuthStore((s) => s.user);
  const channel = useKioskChannelStore((s) => s.channel);
  const clearChannel = useKioskChannelStore((s) => s.clear);
  const [activeTab, setActiveTab] = useState<TabId>('payment');

  function handleSignOut() {
    logout();
    clearChannel();
    history.replace('/login');
  }

  function handleSwitchKiosk() {
    clearChannel();
    history.replace('/channel-select');
  }

  const activeConfig = useMemo(() => TAB_CONFIG.find((tab) => tab.id === activeTab), [activeTab]);

  function tabLabel(tab: typeof TAB_CONFIG[number]): string {
    try {
      const val = t(tab.labelKey);
      // i18next returns the key if translation missing
      return val === tab.labelKey ? TAB_LABELS[tab.id] : val;
    } catch {
      return TAB_LABELS[tab.id];
    }
  }

  const activeLabel = activeConfig ? tabLabel(activeConfig) : t('settings.title');
  const activeSubtitle = activeConfig?.subtitle ?? '';

  return (
    <div className="flex flex-col h-full bg-brand-bg">
      {/* Top bar */}
      <div className="px-3 sm:px-6 py-1.5 sm:py-2 border-b border-brand-border bg-brand-surface/95 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => history.goBack()}
            aria-label={t('common.back')}
            className="w-9 h-9 rounded-xl flex items-center justify-center border border-brand-border text-brand-muted hover:text-brand-text hover:bg-brand-surface-alt transition-all"
          >
            <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
              <polyline points="15,18 9,12 15,6" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-xl font-extrabold font-brand text-brand-text leading-tight">{t('settings.title')}</h1>
            <p className="text-[11px] sm:text-xs font-brand text-brand-muted mt-0.5">{kioskName} {t('settings.kioskSuffix')}</p>
          </div>

          <div className="hidden md:flex items-center gap-2.5">
            {user && (
              <div className="text-right mr-1">
                <p className="text-xs font-bold font-brand text-brand-text leading-none">{user.name}</p>
                {channel && <p className="text-[10px] font-brand text-brand-muted leading-none mt-1">{channel.name}</p>}
              </div>
            )}
            {channel && (
              <button
                onClick={handleSwitchKiosk}
                aria-label={t('settings.switchKiosk')}
                className="px-3.5 py-2 rounded-xl text-xs font-bold font-brand border hover:opacity-90"
                style={{ background: themeColors.surfaceAlt, color: themeColors.text, borderColor: themeColors.border }}
              >
                {t('settings.switchKiosk')}
              </button>
            )}
            <button
              onClick={handleSignOut}
              aria-label={t('settings.signOut')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold font-brand border hover:opacity-90"
              style={{ background: themeRGBA('error', 0.08), color: themeColors.error, borderColor: themeRGBA('error', 0.24) }}
            >
              {t('settings.signOut')}
            </button>
          </div>
        </div>
      </div>

      {/* Body: sidebar + content */}
      <div className="flex-1 min-h-0">
        <div className="h-full grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="border-b lg:border-b-0 lg:border-r border-brand-border bg-brand-surface/55">
            <div className="lg:p-3 overflow-x-auto lg:overflow-y-auto no-scrollbar">
              <nav aria-label={t('settings.title')} className="flex lg:flex-col gap-1.5 px-2 py-2 min-w-max lg:min-w-0">
                {TAB_CONFIG.map((tab) => {
                  const active = activeTab === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className="w-full text-left rounded-xl px-3.5 py-3 flex items-center gap-3 transition-all"
                      style={{
                        background: active ? themeRGBA('primary', 0.1) : 'transparent',
                        color: active ? 'var(--color-brand-primary)' : themeColors.muted,
                        border: `1px solid ${active ? themeRGBA('primary', 0.28) : 'transparent'}`,
                      }}
                    >
                      <span
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? themeRGBA('primary', 0.14) : themeColors.surfaceAlt }}
                      >
                        <Icon size={16} color={active ? 'var(--color-brand-primary)' : themeColors.muted} />
                      </span>
                      <span className="text-sm font-bold font-brand whitespace-nowrap">{tabLabel(tab)}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Content panel */}
          <section className="flex flex-col min-h-0">
            <div className="px-4 sm:px-6 py-1.5 sm:py-2 border-b border-brand-border bg-brand-surface/75 flex-shrink-0">
              <h2 className="text-sm sm:text-lg font-extrabold font-brand" style={{ color: themeColors.text }}>
                {activeLabel}
              </h2>
              <p className="text-[11px] sm:text-sm font-brand mt-0.5 sm:mt-1" style={{ color: themeColors.muted }}>
                {activeSubtitle}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto bg-brand-bg/45">
              {activeTab === 'brand'        && <BrandThemeTab />}
              {activeTab === 'api'          && <ApiConfigTab />}
              {activeTab === 'payment'      && <PaymentTab />}
              {activeTab === 'printers'     && <PrintersTab />}
              {activeTab === 'kiosk'        && <KioskBehaviorTab />}
              {activeTab === 'localization' && <LocalizationTab />}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
