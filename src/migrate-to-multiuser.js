// One-time migration: create owner user account and assign all existing data to them.
// Run: node src/migrate-to-multiuser.js --email owner@example.com --password yourpassword --name "Your Name"
require('dotenv').config();
const { prisma } = require('./db');

async function parseArgs() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i !== -1 ? args[i + 1] : null;
  };
  return {
    email: get('--email'),
    password: get('--password'),
    name: get('--name') || 'Owner',
  };
}

async function main() {
  const { email, password, name } = await parseArgs();
  if (!email || !password) {
    console.error('Usage: node src/migrate-to-multiuser.js --email <email> --password <password> [--name <name>]');
    process.exit(1);
  }

  // Use Better Auth API to create the owner account properly
  const { auth } = await import('../app/lib/auth.js').catch(() => {
    // Fallback: require compiled version
    return require('../app/lib/auth');
  });

  console.log('[migrate] Creating owner account...');
  const result = await auth.api.signUpEmail({
    body: { email, password, name },
  });

  if (result.error) {
    // Try to find existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      console.error('[migrate] Failed to create user:', result.error);
      process.exit(1);
    }
    console.log('[migrate] User already exists, using existing:', existing.id);
    var userId = existing.id;
  } else {
    var userId = result.user?.id || result.data?.user?.id;
    console.log('[migrate] Owner created:', userId);
  }

  if (!userId) {
    console.error('[migrate] Could not determine userId');
    process.exit(1);
  }

  // Mark as owner + pro plan
  await prisma.user.update({
    where: { id: userId },
    data: { isOwner: true, plan: 'pro' },
  });
  console.log('[migrate] Marked as owner with pro plan');

  // Assign existing WatchedJids to owner
  const watchCount = await prisma.watchedJid.updateMany({
    where: { userId: null },
    data: { userId },
  });
  console.log(`[migrate] Assigned ${watchCount.count} WatchedJid(s) to owner`);

  // Assign existing DiscoveredJids to owner
  const discCount = await prisma.discoveredJid.updateMany({
    where: { userId: null },
    data: { userId },
  });
  console.log(`[migrate] Assigned ${discCount.count} DiscoveredJid(s) to owner`);

  // Assign existing Mentions to owner
  const mentionCount = await prisma.mention.updateMany({
    where: { userId: null },
    data: { userId },
  });
  console.log(`[migrate] Assigned ${mentionCount.count} Mention(s) to owner`);

  // Assign existing Summaries to owner
  const summaryCount = await prisma.summary.updateMany({
    where: { userId: null },
    data: { userId },
  });
  console.log(`[migrate] Assigned ${summaryCount.count} Summary(s) to owner`);

  // Create UserGroup entries for all existing groups
  const groups = await prisma.group.findMany();
  for (const g of groups) {
    await prisma.userGroup.upsert({
      where: { userId_groupId: { userId, groupId: g.id } },
      update: {},
      create: { userId, groupId: g.id, enabled: true },
    });
  }
  console.log(`[migrate] Created UserGroup for ${groups.length} group(s)`);

  console.log('\n✓ Migration complete!');
  console.log(`  Owner email: ${email}`);
  console.log(`  Owner ID:    ${userId}`);
  console.log('\nYou can now log in at /login');
  process.exit(0);
}

main().catch((e) => { console.error('[migrate] Fatal:', e.message); process.exit(1); });
