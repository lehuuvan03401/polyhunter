/**
 * Managed Wealth Lifecycle Verification
 *
 * Prerequisites:
 * 1) Next app running locally (default http://localhost:3000)
 * 2) Managed wealth seed executed
 *
 * Usage:
 *   cd frontend
 *   MW_VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify/managed-wealth-lifecycle.ts
 */

import 'dotenv/config';

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const BASE_URL = process.env.MW_VERIFY_BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

interface ManagedTermRef {
    id: string;
}

interface ManagedProductRef {
    id: string;
    isGuaranteed: boolean;
    terms: ManagedTermRef[];
}

interface ManagedProductsResponse {
    products: ManagedProductRef[];
}

interface CreatedSubscriptionResponse {
    subscription: {
        id: string;
    };
}

interface SettlementRunResponse {
    scanned: number;
    settledCount: number;
    results: Array<{
        subscriptionId: string;
        status: string;
    }>;
}

interface ManagedSettlementRecord {
    status: string;
    reserveTopup: number;
}

interface SettlementDetailResponse {
    settlement: ManagedSettlementRecord;
}

interface SubscriptionNavResponse {
    summary: Record<string, unknown>;
    snapshots: Array<Record<string, unknown>>;
}

function makeTestWallet(): string {
    return `0x${randomBytes(20).toString('hex')}`;
}

async function api<T>(path: string, init?: RequestInit, walletAddress?: string): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    if (walletAddress) {
        headers.set('x-wallet-address', walletAddress);
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(`[${res.status}] ${path} -> ${JSON.stringify(data)}`);
    }
    return data as T;
}

async function main(): Promise<void> {
    console.log(`[verify] base url: ${BASE_URL}`);

    const productsData = await api<ManagedProductsResponse>('/api/managed-products?active=true');
    assert(productsData.products.length > 0, 'Expected seeded managed products');

    const guaranteedProduct = productsData.products.find((p) => p.isGuaranteed) || productsData.products[0];
    const nonGuaranteedProduct = productsData.products.find((p) => !p.isGuaranteed) || productsData.products[0];
    const guaranteedTerm = guaranteedProduct.terms[0];
    const nonGuaranteedTerm = nonGuaranteedProduct.terms[0];

    assert(guaranteedTerm, 'Guaranteed product needs at least one term');
    assert(nonGuaranteedTerm, 'Non-guaranteed product needs at least one term');

    const wallet = makeTestWallet();
    console.log(`[verify] test wallet: ${wallet}`);

    const subA = await api<CreatedSubscriptionResponse>('/api/managed-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            walletAddress: wallet,
            productId: guaranteedProduct.id,
            termId: guaranteedTerm.id,
            principal: 1000,
            acceptedTerms: true,
        }),
    }, wallet);

    const subB = await api<CreatedSubscriptionResponse>('/api/managed-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            walletAddress: wallet,
            productId: nonGuaranteedProduct.id,
            termId: nonGuaranteedTerm.id,
            principal: 800,
            acceptedTerms: true,
        }),
    }, wallet);

    console.log(`[verify] created subscriptions: ${subA.subscription.id}, ${subB.subscription.id}`);

    // Simulate maturity and PnL outcomes
    const now = new Date();
    const past = new Date(now.getTime() - 5 * 60 * 1000);

    await prisma.managedSubscription.update({
        where: { id: subA.subscription.id },
        data: {
            status: 'RUNNING',
            endAt: past,
            currentEquity: 900, // underperform guaranteed floor
            highWaterMark: 1000,
        },
    });

    await prisma.managedSubscription.update({
        where: { id: subB.subscription.id },
        data: {
            status: 'RUNNING',
            endAt: past,
            currentEquity: 920, // positive performance
            highWaterMark: 850,
        },
    });

    const dryRunResult = await api<SettlementRunResponse>('/api/managed-settlement/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dryRun: true,
            subscriptionIds: [subA.subscription.id, subB.subscription.id],
        }),
    });

    assert.equal(dryRunResult.scanned, 2, 'Expected 2 subscriptions scanned in dry run');
    assert.equal(dryRunResult.settledCount, 2, 'Expected 2 dry-run settlement outputs');

    await api('/api/managed-settlement/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            dryRun: false,
            subscriptionIds: [subA.subscription.id, subB.subscription.id],
        }),
    });

    const settlementA = await api<SettlementDetailResponse>(
        `/api/managed-settlements/${subA.subscription.id}?wallet=${wallet}`,
        undefined,
        wallet
    );
    const settlementB = await api<SettlementDetailResponse>(
        `/api/managed-settlements/${subB.subscription.id}?wallet=${wallet}`,
        undefined,
        wallet
    );
    const navA = await api<SubscriptionNavResponse>(
        `/api/managed-subscriptions/${subA.subscription.id}/nav?wallet=${wallet}&limit=10`,
        undefined,
        wallet
    );

    assert.equal(settlementA.settlement.status, 'COMPLETED', 'Guaranteed settlement should complete');
    assert.equal(settlementB.settlement.status, 'COMPLETED', 'Non-guaranteed settlement should complete');
    assert.ok(settlementA.settlement.reserveTopup > 0, 'Guaranteed flow should trigger reserve topup in this scenario');
    assert.ok(navA.snapshots.length >= 1, 'NAV endpoint should return at least one snapshot');

    console.log('[verify] managed wealth lifecycle verification passed');
}

main()
    .catch((error) => {
        console.error('[verify] failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
