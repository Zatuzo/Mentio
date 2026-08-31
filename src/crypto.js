// Field-level encryption for WhatsApp message text before it touches the
// database. Only the raw chat content is encrypted (Mention.text) — everything
// else (sender, group, timestamps, priority, ...) stays queryable in plain
// columns, so this stays cheap and doesn't require a search index rewrite.
//
// Algorithm: AES-256-GCM. Ciphertext is stored as a single string:
//   enc:v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>
// The "enc:v1:" prefix lets decryptText() tell already-encrypted rows apart
// from historical plaintext rows written before this feature existed —
// decrypting a plaintext string just returns it unchanged instead of
// throwing, so no backfill migration is required.
//
// IMPORTANT: app/lib/crypto.ts implements the exact same scheme for the
// Next.js (TypeScript) side — the two must stay in sync, since a mention
// written by the listener (this file) is read back through the API (that
// file) and vice versa.

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';
const IV_LENGTH = 12; // recommended IV size for GCM

let _warned = false;

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    if (!_warned) {
      console.warn('[crypto] ENCRYPTION_KEY not set — chat text will be stored in plain text');
      _warned = true;
    }
    return null;
  }
  // Accept either a 64-char hex string or a base64 string that decodes to 32 bytes.
  const asHex = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (asHex.length !== 32) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes (hex or base64)');
  }
  return asHex;
}

function encryptText(plainText) {
  const key = getKey();
  if (!key || plainText == null) return plainText;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptText(value) {
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

module.exports = { encryptText, decryptText };
