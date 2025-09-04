-- AlterTable
ALTER TABLE "RefreshToken" ADD COLUMN "revokedAt" DATETIME;

-- CreateIndex
CREATE INDEX "RefreshToken_revoked_revokedAt_idx" ON "RefreshToken"("revoked", "revokedAt");
