package com.polyhunter.affiliate.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for tracking a referral signup
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class TrackReferralRequest {

    @NotBlank(message = "Referral code is required")
    private String referralCode;

    @NotBlank(message = "Referee wallet address is required")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Invalid Ethereum address format")
    private String refereeAddress;
}
