/**
 * Reset all user↔group memberships.
 *
 * Wipes every UserGroup row so the only way a group becomes visible to a user
 * again is the new claim-code flow (posting their code inside the group).
 * ProjectGroup is kept (it is already project-scoped, not the leak vector);
 * Mentions/Summaries/Tasks are kept too — only the user↔group links go.
 *
 * Run once after deploying the claim-code feature:  npm run reset-claims
 */
require('dotenv').config();
const { prisma } = require('./db');

(async () => {
  const ug = await prisma.userGroup.deleteMany({});
  const gc = await prisma.groupClaim.deleteMany({ where: { status: 'pending' } });

  console.log(`[reset-claims] removed ${ug.count} UserGroup link(s)`);
  console.log(`[reset-claims] cleared ${gc.count} stale pending claim(s)`);
  console.log('[reset-claims] done — every user must now re-claim their groups.');

  await prisma.$disconnect();
})().catch((err) => {
  console.error('[reset-claims] failed:', err);
  process.exit(1);
});
