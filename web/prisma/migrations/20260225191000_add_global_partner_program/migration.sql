-- Global partner program seat governance

CREATE TYPE "PartnerSeatStatus" AS ENUM ('ACTIVE', 'ELIMINATED', 'REFUND_PENDING', 'REFUNDED');
CREATE TYPE "PartnerRefundStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

CREATE TABLE "PartnerProgramConfig" (
  "id" TEXT NOT NULL DEFAULT 'GLOBAL',
  "maxSeats" INTEGER NOT NULL DEFAULT 100,
  "refillPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerProgramConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerSeat" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "status" "PartnerSeatStatus" NOT NULL DEFAULT 'ACTIVE',
  "seatFeeUsd" DOUBLE PRECISION NOT NULL,
  "privilegeLevel" TEXT NOT NULL DEFAULT 'V5',
  "backendAccess" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "eliminatedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerSeat_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerSeat_walletAddress_key" ON "PartnerSeat"("walletAddress");
CREATE INDEX "PartnerSeat_status_joinedAt_idx" ON "PartnerSeat"("status", "joinedAt");
CREATE INDEX "PartnerSeat_status_updatedAt_idx" ON "PartnerSeat"("status", "updatedAt");

CREATE TABLE "PartnerMonthlyRank" (
  "id" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "scoreNetDepositUsd" DOUBLE PRECISION NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerMonthlyRank_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerMonthlyRank_seatId_monthKey_key" ON "PartnerMonthlyRank"("seatId", "monthKey");
CREATE INDEX "PartnerMonthlyRank_monthKey_rank_idx" ON "PartnerMonthlyRank"("monthKey", "rank");

CREATE TABLE "PartnerElimination" (
  "id" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "monthKey" TEXT NOT NULL,
  "rankAtElimination" INTEGER NOT NULL,
  "scoreNetDepositUsd" DOUBLE PRECISION NOT NULL,
  "reason" TEXT,
  "eliminatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "refundDeadlineAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PartnerElimination_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerElimination_seatId_monthKey_key" ON "PartnerElimination"("seatId", "monthKey");
CREATE INDEX "PartnerElimination_monthKey_rankAtElimination_idx" ON "PartnerElimination"("monthKey", "rankAtElimination");
CREATE INDEX "PartnerElimination_refundDeadlineAt_idx" ON "PartnerElimination"("refundDeadlineAt");

CREATE TABLE "PartnerRefund" (
  "id" TEXT NOT NULL,
  "seatId" TEXT NOT NULL,
  "eliminationId" TEXT NOT NULL,
  "status" "PartnerRefundStatus" NOT NULL DEFAULT 'PENDING',
  "amountUsd" DOUBLE PRECISION NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "txHash" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerRefund_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PartnerRefund_eliminationId_key" ON "PartnerRefund"("eliminationId");
CREATE INDEX "PartnerRefund_status_requestedAt_idx" ON "PartnerRefund"("status", "requestedAt");
CREATE INDEX "PartnerRefund_seatId_status_idx" ON "PartnerRefund"("seatId", "status");

ALTER TABLE "PartnerMonthlyRank"
ADD CONSTRAINT "PartnerMonthlyRank_seatId_fkey"
FOREIGN KEY ("seatId") REFERENCES "PartnerSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerElimination"
ADD CONSTRAINT "PartnerElimination_seatId_fkey"
FOREIGN KEY ("seatId") REFERENCES "PartnerSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerRefund"
ADD CONSTRAINT "PartnerRefund_seatId_fkey"
FOREIGN KEY ("seatId") REFERENCES "PartnerSeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PartnerRefund"
ADD CONSTRAINT "PartnerRefund_eliminationId_fkey"
FOREIGN KEY ("eliminationId") REFERENCES "PartnerElimination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "PartnerProgramConfig" ("id", "maxSeats", "refillPriceUsd", "updatedAt")
VALUES ('GLOBAL', 100, 0, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
