/**
 * Affiliate API Client
 * 
 * TypeScript client for the affiliate API routes (Next.js API Routes + Prisma)
 */

// Use empty string for local API routes (same-origin)
const API_BASE_URL = '';

// Types
export interface AffiliateStats {
    walletAddress: string;
    referralCode: string;
    tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND';
    commissionRate: number;
    totalVolumeGenerated: number;
    totalReferrals: number;
    totalEarned: number;
    pendingPayout: number;
    volumeToNextTier: number;
    nextTier: string | null;
}

export interface Referral {
    address: string;
    joinedAt: string;
    lifetimeVolume: number;
    last30DaysVolume: number;
    lastActiveAt: string | null;
}

export interface Payout {
    id: string;
    amount: number;
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
    txHash: string | null;
    createdAt: string;
    processedAt: string | null;
}

export interface RegisterResponse {
    success: boolean;
    referralCode?: string;
    walletAddress?: string;
    error?: string;
}

// API Functions
export const affiliateApi = {
    /**
     * Register as an affiliate
     */
    async register(walletAddress: string): Promise<RegisterResponse> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress }),
        });
        return response.json();
    },

    /**
     * Track a referral signup
     */
    async trackReferral(referralCode: string, refereeAddress: string): Promise<{ success: boolean; error?: string }> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode, refereeAddress }),
        });
        return response.json();
    },

    /**
     * Get affiliate stats for dashboard
     */
    async getStats(walletAddress: string): Promise<AffiliateStats> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/stats?walletAddress=${encodeURIComponent(walletAddress)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch affiliate stats');
        }
        return response.json();
    },

    /**
     * Get list of referrals
     */
    async getReferrals(walletAddress: string): Promise<Referral[]> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/referrals?walletAddress=${encodeURIComponent(walletAddress)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch referrals');
        }
        return response.json();
    },

    /**
     * Get payout history
     */
    async getPayouts(walletAddress: string): Promise<Payout[]> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/payouts?walletAddress=${encodeURIComponent(walletAddress)}`);
        if (!response.ok) {
            throw new Error('Failed to fetch payouts');
        }
        return response.json();
    },

    /**
     * Check if referral code is valid
     */
    async lookupCode(code: string): Promise<{ valid: boolean; walletAddress?: string }> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/lookup/code/${encodeURIComponent(code)}`);
        return response.json();
    },

    /**
     * Check if wallet is registered as affiliate
     */
    async lookupWallet(address: string): Promise<{ registered: boolean; referralCode?: string; tier?: string }> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/lookup/wallet/${encodeURIComponent(address)}`);
        return response.json();
    },
};

// Helper to generate referral link
export function generateReferralLink(referralCode: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://polyhunter.com';
    return `${baseUrl}?ref=${referralCode}`;
}

// Tier display helpers
export const TIER_INFO = {
    BRONZE: { name: 'Bronze Partner', color: 'text-orange-400', minVolume: 0, nextTier: 'Silver', nextVolume: 500000 },
    SILVER: { name: 'Silver Partner', color: 'text-gray-300', minVolume: 500000, nextTier: 'Gold', nextVolume: 2000000 },
    GOLD: { name: 'Gold Partner', color: 'text-yellow-400', minVolume: 2000000, nextTier: 'Diamond', nextVolume: 10000000 },
    DIAMOND: { name: 'Diamond Partner', color: 'text-blue-300', minVolume: 10000000, nextTier: null, nextVolume: null },
};
