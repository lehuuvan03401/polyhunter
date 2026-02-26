-- Add subscription-scoped managed positions to isolate accounting across multiple managed subscriptions per wallet.

CREATE TABLE "ManagedSubscriptionPosition" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "tokenId" TEXT NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avgEntryPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedSubscriptionPosition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedSubscriptionPosition_subscriptionId_tokenId_key"
ON "ManagedSubscriptionPosition"("subscriptionId", "tokenId");

CREATE INDEX "ManagedSubscriptionPosition_subscriptionId_idx"
ON "ManagedSubscriptionPosition"("subscriptionId");

CREATE INDEX "ManagedSubscriptionPosition_subscriptionId_balance_idx"
ON "ManagedSubscriptionPosition"("subscriptionId", "balance");

CREATE INDEX "ManagedSubscriptionPosition_walletAddress_balance_idx"
ON "ManagedSubscriptionPosition"("walletAddress", "balance");

ALTER TABLE "ManagedSubscriptionPosition"
ADD CONSTRAINT "ManagedSubscriptionPosition_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
