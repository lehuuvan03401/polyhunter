import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

// Tier commission rates
export const TIER_RATES = {
    BRONZE: 0.10,
    SILVER: 0.20,
    GOLD: 0.30,
    PLATINUM: 0.40,
    DIAMOND: 0.50,
} as const;

// Volume thresholds for tier upgrades
export const TIER_THRESHOLDS = {
    BRONZE: 0,
    SILVER: 500_000,
    GOLD: 2_500_000,
    PLATINUM: 10_000_000,
    DIAMOND: 50_000_000,
} as const;

// Determine tier based on volume
export function getTierFromVolume(volume: number): 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND' {
    if (volume >= TIER_THRESHOLDS.DIAMOND) return 'DIAMOND';
    if (volume >= TIER_THRESHOLDS.PLATINUM) return 'PLATINUM';
    if (volume >= TIER_THRESHOLDS.GOLD) return 'GOLD';
    if (volume >= TIER_THRESHOLDS.SILVER) return 'SILVER';
    return 'BRONZE';
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
