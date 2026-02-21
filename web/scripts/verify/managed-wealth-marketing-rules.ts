/**
 * Managed Wealth Marketing Rules Verification
 *
 * Verifies:
 * 1) First 1-day subscription gets trial flag
 * 2) Referred user's first subscription extends referrer's active subscription by 1 day
 * 3) Same referee only triggers extension once
 * 4) Early withdrawal guardrails return cooldown or fee-ack requirement
 *
 * Usage:
 *   cd frontend
 *   MW_VERIFY_BASE_URL=http://localhost:3000 npx tsx scripts/verify/managed-wealth-marketing-rules.ts
 */

import 'dotenv/config';

import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { ethers } from 'ethers';
import { buildManagedWalletAuthMessage } from '../../lib/managed-wealth/wallet-auth-message';

const BASE_URL = process.env.MW_VERIFY_BASE_URL || 'http://localhost:3000';
const DATABASE_URL = process.env.DATABASE_URL || '';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ['error'] });

interface ManagedTermRef {
    id: string;
    durationDays: number;
}

interface ManagedProductRef {
    id: string;
    isGuaranteed: boolean;
    terms: ManagedTermRef[];
}

interface ManagedProductsResponse {
    products: ManagedProductRef[];
}

interface CreateSubscriptionResponse {
    subscription: {
        id: string;
    };
    marketing?: {
        trialApplied?: boolean;
        trialEndsAt?: string | null;
        referralBonusApplied?: boolean;
    };
}

async function signedRequest<T>(
    path: string,
    init: RequestInit,
    walletAddress: string,
    signer: ethers.Wallet
): Promise<{ ok: boolean; status: number; data: T }> {
    const headers = new Headers(init.headers ?? {});
    const normalizedWallet = walletAddress.toLowerCase();
    headers.set('x-wallet-address', normalizedWallet);

    const timestamp = Date.now();
    const message = buildManagedWalletAuthMessage({
        walletAddress: normalizedWallet,
        method: init.method || 'GET',
        pathWithQuery: path,
        timestamp,
    });
    const signature = await signer.signMessage(message);
    headers.set('x-wallet-signature', signature);
    headers.set('x-wallet-timestamp', String(timestamp));

    const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    return {
        ok: res.ok,
        status: res.status,
        data: data as T,
    };
}

async function api<T>(
    path: string,
    init?: RequestInit,
    walletAddress?: string,
    signer?: ethers.Wallet
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
    if (!res.ok) {
        throw new Error(`[${res.status}] ${path} -> ${JSON.stringify(data)}`);
    }
    return data as T;
}

async function createSubscription(params: {
    walletAddress: string;
    signer: ethers.Wallet;
    productId: string;
    termId: string;
    principal: number;
}): Promise<CreateSubscriptionResponse> {
    return api<CreateSubscriptionResponse>(
        '/api/managed-subscriptions',
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                walletAddress: params.walletAddress,
                productId: params.productId,
                termId: params.termId,
                principal: params.principal,
                acceptedTerms: true,
            }),
        },
        params.walletAddress,
        params.signer
    );
}

