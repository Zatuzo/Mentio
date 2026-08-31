import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;

async function freshCryptoModule() {
  vi.resetModules();
  return import('@/app/lib/crypto');
}

describe('encryptText / decryptText', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = '82eee778e14fcfc752b7d457266ed196491d78db15b54199f22237b9396ad7b8'; // 64 hex chars = 32 bytes
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
  });

  it('round-trips plain text through encrypt then decrypt', async () => {
    const { encryptText, decryptText } = await freshCryptoModule();
    const plain = 'tolong siapin landing page besok pagi';
    const cipher = encryptText(plain);
    expect(cipher).not.toBe(plain);
    expect(cipher).toMatch(/^enc:v1:/);
    expect(decryptText(cipher)).toBe(plain);
  });

  it('passes an already-plaintext (legacy) value through unchanged', async () => {
    const { decryptText } = await freshCryptoModule();
    expect(decryptText('an old row written before encryption existed')).toBe(
      'an old row written before encryption existed'
    );
  });

  it('stores plaintext (with a warning) when ENCRYPTION_KEY is unset', async () => {
    delete process.env.ENCRYPTION_KEY;
    const { encryptText } = await freshCryptoModule();
    expect(encryptText('hello')).toBe('hello');
  });

  it('fails to decrypt with the wrong key instead of returning garbage', async () => {
    const { encryptText } = await freshCryptoModule();
    const cipher = encryptText('secret message');

    process.env.ENCRYPTION_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
    const { decryptText } = await freshCryptoModule();
    expect(() => decryptText(cipher)).toThrow();
  });
});
