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
CREATE INDEX "Project_name_idx" ON "Project"("name");

-- CreateIndex
CREATE INDEX "ProjectTag_projectId_idx" ON "ProjectTag"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTag_tagId_idx" ON "ProjectTag"("tagId");

-- CreateIndex
CREATE INDEX "Tag_archived_createdAt_idx" ON "Tag"("archived", "createdAt");

-- CreateIndex
CREATE INDEX "Tag_name_idx" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "VideoLink_projectId_idx" ON "VideoLink"("projectId");

-- CreateIndex
CREATE INDEX "VideoLink_archived_createdAt_idx" ON "VideoLink"("archived", "createdAt");
