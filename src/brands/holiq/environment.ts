// src/brands/holiq/environment.ts
import type { BrandEnvironment } from '../types';

// Holiq brand auth constants — per-brand tenant identifiers.
// These are DIFFERENT from Straunt and MUST be used whenever the user
// has selected the Holiq brand, regardless of build-time VITE_ values.
const HOLIQ_AUTH = {
  appGroupId:        '1673597639768441',   // holiq app_group_id
  prdId:             '1673597530239814',   // holiq prd_id
  // Confirmed working via curl — uses the shared store-listing service (same as Straunt).
  // The env var get_stores_bls_id ('3828022124411623') is NOT used for the stores call;
  // the Holiq ext-store api.service.ts also hardcodes '3821548006039960'.
  storesServiceId:   '3821548006039960',
  channelsServiceId: '3880470537073453',   // same for all brands
  uniqueCode:        'holiq',
} as const;

export const holiqEnvironment: BrandEnvironment = {
  brandId: 'holiq',
  displayName: import.meta.env.VITE_DISPLAY_NAME || 'Holiq',
  appId: 'com.holiq.kiosk',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.holiq.com/v1',
  apiKey: import.meta.env.VITE_API_KEY || '',
  brandHeader: import.meta.env.VITE_BRAND_HEADER || 'holiq',

  authConfig: HOLIQ_AUTH,

  defaultTheme: {
    // ── Holiq brand palette — red/coral as per brand spec ──────────────
    // Primary Button:       #FD5056
    // Hover Button:         #E94449
    // Input Focus:          #E24D52
    // Phone Background:     #FD50561F  (≈ rgba(253,80,86,0.12))
    // Notification Bg:      #FF767B
    // Skeleton Main:        #FFC5C8
    // Skeleton Sub:         #F5E0E0
    // Available Active:     #F0C7CC
    primary:      '#FD5056',
    secondary:    '#E94449',
    accent:       '#FF767B',
    background:   '#FFF5F5',
    surface:      '#FFE8E9',
    surfaceAlt:   '#F5E0E0',
    text:         '#1A0A0B',
    textMuted:    '#6B4B4D',
    textInverse:  '#FFFFFF',
    border:       '#F0C7CC',
    error:        '#DC2626',
    success:      '#22C55E',
    warning:      '#F59E0B',
    fontFamily:   "'Poppins', system-ui, sans-serif",
    logoUrl:      '',
    radius:       '1rem',
    primaryHover:  '#E94449',
    primaryActive: '#E24D52',
    gradientStart: '#FD5056',
    gradientEnd:   '#E94449',
    badgeBg:       'rgba(253,80,86,0.12)',
  },
  catalog: {
    strategy: 'paginated',
    pageSize: 20,
    defaultSortOrder: 'api-order',
    productCardVariant: 'standard',
    showDietaryBadges: false,
    hideUnavailableProducts: true,
    excludedCategoryIds: [],
  },
  defaultTaxRate: 0.0825,
  defaultLocale: 'en-US',
  defaultCurrency: 'USD',
  defaultTimezone: 'America/Chicago',

  businessRules: {
    ageVerification: {
      enabled: true,
      minAge: 21,
      prompt: 'You must be {minAge} years of age or older to purchase alcohol.',
      subtitle: 'By continuing, you confirm you are 21 or older.',
    },
    dietary: {
      showCalories: false,
      badges: {},
    },
    tipConfig: {
      enabled: false,
      presets: [10, 15, 20],
      customAllowed: false,
    },
    receiptConfig: {
      logoOnReceipt: true,
      footerMessage: 'Please enjoy responsibly. Must be 21+ to purchase.',
      showTaxBreakdown: true,
      printEnabled: true,
      autoReturnSeconds: 20,
    },
    orderFlowConfig: {
      dineInEnabled: false,
      takeoutEnabled: true,
      askOrderType: false,
      defaultOrderType: 'takeout',
    },
    loyaltyConfig: {
      enabled: false,
      programName: 'Holiq Club',
      lookupMethod: 'phone',
    },
    upsellConfig: {
      enabled: true,
      triggerStage: 'cart',
      maxSuggestions: 2,
    },
    supportedPaymentMethods: ['card'],
    kioskDefaults: {
      idleTimeoutSeconds: 90,
      attractLoopEnabled: true,
      staffPinEnabled: true,
    },
  },

  attractScreen: {
    idleVideoUrl: undefined,
    idleImageUrls: [],
    tagline: 'Discover.',
    taglineHighlight: 'Order.',
    ctaLabel: 'Start Browsing',
    showLogo: true,
    featureBadges: ['Premium selection', 'Easy ordering', 'Quick pickup'],
    heroLayout: 'hero-fullscreen',
    doodles: ['🍺','🍷','🥂','🍸','🥃','🍾','🫗','🍻','🧊','🍹','🫧','🍶'],
  },

  categoryIconMap: {
    'beer':          '🍺',
    'ale':           '🍺',
    'lager':         '🍺',
    'craft':         '🍺',
    'wine':          '🍷',
    'red wine':      '🍷',
    'white wine':    '🥂',
    'rosé':          '🌹',
    'champagne':     '🍾',
    'sparkling':     '🍾',
    'spirits':       '🥃',
    'whiskey':       '🥃',
    'whisky':        '🥃',
    'bourbon':       '🥃',
    'vodka':         '🍸',
    'gin':           '🍸',
    'tequila':       '🥃',
    'rum':           '🍹',
    'cocktail':      '🍸',
    'mixed':         '🍹',
    'liqueur':       '🫗',
    'cider':         '🍺',
    'sake':          '🍶',
    'seltzer':       '🫧',
    'non-alcoholic': '🧃',
    'soft drink':    '🥤',
    'water':         '💧',
    'snack':         '🧆',
    'food':          '🍽',
  },

  searchHints: [
    'Search by brand or type…',
    'Explore craft beers…',
    'Find premium whiskeys…',
    'Browse our wine selection…',
    'Looking for cocktail mixers?',
    'Discover local spirits…',
  ],
};
