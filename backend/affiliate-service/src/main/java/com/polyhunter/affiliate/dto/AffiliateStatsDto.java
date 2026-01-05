package com.polyhunter.affiliate.dto;

import com.polyhunter.affiliate.entity.AffiliateTier;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for affiliate dashboard stats
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AffiliateStatsDto {

    private String walletAddress;
    private String referralCode;
    private AffiliateTier tier;
    private double commissionRate;
    private double totalVolumeGenerated;
    private long totalReferrals;
    private double totalEarned;
    private double pendingPayout;
    private double volumeToNextTier;
    private String nextTier;
}
