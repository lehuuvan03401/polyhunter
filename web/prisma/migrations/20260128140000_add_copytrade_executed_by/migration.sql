-- Track which worker executed the trade
ALTER TABLE "CopyTrade" ADD COLUMN IF NOT EXISTS "executedBy" TEXT;
