-- CreateEnum
CREATE TYPE "PlatformTxType" AS ENUM ('EARN', 'SPEND', 'ADJUST');

-- CreateTable
CREATE TABLE "PlatformWallet" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lifetimeEarned" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lifetimeSpent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformWalletTransaction" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "PlatformTxType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balanceBefore" DECIMAL(10,2) NOT NULL,
    "balanceAfter" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformWalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlatformWallet_customerId_key" ON "PlatformWallet"("customerId");

-- CreateIndex
CREATE INDEX "PlatformWallet_customerId_idx" ON "PlatformWallet"("customerId");

-- CreateIndex
CREATE INDEX "PlatformWalletTransaction_walletId_idx" ON "PlatformWalletTransaction"("walletId");

-- CreateIndex
CREATE INDEX "PlatformWalletTransaction_createdAt_idx" ON "PlatformWalletTransaction"("createdAt");

-- AddForeignKey
ALTER TABLE "PlatformWallet" ADD CONSTRAINT "PlatformWallet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("phoneNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformWalletTransaction" ADD CONSTRAINT "PlatformWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "PlatformWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
