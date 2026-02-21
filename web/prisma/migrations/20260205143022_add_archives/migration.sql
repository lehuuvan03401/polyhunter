-- CreateTable
CREATE TABLE "CopyTradeArchive" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "originalTrader" TEXT NOT NULL,
    "originalSide" TEXT NOT NULL,
    "leaderSide" TEXT,
    "originalSize" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "marketSlug" TEXT,
    "originalTxHash" TEXT,
    "conditionId" TEXT,
    "tokenId" TEXT,
    "outcome" TEXT,
    "copySize" DOUBLE PRECISION NOT NULL,
    "copyPrice" DOUBLE PRECISION,
    "status" "CopyTradeStatus" NOT NULL,
    "txHash" TEXT,
    "errorMessage" TEXT,
    "realizedPnL" DOUBLE PRECISION,
    "usedBotFloat" BOOLEAN NOT NULL DEFAULT false,
    "executedBy" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CopyTradeArchive_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLogArchive" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "sourceTradeId" TEXT,
    "sourceUserId" TEXT,
    "generation" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLogArchive_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CopyTradeArchive_configId_idx" ON "CopyTradeArchive"("configId");

-- CreateIndex
CREATE INDEX "CopyTradeArchive_originalTrader_idx" ON "CopyTradeArchive"("originalTrader");

-- CreateIndex
CREATE INDEX "CopyTradeArchive_archivedAt_idx" ON "CopyTradeArchive"("archivedAt");

-- CreateIndex
CREATE INDEX "CopyTradeArchive_detectedAt_idx" ON "CopyTradeArchive"("detectedAt");

-- CreateIndex
CREATE INDEX "CommissionLogArchive_referrerId_idx" ON "CommissionLogArchive"("referrerId");

-- CreateIndex
CREATE INDEX "CommissionLogArchive_type_idx" ON "CommissionLogArchive"("type");

-- CreateIndex
CREATE INDEX "CommissionLogArchive_archivedAt_idx" ON "CommissionLogArchive"("archivedAt");

-- CreateIndex
CREATE INDEX "CommissionLogArchive_createdAt_idx" ON "CommissionLogArchive"("createdAt");

-- AddForeignKey
ALTER TABLE "CopyTradeArchive" ADD CONSTRAINT "CopyTradeArchive_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CopyTradingConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLogArchive" ADD CONSTRAINT "CommissionLogArchive_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
