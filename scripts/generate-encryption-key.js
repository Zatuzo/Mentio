#!/usr/bin/env node
// Generates a value suitable for ENCRYPTION_KEY (see src/crypto.js) — a
// random 32-byte key, hex-encoded. Usage: node scripts/generate-encryption-key.js
const crypto = require('crypto');

console.log(crypto.randomBytes(32).toString('hex'));
