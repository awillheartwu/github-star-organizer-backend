/*
  Warnings:

  - You are about to drop the column `archived` on the `ProjectTag` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `ProjectTag` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `ProjectTag` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `ProjectTag` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProjectTag" (
    "projectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("projectId", "tagId"),
    CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ProjectTag" ("projectId", "tagId") SELECT "projectId", "tagId" FROM "ProjectTag";
DROP TABLE "ProjectTag";
ALTER TABLE "new_ProjectTag" RENAME TO "ProjectTag";
CREATE INDEX "ProjectTag_projectId_idx" ON "ProjectTag"("projectId");
CREATE INDEX "ProjectTag_tagId_idx" ON "ProjectTag"("tagId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
