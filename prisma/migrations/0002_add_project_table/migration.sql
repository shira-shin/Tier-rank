-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_slug_key" ON "Project"("slug");

-- Seed default demo project for tier scoring
INSERT INTO "Project" ("id", "slug", "name", "description", "createdAt", "updatedAt")
VALUES ('proj_demo', 'demo', 'Demo Project', 'Default project for AI tier scoring demo.', NOW(), NOW())
ON CONFLICT ("slug") DO NOTHING;
