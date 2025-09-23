-- AlterTable
ALTER TABLE "Project" ADD COLUMN "aiSummarizedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "aiSummaryError" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummaryErrorAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "aiSummaryLang" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummaryModel" TEXT;
ALTER TABLE "Project" ADD COLUMN "aiSummarySourceHash" TEXT;

-- CreateIndex
CREATE INDEX "Project_aiSummarizedAt_idx" ON "Project"("aiSummarizedAt");
