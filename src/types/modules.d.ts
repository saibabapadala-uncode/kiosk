// src/types/modules.d.ts
// ─── @capacitor/network ────────────────────────────────────────────────────────

declare module '@capacitor/network' {
  export interface ConnectionStatus {
    connected: boolean;
    connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
  }
  export const Network: {
    getStatus(): Promise<ConnectionStatus>;
    addListener(
      event: 'networkStatusChange',
      handler: (status: ConnectionStatus) => void,
    ): Promise<{ remove(): Promise<void> }>;
  };
}

// ─── @capacitor/app ───────────────────────────────────────────────────────────

declare module '@capacitor/app' {
  export interface AppState { isActive: boolean }
  export const App: {
    addListener(event: 'backButton', handler: (data: { canGoBack: boolean }) => void): Promise<{ remove(): Promise<void> }>;
    addListener(event: 'appStateChange', handler: (state: AppState) => void): Promise<{ remove(): Promise<void> }>;
    addListener(event: 'resume', handler: () => void): Promise<{ remove(): Promise<void> }>;
    addListener(event: 'pause', handler: () => void): Promise<{ remove(): Promise<void> }>;
    exitApp(): Promise<void>;
    getInfo(): Promise<{ id: string; name: string; build: string; version: string }>;
  };
}

// ─── @capacitor/screen-orientation ────────────────────────────────────────────

declare module '@capacitor/screen-orientation' {
  export type OrientationType =
    | 'landscape'
    | 'landscape-primary'
    | 'landscape-secondary'
    | 'portrait'
    | 'portrait-primary'
    | 'portrait-secondary';
  export const ScreenOrientation: {
    lock(opts: { orientation: OrientationType }): Promise<void>;
    unlock(): Promise<void>;
    getCurrentOrientation(): Promise<{ type: OrientationType }>;
  };
}

// ─── @capacitor/status-bar ────────────────────────────────────────────────────

declare module '@capacitor/status-bar' {
  export enum Style { Dark = 'DARK', Light = 'LIGHT', Default = 'DEFAULT' }
  export const StatusBar: {
    hide(): Promise<void>;
    show(): Promise<void>;
    setStyle(opts: { style: Style }): Promise<void>;
    setBackgroundColor(opts: { color: string }): Promise<void>;
    setOverlaysWebView(opts: { overlay: boolean }): Promise<void>;
  };
}
