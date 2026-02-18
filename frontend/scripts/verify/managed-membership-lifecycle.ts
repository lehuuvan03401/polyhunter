/**
 * Managed Membership Lifecycle Verification
 *
 * Verifies:
 * 1) plans endpoint exposes monthly/quarterly pricing
 * 2) create membership with MCN applies 50% discount
 * 3) duplicate active membership purchase is blocked
 *
 * Usage:
 *   cd frontend
 *   MW_VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify/managed-membership-lifecycle.ts
 */

import 'dotenv/config';

import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { buildManagedWalletAuthMessage } from '../../lib/managed-wealth/wallet-auth-message';

const BASE_URL = process.env.MW_VERIFY_BASE_URL || 'http://localhost:3000';

type PlanType = 'MONTHLY' | 'QUARTERLY';

interface PlansResponse {
    plans: Array<{
        planType: PlanType;
        durationDays: number;
        basePriceUsd: number;
        prices: {
            USDC: number;
            MCN: number;
        };
        mcnDiscountRate: number;
    }>;
}

interface MembershipResponse {
    membership: {
        id: string;
        walletAddress: string;
        planType: PlanType;
        paymentToken: 'USDC' | 'MCN';
        basePriceUsd: number;
        discountRate: number;
        finalPriceUsd: number;
        startsAt: string;
        endsAt: string;
        status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    };
}

interface MembershipListResponse {
    memberships: Array<{
        id: string;
        status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    }>;
    activeMembership: {
        id: string;
        status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    } | null;
    activeMembershipAlert: {
        isExpiringSoon: boolean;
        remainingHours: number;
        remainingDays: number;
    } | null;
}

async function api<T>(
    path: string,
    init?: RequestInit,
    walletAddress?: string,
    signer?: ethers.Wallet,
    expectStatus = 200
): Promise<T> {
    const headers = new Headers(init?.headers ?? {});
    const normalizedWallet = walletAddress?.toLowerCase();

    if (normalizedWallet) {
        headers.set('x-wallet-address', normalizedWallet);
    }

    if (normalizedWallet && signer) {
        const timestamp = Date.now();
        const message = buildManagedWalletAuthMessage({
            walletAddress: normalizedWallet,
            method: init?.method || 'GET',
            pathWithQuery: path,
            timestamp,
        });
        const signature = await signer.signMessage(message);
        headers.set('x-wallet-signature', signature);
        headers.set('x-wallet-timestamp', String(timestamp));
    }

    const res = await fetch(`${BASE_URL}${path}`, {
        ...init,
        headers,
    });

    const data = await res.json().catch(() => ({}));
    if (res.status !== expectStatus) {
        throw new Error(`[${res.status}] ${path} -> ${JSON.stringify(data)}`);
    }

    return data as T;
}

async function main(): Promise<void> {
    console.log(`[verify-membership] base url: ${BASE_URL}`);

    const plans = await api<PlansResponse>('/api/managed-membership/plans');
    const monthly = plans.plans.find((p) => p.planType === 'MONTHLY');
    const quarterly = plans.plans.find((p) => p.planType === 'QUARTERLY');

    assert(monthly, 'Monthly plan must exist');
    assert(quarterly, 'Quarterly plan must exist');
    assert.equal(monthly.basePriceUsd, 88, 'Monthly base price should be 88');
    assert.equal(quarterly.basePriceUsd, 228, 'Quarterly base price should be 228');
    assert.equal(monthly.prices.MCN, 44, 'Monthly MCN discounted price should be 44');
    assert.equal(quarterly.prices.MCN, 114, 'Quarterly MCN discounted price should be 114');

    const signer = ethers.Wallet.createRandom();
    const wallet = signer.address.toLowerCase();
    console.log(`[verify-membership] test wallet: ${wallet}`);

    const created = await api<MembershipResponse>(
        '/api/managed-membership',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: wallet,
                planType: 'MONTHLY',
                paymentToken: 'MCN',
            }),
        },
        wallet,
        signer,
        201
    );

    assert.equal(created.membership.planType, 'MONTHLY', 'Expected MONTHLY plan');
    assert.equal(created.membership.paymentToken, 'MCN', 'Expected MCN payment token');
    assert.equal(created.membership.basePriceUsd, 88, 'Expected monthly base price');
    assert.equal(created.membership.discountRate, 0.5, 'Expected 50% discount');
    assert.equal(created.membership.finalPriceUsd, 44, 'Expected discounted final price');

    const activeOnly = await api<MembershipListResponse>(
        `/api/managed-membership?wallet=${wallet}&status=ACTIVE&limit=10`,
        undefined,
        wallet,
        signer,
        200
    );
    assert.equal(activeOnly.memberships.length, 1, 'Expected one ACTIVE membership in filter response');
    assert.equal(activeOnly.activeMembership?.id, created.membership.id, 'Expected active membership id to match created id');
    assert(activeOnly.activeMembershipAlert, 'Expected active membership alert payload');
    assert.equal(activeOnly.activeMembershipAlert?.isExpiringSoon, false, 'New monthly plan should not be expiring soon');

    await api<{ error: string }>(
        '/api/managed-membership',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: wallet,
                planType: 'QUARTERLY',
                paymentToken: 'USDC',
            }),
        },
        wallet,
        signer,
        409
    );

    console.log('[verify-membership] managed membership lifecycle verification passed');
}

main().catch((error) => {
    console.error('[verify-membership] failed:', error);
    process.exit(1);
});