async function main(): Promise<void> {
    console.log(`[verify-marketing] base url: ${BASE_URL}`);

    const productsData = await api<ManagedProductsResponse>('/api/managed-products?active=true');
    assert(productsData.products.length > 0, 'Expected managed products');

    const product = productsData.products.find((p) => !p.isGuaranteed) || productsData.products[0];
    const oneDayTerm = product.terms.find((t) => t.durationDays === 1);
    const longTerm = product.terms.find((t) => t.durationDays > 1);
    assert(oneDayTerm, 'Expected 1-day term for trial validation');
    assert(longTerm, 'Expected >1-day term for non-trial baseline');

    const referrerSigner = ethers.Wallet.createRandom();
    const refereeSigner = ethers.Wallet.createRandom();
    const referrerWallet = referrerSigner.address.toLowerCase();
    const refereeWallet = refereeSigner.address.toLowerCase();

    console.log(`[verify-marketing] referrer=${referrerWallet}`);
    console.log(`[verify-marketing] referee=${refereeWallet}`);

    const referralCode = `MW${Date.now().toString(36).toUpperCase().slice(-6)}${Math.floor(Math.random() * 1000)}`;
    const referrer = await prisma.referrer.create({
        data: {
            walletAddress: referrerWallet,
            referralCode,
        },
    });

    await prisma.referral.create({
        data: {
            referrerId: referrer.id,
            refereeAddress: refereeWallet,
        },
    });

    const referrerSub = await createSubscription({
        walletAddress: referrerWallet,
        signer: referrerSigner,
        productId: product.id,
        termId: longTerm.id,
        principal: 1000,
    });

    const referrerSubBefore = await prisma.managedSubscription.findUnique({
        where: { id: referrerSub.subscription.id },
        select: { endAt: true },
    });
    assert(referrerSubBefore?.endAt, 'Referrer baseline subscription must have endAt');

    const refereeFirstSub = await createSubscription({
        walletAddress: refereeWallet,
        signer: refereeSigner,
        productId: product.id,
        termId: oneDayTerm.id,
        principal: 300,
    });

    assert.equal(
        refereeFirstSub.marketing?.trialApplied,
        true,
        'Referee first 1-day subscription should apply trial'
    );
    assert.equal(
        refereeFirstSub.marketing?.referralBonusApplied,
        true,
        'Referrer should receive +1 day on referee first subscription'
    );

    const referrerSubAfterFirst = await prisma.managedSubscription.findUnique({
        where: { id: referrerSub.subscription.id },
        select: { endAt: true },
    });
    assert(referrerSubAfterFirst?.endAt, 'Referrer subscription should still have endAt after bonus');

    const endDiff1 = referrerSubAfterFirst.endAt.getTime() - referrerSubBefore.endAt.getTime();
    assert.equal(endDiff1, ONE_DAY_MS, 'Referrer endAt should be extended exactly by 1 day');

    const referralRowAfterFirst = await prisma.referral.findUnique({
        where: { refereeAddress: refereeWallet },
        select: { subscriptionBonusGrantedAt: true },
    });
    assert(
        referralRowAfterFirst?.subscriptionBonusGrantedAt,
        'Referral should be marked as bonus granted after first trigger'
    );

    const refereeSecondSub = await createSubscription({
        walletAddress: refereeWallet,
        signer: refereeSigner,
        productId: product.id,
        termId: longTerm.id,
        principal: 200,
    });

    assert.equal(
        refereeSecondSub.marketing?.referralBonusApplied,
        false,
        'Referral bonus should not trigger twice for the same referee wallet'
    );

    const referrerSubAfterSecond = await prisma.managedSubscription.findUnique({
        where: { id: referrerSub.subscription.id },
        select: { endAt: true },
    });
    assert(referrerSubAfterSecond?.endAt, 'Referrer subscription should have endAt after second referee order');
    assert.equal(
        referrerSubAfterSecond.endAt.getTime(),
        referrerSubAfterFirst.endAt.getTime(),
        'Second referee subscription must not extend referrer endAt again'
    );

    const [firstRefereeSubRecord, secondRefereeSubRecord] = await Promise.all([
        prisma.managedSubscription.findUnique({
            where: { id: refereeFirstSub.subscription.id },
            select: { isTrial: true, trialEndsAt: true },
        }),
        prisma.managedSubscription.findUnique({
            where: { id: refereeSecondSub.subscription.id },
            select: { isTrial: true, trialEndsAt: true },
        }),
    ]);

    assert.equal(firstRefereeSubRecord?.isTrial, true, 'First 1-day subscription should be trial');
    assert(firstRefereeSubRecord?.trialEndsAt, 'First trial subscription should have trialEndsAt');
    assert.equal(secondRefereeSubRecord?.isTrial, false, 'Second subscription should not be trial');

    const guardrailSigner = ethers.Wallet.createRandom();
    const guardrailWallet = guardrailSigner.address.toLowerCase();
    const guardrailSub = await createSubscription({
        walletAddress: guardrailWallet,
        signer: guardrailSigner,
        productId: product.id,
        termId: longTerm.id,
        principal: 500,
    });
    const withdrawPath = `/api/managed-subscriptions/${guardrailSub.subscription.id}/withdraw`;
    const firstWithdrawAttempt = await signedRequest<Record<string, unknown>>(
        withdrawPath,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                confirm: true,
                walletAddress: guardrailWallet,
            }),
        },
        guardrailWallet,
        guardrailSigner
    );
    assert.equal(firstWithdrawAttempt.status, 409, 'Early withdrawal should trigger guardrail response');

    const guardrailCode = String(firstWithdrawAttempt.data.code ?? '');
    assert(
        guardrailCode === 'WITHDRAW_COOLDOWN_ACTIVE' || guardrailCode === 'EARLY_WITHDRAWAL_FEE_ACK_REQUIRED',
        `Unexpected guardrail code: ${guardrailCode || 'empty'}`
    );

    if (guardrailCode === 'EARLY_WITHDRAWAL_FEE_ACK_REQUIRED') {
        const confirmedWithdraw = await signedRequest<Record<string, unknown>>(
            withdrawPath,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    confirm: true,
                    walletAddress: guardrailWallet,
                    acknowledgeEarlyWithdrawalFee: true,
                }),
            },
            guardrailWallet,
            guardrailSigner
        );
        assert.equal(confirmedWithdraw.ok, true, 'Confirmed early withdrawal should succeed');
        assert.equal(
            Boolean((confirmedWithdraw.data.guardrails as Record<string, unknown> | undefined)?.isEarlyWithdrawal),
            true,
            'Confirmed early withdrawal should report guardrail metadata'
        );
    }

    console.log('[verify-marketing] marketing rules verification passed');
}

main()
    .catch((error) => {
        console.error('[verify-marketing] failed:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
