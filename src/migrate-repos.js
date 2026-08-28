// One-shot migration: project.githubRepo -> ProjectRepo row, set as defaultRepoId
// for every admin in the project. Safe to re-run (idempotent).
require('dotenv').config();
const { prisma } = require('./db');

async function main() {
  const projects = await prisma.project.findMany({
    where: { githubRepo: { not: null } },
    include: { members: { where: { role: 'admin' } } },
  });

  console.log(`[migrate-repos] ${projects.length} project(s) with legacy githubRepo`);

  for (const p of projects) {
    const fullName = p.githubRepo.trim();
    const branch = p.githubBranch?.trim() || 'main';

    const repo = await prisma.projectRepo.upsert({
      where: { projectId_fullName: { projectId: p.id, fullName } },
      update: { branch },
      create: {
        projectId: p.id,
        fullName,
        branch,
        addedById: p.members[0]?.userId || null,
      },
    });

    // Set as default for every admin who doesn't have one yet.
    for (const m of p.members) {
      if (!m.defaultRepoId) {
        await prisma.projectMember.update({
          where: { id: m.id },
          data: { defaultRepoId: repo.id },
        });
      }
    }
    console.log(`  ✓ ${p.name}: seeded "${fullName}" + ${p.members.length} admin default(s)`);
  }

  console.log('[migrate-repos] done');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
