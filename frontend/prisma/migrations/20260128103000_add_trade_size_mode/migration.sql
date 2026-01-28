-- Add trade size mode to copy trading config
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TradeSizeMode') THEN
        CREATE TYPE "TradeSizeMode" AS ENUM ('SHARES', 'NOTIONAL');
    END IF;
END $$;

ALTER TABLE "CopyTradingConfig" ADD COLUMN IF NOT EXISTS "tradeSizeMode" "TradeSizeMode" NOT NULL DEFAULT 'SHARES';
