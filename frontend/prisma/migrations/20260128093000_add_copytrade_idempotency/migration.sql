-- Add idempotency key for CopyTrade and enforce unique constraints
ALTER TABLE "CopyTrade" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "CopyTrade" ADD COLUMN IF NOT EXISTS "originalTxHash" TEXT;

UPDATE "CopyTrade"
SET "idempotencyKey" = 'legacy-' || "id"
WHERE "idempotencyKey" IS NULL;

ALTER TABLE "CopyTrade" ALTER COLUMN "idempotencyKey" SET NOT NULL;

CREATE UNIQUE INDEX "CopyTrade_idempotencyKey_key" ON "CopyTrade"("idempotencyKey");

CREATE UNIQUE INDEX "CopyTrade_configId_originalTxHash_key" ON "CopyTrade"("configId", "originalTxHash");
