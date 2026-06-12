import { useMemo, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { testConnection } from '@/services/api.service';
import { MaskedInput, SettingsInput } from '../shared';
import { themeColors, themeRGBA } from '@/utils/themeColors';

type TestState = 'idle' | 'testing' | 'ok' | 'error';

function ActionButton({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="px-4 py-2.5 rounded-xl text-sm font-bold font-brand text-white active:scale-95 disabled:opacity-45 disabled:cursor-not-allowed transition-all flex items-center gap-2"
      style={{ background: 'var(--gradient-cta)', boxShadow: '0 4px 14px rgba(var(--color-brand-primary-rgb),0.28)' }}
    >
      {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
      {children}
    </button>
  );
}

function FieldCard({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4.5 space-y-2.5" style={{ background: themeColors.surface, border: `1.5px solid ${themeColors.border}` }}>
      <div>
        <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>{title}</p>
        <p className="text-xs font-brand mt-0.5 leading-relaxed" style={{ color: themeColors.muted }}>{hint}</p>
      </div>
      {children}
    </div>
  );
}

export default function ApiConfigTab() {
  const { api, setApi } = useSettingsStore();
  const [testState, setTestState] = useState<TestState>('idle');
  const [testResult, setTestResult] = useState<{ latencyMs: number; error?: string } | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);

  const canTest = useMemo(() => api.apiBaseUrl.trim().length > 0, [api.apiBaseUrl]);

  async function handleTest() {
    setTestState('testing');
    setTestResult(null);
    const result = await testConnection();
    setTestResult({ latencyMs: result.latencyMs, error: result.error });
    setTestState(result.ok ? 'ok' : 'error');
    setLastCheckedAt(new Date());
  }

  return (
    <div className="p-5 max-w-3xl mx-auto space-y-5">


      <FieldCard
        title="Server address"
        hint="Where this kiosk sends all API requests."
      >
        <SettingsInput
          id="api-base-url"
          type="url"
          value={api.apiBaseUrl}
          onChange={(e) => setApi({ apiBaseUrl: (e.target as HTMLInputElement).value.trim() })}
          placeholder="https://api.example.com/v1"
        />
      </FieldCard>

      <FieldCard
        title="Access key"
        hint="Used to authenticate this kiosk with your backend."
      >
        <MaskedInput
          id="api-key"
          value={api.apiKey}
          onChange={(v) => setApi({ apiKey: v })}
          placeholder="sk-••••••••••••••••"
          aria-label="API key"
        />
      </FieldCard>

      <FieldCard
        title="Brand code"
        hint="Sent with requests to identify which brand this kiosk belongs to."
      >
        <SettingsInput
          id="brand-header"
          type="text"
          value={api.brandHeader}
          onChange={(e) => setApi({ brandHeader: (e.target as HTMLInputElement).value.trim() })}
          placeholder="your-brand-id"
        />
      </FieldCard>

      <div className="rounded-2xl p-5 space-y-3.5" style={{ background: themeColors.surface, border: `1.5px solid ${themeColors.border}` }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold font-brand" style={{ color: themeColors.text }}>Connection check</p>
            <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>
              Run a quick health check with the details above.
            </p>
          </div>
          <ActionButton onClick={handleTest} loading={testState === 'testing'} disabled={!canTest}>
            {testState === 'testing' ? 'Checking…' : 'Test connection'}
          </ActionButton>
        </div>

        {lastCheckedAt && (
          <p className="text-xs font-brand" style={{ color: themeColors.muted }}>
            Last checked: {lastCheckedAt.toLocaleTimeString()}
          </p>
        )}

        {testState === 'ok' && testResult && (
          <div className="rounded-xl px-3.5 py-3" style={{ background: themeRGBA('success', 0.08), border: `1px solid ${themeRGBA('success', 0.24)}` }}>
            <p className="text-sm font-bold font-brand" style={{ color: themeColors.success }}>Connected</p>
            <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>Response time: {testResult.latencyMs}ms</p>
          </div>
        )}

        {testState === 'error' && testResult && (
          <div className="rounded-xl px-3.5 py-3" style={{ background: themeRGBA('error', 0.08), border: `1px solid ${themeRGBA('error', 0.24)}` }}>
            <p className="text-sm font-bold font-brand" style={{ color: themeColors.error }}>Could not connect</p>
            <p className="text-xs font-brand mt-0.5" style={{ color: themeColors.muted }}>Response time: {testResult.latencyMs}ms</p>
            {testResult.error && <p className="text-xs font-mono mt-1.5" style={{ color: themeColors.error }}>{testResult.error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
