-- AlterTable
ALTER TABLE "CopyTradingConfig" ADD COLUMN     "agentId" TEXT;

-- CreateTable
CREATE TABLE "AgentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tags" TEXT[],
    "traderAddress" TEXT NOT NULL,
    "traderName" TEXT,
    "avatarUrl" TEXT,
    "strategyProfile" "StrategyProfile" NOT NULL DEFAULT 'MODERATE',
    "mode" "CopyTradingMode" NOT NULL DEFAULT 'PERCENTAGE',
    "sizeScale" DOUBLE PRECISION,
    "fixedAmount" DOUBLE PRECISION,
    "maxSizePerTrade" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "minSizePerTrade" DOUBLE PRECISION,
    "stopLoss" DOUBLE PRECISION,
    "takeProfit" DOUBLE PRECISION,
    "maxOdds" DOUBLE PRECISION,
    "minLiquidity" DOUBLE PRECISION,
    "minVolume" DOUBLE PRECISION,
    "sellMode" TEXT NOT NULL DEFAULT 'SAME_PERCENT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentTemplate_isActive_idx" ON "AgentTemplate"("isActive");

-- CreateIndex
CREATE INDEX "AgentTemplate_traderAddress_idx" ON "AgentTemplate"("traderAddress");

-- CreateIndex
CREATE INDEX "CopyTradingConfig_agentId_idx" ON "CopyTradingConfig"("agentId");

-- AddForeignKey
ALTER TABLE "CopyTradingConfig" ADD CONSTRAINT "CopyTradingConfig_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
