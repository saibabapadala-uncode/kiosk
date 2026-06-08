// src/modules/settings/tabs/PaymentTab.tsx
// Stripe Reader M2 connection management + Stripe configuration.

import { useState, useCallback } from 'react';
import { useSettingsStore }          from '@/store/settingsStore';
import { useReaderConnection }       from '@/hooks/useReaderConnection';
import type { ReaderConnectionStatus } from '@/hooks/useReaderConnection';
import type { TerminalReader }       from '@/services/stripe/types';
import { SettingsField, SettingsSection, SettingsInput, MaskedInput, ToggleSwitch } from '../shared';
import { themeColors, themeRGBA } from '@/utils/themeColors';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec.toString().padStart(2, '0')}s` : `${sec}s`;
}

function batteryColor(level: number | undefined): string {
  if (level === undefined) return themeColors.muted;
  if (level > 0.5) return themeColors.success;
  if (level > 0.2) return 'var(--color-brand-primary)';
  return themeColors.error;
}

// ─── Status indicator ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ReaderConnectionStatus, { label: string; color: string; pulse: boolean }> = {
  idle:          { label: 'Not connected',  color: 'var(--color-brand-muted)', pulse: false },
  initializing:  { label: 'Initializing…', color: 'var(--color-brand-primary)', pulse: true  },
  discovering:   { label: 'Scanning…',     color: '#3B82F6', pulse: true  }, // dev/scanning is blue
  connecting:    { label: 'Connecting…',   color: 'var(--color-brand-primary)', pulse: true  },
  connected:     { label: 'Connected',     color: 'var(--color-brand-success)', pulse: false },
  reconnecting:  { label: 'Reconnecting…', color: 'var(--color-brand-primary)', pulse: true  },
  disconnecting: { label: 'Disconnecting…',color: 'var(--color-brand-muted)', pulse: true  },
  disconnected:  { label: 'Disconnected',  color: 'var(--color-brand-muted)', pulse: false },
  timeout:       { label: 'Session ended', color: 'var(--color-brand-primary)', pulse: false },
  error:         { label: 'Error',         color: 'var(--color-brand-error)', pulse: false },
};

function StatusBadge({ status }: { status: ReaderConnectionStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className="flex items-center gap-2 text-xs font-bold font-brand">
      <span
        className={cfg.pulse ? 'animate-pulse' : ''}
        style={{
          display: 'inline-block', width: 9, height: 9,
          borderRadius: '50%', background: cfg.color, flexShrink: 0,
        }}
      />
      <span style={{ color: cfg.color }}>{cfg.label}</span>
    </span>
  );
}

// ─── Battery bar ──────────────────────────────────────────────────────────────

function BatteryBar({ level }: { level: number | undefined }) {
  if (level === undefined) return null;
  const pct  = Math.round(level * 100);
  const color = batteryColor(level);
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center" style={{ width: 28, height: 14 }}>
        {/* Body */}
        <div style={{ flex: 1, height: '100%', borderRadius: 3, border: `1.5px solid ${color}`, overflow: 'hidden', position: 'relative' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 500ms' }} />
        </div>
        {/* Terminal nub */}
        <div style={{ width: 3, height: 7, background: color, borderRadius: '0 2px 2px 0', marginLeft: 1 }} />
      </div>
      <span className="text-xs font-brand font-semibold" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ─── Reader card ──────────────────────────────────────────────────────────────

function ReaderCard({
  reader,
  isSelected,
  isConnected,
  onSelect,
}: {
  reader: TerminalReader;
  isSelected: boolean;
  isConnected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className="rounded-2xl p-4 transition-all duration-200"
      style={{
        background: isSelected ? themeRGBA('primary', 0.08) : themeColors.surface,
        border: `1.5px solid ${isSelected ? 'var(--color-brand-primary)' : themeColors.border}`,
        boxShadow: 'var(--ui-card-shadow)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Reader icon + info */}
        <div className="flex items-center gap-3">
          {/* M2 icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: isConnected ? themeRGBA('success', 0.12) : themeColors.surfaceAlt,
              border: `1px solid ${isConnected ? themeRGBA('success', 0.25) : themeColors.border}`
            }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"
              stroke={isConnected ? themeColors.success : themeColors.muted} strokeWidth={1.8} strokeLinecap="round">
              <rect x="2" y="6" width="20" height="13" rx="2"/>
              <path d="M2 10h20"/>
              <circle cx="6" cy="15" r="1.2" fill={isConnected ? themeColors.success : themeColors.muted} stroke="none"/>
            </svg>
          </div>
          <div>
            <p className="font-bold font-brand text-sm" style={{ color: themeColors.text }}>{reader.label}</p>
            <p className="text-xs font-mono font-brand mt-0.5" style={{ color: themeColors.muted }}>{reader.serialNumber}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs font-brand font-medium" style={{ color: themeColors.muted }}>
                {reader.deviceType === 'stripeM2' ? 'Stripe Reader M2' : reader.deviceType}
              </span>
              {reader.status && (
                <span className="text-xs font-brand font-bold" style={{ color: reader.status === 'online' ? themeColors.success : themeColors.muted }}>
                  · {reader.status}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2.5 flex-shrink-0">
          <BatteryBar level={reader.batteryLevel} />
          {isConnected ? (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold font-brand border"
              style={{
                background: themeRGBA('success', 0.12),
                color: themeColors.success,
                borderColor: themeRGBA('success', 0.25),
              }}
            >
              ✓ Active
            </span>
          ) : (
            <button
              type="button"
              onClick={onSelect}
              className="px-3 py-1 rounded-full text-xs font-bold font-brand transition-all active:scale-95 border"
              style={{
                background: 'transparent',
                borderColor: 'var(--color-brand-primary)',
                color: 'var(--color-brand-primary)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = themeRGBA('primary', 0.12);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              Use This
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Session countdown ────────────────────────────────────────────────────────

function SessionCountdown({ seconds }: { seconds: number }) {
  const urgent = seconds < 120;
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border"
      style={{
        background: urgent ? themeRGBA('warning', 0.12) : themeRGBA('success', 0.12),
        borderColor: urgent ? themeRGBA('warning', 0.25) : themeRGBA('success', 0.25),
      }}
    >
      <svg className="w-4.5 h-4.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
        stroke={urgent ? 'var(--color-brand-primary)' : themeColors.success} strokeWidth={2.2} strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <div className="flex-1">
        <p className="text-xs font-bold font-brand" style={{ color: urgent ? 'var(--color-brand-primary)' : themeColors.success }}>
          Session {urgent ? 'ending soon' : 'active'}
        </p>
        <p className="text-xs font-brand mt-0.5" style={{ color: urgent ? 'var(--color-brand-primary)' : themeColors.success }}>
          Auto-disconnects in <strong>{formatSeconds(seconds)}</strong>
        </p>
      </div>
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function PaymentTab() {
  const { payment, setPayment } = useSettingsStore();
  const {
    status, connectedReader, discoveredReaders, error,
    sessionSecondsLeft, reconnectAttempts,
    initialize, discover, connect, disconnect, reconnect,
  } = useReaderConnection();

  const [selectedSerial, setSelectedSerial] = useState('');

  const isActive      = status === 'connected' || status === 'reconnecting';
  const isBusy        = ['initializing','discovering','connecting','disconnecting','reconnecting'].includes(status);

  const handleDiscover = useCallback(async () => {
    if (!payment.terminalLocationId.trim()) return;
    await initialize();
    await discover();
  }, [payment.terminalLocationId, initialize, discover]);

  const handleConnect = useCallback(async () => {
    const sn = selectedSerial || payment.readerSerialNumber;
    await connect(sn || undefined);
  }, [selectedSerial, payment.readerSerialNumber, connect]);

  const handleSelectReader = useCallback((sn: string) => {
    setSelectedSerial(sn);
    setPayment({ readerSerialNumber: sn });
  }, [setPayment]);

  return (
    <div className="p-5 space-y-0 max-w-7xl mx-auto">

      {/* ── 1. Stripe Configuration ─────────────────────────────────────── */}
      <SettingsSection title="Stripe Configuration">
        <SettingsField label="Publishable Key" htmlFor="stripe-pk"
          description="Starts with pk_live_ or pk_test_">
          <MaskedInput
            id="stripe-pk"
            value={payment.stripePublishableKey}
            onChange={(v) => setPayment({ stripePublishableKey: v })}
            placeholder="pk_live_••••••••••••••••"
            aria-label="Stripe publishable key"
          />
        </SettingsField>
      </SettingsSection>

      {/* ── 2. Reader Connection Settings ───────────────────────────────── */}
      <SettingsSection title="Reader Connection">

        {/* Connection method */}
        <SettingsField label="Connection Method" description="Stripe Reader M2 uses Bluetooth.">
          <div className="flex gap-2.5 flex-wrap">
            {([ ['bluetooth','Bluetooth (M2)'], ['internet','Internet/WiFi'], ['localMobile','Tap to Pay'] ] as const).map(
              ([val, label]) => {
                const isSelected = payment.connectionMethod === val;
                return (
                  <button key={val} type="button"
                    onClick={() => setPayment({ connectionMethod: val })}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold font-brand transition-all active:scale-95 border"
                    style={isSelected ? {
                      background: 'var(--gradient-cta)',
                      color: 'white',
                      borderColor: 'var(--color-brand-primary)',
                      boxShadow: '0 4px 14px rgba(var(--color-brand-primary-rgb),0.32)',
                    } : {
                      background: themeColors.surfaceAlt,
                      color: themeColors.text,
                      borderColor: themeColors.border,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-brand-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = themeColors.border;
                      }
                    }}
                  >
                    {val === 'bluetooth'    && <span>📶</span>}
                    {val === 'internet'     && <span>🌐</span>}
                    {val === 'localMobile'  && <span>📱</span>}
                    {label}
                  </button>
                );
              },
            )}
          </div>
        </SettingsField>

        {/* Location ID */}
        <SettingsField label="Terminal Location ID" htmlFor="terminal-location"
          description="Found in Stripe Dashboard → Terminal → Locations">
          <SettingsInput
            id="terminal-location"
            type="text"
            value={payment.terminalLocationId}
            onChange={(e) => setPayment({ terminalLocationId: (e.target as HTMLInputElement).value.trim() })}
            placeholder="tml_xxxxxxxxxxxx"
          />
        </SettingsField>

        {/* Serial number */}
        <SettingsField label="Reader Serial Number" htmlFor="reader-serial"
          description={`Found on the back label of the M2 reader. SN: STRM…`}>
          <SettingsInput
            id="reader-serial"
            type="text"
            value={payment.readerSerialNumber}
            onChange={(e) => {
              const v = (e.target as HTMLInputElement).value.trim().toUpperCase();
              setPayment({ readerSerialNumber: v });
              setSelectedSerial(v);
            }}
            placeholder="STRM26XXXXXXXXX"
          />
        </SettingsField>
      </SettingsSection>

      {/* ── 3. Live Connection Panel ─────────────────────────────────────── */}
      <SettingsSection title="Reader Status">

        {/* Live status row */}
        <div className="flex items-center justify-between px-1 py-2">
          <StatusBadge status={status} />
          {reconnectAttempts > 0 && !isActive && (
            <span className="text-xs font-bold font-brand" style={{ color: themeColors.muted }}>
              Attempt {reconnectAttempts}/{3}
            </span>
          )}
        </div>

        {/* Connected reader card */}
        {isActive && connectedReader && (
          <div className="py-2">
            <ReaderCard
              reader={connectedReader}
              isSelected
              isConnected
              onSelect={() => {}}
            />
          </div>
        )}

        {/* Session countdown */}
        {isActive && sessionSecondsLeft !== null && (
          <div className="py-2">
            <SessionCountdown seconds={sessionSecondsLeft} />
          </div>
        )}

        {/* Session ended notice */}
        {status === 'timeout' && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border my-2"
            style={{
              background: themeRGBA('warning', 0.12),
              borderColor: themeRGBA('warning', 0.25),
            }}
          >
            <span className="text-lg mt-0.5">⏱</span>
            <div>
              <p className="text-xs font-bold font-brand" style={{ color: 'var(--color-brand-primary)' }}>Session timed out</p>
              <p className="text-xs font-brand mt-1 leading-relaxed" style={{ color: themeColors.text }}>
                Reader was disconnected after {payment.sessionTimeoutMinutes} min of no payment activity.
                Reconnect when needed.
              </p>
            </div>
          </div>
        )}

        {/* Error notice */}
        {status === 'error' && error && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl border my-2"
            style={{
              background: themeRGBA('error', 0.12),
              borderColor: themeRGBA('error', 0.25),
            }}
          >
            <svg className="w-5 h-5 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none"
              stroke={themeColors.error} strokeWidth={2.2} strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p className="text-xs font-brand font-medium leading-relaxed" style={{ color: themeColors.error }}>{error}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2.5 pt-3 pb-2">
          {/* Discover */}
          {!isActive && (
            <button type="button" onClick={() => void handleDiscover()}
              disabled={isBusy || !payment.terminalLocationId.trim()}
              className="flex items-center gap-2 px-4.5 py-3 rounded-xl text-xs font-bold font-brand transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
              style={{ background: 'linear-gradient(135deg,#3B82F6,#2563EB)', color: 'white' }}
            >
              {status === 'discovering' ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"/>&nbsp;Scanning…</>
              ) : (
                <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>Discover</>
              )}
            </button>
          )}

          {/* Connect */}
          {!isActive && (
            <button type="button" onClick={() => void handleConnect()}
              disabled={isBusy || (!payment.readerSerialNumber && !selectedSerial)}
              className="flex items-center gap-2 px-4.5 py-3 rounded-xl text-xs font-bold font-brand transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
              style={{ background: 'linear-gradient(135deg,#22C55E,#16A34A)', color: 'white' }}
            >
              {status === 'connecting' ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"/>&nbsp;Connecting…</>
              ) : (
                <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/>
                  <path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill="white"/>
                </svg>Connect</>
              )}
            </button>
          )}

          {/* Reconnect after error */}
          {(status === 'error' || status === 'disconnected' || status === 'timeout') && reconnectAttempts > 0 && (
            <button type="button" onClick={() => void reconnect()}
              disabled={isBusy}
              className="flex items-center gap-2 px-4.5 py-3 rounded-xl text-xs font-bold font-brand transition-all active:scale-95 border"
              style={{
                background: themeRGBA('warning', 0.12),
                color: 'var(--color-brand-primary)',
                borderColor: themeRGBA('warning', 0.25),
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = themeRGBA('warning', 0.18);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = themeRGBA('warning', 0.12);
              }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
              </svg>
              Retry
            </button>
          )}

          {/* Disconnect */}
          {(isActive || status === 'disconnecting') && (
            <button type="button" onClick={() => void disconnect()}
              disabled={status === 'disconnecting'}
              className="flex items-center gap-2 px-4.5 py-3 rounded-xl text-xs font-bold font-brand transition-all active:scale-95 border"
              style={{
                background: themeRGBA('error', 0.12),
                color: themeColors.error,
                borderColor: themeRGBA('error', 0.25),
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = themeRGBA('error', 0.18);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = themeRGBA('error', 0.12);
              }}
            >
              {status === 'disconnecting' ? (
                <><span className="w-3.5 h-3.5 rounded-full border-2 border-red-500 border-t-transparent animate-spin"/>&nbsp;Disconnecting…</>
              ) : (
                <><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>Disconnect</>
              )}
            </button>
          )}
        </div>

        {/* Discovered readers (not yet connected) */}
        {discoveredReaders.length > 0 && !isActive && (
          <div className="flex flex-col gap-3.5 pt-3">
            <p className="text-[10px] font-bold font-brand uppercase tracking-wider pl-1" style={{ color: themeColors.muted }}>
              {discoveredReaders.length} reader{discoveredReaders.length !== 1 ? 's' : ''} found
            </p>
            {discoveredReaders.map((r) => (
              <ReaderCard
                key={r.serialNumber}
                reader={r}
                isSelected={payment.readerSerialNumber === r.serialNumber}
                isConnected={false}
                onSelect={() => handleSelectReader(r.serialNumber)}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      {/* ── 4. Session & Reliability ─────────────────────────────────────── */}
      <SettingsSection title="Session & Reliability">

        {/* Session timeout */}
        <SettingsField
          label="Session Timeout"
          htmlFor="session-timeout"
          description={
            payment.sessionTimeoutMinutes === 0
              ? 'Reader stays connected indefinitely.'
              : `Reader disconnects after ${payment.sessionTimeoutMinutes} min of no payment activity.`
          }
        >
          <div className="flex flex-col gap-2 w-full">
            <div className="flex items-center gap-3">
              <span className="text-xs font-brand text-brand-muted w-12">Off</span>
              <input
                id="session-timeout"
                type="range" min={0} max={120} step={5}
                value={payment.sessionTimeoutMinutes}
                onChange={(e) => setPayment({ sessionTimeoutMinutes: Number(e.target.value) })}
                className="flex-1 accent-[var(--color-brand-primary)]"
              />
              <span className="text-xs font-brand text-brand-muted w-12 text-right">2 h</span>
            </div>
            <p className="text-sm font-bold font-brand text-brand-primary text-center">
              {payment.sessionTimeoutMinutes === 0 ? 'No timeout' : `${payment.sessionTimeoutMinutes} min`}
            </p>
          </div>
        </SettingsField>

        {/* Auto-reconnect */}
        <SettingsField
          label="Auto-Reconnect"
          description="Automatically try to reconnect if the reader drops unexpectedly (up to 3 attempts)."
        >
          <ToggleSwitch
            checked={payment.autoReconnect}
            onChange={(v) => setPayment({ autoReconnect: v })}
            label="Enable auto-reconnect"
          />
        </SettingsField>

      </SettingsSection>

      {/* ── M2 quick-reference ──────────────────────────────────────────── */}
      <SettingsSection title="Reader Reference">
        <div className="rounded-xl p-4.5 flex items-start gap-4"
          style={{
            background: themeColors.surfaceAlt,
            border: `1.5px solid ${themeColors.border}`
          }}
        >
          {/* M2 silhouette */}
          <div className="w-12 h-16 rounded-xl flex-shrink-0 flex items-center justify-center border"
            style={{
              background: themeColors.surface,
              borderColor: themeColors.border,
            }}
          >
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="var(--color-brand-muted)" strokeWidth={1.8} strokeLinecap="round">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <line x1="4" y1="8" x2="20" y2="8"/>
              <circle cx="12" cy="14" r="3"/>
            </svg>
          </div>
          <div>
            <p className="font-extrabold font-brand text-sm" style={{ color: themeColors.text }}>Stripe Reader M2 (STRM2-01 B)</p>
            <div className="mt-2.5 space-y-1.5">
              {[
                ['Connection',   'Bluetooth 5.0'],
                ['Model',        'STRM2-01 B'],
                ['Pairing',      'First, press the power button for 5 s'],
                ['LED Indicator','Solid white = ready · Flashing = pairing'],
                ['Charging',     'USB-C · ~2 h for full charge'],
              ].map(([k, v]) => (
                <p key={k} className="text-xs font-brand" style={{ color: themeColors.muted }}>
                  <span className="font-bold" style={{ color: themeColors.text }}>{k}: </span>{v}
                </p>
              ))}
            </div>
          </div>
        </div>
      </SettingsSection>

    </div>
  );
}
