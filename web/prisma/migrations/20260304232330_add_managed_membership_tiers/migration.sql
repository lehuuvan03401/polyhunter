-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ManagedMembershipPlanType" ADD VALUE 'SEMI_ANNUAL';
ALTER TYPE "ManagedMembershipPlanType" ADD VALUE 'ANNUAL';

-- AlterEnum
ALTER TYPE "ManagedSubscriptionStatus" ADD VALUE 'LIQUIDATING';

-- DropIndex
DROP INDEX "ManagedSubscription_walletAddress_isTrial_idx";

-- AlterTable
ALTER TABLE "ManagedProduct" ALTER COLUMN "performanceFeeRate" SET DEFAULT 0.2;

-- AlterTable
ALTER TABLE "PartnerElimination" ADD COLUMN     "scoreActiveManagedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PartnerMonthlyRank" ADD COLUMN     "scoreActiveManagedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PartnerQueue" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "commitmentAmountUsd" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerEliminationTask" (
    "id" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorLog" TEXT,
    "processedSeats" INTEGER NOT NULL DEFAULT 0,
    "totalSeats" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerEliminationTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PartnerQueue_walletAddress_key" ON "PartnerQueue"("walletAddress");

-- CreateIndex
CREATE INDEX "PartnerQueue_status_commitmentAmountUsd_joinedAt_idx" ON "PartnerQueue"("status", "commitmentAmountUsd", "joinedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerEliminationTask_monthKey_key" ON "PartnerEliminationTask"("monthKey");

-- CreateIndex
CREATE INDEX "PartnerEliminationTask_status_monthKey_idx" ON "PartnerEliminationTask"("status", "monthKey");

-- RenameIndex
ALTER INDEX "ManagedPrincipalReservationLedger_walletAddress_entryType_creat" RENAME TO "ManagedPrincipalReservationLedger_walletAddress_entryType_c_idx";

-- RenameIndex
ALTER INDEX "ManagedSubscriptionAllocation_subscriptionId_status_createdAt_i" RENAME TO "ManagedSubscriptionAllocation_subscriptionId_status_created_idx";

-- RenameIndex
ALTER INDEX "ManagedSubscriptionExecutionTarget_subscriptionId_copyConfigId_" RENAME TO "ManagedSubscriptionExecutionTarget_subscriptionId_copyConfi_key";

-- RenameIndex
ALTER INDEX "ManagedSubscriptionExecutionTarget_subscriptionId_isActive_targ" RENAME TO "ManagedSubscriptionExecutionTarget_subscriptionId_isActive__idx";

-- RenameIndex
ALTER INDEX "SameLevelBonusSettlement_sourceTradeId_referrerId_generation_ke" RENAME TO "SameLevelBonusSettlement_sourceTradeId_referrerId_generatio_key";
