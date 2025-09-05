-- CreateTable
CREATE TABLE "AiSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "lang" TEXT,
    "tokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AiSummary_projectId_createdAt_idx" ON "AiSummary"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSummary_style_idx" ON "AiSummary"("style");
