-- AlterTable
ALTER TABLE "Project" ADD COLUMN "aiSummarizedAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "aiSummaryError" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummaryErrorAt" DATETIME;
ALTER TABLE "Project" ADD COLUMN "aiSummaryLang" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummaryModel" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummarySourceHash" TEXT;

-- CreateIndex
CREATE INDEX "Project_aiSummarizedAt_idx" ON "Project"("aiSummarizedAt");
