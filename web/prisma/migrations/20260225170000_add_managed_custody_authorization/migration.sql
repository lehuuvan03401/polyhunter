-- Managed custody authorization trail for MANAGED mode

CREATE TYPE "ManagedCustodyAuthorizationStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "ManagedCustodyAuthorization" (
  "id" TEXT NOT NULL,
  "accountId" TEXT,
  "walletAddress" TEXT NOT NULL,
  "mode" "ParticipationMode" NOT NULL DEFAULT 'MANAGED',
  "status" "ManagedCustodyAuthorizationStatus" NOT NULL DEFAULT 'ACTIVE',
  "consentStatement" TEXT NOT NULL,
  "requestPath" TEXT NOT NULL,
  "requestMethod" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "scope" JSONB,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManagedCustodyAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManagedCustodyAuthorization_walletAddress_status_grantedAt_idx"
ON "ManagedCustodyAuthorization"("walletAddress", "status", "grantedAt");

CREATE INDEX "ManagedCustodyAuthorization_accountId_status_idx"
ON "ManagedCustodyAuthorization"("accountId", "status");

ALTER TABLE "ManagedCustodyAuthorization"
ADD CONSTRAINT "ManagedCustodyAuthorization_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "ParticipationAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
