import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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

const command = process.argv[2];
if (!command || !['seed', 'cleanup'].includes(command)) {
  console.error('Usage: npx tsx scripts/verify/seed-copytrade-locks.ts <seed|cleanup>');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const __root = path.resolve(__dirname, '../..');

async function createPrismaClient() {
  let PrismaClient: any;
  try {
    ({ PrismaClient } = await import('@prisma/client'));
  } catch (error) {
    const fallbackClient = pathToFileURL(
      path.resolve(__root, 'frontend/node_modules/@prisma/client/index.js')
    ).href;
    ({ PrismaClient } = await import(fallbackClient));
  }

  const databaseUrl = process.env.DATABASE_URL || '';
  if (!databaseUrl) {
    return new PrismaClient();
  }

  let Pool: any;
  let PrismaPg: any;
  try {
    const pgModule: any = await import('pg');
    const adapterModule: any = await import('@prisma/adapter-pg');
    Pool = pgModule.Pool ?? pgModule.default?.Pool ?? pgModule.default;
    PrismaPg = adapterModule.PrismaPg ?? adapterModule.default?.PrismaPg ?? adapterModule.default;
  } catch (adapterError) {
    const fallbackPg = pathToFileURL(
      path.resolve(__root, 'frontend/node_modules/pg/lib/index.js')
    ).href;
    const fallbackAdapter = pathToFileURL(
      path.resolve(__root, 'frontend/node_modules/@prisma/adapter-pg/dist/index.js')
    ).href;
    const pgModule: any = await import(fallbackPg);
    const adapterModule: any = await import(fallbackAdapter);
    Pool = pgModule.Pool ?? pgModule.default?.Pool ?? pgModule.default;
    PrismaPg = adapterModule.PrismaPg ?? adapterModule.default?.PrismaPg ?? adapterModule.default;
  }

  if (!Pool || !PrismaPg) {
    throw new Error('Adapter modules missing Pool/PrismaPg exports.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ['error'] });
}

const prisma = await createPrismaClient();

async function ensureConfig(): Promise<string> {
  const existing = await prisma.copyTradingConfig.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const created = await prisma.copyTradingConfig.create({
    data: {
      walletAddress: '0x0000000000000000000000000000000000000001',
      traderAddress: '0x0000000000000000000000000000000000000002',
      mode: 'PERCENTAGE',
      sizeScale: 1,
      maxSizePerTrade: 10,
      slippageType: 'FIXED',
      maxSlippage: 1,
      tradeSizeMode: 'SHARES',
      executionMode: 'PROXY',
      autoExecute: false,
      channel: 'POLLING',
      direction: 'COPY',
      isActive: false,
    },
    select: { id: true },
  });

  return created.id;
}

async function seed() {
  const configId = await ensureConfig();
  const now = new Date();

  await prisma.copyTrade.createMany({
    data: [
      {
        configId,
        idempotencyKey: `seed-${Date.now()}-pending-1`,
        originalTrader: 'SEED',
        originalSide: 'BUY',
        originalSize: 10,
        originalPrice: 0.5,
        copySize: 5,
        status: 'SETTLEMENT_PENDING',
        detectedAt: now,
        executedAt: now,
      },
      {
        configId,
        idempotencyKey: `seed-${Date.now()}-failed-1`,
        originalTrader: 'SEED',
        originalSide: 'BUY',
        originalSize: 10,
        originalPrice: 0.5,
        copySize: 5,
        status: 'FAILED',
        retryCount: 0,
        nextRetryAt: now,
        detectedAt: now,
      },
    ],
  });

  console.log('Seeded CopyTrade rows for lock-claim verification.');
}

async function cleanup() {
  const deleted = await prisma.copyTrade.deleteMany({
    where: { originalTrader: 'SEED' },
  });
  console.log(`Cleanup complete. Deleted ${deleted.count} rows.`);
}

try {
  if (command === 'seed') {
    await seed();
  } else {
    await cleanup();
  }
} finally {
  await prisma.$disconnect();
}
