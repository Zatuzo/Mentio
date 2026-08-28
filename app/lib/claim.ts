// Group claim codes — a user posts their code inside a WhatsApp group to prove
// membership; the shared listener detects it and links the group to them.

// Unambiguous alphabet (no 0/O/1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateClaimCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `MENTIO-${s}`;
}

// Also used (as a copy) by src/listener.js to scan incoming messages.
export const CLAIM_CODE_REGEX = /MENTIO-[A-Z0-9]{4,12}/i;

export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000; // 24h
