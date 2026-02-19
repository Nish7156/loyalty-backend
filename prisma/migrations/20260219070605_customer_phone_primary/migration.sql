/*
  Warnings:

  - The primary key for the `Customer` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `Customer` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Reward" DROP CONSTRAINT "Reward_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Streak" DROP CONSTRAINT "Streak_customerId_fkey";

-- DropIndex
DROP INDEX "Customer_phoneNumber_idx";

-- DropIndex
DROP INDEX "Customer_phoneNumber_key";

-- AlterTable
ALTER TABLE "Customer" DROP CONSTRAINT "Customer_pkey",
DROP COLUMN "id",
ADD CONSTRAINT "Customer_pkey" PRIMARY KEY ("phoneNumber");

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("phoneNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("phoneNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("phoneNumber") ON DELETE CASCADE ON UPDATE CASCADE;
