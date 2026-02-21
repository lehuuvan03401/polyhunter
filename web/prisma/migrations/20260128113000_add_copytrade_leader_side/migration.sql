-- Preserve leader's original trade side
ALTER TABLE "CopyTrade" ADD COLUMN IF NOT EXISTS "leaderSide" TEXT;
