-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_customerId_idx" ON "PushSubscription"("customerId");

-- CreateIndex
CREATE INDEX "Activity_branchId_status_createdAt_idx" ON "Activity"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_customerId_status_idx" ON "Activity"("customerId", "status");

-- CreateIndex
CREATE INDEX "WalletTransaction_walletId_type_idx" ON "WalletTransaction"("walletId", "type");

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("phoneNumber") ON DELETE CASCADE ON UPDATE CASCADE;
