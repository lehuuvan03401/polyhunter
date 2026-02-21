import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getEnvFile = () => {
  if (process.env.ENV_FILE) return process.env.ENV_FILE;
  if (process.env.NODE_ENV === 'production') return '.env.production';
  if (process.env.NODE_ENV === 'test') return '.env.test';
  return '.env.local';
};

const envPath = path.resolve(__dirname, '../../frontend', getEnvFile());
dotenv.config({ path: envPath });

const lockTtlMs = parseInt(process.env.COPY_TRADING_LOCK_TTL_MS || '300000', 10);
const holdMs = parseInt(process.env.LOCK_HOLD_MS || '5000', 10);
const take = parseInt(process.env.LOCK_TAKE || '5', 10);
const statuses = (process.env.LOCK_STATUSES || 'SETTLEMENT_PENDING,FAILED')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const databaseUrl = process.env.DATABASE_URL || '';
if (!databaseUrl) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const Pool = pg.Pool ?? (pg as any).default?.Pool ?? (pg as any).default;
const pool = new Pool({ connectionString: databaseUrl });

async function claimAndHold() {
  const now = new Date();
  const lockOwner = `verify-${process.pid}-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
  const staleBefore = new Date(now.getTime() - lockTtlMs);

  const candidates = await pool.query(
    `SELECT id FROM "CopyTrade"
     WHERE status = ANY($1::"CopyTradeStatus"[])
       AND ("lockedAt" IS NULL OR "lockedAt" < $2)
     LIMIT $3`,
    [statuses, staleBefore, take]
  );

  if (candidates.rows.length === 0) {
    console.log('No eligible trades to claim.');
    return;
  }

  const ids = candidates.rows.map((c) => c.id);
  await pool.query(
    `UPDATE "CopyTrade"
     SET "lockedAt" = $1, "lockedBy" = $2
     WHERE id = ANY($3::text[])
       AND status = ANY($4::"CopyTradeStatus"[])
       AND ("lockedAt" IS NULL OR "lockedAt" < $5)`,
    [now, lockOwner, ids, statuses, staleBefore]
  );

  const claimed = await pool.query(
    `SELECT id, status, "lockedBy", "lockedAt"
     FROM "CopyTrade"
     WHERE id = ANY($1::text[]) AND "lockedBy" = $2`,
    [ids, lockOwner]
  );

  console.log(`Claimed ${claimed.rows.length} trades.`);
  claimed.rows.forEach((trade) => {
    console.log(`  ${trade.id} ${trade.status} ${trade.lockedBy}`);
  });

  await new Promise((resolve) => setTimeout(resolve, holdMs));

  await pool.query(
    `UPDATE "CopyTrade"
     SET "lockedAt" = NULL, "lockedBy" = NULL
     WHERE id = ANY($1::text[]) AND "lockedBy" = $2`,
    [claimed.rows.map((t) => t.id), lockOwner]
  );

  console.log('Released claimed trades.');
}

try {
  await claimAndHold();
} finally {
  await pool.end();
}
