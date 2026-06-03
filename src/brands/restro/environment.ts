// src/brands/restro/environment.ts
import type { BrandEnvironment } from '../types';

// Restro brand auth constants — per-brand tenant identifiers.
const RESTRO_AUTH = {
  appGroupId:        '1737711322147389',   // restro app_group_id
  prdId:             '1737710744958522',   // restro prd_id
  storesServiceId:   '3821548006039960',   // same as straunt
  channelsServiceId: '3880470537073453',   // same for all brands
  uniqueCode:        'restro',
} as const;

export const restroEnvironment: BrandEnvironment = {
  brandId: 'restro',
  displayName: import.meta.env.VITE_DISPLAY_NAME || 'Restro',
  appId: 'com.restro.kiosk',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'https://api.restro.com/v1',
  apiKey: import.meta.env.VITE_API_KEY || '',
  brandHeader: import.meta.env.VITE_BRAND_HEADER || 'restro',
  defaultTheme: {
    primary:      '#16A34A',
    secondary:    '#15803D',
    accent:       '#4ADE80',
    background:   '#F0FDF4',
    surface:      '#DCFCE7',
    surfaceAlt:   '#BBF7D0',
    text:         '#052E16',
    textMuted:    '#4B5563',
    textInverse:  '#FFFFFF',
    border:       '#BBF7D0',
    error:        '#EF4444',
    success:      '#16A34A',
    warning:      '#F59E0B',
    fontFamily:   "'Nunito', system-ui, sans-serif",
    logoUrl:      '',
    radius:       '0.625rem',
    primaryHover:  '#15803D',
    primaryActive: '#166534',
    gradientStart: '#16A34A',
    gradientEnd:   '#15803D',
    badgeBg:       'rgba(22,163,74,0.10)',
  },
  catalog: {
    strategy: 'full-load',
    defaultSortOrder: 'api-order',
    productCardVariant: 'standard',
    showDietaryBadges: true,
    hideUnavailableProducts: false,
    excludedCategoryIds: [],
  },
  authConfig: RESTRO_AUTH,

  defaultTaxRate: 0.0825,
  defaultLocale: 'en-US',
  defaultCurrency: 'USD',
  defaultTimezone: 'America/Chicago',

  businessRules: {
    ageVerification: {
      enabled: false,
      minAge: 18,
      prompt: 'You must be {minAge} or older.',
      subtitle: '',
    },
    dietary: {
      showCalories: true,
      badges: {
        isVeg:        { label: 'V',  name: 'Vegetarian',  color: '#16A34A' },
        isVegan:      { label: 'VE', name: 'Vegan',        color: '#15803D' },
        isGlutenFree: { label: 'GF', name: 'Gluten-Free',  color: '#7C3AED' },
        isOrganic:    { label: 'O',  name: 'Organic',      color: '#065F46' },
      },
    },
    tipConfig: {
      enabled: true,
      presets: [10, 15, 18],
      customAllowed: true,
    },
    receiptConfig: {
      logoOnReceipt: true,
      footerMessage: 'Thank you for your visit. See you again!',
      showTaxBreakdown: true,
      printEnabled: true,
      autoReturnSeconds: 30,
    },
    orderFlowConfig: {
      dineInEnabled: true,
      takeoutEnabled: true,
      askOrderType: true,
      defaultOrderType: 'dine-in',
    },
    loyaltyConfig: {
      enabled: false,
      programName: 'Restro Loyalty',
      lookupMethod: 'phone',
    },
    upsellConfig: {
      enabled: true,
      triggerStage: 'cart',
      maxSuggestions: 3,
    },
    supportedPaymentMethods: ['card'],
    kioskDefaults: {
      idleTimeoutSeconds: 120,
      attractLoopEnabled: true,
      staffPinEnabled: true,
    },
  },

  attractScreen: {
    idleVideoUrl: undefined,
    idleImageUrls: [],
    tagline: 'Dine.',
    taglineHighlight: 'Enjoy.',
    ctaLabel: 'Start Your Order',
    showLogo: true,
    featureBadges: ['Fresh ingredients', 'Dine-in & takeout', 'Pay your way'],
    heroLayout: 'split-headline',
    doodles: ['🥗','🍱','🥩','🍜','🧆','🥘','🫕','🍛','🥙','🫔','🧇','🥞'],
  },

  categoryIconMap: {
    'starter':   '🥗',
    'appetizer': '🥟',
    'salad':     '🥗',
    'soup':      '🍲',
    'main':      '🍱',
    'grill':     '🥩',
    'steak':     '🥩',
    'chicken':   '🍗',
    'seafood':   '🦐',
    'fish':      '🐟',
    'pasta':     '🍝',
    'noodle':    '🍜',
    'rice':      '🍚',
    'curry':     '🍛',
    'pizza':     '🍕',
    'burger':    '🍔',
    'sandwich':  '🥪',
    'wrap':      '🌯',
    'dessert':   '🍰',
    'sweet':     '🧁',
    'cake':      '🎂',
    'drink':     '🥤',
    'beverage':  '🥤',
    'coffee':    '☕',
    'tea':       '🫖',
    'juice':     '🍹',
    'bread':     '🫓',
    'side':      '🥦',
    'combo':     '🍱',
    'breakfast': '🍳',
  },

  searchHints: [
    'What would you like to eat?',
    'Explore our starters…',
    'Try our grilled specials…',
    'Looking for desserts?',
    'Browse main courses…',
    'Find your favorite dish…',
  ],
};
