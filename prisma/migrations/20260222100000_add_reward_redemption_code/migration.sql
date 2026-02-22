-- AlterTable
ALTER TABLE "Reward" ADD COLUMN "redemptionCode" TEXT;
ALTER TABLE "Reward" ADD COLUMN "redemptionCompletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Reward_redemptionCode_key" ON "Reward"("redemptionCode");
