-- CreateTable
CREATE TABLE "public"."SyncStateHistory" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "cursor" TEXT,
    "etag" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "statsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncStateHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncStateHistory_source_idx" ON "public"."SyncStateHistory"("source");

-- CreateIndex
CREATE INDEX "SyncStateHistory_key_idx" ON "public"."SyncStateHistory"("key");

-- CreateIndex
CREATE INDEX "SyncStateHistory_createdAt_idx" ON "public"."SyncStateHistory"("createdAt");

-- CreateIndex
CREATE INDEX "SyncStateHistory_source_key_createdAt_idx" ON "public"."SyncStateHistory"("source", "key", "createdAt");
