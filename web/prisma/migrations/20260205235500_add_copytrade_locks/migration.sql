-- Add lock fields for multi-worker claiming
ALTER TABLE "CopyTrade"
ADD COLUMN "lockedAt" TIMESTAMP(3),
ADD COLUMN "lockedBy" TEXT;
