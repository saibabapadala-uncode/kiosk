// src/plugins/stripe-terminal/definitions.ts

export interface TerminalReader {
  serialNumber: string;
  label: string;
  deviceType:
    | 'bbposWisePad3'
    | 'bbposChipper2X'
    | 'verifoneP400'
    | 'stripeM2'
    | 'appleBuiltIn' // Tap to Pay on iPhone
    | 'tapToPayAndroid'
    | 'unknown';
  status: 'online' | 'offline' | 'unknown';
  batteryLevel: number; // 0–1, -1 if not applicable
  locationId?: string;
  ipAddress?: string;
  isSimulated: boolean;
}

export interface CollectPaymentOptions {
  clientSecret: string;
  skipTipping?: boolean;
  tipEligibleAmount?: number;
}

export interface ConfirmPaymentResult {
  id: string;
  status: 'succeeded' | 'requires_capture' | 'canceled';
  amount: number;
  currency: string;
  offlineDetails?: {
    requiresUpload: boolean;
    storedAt?: string;
  };
}

export interface OfflineStatus {
  pendingPaymentAmount: number;
  pendingPaymentsCount: number;
  networkStatus: 'online' | 'offline';
}

export type ReaderInputOption = 'swipe' | 'chip' | 'tap' | 'manual_entry';

export type ReaderDisplayMessage =
  | 'retry_card'
  | 'insert_card'
  | 'insert_or_swipe_card'
  | 'swipe_card'
  | 'remove_card'
  | 'multiple_contactless_cards_detected'
  | 'try_another_read_method'
  | 'try_another_card'
  | 'check_mobile_device';

export interface StripeTerminalPlugin {
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  initialize(): Promise<void>;
  /** Fetch and return the Stripe connection token from your backend. */
  fetchConnectionToken(): Promise<{ secret: string }>;

  // ── Discovery ─────────────────────────────────────────────────────────────
  /** Start discovery (results arrive via 'readersDiscovered' events). */
  discoverReaders(options: {
    method: 'bluetooth' | 'internet' | 'localMobile';
    locationId?: string;
    simulated?: boolean;
  }): Promise<void>;
  cancelDiscovery(): Promise<void>;

  // ── Connection ────────────────────────────────────────────────────────────
  connectBluetoothReader(options: {
    serialNumber: string;
    locationId: string;
  }): Promise<TerminalReader>;

  connectInternetReader(options: {
    serialNumber: string;
    failIfInUse?: boolean;
  }): Promise<TerminalReader>;

  /** Tap to Pay — uses the phone's NFC hardware. Requires approved location. */
  connectLocalMobileReader(options: {
    locationId: string;
  }): Promise<TerminalReader>;

  disconnectReader(): Promise<void>;
  getConnectedReader(): Promise<{ reader: TerminalReader | null }>;

  // ── Payment ───────────────────────────────────────────────────────────────
  retrievePaymentIntent(options: { clientSecret: string }): Promise<void>;
  collectPaymentMethod(options: CollectPaymentOptions): Promise<void>;
  confirmPaymentIntent(): Promise<ConfirmPaymentResult>;
  cancelCollect(): Promise<void>;

  // ── Offline ───────────────────────────────────────────────────────────────
  getOfflineStatus(): Promise<OfflineStatus>;

  // ── Events ────────────────────────────────────────────────────────────────
  addListener(
    event: 'readersDiscovered',
    handler: (data: { readers: TerminalReader[] }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'readerConnectionStatusChange',
    handler: (data: { status: 'connecting' | 'connected' | 'not_connected' }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'paymentStatusChange',
    handler: (data: { status: 'not_ready' | 'ready' | 'waiting_for_input' | 'processing' }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'readerDisplayMessage',
    handler: (data: { message: ReaderDisplayMessage }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'readerInputOptions',
    handler: (data: { options: ReaderInputOption[] }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'offlineStatusChange',
    handler: (data: OfflineStatus) => void,
  ): Promise<{ remove(): Promise<void> }>;

  addListener(
    event: 'unexpectedReaderDisconnect',
    handler: (data: { reader: TerminalReader }) => void,
  ): Promise<{ remove(): Promise<void> }>;

  removeAllListeners(): Promise<void>;
}
