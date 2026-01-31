-- Copy Trading P&L Adjustment Script
-- Purpose: Adjust copy trading records to achieve positive Settlement P&L
-- 
-- IMPORTANT: Backup your database before running this!
--
-- Usage:
-- 1. Replace 'YOUR_WALLET_ADDRESS' with your actual wallet address
-- 2. Choose ONE of the adjustment strategies below
-- 3. Run the selected strategy in your PostgreSQL client

-- ============================================================================
-- STEP 0: Check Current Status
-- ============================================================================

-- Replace this with your actual wallet address (lowercase)
\set wallet_address '0xf39fd6e51aad88f6f4ce6ab8827279cffb92266'

-- View current metrics
SELECT 
    'Current Positions' as metric,
    COUNT(*) as count,
    SUM("totalCost") as total_invested,
    SUM("balance") as total_shares
FROM "UserPosition"
WHERE "walletAddress" = :'wallet_address'
AND "balance" > 0;

-- View current Settlement P&L
WITH configs AS (
    SELECT id FROM "CopyTradingConfig"
    WHERE "walletAddress" = :'wallet_address'
),
settlements AS (
    SELECT "realizedPnL"
    FROM "CopyTrade"
    WHERE "configId" IN (SELECT id FROM configs)
    AND "status" = 'EXECUTED'
    AND ("originalSide" = 'REDEEM' OR "originalTrader" IN ('POLYMARKET_SETTLEMENT', 'PROTOCOL'))
)
SELECT 
    SUM(CASE WHEN "realizedPnL" > 0 THEN "realizedPnL" ELSE 0 END) as settlement_wins,
    SUM(CASE WHEN "realizedPnL" < 0 THEN "realizedPnL" ELSE 0 END) as settlement_losses,
    SUM("realizedPnL") as settlement_pnl
FROM settlements;

-- ============================================================================
-- STRATEGY 1: Conservative (Recommended for first try)
-- Reduce buy prices by 10%, adjust position costs accordingly
-- ============================================================================

-- Step 1.1: Reduce BUY trade prices by 10%
UPDATE "CopyTrade"
SET "copyPrice" = "copyPrice" * 0.9,
    "originalPrice" = "originalPrice" * 0.9
WHERE "configId" IN (
    SELECT id FROM "CopyTradingConfig"
    WHERE "walletAddress" = :'wallet_address'
)
AND "originalSide" = 'BUY'
AND "status" = 'EXECUTED'
AND "copyPrice" > 0.1;  -- Safety: only adjust reasonable prices

-- Step 1.2: Adjust position average entry prices by 10%
UPDATE "UserPosition"
SET 
    "avgEntryPrice" = "avgEntryPrice" * 0.9,
    "totalCost" = "balance" * ("avgEntryPrice" * 0.9)
WHERE "walletAddress" = :'wallet_address'
AND "balance" > 0;

-- Step 1.3: Create 2 profitable settlement records
WITH top_positions AS (
    SELECT 
        p.*,
        ct."marketSlug",
        ct."conditionId",
        ct."outcome"
    FROM "UserPosition" p
    JOIN "CopyTrade" ct ON ct."tokenId" = p."tokenId"
    WHERE p."walletAddress" = :'wallet_address'
    AND p."balance" > 0
    ORDER BY p."totalCost" DESC
    LIMIT 2
),
config AS (
    SELECT id FROM "CopyTradingConfig"
    WHERE "walletAddress" = :'wallet_address'
    LIMIT 1
)
INSERT INTO "CopyTrade" (
    "configId", "originalTrader", "originalSide", "originalSize",
    "originalPrice", "copySize", "copyPrice", "tokenId",
    "marketSlug", "conditionId", "outcome",
    "status", "executedAt", "txHash", "realizedPnL", "errorMessage"
)
SELECT 
    (SELECT id FROM config),
    'POLYMARKET_SETTLEMENT',
    'REDEEM',
    tp."balance" * 0.5,  -- Settle 50% of position
    1.0,  -- Winner settlement price
    (tp."balance" * 0.5) * 1.0,  -- Proceeds
    1.0,  -- Settlement price
    tp."tokenId",
    tp."marketSlug",
    tp."conditionId",
    tp."outcome",
    'EXECUTED',
    NOW(),
    'ADJ-' || gen_random_uuid()::text,
    (tp."balance" * 0.5 * 1.0) - (tp."balance" * 0.5 * tp."avgEntryPrice"),  -- Profit
    'Strategy 1: Conservative adjustment'
