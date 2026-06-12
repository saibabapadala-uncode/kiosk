/**
 * WORK / staging environment.
 *
 * Mirrors kiosk_straunt_storefront/src/environments/environment.work.ts.
 * Used for work / staging builds: npm run build:work
 *
 * Typically points to the QA backend but with production-style build flags
 * (minified, no sourcemaps) for final staging verification.
 *
 * ── HOW TO SWITCH BRAND ───────────────────────────────────────────────────
 * Uncomment ONE brand block; keep the others commented out.
 * Then run:  npm run build:work
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { Environment } from './types';

export const environment: Environment = {
  production: false,

  // ── Platform API (QA cluster for staging verification) ───────────────────
  apiBaseUrl:      'https://api.uncodeapi.com/v1/',
  aphSid:          'e7792b2df8864e058a2e9a462cfcf249',
  apiKey:          'becca70d6ea142689e647de3351a4e4d',

  stripeKey: {
    '3830008950077440': 'pk_test_51NaviFKPNsr2AqncBGNQjg1BTPAvJFOUCyEDAeXZu1VpWbQkrWDSBKCx5TGrqnXkn11nceFWCA0ew0bHdPSzr5d900jOROXTG3',
    '3840549084790870': 'pk_test_51NaviFKPNsr2AqncBGNQjg1BTPAvJFOUCyEDAeXZu1VpWbQkrWDSBKCx5TGrqnXkn11nceFWCA0ew0bHdPSzr5d900jOROXTG3',
    '3830008877492221': 'pk_test_51NaviFKPNsr2AqncBGNQjg1BTPAvJFOUCyEDAeXZu1VpWbQkrWDSBKCx5TGrqnXkn11nceFWCA0ew0bHdPSzr5d900jOROXTG3',
  },

  offlineDBUrl:    'https://comm.uncodeapi.com/qa/',
  offlineDBapiKey: 'eqxPVjOKbw6kFDjoRVfcc5bQf52AkYR57veD99wP',
  imageBaseUrl:    'https://assets.scocu.net/',
  messagesWSUrl:   '65xdepk0f5.execute-api.us-east-1.amazonaws.com/QA',
  SOCKET_URL:      'navik.voize.net',
  idpUrl:          'https://idp.uncodeapi.com/qa/api/',

  sharedApiBaseUrl:    'https://growith-01.uncodeapi.com/qa/api/v1/shared_central?url=https://ishs01w01uc-qa-01ctl.scocu.net/api/v1/',
  sharedApplicationId: '3821568656302798',
  sharedEnvironmentId: '1672057321519776',

  environment_id:    '1692331872167292',
  ga_base_url:       'https://gapq.scocu.net/api/v1/',
  unauth_url:        'https://gapq.scocu.net/api/v1/app_group/unauth_call?url=https://iqacga.uncode.io/api/v1/unauth_call',
  auth_url:          '{gateway_url}app_group/auth_call?url=https://iqacga.uncode.io/api/v1/auth_call',
  ga_application_id: '1651074845162523',
  ga_account_id:     '1648710258598183',
  ga_environment_id: '1648476018802981',

  registration_bls_id:    '1679568537603110',
  login_bls_id:           '1648808461205442',
  reset_password_bls_id:  '1651758117822626',
  forgot_password_bls_id: '1651746015556874',

  resthook_base_url:         'https://gateway.uncodeapi.com/rhookmeta/api/',
  universal_uncode_base_url: 'https://gateway.uncodeapi.com/puh/api/',
  customApiUrl:              'https://fitnessvirgo.banter.io/bfb-q/api/',
  pollingTriggerUrl:         'https://wlogic.scocu.net/api/polling_trigger',

  username: 'dobota8448@doishy.com',
  password:  'Test@12#',

  // ═══════════════════════════════════════════════════════════════════════════
  // BRAND SELECTION — uncomment ONE block; keep the others commented out
  // ═══════════════════════════════════════════════════════════════════════════

  // ── STRAUNT ── (active) ───────────────────────────────────────────────────
  env_type:             'qa',
  industry_id:          '3830008950077440',
  store_id:             '3873034825787231',
  location_id:          'tml_FpGEggUfbQbXbj',
  merchant_id:          '1728364735188864',
  pay_key:              'pay-stripe_connect-platform-1708671496275275',
  backofficeUrl:        'https://qaportal.straunt.ai',
  anonymousProjectUrl:  'https://qaacp.uncode.io',

  // ── HOLIQ ── (uncomment and comment STRAUNT block above) ─────────────────
  // env_type:             'qa',
  // industry_id:          'TODO_HOLIQ_INDUSTRY_ID',
  // store_id:             'TODO_HOLIQ_STORE_ID_WORK',
  // location_id:          'TODO_HOLIQ_LOCATION_ID_WORK',
  // merchant_id:          'TODO_HOLIQ_MERCHANT_ID_WORK',
  // pay_key:              'TODO_HOLIQ_PAY_KEY_WORK',
  // backofficeUrl:        'https://qaportal.holiq.ai',
  // anonymousProjectUrl:  'https://qaacp.uncode.io',

  // ── RESTRO ── (uncomment and comment STRAUNT block above) ────────────────
  // env_type:             'qa',
  // industry_id:          'TODO_RESTRO_INDUSTRY_ID',
  // store_id:             'TODO_RESTRO_STORE_ID_WORK',
  // location_id:          'TODO_RESTRO_LOCATION_ID_WORK',
  // merchant_id:          'TODO_RESTRO_MERCHANT_ID_WORK',
  // pay_key:              'TODO_RESTRO_PAY_KEY_WORK',
  // backofficeUrl:        'https://qaportal.restro.ai',
  // anonymousProjectUrl:  'https://qaacp.uncode.io',
};
