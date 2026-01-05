package com.polyhunter.affiliate.entity;

/**
 * Affiliate tier levels with associated commission rates
 */
public enum AffiliateTier {
    BRONZE(0.10, 0),
    SILVER(0.15, 500_000),
    GOLD(0.20, 2_000_000),
    DIAMOND(0.25, 10_000_000);

    private final double commissionRate;
    private final double minVolume;

    AffiliateTier(double commissionRate, double minVolume) {
        this.commissionRate = commissionRate;
        this.minVolume = minVolume;
    }

    public double getCommissionRate() {
        return commissionRate;
    }

    public double getMinVolume() {
        return minVolume;
    }

    /**
     * Determine tier based on total generated volume
     */
    public static AffiliateTier fromVolume(double volume) {
        if (volume >= DIAMOND.minVolume)
            return DIAMOND;
        if (volume >= GOLD.minVolume)
            return GOLD;
        if (volume >= SILVER.minVolume)
            return SILVER;
        return BRONZE;
    }

    /**
     * Get volume needed to reach next tier
     */
    public double getVolumeToNextTier(double currentVolume) {
        AffiliateTier nextTier = switch (this) {
            case BRONZE -> SILVER;
            case SILVER -> GOLD;
            case GOLD -> DIAMOND;
            case DIAMOND -> null;
        };

        if (nextTier == null)
            return 0;
        return Math.max(0, nextTier.minVolume - currentVolume);
    }
}
