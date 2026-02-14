-- CreateEnum
CREATE TYPE "ManagedDisclosurePolicy" AS ENUM ('TRANSPARENT', 'DELAYED');

-- CreateEnum
CREATE TYPE "ManagedSubscriptionStatus" AS ENUM ('PENDING', 'RUNNING', 'MATURED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ManagedSettlementStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ManagedRiskAction" AS ENUM ('DELEVERAGE', 'PAUSE_NEW_ENTRIES', 'FORCE_PROTECTIVE_EXIT');

-- CreateEnum
CREATE TYPE "ReserveFundEntryType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'GUARANTEE_TOPUP', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "ManagedProduct" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategyProfile" "StrategyProfile" NOT NULL,
    "isGuaranteed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "disclosurePolicy" "ManagedDisclosurePolicy" NOT NULL DEFAULT 'TRANSPARENT',
    "disclosureDelayHours" INTEGER NOT NULL DEFAULT 0,
    "performanceFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "managementFeeRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reserveCoverageMin" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedTerm" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "targetReturnMin" DOUBLE PRECISION NOT NULL,
    "targetReturnMax" DOUBLE PRECISION NOT NULL,
    "maxDrawdown" DOUBLE PRECISION NOT NULL,
    "minYieldRate" DOUBLE PRECISION,
    "performanceFeeRate" DOUBLE PRECISION,
    "maxSubscriptionAmount" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedProductAgent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedProductAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedSubscription" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "status" "ManagedSubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "principal" DOUBLE PRECISION NOT NULL,
    "acceptedTermsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disclosurePolicy" "ManagedDisclosurePolicy" NOT NULL DEFAULT 'TRANSPARENT',
    "disclosureDelayHours" INTEGER NOT NULL DEFAULT 0,
    "highWaterMark" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentEquity" DOUBLE PRECISION,
    "copyConfigId" TEXT,
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "maturedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedNavSnapshot" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "nav" DOUBLE PRECISION NOT NULL,
    "equity" DOUBLE PRECISION NOT NULL,
    "periodReturn" DOUBLE PRECISION,
    "cumulativeReturn" DOUBLE PRECISION,
    "drawdown" DOUBLE PRECISION,
    "volatility" DOUBLE PRECISION,
    "isFallbackPrice" BOOLEAN NOT NULL DEFAULT false,
    "priceSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedNavSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedSettlement" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "status" "ManagedSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "principal" DOUBLE PRECISION NOT NULL,
    "finalEquity" DOUBLE PRECISION NOT NULL,
    "grossPnl" DOUBLE PRECISION NOT NULL,
    "highWaterMark" DOUBLE PRECISION NOT NULL,
    "hwmEligibleProfit" DOUBLE PRECISION NOT NULL,
    "performanceFeeRate" DOUBLE PRECISION NOT NULL,
    "performanceFee" DOUBLE PRECISION NOT NULL,
    "guaranteedPayout" DOUBLE PRECISION,
    "reserveTopup" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "finalPayout" DOUBLE PRECISION NOT NULL,
    "settledAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReserveFundLedger" (
    "id" TEXT NOT NULL,
    "entryType" "ReserveFundEntryType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION,
    "subscriptionId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReserveFundLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagedRiskEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION,
    "observedValue" DOUBLE PRECISION,
    "action" "ManagedRiskAction" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagedRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedProduct_slug_key" ON "ManagedProduct"("slug");

-- CreateIndex
CREATE INDEX "ManagedProduct_isActive_strategyProfile_idx" ON "ManagedProduct"("isActive", "strategyProfile");

-- CreateIndex
CREATE INDEX "ManagedProduct_status_idx" ON "ManagedProduct"("status");

-- CreateIndex
CREATE INDEX "ManagedProduct_isGuaranteed_idx" ON "ManagedProduct"("isGuaranteed");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedTerm_productId_durationDays_key" ON "ManagedTerm"("productId", "durationDays");

-- CreateIndex
CREATE INDEX "ManagedTerm_durationDays_isActive_idx" ON "ManagedTerm"("durationDays", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedProductAgent_productId_agentId_key" ON "ManagedProductAgent"("productId", "agentId");

-- CreateIndex
CREATE INDEX "ManagedProductAgent_agentId_idx" ON "ManagedProductAgent"("agentId");

-- CreateIndex
CREATE INDEX "ManagedSubscription_walletAddress_status_idx" ON "ManagedSubscription"("walletAddress", "status");

-- CreateIndex
CREATE INDEX "ManagedSubscription_status_endAt_idx" ON "ManagedSubscription"("status", "endAt");

-- CreateIndex
CREATE INDEX "ManagedSubscription_productId_termId_idx" ON "ManagedSubscription"("productId", "termId");

-- CreateIndex
CREATE INDEX "ManagedSubscription_copyConfigId_idx" ON "ManagedSubscription"("copyConfigId");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedNavSnapshot_subscriptionId_snapshotAt_key" ON "ManagedNavSnapshot"("subscriptionId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ManagedNavSnapshot_subscriptionId_snapshotAt_idx" ON "ManagedNavSnapshot"("subscriptionId", "snapshotAt");

-- CreateIndex
CREATE INDEX "ManagedNavSnapshot_snapshotAt_idx" ON "ManagedNavSnapshot"("snapshotAt");

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSettlement_subscriptionId_key" ON "ManagedSettlement"("subscriptionId");

-- CreateIndex
CREATE INDEX "ManagedSettlement_status_createdAt_idx" ON "ManagedSettlement"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ManagedSettlement_settledAt_idx" ON "ManagedSettlement"("settledAt");

-- CreateIndex
CREATE INDEX "ReserveFundLedger_entryType_createdAt_idx" ON "ReserveFundLedger"("entryType", "createdAt");

-- CreateIndex
CREATE INDEX "ReserveFundLedger_subscriptionId_idx" ON "ReserveFundLedger"("subscriptionId");

-- CreateIndex
CREATE INDEX "ManagedRiskEvent_subscriptionId_createdAt_idx" ON "ManagedRiskEvent"("subscriptionId", "createdAt");

-- CreateIndex
CREATE INDEX "ManagedRiskEvent_action_createdAt_idx" ON "ManagedRiskEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ManagedTerm" ADD CONSTRAINT "ManagedTerm_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ManagedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProductAgent" ADD CONSTRAINT "ManagedProductAgent_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ManagedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedProductAgent" ADD CONSTRAINT "ManagedProductAgent_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "AgentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSubscription" ADD CONSTRAINT "ManagedSubscription_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ManagedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSubscription" ADD CONSTRAINT "ManagedSubscription_termId_fkey" FOREIGN KEY ("termId") REFERENCES "ManagedTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSubscription" ADD CONSTRAINT "ManagedSubscription_copyConfigId_fkey" FOREIGN KEY ("copyConfigId") REFERENCES "CopyTradingConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedNavSnapshot" ADD CONSTRAINT "ManagedNavSnapshot_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSettlement" ADD CONSTRAINT "ManagedSettlement_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveFundLedger" ADD CONSTRAINT "ReserveFundLedger_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedRiskEvent" ADD CONSTRAINT "ManagedRiskEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
