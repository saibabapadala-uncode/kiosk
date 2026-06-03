// src/modules/settings/tabs/ApiConfigTab.tsx
import { useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';
import { testConnection } from '@/services/api.service';
import { SettingsField, SettingsSection, SettingsInput, MaskedInput } from '../shared';

type TestState = 'idle' | 'testing' | 'ok' | 'error';

export default function ApiConfigTab() {
  const { api, setApi } = useSettingsStore();
  const [testState, setTestState] = useState<TestState>('idle');
  const [testResult, setTestResult] = useState<{ latencyMs: number; error?: string } | null>(null);

  async function handleTest() {
    setTestState('testing');
    setTestResult(null);
    const result = await testConnection();
    setTestResult({ latencyMs: result.latencyMs, error: result.error });
    setTestState(result.ok ? 'ok' : 'error');
  }

  return (
    <div className="p-5">
      <SettingsSection title="Endpoint">
        <SettingsField
          label="API Base URL"
          htmlFor="api-base-url"
          description="All API requests are made relative to this URL."
        >
          <SettingsInput
            id="api-base-url"
            type="url"
            value={api.apiBaseUrl}
            onChange={(e) => setApi({ apiBaseUrl: (e.target as HTMLInputElement).value.trim() })}
            placeholder="https://api.example.com/v1"
          />
        </SettingsField>

        <SettingsField
          label="API Key"
          htmlFor="api-key"
          description="Sent as X-Api-Key header on every request."
        >
          <MaskedInput
            id="api-key"
            value={api.apiKey}
            onChange={(v) => setApi({ apiKey: v })}
            placeholder="sk-••••••••••••••••"
            aria-label="API key"
          />
        </SettingsField>

        <SettingsField
          label="Brand Header"
          htmlFor="brand-header"
          description="Value sent as X-Brand-Header to identify this brand."
        >
          <SettingsInput
            id="brand-header"
            type="text"
            value={api.brandHeader}
            onChange={(e) => setApi({ brandHeader: (e.target as HTMLInputElement).value.trim() })}
            placeholder="your-brand-id"
          />
        </SettingsField>
      </SettingsSection>

      {/* Connection test */}
      <SettingsSection title="Connectivity">
        <SettingsField
          label="Test Connection"
          description="Sends a request to GET /health using the current settings."
        >
          <div className="flex flex-col gap-3">
            <button
              onClick={handleTest}
              disabled={testState === 'testing'}
              aria-label="Test API connection"
              className={[
                'px-5 py-2.5 rounded-brand text-sm font-bold font-brand',
                'transition-all active:scale-95 touch-target',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-primary',
                testState === 'testing'
                  ? 'bg-brand-border text-brand-muted cursor-wait'
                  : 'bg-brand-primary text-white hover:opacity-90',
              ].join(' ')}
            >
              {testState === 'testing' ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Testing…
                </span>
              ) : 'Test Connection'}
            </button>

            {testState === 'ok' && testResult && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 text-sm font-brand"
              >
                <span className="w-5 h-5 rounded-full bg-brand-success flex items-center justify-center text-white text-xs font-bold">✓</span>
                <span className="text-brand-success font-semibold">Connected</span>
                <span className="text-brand-muted">— {testResult.latencyMs}ms</span>
              </div>
            )}

            {testState === 'error' && testResult && (
              <div
                role="alert"
                aria-live="assertive"
                className="flex flex-col gap-1 text-sm font-brand"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-brand-error flex items-center justify-center text-white text-xs font-bold">✕</span>
                  <span className="text-brand-error font-semibold">Connection failed</span>
                  <span className="text-brand-muted">— {testResult.latencyMs}ms</span>
                </div>
                {testResult.error && (
                  <p className="text-xs text-brand-muted font-mono ml-7">{testResult.error}</p>
                )}
              </div>
            )}
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
