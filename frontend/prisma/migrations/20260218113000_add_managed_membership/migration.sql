-- Marketing proposal phase-2:
-- Managed membership plans (monthly/quarterly)

CREATE TYPE "ManagedMembershipPlanType" AS ENUM ('MONTHLY', 'QUARTERLY');
CREATE TYPE "ManagedMembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');

CREATE TABLE "ManagedMembership" (
  "id" TEXT NOT NULL,
  "walletAddress" TEXT NOT NULL,
  "planType" "ManagedMembershipPlanType" NOT NULL,
  "status" "ManagedMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "paymentToken" TEXT NOT NULL DEFAULT 'USDC',
  "basePriceUsd" DOUBLE PRECISION NOT NULL,
  "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "finalPriceUsd" DOUBLE PRECISION NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagedMembership_walletAddress_status_endsAt_idx"
ON "ManagedMembership"("walletAddress", "status", "endsAt");

CREATE INDEX "ManagedMembership_walletAddress_createdAt_idx"
ON "ManagedMembership"("walletAddress", "createdAt");
