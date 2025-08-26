/*
  Warnings:

  - A unique constraint covering the columns `[projectDisplayId]` on the table `projects` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."projects" ADD COLUMN     "projectDisplayId" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "projects_projectDisplayId_key" ON "public"."projects"("projectDisplayId");
