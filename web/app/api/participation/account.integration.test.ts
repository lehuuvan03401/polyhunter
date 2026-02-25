import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

type NetLedgerDirection = 'DEPOSIT' | 'WITHDRAW';

type NetLedgerRow = {
    walletAddress: string;
    direction: NetLedgerDirection;
    usdAmount: number;
    mcnEquivalentAmount: number;
};

type ParticipationAccountRow = {
    id: string;
    walletAddress: string;
    status: 'PENDING' | 'ACTIVE';
    preferredMode: 'FREE' | 'MANAGED' | null;
    isRegistrationComplete: boolean;
    registrationCompletedAt: Date | null;
    activatedAt: Date | null;
};

type ReferralRow = {
    id: string;
    refereeAddress: string;
    subscriptionBonusGrantedAt: Date | null;
    referrer: {
        walletAddress: string;
    };
};

type ManagedMembershipRow = {
    id: string;
    walletAddress: string;
    status: 'ACTIVE' | 'EXPIRED';
    endsAt: Date;
};

type ManagedSubscriptionRow = {
    id: string;
    walletAddress: string;
    status: 'RUNNING' | 'SETTLED';
    endAt: Date;
};

type ParticipationTestState = {
    ledgers: NetLedgerRow[];
    accounts: Map<string, ParticipationAccountRow>;
    referrals: Map<string, ReferralRow>;
    memberships: Map<string, ManagedMembershipRow>;
    managedSubscriptions: Map<string, ManagedSubscriptionRow>;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const REFEREE_WALLET = '0x1111111111111111111111111111111111111111';
const REFERRER_WALLET = '0x2222222222222222222222222222222222222222';
const MEMBERSHIP_ID = 'membership-referrer-1';

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

function normalizeWallet(walletAddress: string) {
    return walletAddress.trim().toLowerCase();
}

function createParticipationState(netDepositMcnEquivalent: number): ParticipationTestState {
    return {
        ledgers: [
            {
                walletAddress: REFEREE_WALLET,
                direction: 'DEPOSIT',
                usdAmount: netDepositMcnEquivalent,
                mcnEquivalentAmount: netDepositMcnEquivalent,
            },
        ],
        accounts: new Map(),
        referrals: new Map([
            [
                REFEREE_WALLET,
                {
                    id: 'referral-1',
                    refereeAddress: REFEREE_WALLET,
                    subscriptionBonusGrantedAt: null,
                    referrer: {
                        walletAddress: REFERRER_WALLET,
                    },
                },
            ],
        ]),
        memberships: new Map([
            [
                MEMBERSHIP_ID,
                {
                    id: MEMBERSHIP_ID,
                    walletAddress: REFERRER_WALLET,
                    status: 'ACTIVE',
                    endsAt: new Date('2026-03-10T00:00:00.000Z'),
                },
            ],
        ]),
        managedSubscriptions: new Map(),
    };
}

function createParticipationPrismaMock(state: ParticipationTestState) {
    const participationAccount = {
        findUnique: async ({ where }: { where: { walletAddress: string } }) =>
            state.accounts.get(normalizeWallet(where.walletAddress)) ?? null,
        upsert: async ({
            where,
            update,
            create,
        }: {
            where: { walletAddress: string };
            update: Partial<ParticipationAccountRow>;
            create: Partial<ParticipationAccountRow>;
        }) => {
            const wallet = normalizeWallet(where.walletAddress);
            const existing = state.accounts.get(wallet);

            if (existing) {
                const next = { ...existing, ...update };
                state.accounts.set(wallet, next);
                return next;
            }

            const created: ParticipationAccountRow = {
                id: (create.id as string) ?? `account-${wallet.slice(2, 8)}`,
                walletAddress: wallet,
                status: (create.status as 'PENDING' | 'ACTIVE') ?? 'PENDING',
                preferredMode: (create.preferredMode as 'FREE' | 'MANAGED' | null) ?? null,
                isRegistrationComplete: Boolean(create.isRegistrationComplete),
                registrationCompletedAt: (create.registrationCompletedAt as Date | null) ?? null,
                activatedAt: (create.activatedAt as Date | null) ?? null,
            };

            state.accounts.set(wallet, created);
            return created;
        },
        update: async ({
            where,
            data,
        }: {
            where: { walletAddress: string };
            data: Partial<ParticipationAccountRow>;
        }) => {
            const wallet = normalizeWallet(where.walletAddress);
            const existing = state.accounts.get(wallet);
            if (!existing) {
                throw new Error('ACCOUNT_NOT_FOUND');
            }
            const next = { ...existing, ...data };
            state.accounts.set(wallet, next);
            return next;
        },
    };

    const referral = {
        findUnique: async ({ where }: { where: { refereeAddress: string } }) =>
            state.referrals.get(normalizeWallet(where.refereeAddress)) ?? null,
        update: async ({ where, data }: { where: { id: string }; data: Partial<ReferralRow> }) => {
            const existing = Array.from(state.referrals.values()).find((row) => row.id === where.id);
            if (!existing) throw new Error('REFERRAL_NOT_FOUND');
            const next = { ...existing, ...data };
            state.referrals.set(normalizeWallet(existing.refereeAddress), next);
            return next;
        },
    };

    const managedMembership = {
        findFirst: async ({
            where,
        }: {
            where: { walletAddress: string; status: 'ACTIVE'; endsAt: { gt: Date } };
        }) => {
            const wallet = normalizeWallet(where.walletAddress);
            const candidates = Array.from(state.memberships.values())
                .filter(
                    (row) =>
                        normalizeWallet(row.walletAddress) === wallet &&
                        row.status === where.status &&
                        row.endsAt.getTime() > where.endsAt.gt.getTime()
                )
                .sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
            return candidates[0] ?? null;
        },
        update: async ({ where, data }: { where: { id: string }; data: { endsAt: Date } }) => {
            const existing = state.memberships.get(where.id);
            if (!existing) throw new Error('MEMBERSHIP_NOT_FOUND');
            const next = { ...existing, endsAt: data.endsAt };
            state.memberships.set(where.id, next);
            return next;
        },
    };

    const managedSubscription = {
        findFirst: async ({
            where,
        }: {
            where: { walletAddress: string; status: 'RUNNING'; endAt: { gt: Date } };
        }) => {
            const wallet = normalizeWallet(where.walletAddress);
            const candidates = Array.from(state.managedSubscriptions.values())
                .filter(
                    (row) =>
                        normalizeWallet(row.walletAddress) === wallet &&
                        row.status === where.status &&
                        row.endAt.getTime() > where.endAt.gt.getTime()
                )
                .sort((a, b) => a.endAt.getTime() - b.endAt.getTime());
            return candidates[0] ?? null;
        },
        update: async ({ where, data }: { where: { id: string }; data: { endAt: Date } }) => {
            const existing = state.managedSubscriptions.get(where.id);
            if (!existing) throw new Error('SUBSCRIPTION_NOT_FOUND');
            const next = { ...existing, endAt: data.endAt };
            state.managedSubscriptions.set(where.id, next);
            return next;
        },
    };

    const netDepositLedger = {
        aggregate: async ({
            where,
        }: {
            where: { walletAddress: string; direction: NetLedgerDirection };
        }) => {
            const wallet = normalizeWallet(where.walletAddress);
            const rows = state.ledgers.filter(
                (row) => normalizeWallet(row.walletAddress) === wallet && row.direction === where.direction
            );
            const sumUsd = rows.reduce((acc, row) => acc + row.usdAmount, 0);
            const sumMcn = rows.reduce((acc, row) => acc + row.mcnEquivalentAmount, 0);
            return {
                _sum: {
                    usdAmount: sumUsd,
                    mcnEquivalentAmount: sumMcn,
                },
            };
        },
    };

    const prismaMock = {
        netDepositLedger,
        participationAccount,
        referral,
        managedMembership,
        managedSubscription,
        $transaction: async (callback: (tx: any) => Promise<any>) => callback(prismaMock),
    };

    return prismaMock;
}

async function setupParticipationRoute(netDepositMcnEquivalent: number) {
    const state = createParticipationState(netDepositMcnEquivalent);
    const prismaMock = createParticipationPrismaMock(state);

    vi.resetModules();
    vi.doMock('@/lib/prisma', () => ({
        prisma: prismaMock,
        isDatabaseEnabled: true,
    }));
    vi.doMock('@/lib/managed-wealth/request-wallet', () => ({
        resolveWalletContext: (_request: NextRequest, options: { bodyWallet?: string; queryWallet?: string }) => {
            const wallet = normalizeWallet(options.bodyWallet ?? options.queryWallet ?? '');
            if (!wallet) {
                return {
                    ok: false,
                    error: 'Wallet required',
                    status: 400,
                };
            }
            return {
                ok: true,
                wallet,
            };
        },
    }));

    const route = await import('@/app/api/participation/account/route');
    return {
        state,
        post: route.POST,
    };
}

describe('Participation account integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('enforces activation gate and applies referral bonus only once', async () => {
        const { state, post } = await setupParticipationRoute(600);

        const activateBeforeRegister = await post(
            createJsonRequest('http://localhost/api/participation/account', {
                walletAddress: REFEREE_WALLET,
                action: 'ACTIVATE',
                mode: 'MANAGED',
            })
        );
        expect(activateBeforeRegister.status).toBe(409);

        const registerRes = await post(
            createJsonRequest('http://localhost/api/participation/account', {
                walletAddress: REFEREE_WALLET,
                action: 'REGISTER',
            })
        );
        expect(registerRes.status).toBe(200);

        const membershipBefore = state.memberships.get(MEMBERSHIP_ID);
        expect(membershipBefore).toBeDefined();
        const beforeEndsAt = membershipBefore!.endsAt.getTime();

        const firstActivation = await post(
            createJsonRequest('http://localhost/api/participation/account', {
                walletAddress: REFEREE_WALLET,
                action: 'ACTIVATE',
                mode: 'MANAGED',
            })
        );
        const firstBody = await firstActivation.json();
        expect(firstActivation.status).toBe(200);
        expect(firstBody.account.status).toBe('ACTIVE');
        expect(firstBody.marketing.referralBonusApplied).toBe(true);

        const membershipAfterFirst = state.memberships.get(MEMBERSHIP_ID)!;
        expect(membershipAfterFirst.endsAt.getTime() - beforeEndsAt).toBe(ONE_DAY_MS);
        expect(state.referrals.get(REFEREE_WALLET)?.subscriptionBonusGrantedAt).toBeInstanceOf(Date);

        const secondActivation = await post(
            createJsonRequest('http://localhost/api/participation/account', {
                walletAddress: REFEREE_WALLET,
                action: 'ACTIVATE',
                mode: 'MANAGED',
            })
        );
        const secondBody = await secondActivation.json();
        expect(secondActivation.status).toBe(200);
        expect(secondBody.marketing.referralBonusApplied).toBe(false);
        expect(state.memberships.get(MEMBERSHIP_ID)?.endsAt.getTime()).toBe(
            membershipAfterFirst.endsAt.getTime()
        );
    });

    it('rejects managed activation when qualified funding is below threshold', async () => {
        const { post } = await setupParticipationRoute(120);

        await post(
            createJsonRequest('http://localhost/api/participation/account', {
                walletAddress: REFEREE_WALLET,
                action: 'REGISTER',
            })
        );

        const activationRes = await post(
            createJsonRequest('http://localhost/api/participation/account', {
                walletAddress: REFEREE_WALLET,
                action: 'ACTIVATE',
                mode: 'MANAGED',
            })
        );
        const body = await activationRes.json();

        expect(activationRes.status).toBe(409);
        expect(body.requiredThreshold).toBe(500);
        expect(body.currentNetMcnEquivalent).toBe(120);
        expect(body.deficit).toBe(380);
    });
});
