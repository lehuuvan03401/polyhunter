-- Add retry fields for copy trade execution
ALTER TABLE "CopyTrade" ADD COLUMN IF NOT EXISTS "retryCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CopyTrade" ADD COLUMN IF NOT EXISTS "nextRetryAt" TIMESTAMP;
