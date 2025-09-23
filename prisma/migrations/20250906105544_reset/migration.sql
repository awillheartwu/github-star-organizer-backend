-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT,
    "stars" INTEGER NOT NULL DEFAULT 0,
    "forks" INTEGER NOT NULL DEFAULT 0,
    "lastCommit" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "touchedAt" TIMESTAMP(3),
    "notes" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER,
    "summaryShort" TEXT,
    "summaryLong" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "AiSummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "model" TEXT,
    "lang" TEXT,
    "tokens" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiSummary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3)
);

-- CreateTable
CREATE TABLE "ProjectTag" (
    "projectId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("projectId", "tagId"),
    CONSTRAINT "ProjectTag_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProjectTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VideoLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "url" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "VideoLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "replacedByTokenId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ArchivedProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "githubId" INTEGER,
    "originalProjectId" TEXT,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_githubId_key" ON "Project"("githubId");

-- CreateIndex
CREATE INDEX "Project_archived_createdAt_idx" ON "Project"("archived", "createdAt");

-- CreateIndex
CREATE INDEX "Project_archived_updatedAt_idx" ON "Project"("archived", "updatedAt");

-- CreateIndex
CREATE INDEX "Project_stars_idx" ON "Project"("stars");

-- CreateIndex
CREATE INDEX "Project_forks_idx" ON "Project"("forks");

-- CreateIndex
CREATE INDEX "Project_score_idx" ON "Project"("score");

-- CreateIndex
CREATE INDEX "Project_language_idx" ON "Project"("language");

-- CreateIndex
CREATE INDEX "Project_lastCommit_idx" ON "Project"("lastCommit");

-- CreateIndex
CREATE INDEX "Project_lastSyncAt_idx" ON "Project"("lastSyncAt");

-- CreateIndex
CREATE INDEX "Project_touchedAt_idx" ON "Project"("touchedAt");

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "AiSummary_projectId_createdAt_idx" ON "AiSummary"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "AiSummary_style_idx" ON "AiSummary"("style");

-- CreateIndex
CREATE INDEX "Tag_archived_createdAt_idx" ON "Tag"("archived", "createdAt");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "ProjectTag_projectId_idx" ON "ProjectTag"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTag_tagId_idx" ON "ProjectTag"("tagId");

-- CreateIndex
CREATE INDEX "VideoLink_projectId_idx" ON "VideoLink"("projectId");

-- CreateIndex
CREATE INDEX "VideoLink_archived_createdAt_idx" ON "VideoLink"("archived", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "User_tokenVersion_idx" ON "User"("tokenVersion");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_jti_key" ON "RefreshToken"("jti");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_revoked_expiresAt_idx" ON "RefreshToken"("revoked", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_revoked_revokedAt_idx" ON "RefreshToken"("revoked", "revokedAt");

-- CreateIndex
CREATE INDEX "SyncState_source_idx" ON "SyncState"("source");

-- CreateIndex
CREATE INDEX "SyncState_updatedAt_idx" ON "SyncState"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_source_key_key" ON "SyncState"("source", "key");

-- CreateIndex
CREATE INDEX "ArchivedProject_githubId_idx" ON "ArchivedProject"("githubId");

-- CreateIndex
CREATE INDEX "ArchivedProject_archivedAt_idx" ON "ArchivedProject"("archivedAt");

-- CreateIndex
CREATE INDEX "ArchivedProject_reason_idx" ON "ArchivedProject"("reason");
