// One-off backfill: encrypts any Mention rows still holding plaintext text
// from before ENCRYPTION_KEY was introduced. Safe to re-run — rows already
// encrypted (the "enc:v1:" prefix, see src/crypto.js) are skipped.
//
// Usage: ENCRYPTION_KEY=... node scripts/encrypt-existing-mentions.js
const { prisma } = require('../src/db');
const { encryptText } = require('../src/crypto');

const ENCRYPTED_PREFIX = 'enc:v1:';

async function main() {
  if (!process.env.ENCRYPTION_KEY) {
    console.error('ENCRYPTION_KEY is not set — nothing to backfill with, aborting.');
    process.exit(1);
  }

  const plaintextMentions = await prisma.mention.findMany({
    where: { NOT: { text: { startsWith: ENCRYPTED_PREFIX } } },
    select: { id: true, text: true },
  });

  console.log(`Found ${plaintextMentions.length} plaintext mention(s) to encrypt.`);

  for (const m of plaintextMentions) {
    await prisma.mention.update({ where: { id: m.id }, data: { text: encryptText(m.text) } });
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
