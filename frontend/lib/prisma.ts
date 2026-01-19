import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import path from 'path';

// Get database URL with absolute path fallback
const getDatabaseUrl = () => {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    // Fallback to absolute path
    const dbPath = path.join(process.cwd(), 'dev.db');
    return `file:${dbPath}`;
};

// Debug: Log the database URL
const dbUrl = getDatabaseUrl();
console.log('[Prisma] Database URL:', dbUrl);

// Create adapter with URL config (not libsql client)
const adapter = new PrismaLibSql({
    url: dbUrl,
});

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

