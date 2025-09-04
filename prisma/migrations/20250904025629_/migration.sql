/*
  Warnings:

  - You are about to drop the column `archivedReason` on the `Project` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "lastCommit" DATETIME,
    "lastSyncAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "touchedAt" DATETIME,
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME
);
INSERT INTO "new_Project" ("archived", "createdAt", "deletedAt", "description", "favorite", "forks", "fullName", "githubId", "id", "language", "lastCommit", "lastSyncAt", "name", "notes", "pinned", "score", "stars", "touchedAt", "updatedAt", "url") SELECT "archived", "createdAt", "deletedAt", "description", "favorite", "forks", "fullName", "githubId", "id", "language", "lastCommit", "lastSyncAt", "name", "notes", "pinned", "score", "stars", "touchedAt", "updatedAt", "url" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_githubId_key" ON "Project"("githubId");
CREATE INDEX "Project_archived_createdAt_idx" ON "Project"("archived", "createdAt");
CREATE INDEX "Project_archived_updatedAt_idx" ON "Project"("archived", "updatedAt");
CREATE INDEX "Project_stars_idx" ON "Project"("stars");
CREATE INDEX "Project_forks_idx" ON "Project"("forks");
CREATE INDEX "Project_score_idx" ON "Project"("score");
CREATE INDEX "Project_language_idx" ON "Project"("language");
CREATE INDEX "Project_lastCommit_idx" ON "Project"("lastCommit");
CREATE INDEX "Project_lastSyncAt_idx" ON "Project"("lastSyncAt");
CREATE INDEX "Project_touchedAt_idx" ON "Project"("touchedAt");
CREATE INDEX "Project_name_idx" ON "Project"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
