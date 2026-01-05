package com.polyhunter.affiliate.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Request DTO for registering as an affiliate
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class RegisterAffiliateRequest {

    @NotBlank(message = "Wallet address is required")
    @Pattern(regexp = "^0x[a-fA-F0-9]{40}$", message = "Invalid Ethereum address format")
    private String walletAddress;
}
