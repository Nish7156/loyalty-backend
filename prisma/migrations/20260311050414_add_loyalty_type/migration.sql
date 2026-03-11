-- CreateEnum
CREATE TYPE "LoyaltyType" AS ENUM ('VISITS', 'POINTS', 'HYBRID');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "loyaltyType" "LoyaltyType" NOT NULL DEFAULT 'VISITS';
