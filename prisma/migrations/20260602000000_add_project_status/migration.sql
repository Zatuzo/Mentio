-- CreateTable
CREATE TABLE "ProjectStatus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectStatus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProjectStatus_projectId_slug_key" ON "ProjectStatus"("projectId", "slug");

-- CreateIndex
CREATE INDEX "ProjectStatus_projectId_order_idx" ON "ProjectStatus"("projectId", "order");

-- AddForeignKey
ALTER TABLE "ProjectStatus" ADD CONSTRAINT "ProjectStatus_projectId_fkey"
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default statuses for all existing projects
INSERT INTO "ProjectStatus" ("id", "projectId", "slug", "label", "color", "order", "isDone")
SELECT concat('s_todo_', "id"), "id", 'todo', 'To Do', '#6b7280', 0, false FROM "Project";

INSERT INTO "ProjectStatus" ("id", "projectId", "slug", "label", "color", "order", "isDone")
SELECT concat('s_prog_', "id"), "id", 'in_progress', 'In Progress', '#3b82f6', 1, false FROM "Project";

INSERT INTO "ProjectStatus" ("id", "projectId", "slug", "label", "color", "order", "isDone")
SELECT concat('s_done_', "id"), "id", 'done', 'Done', '#10b981', 2, true FROM "Project";
