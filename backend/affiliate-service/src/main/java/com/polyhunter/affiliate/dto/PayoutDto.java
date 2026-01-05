package com.polyhunter.affiliate.dto;

import com.polyhunter.affiliate.entity.PayoutStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.UUID;

/**
 * DTO for payout info
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PayoutDto {

    private UUID id;
    private double amount;
    private PayoutStatus status;
    private String txHash;
    private LocalDateTime createdAt;
    private LocalDateTime processedAt;
}
