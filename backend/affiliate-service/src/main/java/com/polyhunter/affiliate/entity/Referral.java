package com.polyhunter.affiliate.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Referral entity - represents a user referred by an affiliate
 */
@Entity
@Table(name = "referrals")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Referral {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referrer_id", nullable = false)
    private Referrer referrer;

    @Column(name = "referee_address", unique = true, nullable = false, length = 42)
    private String refereeAddress;

    @Column(name = "lifetime_volume", nullable = false)
    @Builder.Default
    private Double lifetimeVolume = 0.0;

    @Column(name = "last_30_days_volume", nullable = false)
    @Builder.Default
    private Double last30DaysVolume = 0.0;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "last_active_at")
    private LocalDateTime lastActiveAt;
}
