/**
 * PRODUCTION environment.
 *
 * Mirrors kiosk_straunt_storefront/src/environments/environment.prod.ts.
 * Used for production builds: npm run build:prod
 *
 * ── HOW TO SWITCH BRAND ───────────────────────────────────────────────────
 * Uncomment ONE brand block; keep the others commented out.
 * Then run:  npm run build:prod
 *
 * ⚠️  Never put live secret keys (sk_live_*) here.
 *    Publishable keys (pk_live_*) are safe to commit.
 * ─────────────────────────────────────────────────────────────────────────
 */
import type { Environment } from './types';

export const environment: Environment = {
  production: true,

  // ── Platform API (production cluster) ─────────────────────────────────────
  apiBaseUrl:      'https://api.uncodeapi.com/v1/',
  aphSid:          '93e14a0d52d349ffa80d746be084aa37',
  apiKey:          'b4b924d347964170b92fc85122c089a2',

  // Stripe live publishable keys (keyed by industry_id)
  stripeKey: {
    '3830008950077440': 'pk_live_51NpTCFHxlMLU6gH9VSE3Y0g3Fo5IgvK4o8SYsa38B1zEDTUxRDLN2pt1J1XdN83teHHb74lIdGzRu44JpvBkuxqF00IHE7WDDR',
    '3840549084790870': 'pk_live_51NpTCFHxlMLU6gH9VSE3Y0g3Fo5IgvK4o8SYsa38B1zEDTUxRDLN2pt1J1XdN83teHHb74lIdGzRu44JpvBkuxqF00IHE7WDDR',
    '3830008877492221': 'pk_live_51NpTCFHxlMLU6gH9VSE3Y0g3Fo5IgvK4o8SYsa38B1zEDTUxRDLN2pt1J1XdN83teHHb74lIdGzRu44JpvBkuxqF00IHE7WDDR',
  },

  offlineDBUrl:    'https://comm.uncodeapi.com/prod/',
  offlineDBapiKey: 'SgYFwHqRan36QHV4zfVTt7PmVjDR15B53w7sxefB',
  imageBaseUrl:    'https://assets.scocu.net/',
  messagesWSUrl:   '65xdepk0f5.execute-api.us-east-1.amazonaws.com/QA',
  SOCKET_URL:      'navik.voize.net',
  idpUrl:          'https://idp.uncodeapi.com/prod/api/',

  sharedApiBaseUrl:    'https://growith-01.uncodeapi.com/prod/api/v1/shared_central?url=https://ishs01w01uc-prod-01ctl.scocu.net/api/v1/',
  sharedApplicationId: '3830110779424529',
  sharedEnvironmentId: '1672057539951432',

  environment_id:    '1692332456867297',
  ga_base_url:       'https://gapr.scocu.net/api/v1/',
  unauth_url:        'https://gapr.scocu.net/api/v1/app_group/unauth_call?url=https://ircga.uncode.io/api/v1/unauth_call',
  auth_url:          '{gateway_url}app_group/auth_call?url=https://ircga.uncode.io/api/v1/auth_call',
  ga_application_id: '1652426223786473',
  ga_account_id:     '1648710258598183',
  ga_environment_id: '1652337830054489',

  registration_bls_id:    '1679568537603110',
  login_bls_id:           '1648808461205442',
  reset_password_bls_id:  '1651758117822626',
  forgot_password_bls_id: '1651746015556874',

  resthook_base_url:         'https://gateway.uncodeapi.com/rhookmeta/api/',
  universal_uncode_base_url: 'https://gateway.uncodeapi.com/puh/api/',
  customApiUrl:              'https://fitnessvirgo.banter.io/bfb-q/api/',
  pollingTriggerUrl:         'https://wlogic.scocu.net/api/polling_trigger',

  // ═══════════════════════════════════════════════════════════════════════════
  // BRAND SELECTION — uncomment ONE block; keep the others commented out
  // ═══════════════════════════════════════════════════════════════════════════

  // ── STRAUNT ── (active) ───────────────────────────────────────────────────
  env_type:             'prod',
  industry_id:          '3830008950077440',
  store_id:             '3859756689173716',
  location_id:          'tml_F1fBQAfxoU9GYl', // last char is LETTER l, not digit 1
  merchant_id:          '1724156235468239',
  pay_key:              'pay-stripe_connect-platform-1708671496275275',
  backofficeUrl:        'https://apps.straunt.ai',
  anonymousProjectUrl:  'https://acp.uncode.io',

  // ── HOLIQ ── (uncomment and comment STRAUNT block above) ─────────────────
  // env_type:             'prod',
  // industry_id:          'TODO_HOLIQ_INDUSTRY_ID',
  // store_id:             'TODO_HOLIQ_STORE_ID_PROD',
  // location_id:          'TODO_HOLIQ_LOCATION_ID_PROD',
  // merchant_id:          'TODO_HOLIQ_MERCHANT_ID_PROD',
  // pay_key:              'TODO_HOLIQ_PAY_KEY_PROD',
  // backofficeUrl:        'https://apps.holiq.ai',
  // anonymousProjectUrl:  'https://acp.uncode.io',

  // ── RESTRO ── (uncomment and comment STRAUNT block above) ────────────────
  // env_type:             'prod',
  // industry_id:          'TODO_RESTRO_INDUSTRY_ID',
  // store_id:             'TODO_RESTRO_STORE_ID_PROD',
  // location_id:          'TODO_RESTRO_LOCATION_ID_PROD',
  // merchant_id:          'TODO_RESTRO_MERCHANT_ID_PROD',
  // pay_key:              'TODO_RESTRO_PAY_KEY_PROD',
  // backofficeUrl:        'https://apps.restro.ai',
  // anonymousProjectUrl:  'https://acp.uncode.io',
};
