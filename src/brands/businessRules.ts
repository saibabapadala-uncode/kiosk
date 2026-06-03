// src/brands/businessRules.ts
// Per-brand behavioral configuration — business rules, not visual tokens.
// Components import and branch on these typed values rather than on brandId strings.

// ─── Payment ──────────────────────────────────────────────────────────────────

export type PaymentMethod = 'card' | 'cash' | 'qr_code' | 'upi' | 'gift_card';

// ─── Loyalty ──────────────────────────────────────────────────────────────────

export type LoyaltyLookupMethod = 'phone' | 'barcode' | 'email';

export interface LoyaltyConfig {
  enabled: boolean;
  programName: string;
  lookupMethod: LoyaltyLookupMethod;
}

// ─── Tipping ──────────────────────────────────────────────────────────────────

export interface TipConfig {
  /** When false the /tip route is bypassed entirely. */
  enabled: boolean;
  /** Quick-tap preset percentages, e.g. [15, 18, 20]. */
  presets: number[];
  customAllowed: boolean;
  /** Pre-selected percentage on open. undefined = no pre-selection. */
  defaultPercent?: number;
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

export interface ReceiptConfig {
  logoOnReceipt: boolean;
  /** Marketing message at bottom. Empty = no footer. */
  footerMessage: string;
  showTaxBreakdown: boolean;
  printEnabled: boolean;
  /** Seconds before auto-returning to attract screen. */
  autoReturnSeconds: number;
}

// ─── Order flow ───────────────────────────────────────────────────────────────

export type OrderType = 'dine-in' | 'takeout';

export interface OrderFlowConfig {
  dineInEnabled: boolean;
  takeoutEnabled: boolean;
  /** When true show a dine-in/takeout prompt before catalog. */
  askOrderType: boolean;
  defaultOrderType: OrderType;
}

// ─── Upsell ───────────────────────────────────────────────────────────────────

export type UpsellTriggerStage = 'cart' | 'checkout' | 'both';

export interface UpsellConfig {
  enabled: boolean;
  triggerStage: UpsellTriggerStage;
  maxSuggestions: number;
}

// ─── Dietary / food labelling ─────────────────────────────────────────────────

export interface DietaryBadge {
  /** Short label shown on badge, e.g. "V", "VE", "GF". */
  label: string;
  /** Full accessible name, e.g. "Vegetarian". */
  name: string;
  /** Background color for the badge chip. */
  color: string;
  /** Text color on the badge chip (default: #FFFFFF). */
  textColor?: string;
}

export interface DietaryConfig {
  /**
   * Enabled badge types for this brand.
   * Key is the product flag field name (e.g. "isVeg", "isVegan", "isGlutenFree").
   */
  badges: Record<string, DietaryBadge>;
  /** Whether to show calorie counts on product cards and modals. */
  showCalories: boolean;
}

// ─── Age verification ─────────────────────────────────────────────────────────

export interface AgeVerificationConfig {
  /** When true, show age-gate on attract screen and before restricted products. */
  enabled: boolean;
  /** Minimum age in years (e.g. 21 for US alcohol). */
  minAge: number;
  /**
   * Copy shown on the age-gate prompt.
   * Supports {minAge} interpolation.
   */
  prompt: string;
  /** Subtitle shown below the prompt. */
  subtitle: string;
}

// ─── Attract screen ───────────────────────────────────────────────────────────

export interface AttractScreenConfig {
  idleVideoUrl?: string;
  idleImageUrls: string[];
  tagline: string;
  taglineHighlight?: string;  /* word or phrase to visually accent in the tagline */
  ctaLabel: string;
  showLogo: boolean;
  featureBadges: string[];
  /**
   * Icon/emoji array for the floating doodle layer on the attract screen.
   * Defaults to food emoji set for Straunt; override per brand.
   */
  doodles: string[];
  /**
   * Layout variant for the attract screen hero.
   * 'split-headline' = large type left + doodles right (Straunt food style)
   * 'hero-fullscreen' = full-bleed image/gradient with centred copy (Holiq)
   */
  heroLayout: 'split-headline' | 'hero-fullscreen';
}

// ─── Kiosk defaults ───────────────────────────────────────────────────────────

export interface KioskDefaults {
  /** Seconds of inactivity before attract screen (30–300). */
  idleTimeoutSeconds: number;
  attractLoopEnabled: boolean;
  staffPinEnabled: boolean;
}

// ─── Root interface ───────────────────────────────────────────────────────────

export interface BrandBusinessRules {
  ageVerification: AgeVerificationConfig;
  dietary: DietaryConfig;
  tipConfig: TipConfig;
  receiptConfig: ReceiptConfig;
  orderFlowConfig: OrderFlowConfig;
  loyaltyConfig: LoyaltyConfig;
  upsellConfig: UpsellConfig;
  supportedPaymentMethods: PaymentMethod[];
  kioskDefaults: KioskDefaults;
}
