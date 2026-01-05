package com.polyhunter.affiliate.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

/**
 * DTO for referral info
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferralDto {

    private String address;
    private LocalDateTime joinedAt;
    private double lifetimeVolume;
    private double last30DaysVolume;
    private LocalDateTime lastActiveAt;
}
