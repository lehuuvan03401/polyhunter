package com.polyhunter.affiliate.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Daily volume aggregation for referral tracking
 */
@Entity
@Table(name = "referral_volume", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"referrer_id", "date"})
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferralVolume {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "referrer_id", nullable = false)
    private Referrer referrer;

    @Column(nullable = false)
    private LocalDate date;

    @Column(name = "volume_usd", nullable = false)
    @Builder.Default
    private Double volumeUsd = 0.0;

    @Column(name = "commission_usd", nullable = false)
    @Builder.Default
    private Double commissionUsd = 0.0;

    @Column(name = "trade_count", nullable = false)
    @Builder.Default
    private Integer tradeCount = 0;
}
