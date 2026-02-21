-- CreateEnum
CREATE TYPE "AffiliateTier" AS ENUM ('ORDINARY', 'VIP', 'ELITE', 'PARTNER', 'SUPER_PARTNER');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PRO', 'WHALE');

-- CreateEnum
CREATE TYPE "CopyTradingMode" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('PROXY', 'EOA');

-- CreateEnum
CREATE TYPE "CopyTradeStatus" AS ENUM ('PENDING', 'EXECUTED', 'SETTLEMENT_PENDING', 'FAILED', 'SKIPPED', 'EXPIRED');

-- CreateTable
CREATE TABLE "Referrer" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "tier" "AffiliateTier" NOT NULL DEFAULT 'ORDINARY',
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalEarned" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingPayout" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "maxDepth" INTEGER NOT NULL DEFAULT 0,
    "sunLineCount" INTEGER NOT NULL DEFAULT 0,
    "teamVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "Referrer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamClosure" (
    "id" TEXT NOT NULL,
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "TeamClosure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeAddress" TEXT NOT NULL,
    "lifetimeVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last30DaysVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralVolume" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "volumeUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commissionUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReferralVolume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommissionLog" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" TEXT NOT NULL,
    "sourceTradeId" TEXT,
    "sourceUserId" TEXT,
    "generation" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommissionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProxy" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "proxyAddress" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'STARTER',
    "totalDeposited" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWithdrawn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVolume" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalProfit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalFeesPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProxy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProxyTransaction" (
    "id" TEXT NOT NULL,
    "userProxyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProxyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeTransaction" (
    "id" TEXT NOT NULL,
    "userProxyId" TEXT NOT NULL,
    "profitAmount" DOUBLE PRECISION NOT NULL,
    "feeAmount" DOUBLE PRECISION NOT NULL,
    "feePercent" DOUBLE PRECISION NOT NULL,
    "txHash" TEXT,
    "blockNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTradingConfig" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "traderAddress" TEXT NOT NULL,
    "traderName" TEXT,
    "slippageType" TEXT NOT NULL DEFAULT 'FIXED',
    "maxSlippage" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "autoExecute" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'POLLING',
    "executionMode" "ExecutionMode" NOT NULL DEFAULT 'PROXY',
    "encryptedKey" TEXT,
    "iv" TEXT,
    "mode" "CopyTradingMode" NOT NULL DEFAULT 'PERCENTAGE',
    "sizeScale" DOUBLE PRECISION,
    "fixedAmount" DOUBLE PRECISION,
    "maxSizePerTrade" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "minSizePerTrade" DOUBLE PRECISION,
    "infiniteMode" BOOLEAN NOT NULL DEFAULT false,
    "takeProfit" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "direction" TEXT NOT NULL DEFAULT 'COPY',
    "sideFilter" TEXT,
    "minTriggerSize" DOUBLE PRECISION,
    "maxDaysOut" INTEGER,
    "maxPerMarket" DOUBLE PRECISION,
    "minLiquidity" DOUBLE PRECISION,
    "minVolume" DOUBLE PRECISION,
    "maxOdds" DOUBLE PRECISION,
    "sellMode" TEXT NOT NULL DEFAULT 'SAME_PERCENT',
    "sellFixedAmount" DOUBLE PRECISION,
    "sellPercentage" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CopyTradingConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CopyTrade" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "originalTrader" TEXT NOT NULL,
    "originalSide" TEXT NOT NULL,
    "originalSize" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "marketSlug" TEXT,
    "conditionId" TEXT,
    "tokenId" TEXT,
    "outcome" TEXT,
    "copySize" DOUBLE PRECISION NOT NULL,
    "copyPrice" DOUBLE PRECISION,
    "status" "CopyTradeStatus" NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "errorMessage" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CopyTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "synced" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "errors" TEXT,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtRecord" (
    "id" TEXT NOT NULL,
    "proxyAddress" TEXT NOT NULL,
    "botAddress" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorLog" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repaidAt" TIMESTAMP(3),

    CONSTRAINT "DebtRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPosition" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgEntryPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolumeTier" (
    "id" TEXT NOT NULL,
    "minVolume" DOUBLE PRECISION NOT NULL,
    "maxVolume" DOUBLE PRECISION,
    "feeRateOnProfit" DOUBLE PRECISION NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "VolumeTier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_walletAddress_key" ON "Referrer"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_referralCode_key" ON "Referrer"("referralCode");

-- CreateIndex
CREATE INDEX "TeamClosure_ancestorId_idx" ON "TeamClosure"("ancestorId");

-- CreateIndex
CREATE INDEX "TeamClosure_descendantId_idx" ON "TeamClosure"("descendantId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamClosure_ancestorId_descendantId_key" ON "TeamClosure"("ancestorId", "descendantId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeAddress_key" ON "Referral"("refereeAddress");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralVolume_referrerId_idx" ON "ReferralVolume"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralVolume_referrerId_date_key" ON "ReferralVolume"("referrerId", "date");

-- CreateIndex
CREATE INDEX "Payout_referrerId_idx" ON "Payout"("referrerId");

-- CreateIndex
CREATE INDEX "CommissionLog_referrerId_idx" ON "CommissionLog"("referrerId");

-- CreateIndex
CREATE INDEX "CommissionLog_type_idx" ON "CommissionLog"("type");

-- CreateIndex
CREATE INDEX "CommissionLog_createdAt_idx" ON "CommissionLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserProxy_walletAddress_key" ON "UserProxy"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserProxy_proxyAddress_key" ON "UserProxy"("proxyAddress");

-- CreateIndex
CREATE INDEX "UserProxy_walletAddress_idx" ON "UserProxy"("walletAddress");

-- CreateIndex
CREATE INDEX "ProxyTransaction_userProxyId_idx" ON "ProxyTransaction"("userProxyId");

-- CreateIndex
CREATE INDEX "ProxyTransaction_type_idx" ON "ProxyTransaction"("type");

-- CreateIndex
CREATE INDEX "ProxyTransaction_createdAt_idx" ON "ProxyTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "FeeTransaction_userProxyId_idx" ON "FeeTransaction"("userProxyId");

-- CreateIndex
CREATE INDEX "FeeTransaction_createdAt_idx" ON "FeeTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "CopyTradingConfig_walletAddress_idx" ON "CopyTradingConfig"("walletAddress");

-- CreateIndex
CREATE INDEX "CopyTradingConfig_traderAddress_idx" ON "CopyTradingConfig"("traderAddress");

-- CreateIndex
CREATE INDEX "CopyTradingConfig_isActive_idx" ON "CopyTradingConfig"("isActive");

-- CreateIndex
CREATE INDEX "CopyTrade_configId_idx" ON "CopyTrade"("configId");

-- CreateIndex
CREATE INDEX "CopyTrade_status_idx" ON "CopyTrade"("status");

-- CreateIndex
CREATE INDEX "CopyTrade_detectedAt_idx" ON "CopyTrade"("detectedAt");

-- CreateIndex
CREATE INDEX "SyncLog_type_idx" ON "SyncLog"("type");

-- CreateIndex
CREATE INDEX "SyncLog_startedAt_idx" ON "SyncLog"("startedAt");

-- CreateIndex
CREATE INDEX "DebtRecord_proxyAddress_idx" ON "DebtRecord"("proxyAddress");

-- CreateIndex
CREATE INDEX "DebtRecord_botAddress_idx" ON "DebtRecord"("botAddress");

-- CreateIndex
CREATE INDEX "DebtRecord_status_idx" ON "DebtRecord"("status");

-- CreateIndex
CREATE INDEX "UserPosition_walletAddress_idx" ON "UserPosition"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserPosition_walletAddress_tokenId_key" ON "UserPosition"("walletAddress", "tokenId");

-- AddForeignKey
ALTER TABLE "TeamClosure" ADD CONSTRAINT "TeamClosure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "Referrer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamClosure" ADD CONSTRAINT "TeamClosure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "Referrer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralVolume" ADD CONSTRAINT "ReferralVolume_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommissionLog" ADD CONSTRAINT "CommissionLog_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProxyTransaction" ADD CONSTRAINT "ProxyTransaction_userProxyId_fkey" FOREIGN KEY ("userProxyId") REFERENCES "UserProxy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeeTransaction" ADD CONSTRAINT "FeeTransaction_userProxyId_fkey" FOREIGN KEY ("userProxyId") REFERENCES "UserProxy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CopyTrade" ADD CONSTRAINT "CopyTrade_configId_fkey" FOREIGN KEY ("configId") REFERENCES "CopyTradingConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
