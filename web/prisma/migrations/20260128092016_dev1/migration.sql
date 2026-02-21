-- CreateEnum
CREATE TYPE "StrategyProfile" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- AlterTable
ALTER TABLE "CopyTrade" ADD COLUMN     "realizedPnL" DOUBLE PRECISION,
ADD COLUMN     "usedBotFloat" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CopyTradingConfig" ADD COLUMN     "strategyProfile" "StrategyProfile" NOT NULL DEFAULT 'MODERATE';

-- CreateTable
CREATE TABLE "CachedSmartMoney" (
    "id" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "traderData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedSmartMoney_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmartMoneyCacheMeta" (
    "id" TEXT NOT NULL,
    "lastUpdateAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "traderCount" INTEGER,
    "errorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmartMoneyCacheMeta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CachedTraderLeaderboard" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "traderData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedTraderLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardCacheMeta" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lastUpdateAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "traderCount" INTEGER,
    "errorMessage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardCacheMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CachedSmartMoney_page_idx" ON "CachedSmartMoney"("page");

-- CreateIndex
CREATE UNIQUE INDEX "CachedSmartMoney_page_rank_key" ON "CachedSmartMoney"("page", "rank");

-- CreateIndex
CREATE INDEX "CachedTraderLeaderboard_period_idx" ON "CachedTraderLeaderboard"("period");

-- CreateIndex
CREATE UNIQUE INDEX "CachedTraderLeaderboard_period_rank_key" ON "CachedTraderLeaderboard"("period", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardCacheMeta_period_key" ON "LeaderboardCacheMeta"("period");
