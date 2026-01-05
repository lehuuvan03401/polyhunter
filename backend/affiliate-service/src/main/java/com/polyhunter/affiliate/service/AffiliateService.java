package com.polyhunter.affiliate.service;

import com.polyhunter.affiliate.dto.*;
import com.polyhunter.affiliate.entity.*;
import com.polyhunter.affiliate.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Core affiliate service handling registration, tracking, and statistics
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AffiliateService {

    private final ReferrerRepository referrerRepository;
    private final ReferralRepository referralRepository;
    private final ReferralVolumeRepository volumeRepository;
    private final PayoutRepository payoutRepository;

    // ==================== Registration ====================

    /**
     * Register a wallet as an affiliate
     */
    @Transactional
    public Referrer registerAffiliate(String walletAddress) {
        String normalizedAddress = walletAddress.toLowerCase();

        // Check if already registered
        Optional<Referrer> existing = referrerRepository.findByWalletAddress(normalizedAddress);
        if (existing.isPresent()) {
            log.info("Wallet {} already registered as affiliate", normalizedAddress);
            return existing.get();
        }

        // Generate unique referral code
        String referralCode = Referrer.generateReferralCode(normalizedAddress);
        int attempt = 0;
        while (referrerRepository.existsByReferralCode(referralCode) && attempt < 10) {
            referralCode = referralCode + (char) ('A' + attempt);
            attempt++;
        }

        Referrer referrer = Referrer.builder()
                .walletAddress(normalizedAddress)
                .referralCode(referralCode)
                .tier(AffiliateTier.BRONZE)
                .build();

        referrer = referrerRepository.save(referrer);
        log.info("Registered new affiliate: {} with code {}", normalizedAddress, referralCode);

        return referrer;
    }

    // ==================== Referral Tracking ====================

    /**
     * Track a new referral signup
     */
    @Transactional
    public Referral trackReferral(String referralCode, String refereeAddress) {
        String normalizedReferee = refereeAddress.toLowerCase();

        // Check if referee already exists
        if (referralRepository.existsByRefereeAddress(normalizedReferee)) {
            log.warn("Referee {} already tracked", normalizedReferee);
            return referralRepository.findByRefereeAddress(normalizedReferee).orElse(null);
        }

        // Find referrer by code
        Referrer referrer = referrerRepository.findByReferralCode(referralCode.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Invalid referral code: " + referralCode));

        // Prevent self-referral
        if (referrer.getWalletAddress().equalsIgnoreCase(normalizedReferee)) {
            throw new IllegalArgumentException("Cannot refer yourself");
        }

        Referral referral = Referral.builder()
                .referrer(referrer)
                .refereeAddress(normalizedReferee)
                .build();

        referral = referralRepository.save(referral);
        log.info("Tracked referral: {} referred by {}", normalizedReferee, referrer.getWalletAddress());

        return referral;
    }

    // ==================== Volume Attribution ====================

    /**
     * Attribute trading volume to the appropriate referrer
     */
    @Transactional
    public void attributeVolume(String traderAddress, double volumeUsd) {
        String normalizedAddress = traderAddress.toLowerCase();

        // Find if this trader was referred
        Optional<Referral> referralOpt = referralRepository.findByRefereeAddress(normalizedAddress);
        if (referralOpt.isEmpty()) {
            return; // Not a referred user
        }

        Referral referral = referralOpt.get();
        Referrer referrer = referral.getReferrer();

        // Update referral lifetime volume
        referral.setLifetimeVolume(referral.getLifetimeVolume() + volumeUsd);
        referral.setLast30DaysVolume(referral.getLast30DaysVolume() + volumeUsd);
        referralRepository.save(referral);

        // Calculate commission
        double commission = volumeUsd * referrer.getTier().getCommissionRate();

        // Update daily volume record
        LocalDate today = LocalDate.now();
        ReferralVolume dailyVolume = volumeRepository.findByReferrerIdAndDate(referrer.getId(), today)
                .orElse(ReferralVolume.builder()
                        .referrer(referrer)
                        .date(today)
                        .build());

        dailyVolume.setVolumeUsd(dailyVolume.getVolumeUsd() + volumeUsd);
        dailyVolume.setCommissionUsd(dailyVolume.getCommissionUsd() + commission);
        dailyVolume.setTradeCount(dailyVolume.getTradeCount() + 1);
        volumeRepository.save(dailyVolume);

        // Update referrer totals
        referrer.setTotalVolume(referrer.getTotalVolume() + volumeUsd);
        referrer.setPendingPayout(referrer.getPendingPayout() + commission);

        // Check for tier upgrade
        AffiliateTier newTier = AffiliateTier.fromVolume(referrer.getTotalVolume());
        if (newTier.ordinal() > referrer.getTier().ordinal()) {
            log.info("Upgrading {} from {} to {}", referrer.getWalletAddress(), referrer.getTier(), newTier);
            referrer.setTier(newTier);
        }

        referrerRepository.save(referrer);
        log.debug("Attributed ${} volume, ${} commission to {}", volumeUsd, commission, referrer.getWalletAddress());
    }

    // ==================== Statistics ====================

    /**
     * Get affiliate stats for dashboard
     */
    @Transactional(readOnly = true)
    public AffiliateStatsDto getStats(String walletAddress) {
        String normalizedAddress = walletAddress.toLowerCase();

        Referrer referrer = referrerRepository.findByWalletAddress(normalizedAddress)
                .orElseThrow(() -> new IllegalArgumentException("Wallet not registered as affiliate"));

        long referralCount = referralRepository.countByReferrerId(referrer.getId());
        double volumeToNext = referrer.getTier().getVolumeToNextTier(referrer.getTotalVolume());

        AffiliateTier nextTier = switch (referrer.getTier()) {
            case BRONZE -> AffiliateTier.SILVER;
            case SILVER -> AffiliateTier.GOLD;
            case GOLD -> AffiliateTier.DIAMOND;
            case DIAMOND -> null;
        };

        return AffiliateStatsDto.builder()
                .walletAddress(referrer.getWalletAddress())
                .referralCode(referrer.getReferralCode())
                .tier(referrer.getTier())
                .commissionRate(referrer.getTier().getCommissionRate())
                .totalVolumeGenerated(referrer.getTotalVolume())
                .totalReferrals(referralCount)
                .totalEarned(referrer.getTotalEarned())
                .pendingPayout(referrer.getPendingPayout())
                .volumeToNextTier(volumeToNext)
                .nextTier(nextTier != null ? nextTier.name() : null)
                .build();
    }

    /**
     * Get list of referrals for a referrer
     */
    @Transactional(readOnly = true)
    public List<ReferralDto> getReferrals(String walletAddress) {
        String normalizedAddress = walletAddress.toLowerCase();

        Referrer referrer = referrerRepository.findByWalletAddress(normalizedAddress)
                .orElseThrow(() -> new IllegalArgumentException("Wallet not registered as affiliate"));

        return referralRepository.findByReferrerId(referrer.getId()).stream()
                .map(r -> ReferralDto.builder()
                        .address(r.getRefereeAddress())
                        .joinedAt(r.getCreatedAt())
                        .lifetimeVolume(r.getLifetimeVolume())
                        .last30DaysVolume(r.getLast30DaysVolume())
                        .lastActiveAt(r.getLastActiveAt())
                        .build())
                .collect(Collectors.toList());
    }

    /**
     * Get payout history for a referrer
     */
    @Transactional(readOnly = true)
    public List<PayoutDto> getPayouts(String walletAddress) {
        String normalizedAddress = walletAddress.toLowerCase();

        Referrer referrer = referrerRepository.findByWalletAddress(normalizedAddress)
                .orElseThrow(() -> new IllegalArgumentException("Wallet not registered as affiliate"));

        return payoutRepository.findByReferrerIdOrderByCreatedAtDesc(referrer.getId()).stream()
                .map(p -> PayoutDto.builder()
                        .id(p.getId())
                        .amount(p.getAmountUsd())
                        .status(p.getStatus())
                        .txHash(p.getTxHash())
                        .createdAt(p.getCreatedAt())
                        .processedAt(p.getProcessedAt())
                        .build())
                .collect(Collectors.toList());
    }

    // ==================== Lookups ====================

    /**
     * Find referrer by wallet address
     */
    public Optional<Referrer> findByWallet(String walletAddress) {
        return referrerRepository.findByWalletAddress(walletAddress.toLowerCase());
    }

    /**
     * Find referrer by referral code
     */
    public Optional<Referrer> findByCode(String referralCode) {
        return referrerRepository.findByReferralCode(referralCode.toUpperCase());
    }
}
