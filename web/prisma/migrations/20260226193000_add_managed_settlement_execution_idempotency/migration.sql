-- Add settlement execution ledger to enforce idempotency across settlement and profit-fee distribution.

CREATE TYPE "ManagedCommissionStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'SKIPPED',
  'FAILED'
);

CREATE TABLE "ManagedSettlementExecution" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "grossPnl" DOUBLE PRECISION NOT NULL,
  "profitFeeTradeId" TEXT NOT NULL,
  "profitFeeScope" TEXT NOT NULL,
  "commissionStatus" "ManagedCommissionStatus" NOT NULL DEFAULT 'PENDING',
  "commissionSettledAt" TIMESTAMP(3),
  "commissionSkippedReason" TEXT,
  "commissionError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedSettlementExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedSettlementExecution_settlementId_key"
ON "ManagedSettlementExecution"("settlementId");

CREATE UNIQUE INDEX "ManagedSettlementExecution_profitFeeTradeId_key"
ON "ManagedSettlementExecution"("profitFeeTradeId");

CREATE INDEX "ManagedSettlementExecution_commissionStatus_createdAt_idx"
ON "ManagedSettlementExecution"("commissionStatus", "createdAt");

CREATE INDEX "ManagedSettlementExecution_subscriptionId_commissionStatus_idx"
ON "ManagedSettlementExecution"("subscriptionId", "commissionStatus");

CREATE INDEX "ManagedSettlementExecution_walletAddress_createdAt_idx"
ON "ManagedSettlementExecution"("walletAddress", "createdAt");

ALTER TABLE "ManagedSettlementExecution"
ADD CONSTRAINT "ManagedSettlementExecution_settlementId_fkey"
FOREIGN KEY ("settlementId") REFERENCES "ManagedSettlement"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ManagedSettlementExecution"
ADD CONSTRAINT "ManagedSettlementExecution_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
