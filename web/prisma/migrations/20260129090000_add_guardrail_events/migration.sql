-- Add guardrail event audit table
CREATE TABLE IF NOT EXISTS "GuardrailEvent" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "walletAddress" TEXT,
    "amount" DOUBLE PRECISION,
    "tradeId" TEXT,
    "tokenId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GuardrailEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GuardrailEvent_reason_idx" ON "GuardrailEvent"("reason");
CREATE INDEX IF NOT EXISTS "GuardrailEvent_walletAddress_idx" ON "GuardrailEvent"("walletAddress");
CREATE INDEX IF NOT EXISTS "GuardrailEvent_tokenId_idx" ON "GuardrailEvent"("tokenId");
CREATE INDEX IF NOT EXISTS "GuardrailEvent_createdAt_idx" ON "GuardrailEvent"("createdAt");
