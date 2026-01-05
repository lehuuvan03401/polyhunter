package com.polyhunter.affiliate.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Referrer entity - represents a wallet that can earn affiliate commissions
 */
@Entity
@Table(name = "referrers")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Referrer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "wallet_address", unique = true, nullable = false, length = 42)
    private String walletAddress;

    @Column(name = "referral_code", unique = true, nullable = false, length = 20)
    private String referralCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AffiliateTier tier = AffiliateTier.BRONZE;

    @Column(name = "total_volume", nullable = false)
    @Builder.Default
    private Double totalVolume = 0.0;

    @Column(name = "total_earned", nullable = false)
    @Builder.Default
    private Double totalEarned = 0.0;

    @Column(name = "pending_payout", nullable = false)
    @Builder.Default
    private Double pendingPayout = 0.0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * Generate a unique referral code from wallet address
     */
    public static String generateReferralCode(String walletAddress) {
        return walletAddress.substring(2, 10).toUpperCase();
    }
}
