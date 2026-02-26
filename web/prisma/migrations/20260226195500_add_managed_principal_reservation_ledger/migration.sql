-- Add managed principal reservation ledger to enforce subscription-level principal availability.

CREATE TYPE "ManagedPrincipalReservationEntryType" AS ENUM (
  'RESERVE',
  'RELEASE'
);

CREATE TABLE "ManagedPrincipalReservationLedger" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "entryType" "ManagedPrincipalReservationEntryType" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "managedQualifiedBalance" DOUBLE PRECISION,
  "reservedBalanceAfter" DOUBLE PRECISION,
  "availableBalanceAfter" DOUBLE PRECISION,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManagedPrincipalReservationLedger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedPrincipalReservationLedger_idempotencyKey_key"
ON "ManagedPrincipalReservationLedger"("idempotencyKey");

CREATE INDEX "ManagedPrincipalReservationLedger_walletAddress_createdAt_idx"
ON "ManagedPrincipalReservationLedger"("walletAddress", "createdAt");

CREATE INDEX "ManagedPrincipalReservationLedger_walletAddress_entryType_createdAt_idx"
ON "ManagedPrincipalReservationLedger"("walletAddress", "entryType", "createdAt");

CREATE INDEX "ManagedPrincipalReservationLedger_subscriptionId_createdAt_idx"
ON "ManagedPrincipalReservationLedger"("subscriptionId", "createdAt");

ALTER TABLE "ManagedPrincipalReservationLedger"
ADD CONSTRAINT "ManagedPrincipalReservationLedger_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
