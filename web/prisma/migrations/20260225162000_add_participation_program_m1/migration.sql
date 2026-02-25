-- Participation program (M1 foundation)
-- Adds activation/funding/net-deposit/matrix models

CREATE TYPE "ParticipationMode" AS ENUM ('FREE', 'MANAGED');
CREATE TYPE "ParticipationAccountStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "ParticipationFundingChannel" AS ENUM ('EXCHANGE', 'TP_WALLET');
CREATE TYPE "ParticipationFundingDirection" AS ENUM ('DEPOSIT', 'WITHDRAW');
CREATE TYPE "ManagedReturnPrincipalBand" AS ENUM ('A', 'B', 'C');

CREATE TABLE "ParticipationAccount" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "status" "ParticipationAccountStatus" NOT NULL DEFAULT 'PENDING',
  "preferredMode" "ParticipationMode",
  "isRegistrationComplete" BOOLEAN NOT NULL DEFAULT false,
  "registrationCompletedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParticipationAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipationAccount_walletAddress_key"
ON "ParticipationAccount"("walletAddress");

CREATE INDEX "ParticipationAccount_status_idx"
ON "ParticipationAccount"("status");

CREATE INDEX "ParticipationAccount_preferredMode_status_idx"
ON "ParticipationAccount"("preferredMode", "status");

CREATE TABLE "ParticipationFundingRecord" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "channel" "ParticipationFundingChannel" NOT NULL,
  "direction" "ParticipationFundingDirection" NOT NULL DEFAULT 'DEPOSIT',
  "tokenSymbol" TEXT NOT NULL DEFAULT 'MCN',
  "rawAmount" DOUBLE PRECISION NOT NULL,
  "usdAmount" DOUBLE PRECISION NOT NULL,
  "mcnEquivalentAmount" DOUBLE PRECISION NOT NULL,
  "txHash" TEXT,
  "metadata" JSONB,
  "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParticipationFundingRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipationFundingRecord_txHash_key"
ON "ParticipationFundingRecord"("txHash");

CREATE INDEX "ParticipationFundingRecord_accountId_createdAt_idx"
ON "ParticipationFundingRecord"("accountId", "createdAt");

CREATE INDEX "ParticipationFundingRecord_walletAddress_createdAt_idx"
ON "ParticipationFundingRecord"("walletAddress", "createdAt");

CREATE INDEX "ParticipationFundingRecord_channel_createdAt_idx"
ON "ParticipationFundingRecord"("channel", "createdAt");

CREATE INDEX "ParticipationFundingRecord_direction_createdAt_idx"
ON "ParticipationFundingRecord"("direction", "createdAt");

CREATE TABLE "NetDepositLedger" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "fundingRecordId" TEXT,
  "walletAddress" TEXT NOT NULL,
  "channel" "ParticipationFundingChannel" NOT NULL,
  "direction" "ParticipationFundingDirection" NOT NULL,
  "usdAmount" DOUBLE PRECISION NOT NULL,
  "mcnEquivalentAmount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NetDepositLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NetDepositLedger_accountId_createdAt_idx"
ON "NetDepositLedger"("accountId", "createdAt");

CREATE INDEX "NetDepositLedger_walletAddress_createdAt_idx"
ON "NetDepositLedger"("walletAddress", "createdAt");

CREATE INDEX "NetDepositLedger_direction_createdAt_idx"
ON "NetDepositLedger"("direction", "createdAt");

CREATE INDEX "NetDepositLedger_channel_createdAt_idx"
ON "NetDepositLedger"("channel", "createdAt");

CREATE TABLE "DailyLevelSnapshot" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "snapshotDate" TIMESTAMP(3) NOT NULL,
  "selfNetDepositUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "teamNetDepositUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "level" TEXT NOT NULL DEFAULT 'NONE',
  "dividendRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyLevelSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyLevelSnapshot_walletAddress_snapshotDate_key"
ON "DailyLevelSnapshot"("walletAddress", "snapshotDate");

CREATE INDEX "DailyLevelSnapshot_accountId_snapshotDate_idx"
ON "DailyLevelSnapshot"("accountId", "snapshotDate");

CREATE INDEX "DailyLevelSnapshot_snapshotDate_level_idx"
ON "DailyLevelSnapshot"("snapshotDate", "level");

CREATE TABLE "ManagedReturnMatrix" (
  "id" TEXT NOT NULL,
  "principalBand" "ManagedReturnPrincipalBand" NOT NULL,
  "minPrincipalUsd" DOUBLE PRECISION NOT NULL,
  "maxPrincipalUsd" DOUBLE PRECISION NOT NULL,
  "termDays" INTEGER NOT NULL,
  "strategyProfile" "StrategyProfile" NOT NULL,
  "returnMin" DOUBLE PRECISION NOT NULL,
  "returnMax" DOUBLE PRECISION NOT NULL,
  "returnUnit" TEXT NOT NULL DEFAULT 'PERCENT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedReturnMatrix_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedReturnMatrix_principalBand_termDays_strategyProfile_key"
ON "ManagedReturnMatrix"("principalBand", "termDays", "strategyProfile");

CREATE INDEX "ManagedReturnMatrix_isActive_principalBand_termDays_idx"
ON "ManagedReturnMatrix"("isActive", "principalBand", "termDays");

CREATE INDEX "ManagedReturnMatrix_strategyProfile_termDays_idx"
ON "ManagedReturnMatrix"("strategyProfile", "termDays");

ALTER TABLE "ParticipationFundingRecord"
ADD CONSTRAINT "ParticipationFundingRecord_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ParticipationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NetDepositLedger"
ADD CONSTRAINT "NetDepositLedger_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ParticipationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NetDepositLedger"
ADD CONSTRAINT "NetDepositLedger_fundingRecordId_fkey"
FOREIGN KEY ("fundingRecordId") REFERENCES "ParticipationFundingRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DailyLevelSnapshot"
ADD CONSTRAINT "DailyLevelSnapshot_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ParticipationAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
