const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration to projects...');

  // 1. Get all users
  const users = await prisma.user.findMany({
    include: {
      tasks: true,
      userGroups: true,
    }
  });

  console.log(`Found ${users.length} users to migrate.`);

  for (const user of users) {
    console.log(`Processing user ${user.email}...`);

    // 2. Create a default project for the user if they don't have any
    const existingMember = await prisma.projectMember.findFirst({
      where: { userId: user.id }
    });

    let project;
    if (existingMember) {
      project = await prisma.project.findUnique({ where: { id: existingMember.projectId } });
      console.log(`User already has project: ${project.name}`);
    } else {
      project = await prisma.project.create({
        data: {
          name: `${user.name}'s Project`,
          members: {
            create: {
              userId: user.id,
              role: 'admin'
            }
          }
        }
      });
      console.log(`Created new project: ${project.name}`);
    }

    // 3. Migrate Tasks to the project
    const tasksToMigrate = user.tasks.filter(t => !t.projectId);
    if (tasksToMigrate.length > 0) {
      const taskIds = tasksToMigrate.map(t => t.id);
      await prisma.task.updateMany({
        where: { id: { in: taskIds } },
        data: { projectId: project.id }
      });
      console.log(`Migrated ${tasksToMigrate.length} tasks to project.`);
    }

    // 4. Migrate UserGroups to ProjectGroups
    for (const ug of user.userGroups) {
      // Check if ProjectGroup already exists
      const existingPg = await prisma.projectGroup.findUnique({
        where: {
          projectId_groupId: {
            projectId: project.id,
            groupId: ug.groupId
          }
        }
      });

      if (!existingPg) {
        await prisma.projectGroup.create({
          data: {
            projectId: project.id,
            groupId: ug.groupId
          }
        });
        console.log(`Created ProjectGroup mapping for group ${ug.groupId}.`);
      }
    }
  }

  console.log('Migration completed successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
