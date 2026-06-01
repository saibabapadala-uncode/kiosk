// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const brand = process.env.BRAND || 'straunt';
const brandName = brand.charAt(0).toUpperCase() + brand.slice(1);
const isProd = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: `com.${brand}.kiosk`,
  appName: `${brandName} Kiosk`,
  webDir: 'dist',

  server: {
    androidScheme: 'https',
    iosScheme: 'https',
    allowNavigation: [],
    // In development, uncomment to proxy to the Vite dev server:
    // url: 'http://192.168.1.x:3000',
    // cleartext: true,
  },

  android: {
    backgroundColor: '#000000',
    allowMixedContent: false,
    captureInput: true,            // required for barcode scanner keyboard events
    webContentsDebuggingEnabled: !isProd,
    // Keep the screen on while the app is in the foreground
    // (set in AndroidManifest.xml: android:keepScreenOn="true")
  },

  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#000000',
    preferredContentMode: 'mobile',
  },

  plugins: {
    Preferences: {
      group: `com.${brand}.kiosk.prefs`,
    },
    // Screen locked to landscape at app level; the plugin call in
    // useAppLifecycle() re-locks after resume in case the OS unlocked it.
    ScreenOrientation: {
      // Note: actual lock happens via ScreenOrientation.lock() in useAppLifecycle
    },
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#000000',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
  },
};

export default config;
