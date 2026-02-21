import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Use adapter for Prisma 7 + Postgres (Config Mode)
const connectionString = `${process.env.DATABASE_URL}`;
const rawDatabaseUrl = process.env.DATABASE_URL || '';
const hasPlaceholderUrl = /USER:PASS@HOST:PORT/i.test(rawDatabaseUrl);
export const isDatabaseEnabled =
    Boolean(rawDatabaseUrl) &&
    !hasPlaceholderUrl &&
    /^(postgres|postgresql):\/\//i.test(rawDatabaseUrl);
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
