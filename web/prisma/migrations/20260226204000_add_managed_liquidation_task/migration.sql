-- Replace synthetic managed liquidation bookkeeping with explicit liquidation task states.

CREATE TYPE "ManagedLiquidationTaskStatus" AS ENUM (
  'PENDING',
  'RETRYING',
  'BLOCKED',
  'COMPLETED',
  'FAILED'
);

CREATE TABLE "ManagedLiquidationTask" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "copyConfigId" TEXT,
  "tokenId" TEXT NOT NULL,
  "requestedShares" DOUBLE PRECISION NOT NULL,
  "avgEntryPrice" DOUBLE PRECISION NOT NULL,
  "indicativePrice" DOUBLE PRECISION,
  "notionalUsd" DOUBLE PRECISION,
  "status" "ManagedLiquidationTaskStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedLiquidationTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedLiquidationTask_subscriptionId_tokenId_key"
ON "ManagedLiquidationTask"("subscriptionId", "tokenId");

CREATE INDEX "ManagedLiquidationTask_status_nextRetryAt_idx"
ON "ManagedLiquidationTask"("status", "nextRetryAt");

CREATE INDEX "ManagedLiquidationTask_subscriptionId_status_idx"
ON "ManagedLiquidationTask"("subscriptionId", "status");

CREATE INDEX "ManagedLiquidationTask_walletAddress_status_idx"
ON "ManagedLiquidationTask"("walletAddress", "status");

ALTER TABLE "ManagedLiquidationTask"
ADD CONSTRAINT "ManagedLiquidationTask_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
