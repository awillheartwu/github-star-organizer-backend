-- AlterTable
ALTER TABLE "Project" ADD COLUMN "touchedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Project_touchedAt_idx" ON "Project"("touchedAt");
