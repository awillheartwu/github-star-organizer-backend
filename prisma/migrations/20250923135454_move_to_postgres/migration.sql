/*
  Warnings:

  - The `role` column on the `User` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `style` on the `AiSummary` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reason` on the `ArchivedProject` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "public"."ArchivedReason" AS ENUM ('manual', 'unstarred');

-- CreateEnum
CREATE TYPE "public"."AiSummaryStyle" AS ENUM ('short', 'long');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('USER', 'ADMIN');

-- AlterTable
ALTER TABLE "public"."AiSummary" DROP COLUMN "style",
ADD COLUMN     "style" "public"."AiSummaryStyle" NOT NULL;

-- AlterTable
ALTER TABLE "public"."ArchivedProject" DROP COLUMN "reason",
ADD COLUMN     "reason" "public"."ArchivedReason" NOT NULL;

-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "role",
ADD COLUMN     "role" "public"."UserRole" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "AiSummary_style_idx" ON "public"."AiSummary"("style");

-- CreateIndex
CREATE INDEX "ArchivedProject_reason_idx" ON "public"."ArchivedProject"("reason");
