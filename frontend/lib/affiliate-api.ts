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
    tier: 'ORDINARY' | 'VIP' | 'ELITE' | 'PARTNER' | 'SUPER_PARTNER';
    commissionRate: number;
    totalVolumeGenerated: number;
    totalReferrals: number;
    totalEarned: number;
    pendingPayout: number;
    volumeToNextTier: number;
    nextTier: string | null;
    sunLineCount: number;
    maxDepth: number;
    teamSize: number;
    earningsBreakdown: {
        zeroLine: number;
        sunLine: number;
    };
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
    async trackReferral(referralCode: string, referrerWallet: string, refereeAddress: string): Promise<{ success: boolean; error?: string }> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/track`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ referralCode, referrerWallet, refereeAddress }),
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
     * Get the message that needs to be signed for payout authorization
     */
    async getPayoutMessage(walletAddress: string, timestamp: number): Promise<{ message: string; amount: number }> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/payouts`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, timestamp }),
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to get payout message');
        }
        return response.json();
    },

    /**
     * Request a payout (requires wallet signature for security)
     */
    async requestPayout(
        walletAddress: string,
        signature: string,
        timestamp: number
    ): Promise<{ success: boolean; payoutId?: string; amount?: number; message?: string; error?: string }> {
        const response = await fetch(`${API_BASE_URL}/api/affiliate/payouts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ walletAddress, signature, timestamp }),
        });
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
    ORDINARY: { name: 'Ordinary Member', color: 'text-gray-400', minDirect: 0, minTeam: 0, nextTier: 'VIP' },
    VIP: { name: 'VIP Member', color: 'text-blue-400', minDirect: 3, minTeam: 10, nextTier: 'ELITE' },
    ELITE: { name: 'Elite Agent', color: 'text-purple-400', minDirect: 10, minTeam: 100, nextTier: 'PARTNER' },
    PARTNER: { name: 'Partner', color: 'text-yellow-400', minDirect: 30, minTeam: 500, nextTier: 'SUPER_PARTNER' },
    SUPER_PARTNER: { name: 'Super Partner', color: 'text-red-500', minDirect: 50, minTeam: 1000, nextTier: null },
};
