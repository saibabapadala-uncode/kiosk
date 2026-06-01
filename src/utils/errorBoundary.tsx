// src/utils/errorBoundary.tsx
// Class component — required for componentDidCatch.
// Uses inline styles intentionally: brand CSS vars may be unavailable if the
// crash happened inside BrandProvider.
import React, { type ErrorInfo, type ReactNode } from 'react';
import { logger } from './logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function FallbackUI({ error, onReset }: { error: Error | null; onReset: () => void }) {
  const isDev = import.meta.env.DEV;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100dvh',
        background: '#0f172a',
        color: '#f1f5f9',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
        gap: '1.5rem',
      }}
    >
      {/* Icon */}
      <div style={{ fontSize: '4rem', lineHeight: 1 }}>⚠️</div>

      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Something went wrong
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1rem' }}>
          The kiosk encountered an unexpected error.
        </p>
        {isDev && error && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '1rem',
              background: '#1e293b',
              borderRadius: '0.5rem',
              fontSize: '0.75rem',
              color: '#f87171',
              textAlign: 'left',
              maxWidth: '600px',
              overflowX: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {error.stack ?? error.message}
          </pre>
        )}
      </div>

      <button
        onClick={onReset}
        style={{
          padding: '1rem 2.5rem',
          borderRadius: '0.75rem',
          background: '#6366f1',
          color: '#fff',
          fontWeight: 700,
          fontSize: '1rem',
          border: 'none',
          cursor: 'pointer',
          minHeight: '56px',
        }}
      >
        Start Over
      </button>

      <p style={{ color: '#475569', fontSize: '0.75rem' }}>
        If this keeps happening, please contact support.
      </p>
    </div>
  );
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('[ErrorBoundary] Unhandled render error', { error, componentStack: info.componentStack });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    // Navigate to attract — use hard reload as last resort
    window.location.replace('/');
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return <FallbackUI error={this.state.error} onReset={this.handleReset} />;
    }
    return this.props.children;
  }
}
