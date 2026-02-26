import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

function createJsonRequest(url: string, body: unknown) {
    return new NextRequest(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

async function setupRouteWithInsufficientPrincipal() {
    vi.resetModules();

    const reserveMock = vi.fn();

    class ManagedPrincipalAvailabilityError extends Error {
        code: string;
        details: Record<string, number>;
        requestedPrincipal: number;

        constructor(requestedPrincipal: number, details: Record<string, number>) {
            super('Managed principal reservation balance is insufficient');
            this.code = 'MANAGED_PRINCIPAL_RESERVATION_INSUFFICIENT';
            this.details = details;
            this.requestedPrincipal = requestedPrincipal;
        }
    }

    const availabilityError = new ManagedPrincipalAvailabilityError(500, {
        managedQualifiedBalance: 600,
        reservedBalance: 200,
        reservedFromLedger: 200,
        reservedFromActiveSubscriptions: 200,
        availableBalance: 400,
    });

    vi.doMock('@/lib/managed-wealth/principal-reservation', () => ({
        assertManagedPrincipalAvailability: vi.fn().mockRejectedValue(availabilityError),
        reserveManagedPrincipal: reserveMock,
        ManagedPrincipalAvailabilityError,
    }));

    vi.doMock('@/lib/prisma', () => ({
        prisma: {
            participationAccount: {
                findUnique: vi.fn().mockResolvedValue({
                    status: 'ACTIVE',
                    preferredMode: 'MANAGED',
                    isRegistrationComplete: true,
                }),
            },
            managedProduct: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'prod-1',
                    isActive: true,
                    status: 'ACTIVE',
                    isGuaranteed: false,
                    reserveCoverageMin: 1,
                    disclosurePolicy: 'TRANSPARENT',
                    disclosureDelayHours: 0,
                }),
            },
            managedTerm: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'term-1',
                    productId: 'prod-1',
                    isActive: true,
                    durationDays: 30,
                    minYieldRate: 0,
                    maxSubscriptionAmount: null,
                }),
            },
            $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
                const tx = {
                    $executeRaw: vi.fn().mockResolvedValue(null),
                    managedSubscription: {
                        count: vi.fn().mockResolvedValue(0),
                        create: vi.fn(),
                    },
                    managedNavSnapshot: {
                        create: vi.fn(),
                    },
                };
                return fn(tx);
            }),
        },
        isDatabaseEnabled: true,
    }));

    vi.doMock('@/lib/managed-wealth/request-wallet', () => ({
        resolveWalletContext: () => ({
            ok: true,
            wallet: '0x1111111111111111111111111111111111111111',
        }),
    }));

    vi.doMock('@/lib/participation-program/referral-subscription-bonus', () => ({
        applyOneTimeReferralSubscriptionBonus: vi.fn().mockResolvedValue({ applied: false }),
    }));

    const route = await import('@/app/api/managed-subscriptions/route');
    return {
        post: route.POST,
        reserveMock,
    };
}

describe('Managed subscriptions principal reservation integration', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rejects subscription when managed principal availability is insufficient', async () => {
        const { post, reserveMock } = await setupRouteWithInsufficientPrincipal();

        const res = await post(
            createJsonRequest('http://localhost/api/managed-subscriptions', {
                walletAddress: '0x1111111111111111111111111111111111111111',
                productId: 'prod-1',
                termId: 'term-1',
                principal: 500,
                acceptedTerms: true,
            })
        );
        const body = await res.json();

        expect(res.status).toBe(409);
        expect(body.code).toBe('MANAGED_PRINCIPAL_RESERVATION_INSUFFICIENT');
        expect(body.requestedPrincipal).toBe(500);
        expect(body.availability.availableBalance).toBe(400);
        expect(reserveMock).not.toHaveBeenCalled();
    });
});
