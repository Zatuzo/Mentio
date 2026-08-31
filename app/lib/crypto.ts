// TypeScript mirror of src/crypto.js — see that file for the full scheme
// explanation (AES-256-GCM, "enc:v1:" prefix, plaintext pass-through for
// legacy rows). Duplicated on purpose: src/*.js runs as plain Node scripts
// (listener/summarizer) and can't import a .ts module directly, so both
// sides implement the identical, small algorithm rather than sharing a
// build step. Keep them in sync if this ever changes.

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12;

let warned = false;

function getKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (!warned) {
      console.warn('[crypto] ENCRYPTION_KEY not set — chat text will be stored in plain text');
      warned = true;
    }
    return null;
  }
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (hex or base64)');
  }
  return key;
}

export function encryptText(plainText: string | null | undefined): string | null | undefined {
  const key = getKey();
  if (!key || plainText == null) return plainText;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptText(value: string | null | undefined): string | null | undefined {
  if (value == null || !value.startsWith(PREFIX)) return value; // plaintext / legacy row

  const key = getKey();
  if (!key) {
    console.warn('[crypto] cannot decrypt — ENCRYPTION_KEY not set');
    return value;
  }

  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}
