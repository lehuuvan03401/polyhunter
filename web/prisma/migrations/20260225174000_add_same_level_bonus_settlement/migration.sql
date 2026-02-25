-- Same-level bonus settlement ledger

CREATE TABLE "SameLevelBonusSettlement" (
  "id" TEXT NOT NULL,
  "sourceTradeId" TEXT NOT NULL,
  "sourceUserId" TEXT NOT NULL,
  "referrerId" TEXT NOT NULL,
  "generation" INTEGER NOT NULL,
  "bonusRate" DOUBLE PRECISION NOT NULL,
  "bonusAmount" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SameLevelBonusSettlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SameLevelBonusSettlement_sourceTradeId_referrerId_generation_key"
ON "SameLevelBonusSettlement"("sourceTradeId", "referrerId", "generation");

CREATE INDEX "SameLevelBonusSettlement_referrerId_createdAt_idx"
ON "SameLevelBonusSettlement"("referrerId", "createdAt");

CREATE INDEX "SameLevelBonusSettlement_sourceUserId_createdAt_idx"
ON "SameLevelBonusSettlement"("sourceUserId", "createdAt");

ALTER TABLE "SameLevelBonusSettlement"
ADD CONSTRAINT "SameLevelBonusSettlement_referrerId_fkey"
FOREIGN KEY ("referrerId") REFERENCES "Referrer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
