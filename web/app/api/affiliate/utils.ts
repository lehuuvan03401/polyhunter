import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

import { AffiliateTier } from '@prisma/client';

// Tier commission rates (Team Differential Rates)
export const TIER_RATES = {
    [AffiliateTier.ORDINARY]: 0.01,
    [AffiliateTier.VIP]: 0.02,
    [AffiliateTier.ELITE]: 0.03,
    [AffiliateTier.PARTNER]: 0.05,
    [AffiliateTier.SUPER_PARTNER]: 0.08,
} as const;

// Volume thresholds for tier upgrades
export const TIER_THRESHOLDS = {
    [AffiliateTier.ORDINARY]: 0,
    [AffiliateTier.VIP]: 500_000,
    [AffiliateTier.ELITE]: 2_500_000,
    [AffiliateTier.PARTNER]: 10_000_000,
    [AffiliateTier.SUPER_PARTNER]: 50_000_000,
} as const;

// Determine tier based on volume
export function getTierFromVolume(volume: number): AffiliateTier {
    if (volume >= TIER_THRESHOLDS[AffiliateTier.SUPER_PARTNER]) return AffiliateTier.SUPER_PARTNER;
    if (volume >= TIER_THRESHOLDS[AffiliateTier.PARTNER]) return AffiliateTier.PARTNER;
    if (volume >= TIER_THRESHOLDS[AffiliateTier.ELITE]) return AffiliateTier.ELITE;
    if (volume >= TIER_THRESHOLDS[AffiliateTier.VIP]) return AffiliateTier.VIP;
    return AffiliateTier.ORDINARY;
}

// Generate referral code from wallet address
export function generateReferralCode(walletAddress: string): string {
    return walletAddress.slice(2, 10).toUpperCase();
}

// Normalize wallet address
export function normalizeAddress(address: string): string {
    return address.toLowerCase();
}

// Error response helper
export function errorResponse(message: string, status: number = 400) {
    return NextResponse.json({ success: false, error: message }, { status });
}

// Export prisma for use in routes
export { prisma };