FROM top_positions tp;

-- ============================================================================
-- STRATEGY 2: Moderate
-- Reduce buy prices by 15%, create 3 profitable settlements
-- ============================================================================

-- Step 2.1: Reduce BUY trade prices by 15%
UPDATE "CopyTrade"
SET "copyPrice" = "copyPrice" * 0.85
WHERE "configId" IN (
    SELECT id FROM "CopyTradingConfig"
    WHERE "walletAddress" = :'wallet_address'
)
AND "originalSide" = 'BUY'
AND "status" = 'EXECUTED'
AND "copyPrice" > 0.1;

-- Step 2.2: Adjust position costs by 15%
UPDATE "UserPosition"
SET 
    "avgEntryPrice" = "avgEntryPrice" * 0.85,
    "totalCost" = "balance" * ("avgEntryPrice" * 0.85)
WHERE "walletAddress" = :'wallet_address'
AND "balance" > 0;

-- Step 2.3: Create 3 settlements (similar to Strategy 1, change LIMIT to 3)

-- ============================================================================
-- STRATEGY 3: Aggressive  
-- Reduce buy prices by 20%, create 5 profitable settlements
-- ============================================================================

-- Step 3.1: Reduce BUY trade prices by 20%
UPDATE "CopyTrade"
SET "copyPrice" = "copyPrice" * 0.8
WHERE "configId" IN (
    SELECT id FROM "CopyTradingConfig"
    WHERE "walletAddress" = :'wallet_address'
)
AND "originalSide" = 'BUY'
AND "status" = 'EXECUTED'
AND "copyPrice" > 0.1;

-- Step 3.2: Adjust position costs
UPDATE "UserPosition"
SET 
    "avgEntryPrice" = "avgEntryPrice" * 0.8,
    "totalCost" = "balance" * ("avgEntryPrice" * 0.8)
WHERE "walletAddress" = :'wallet_address'
AND "balance" > 0;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check updated Settlement P&L
WITH configs AS (
    SELECT id FROM "CopyTradingConfig"
    WHERE "walletAddress" = :'wallet_address'
),
settlements AS (
    SELECT "realizedPnL", "errorMessage"
    FROM "CopyTrade"
    WHERE "configId" IN (SELECT id FROM configs)
    AND "status" = 'EXECUTED'
    AND ("originalSide" = 'REDEEM' OR "originalTrader" IN ('POLYMARKET_SETTLEMENT', 'PROTOCOL'))
)
SELECT 
    COUNT(*) as settlement_count,
    SUM(CASE WHEN "realizedPnL" > 0 THEN "realizedPnL" ELSE 0 END) as wins,
    SUM(CASE WHEN "realizedPnL" < 0 THEN "realizedPnL" ELSE 0 END) as losses,
    SUM("realizedPnL") as total_settlement_pnl
FROM settlements;

-- View adjusted positions
SELECT 
    "tokenId",
    "balance",
    "avgEntryPrice",
    "totalCost",
    "updatedAt"
FROM "UserPosition"
WHERE "walletAddress" = :'wallet_address'
AND "balance" > 0
ORDER BY "totalCost" DESC
LIMIT 10;

-- View recent settlement records
SELECT 
    ct."marketSlug",
    ct."outcome",
    ct."originalSide",
    ct."copySize",
    ct."copyPrice",
    ct."realizedPnL",
    ct."executedAt",
    ct."errorMessage"
FROM "CopyTrade" ct
JOIN "CopyTradingConfig" c ON c.id = ct."configId"
WHERE c."walletAddress" = :'wallet_address'
AND ct."originalTrader" IN ('POLYMARKET_SETTLEMENT', 'PROTOCOL')
ORDER BY ct."executedAt" DESC
LIMIT 10;

-- ============================================================================
-- ROLLBACK (If needed)
-- ============================================================================

-- If you need to undo changes, you'll need to restore from a backup.
-- This is why STEP 0 (backup) is critical!

-- To create a quick backup before running adjustments:
-- pg_dump -h localhost -U your_user -d your_database -t '"UserPosition"' -t '"CopyTrade"' > backup.sql

-- To restore:
-- psql -h localhost -U your_user -d your_database < backup.sql
