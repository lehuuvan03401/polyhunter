import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'path';

// Get database URL from environment variable or use local file
const getDatabaseUrl = () => {
    if (process.env.DATABASE_URL) {
        return process.env.DATABASE_URL;
    }
    // Fallback to local file database
    const dbPath = path.join(process.cwd(), 'dev.db');
    return `file:${dbPath}`;
};

// Create adapter with config URL
const adapter = new PrismaLibSql({
    url: getDatabaseUrl(),
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
