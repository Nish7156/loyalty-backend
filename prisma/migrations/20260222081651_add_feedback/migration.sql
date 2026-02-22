-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_customerId_idx" ON "Feedback"("customerId");

-- CreateIndex
CREATE INDEX "Feedback_createdAt_idx" ON "Feedback"("createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("phoneNumber") ON DELETE CASCADE ON UPDATE CASCADE;
