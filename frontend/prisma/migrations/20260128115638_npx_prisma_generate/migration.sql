-- Ensure column exists before altering type (migration order safety)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'CopyTrade'
          AND column_name = 'nextRetryAt'
    ) THEN
        ALTER TABLE "CopyTrade" ADD COLUMN "nextRetryAt" TIMESTAMP;
    END IF;

    ALTER TABLE "CopyTrade" ALTER COLUMN "nextRetryAt" SET DATA TYPE TIMESTAMP(3);
END $$;
