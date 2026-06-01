// src/utils/crypto.ts
// AES-GCM credential encryption — identical algorithm to ext-store
// Authentication.service.ts so encrypted credentials are portable.

import { AUTH_CONFIG } from '@/config/auth.config';

const { ENCRYPTION_SECRET, ENCRYPTION_IV, CREDENTIAL_SUFFIX } = AUTH_CONFIG;

function getCrypto(): Crypto | null {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { crypto?: Crypto }).crypto)
    return (globalThis as unknown as { crypto: Crypto }).crypto;
  return null;
}

async function getKey(cryptoRef: Crypto): Promise<CryptoKey> {
  const keyBytes = new TextEncoder().encode(ENCRYPTION_SECRET.padEnd(32, '0').slice(0, 32));
  return cryptoRef.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function buf2b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

function b642buf(b64: string): ArrayBuffer {
  const bin  = atob(b64);
  const buf  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export async function encryptCredentials(data: object): Promise<string | null> {
  const cryptoRef = getCrypto();
  if (!cryptoRef?.subtle) return null;
  try {
    const iv      = new TextEncoder().encode(ENCRYPTION_IV);
    const key     = await getKey(cryptoRef);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const enc     = await cryptoRef.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    return buf2b64(enc);
  } catch {
    return null;
  }
}

export async function decryptCredentials<T = Record<string, string>>(
  encrypted: string,
): Promise<T | null> {
  const cryptoRef = getCrypto();
  if (!cryptoRef?.subtle) return null;
  try {
    const iv  = new TextEncoder().encode(ENCRYPTION_IV);
    const key = await getKey(cryptoRef);
    const dec = await cryptoRef.subtle.decrypt({ name: 'AES-GCM', iv }, key, b642buf(encrypted));
    return JSON.parse(new TextDecoder().decode(dec)) as T;
  } catch {
    return null;
  }
}

/** Append the shared suffix before encrypting (mirrors ext-store logic). */
export function appendSuffix(value: string): string {
  return `${value}${CREDENTIAL_SUFFIX}`;
}

export function removeSuffix(value: string): string {
  return value.endsWith(CREDENTIAL_SUFFIX)
    ? value.slice(0, -CREDENTIAL_SUFFIX.length)
    : value;
}
