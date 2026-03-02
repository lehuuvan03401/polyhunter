-- Persist managed subscription allocation snapshots for deterministic replay and audits.

CREATE TYPE "ManagedSubscriptionAllocationStatus" AS ENUM (
  'ACTIVE',
  'SUPERSEDED',
  'REVOKED'
);

CREATE TABLE "ManagedSubscriptionAllocation" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "ManagedSubscriptionAllocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason" TEXT,
  "seed" TEXT NOT NULL,
  "scoreSnapshot" JSONB NOT NULL,
  "selectedWeights" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedSubscriptionAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedSubscriptionAllocation_subscriptionId_version_key"
ON "ManagedSubscriptionAllocation"("subscriptionId", "version");

CREATE INDEX "ManagedSubscriptionAllocation_subscriptionId_status_createdAt_idx"
ON "ManagedSubscriptionAllocation"("subscriptionId", "status", "createdAt");

CREATE INDEX "ManagedSubscriptionAllocation_status_createdAt_idx"
ON "ManagedSubscriptionAllocation"("status", "createdAt");

ALTER TABLE "ManagedSubscriptionAllocation"
ADD CONSTRAINT "ManagedSubscriptionAllocation_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
