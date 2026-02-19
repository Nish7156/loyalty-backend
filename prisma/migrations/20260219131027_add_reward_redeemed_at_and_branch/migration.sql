/*
  Warnings:

  - You are about to drop the column `periodStartedAt` on the `Streak` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "redeemedAt" TIMESTAMP(3),
ADD COLUMN     "redeemedBranchId" TEXT;

-- AlterTable
ALTER TABLE "Streak" DROP COLUMN "periodStartedAt";

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_redeemedBranchId_fkey" FOREIGN KEY ("redeemedBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
