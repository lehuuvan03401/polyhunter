-- CreateTable
CREATE TABLE "ReimbursementLedger" (
    "id" TEXT NOT NULL,
    "copyTradeId" TEXT NOT NULL,
    "proxyAddress" TEXT NOT NULL,
    "botAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "errorLog" TEXT,
    "txHash" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "ReimbursementLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReimbursementLedger_proxyAddress_botAddress_status_idx" ON "ReimbursementLedger"("proxyAddress", "botAddress", "status");

-- CreateIndex
CREATE INDEX "ReimbursementLedger_status_nextRetryAt_idx" ON "ReimbursementLedger"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "ReimbursementLedger_lockedAt_idx" ON "ReimbursementLedger"("lockedAt");

-- CreateIndex
CREATE INDEX "ReimbursementLedger_createdAt_idx" ON "ReimbursementLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReimbursementLedger_copyTradeId_key" ON "ReimbursementLedger"("copyTradeId");

-- AddForeignKey
ALTER TABLE "ReimbursementLedger" ADD CONSTRAINT "ReimbursementLedger_copyTradeId_fkey" FOREIGN KEY ("copyTradeId") REFERENCES "CopyTrade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
