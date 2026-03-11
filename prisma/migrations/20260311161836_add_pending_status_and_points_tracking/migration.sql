-- AlterEnum
ALTER TYPE "RewardStatus" ADD VALUE 'PENDING';

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "pointsCost" DECIMAL(10,2),
ADD COLUMN     "source" TEXT DEFAULT 'VISITS';
