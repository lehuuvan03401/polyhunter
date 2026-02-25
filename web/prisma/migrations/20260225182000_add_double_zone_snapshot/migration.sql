-- Double-zone promotion snapshot

CREATE TABLE "DoubleZoneSnapshot" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "leftLegWallet" TEXT,
  "rightLegWallet" TEXT,
  "leftNetDepositUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "rightNetDepositUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "weakZoneNetDepositUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "strongZoneNetDepositUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "promotionLevel" TEXT NOT NULL DEFAULT 'NONE',
  "nextLevel" TEXT,
  "nextLevelGapUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DoubleZoneSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DoubleZoneSnapshot_walletAddress_snapshotDate_key"
ON "DoubleZoneSnapshot"("walletAddress", "snapshotDate");

CREATE INDEX "DoubleZoneSnapshot_accountId_snapshotDate_idx"
ON "DoubleZoneSnapshot"("accountId", "snapshotDate");

CREATE INDEX "DoubleZoneSnapshot_snapshotDate_promotionLevel_idx"
ON "DoubleZoneSnapshot"("snapshotDate", "promotionLevel");

ALTER TABLE "DoubleZoneSnapshot"
ADD CONSTRAINT "DoubleZoneSnapshot_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ParticipationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
