-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cursor" TEXT,
    "etag" TEXT,
    "lastRunAt" DATETIME,
    "lastSuccessAt" DATETIME,
    "lastErrorAt" DATETIME,
    "lastError" TEXT,
    "statsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SyncState_source_idx" ON "SyncState"("source");

-- CreateIndex
CREATE INDEX "SyncState_updatedAt_idx" ON "SyncState"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_source_key_key" ON "SyncState"("source", "key");
