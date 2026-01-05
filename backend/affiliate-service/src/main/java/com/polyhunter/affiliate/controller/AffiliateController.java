package com.polyhunter.affiliate.controller;

import com.polyhunter.affiliate.dto.*;
import com.polyhunter.affiliate.entity.Referrer;
import com.polyhunter.affiliate.service.AffiliateService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for affiliate system
 */
@RestController
@RequestMapping("/api/affiliate")
@RequiredArgsConstructor
@Tag(name = "Affiliate", description = "Affiliate program management APIs")
@CrossOrigin(origins = { "http://localhost:3000", "http://localhost:3001" })
public class AffiliateController {

    private final AffiliateService affiliateService;

    // ==================== Registration ====================

    @PostMapping("/register")
    @Operation(summary = "Register as an affiliate", description = "Register wallet address as an affiliate and get a referral code")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterAffiliateRequest request) {
        try {
            Referrer referrer = affiliateService.registerAffiliate(request.getWalletAddress());
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "referralCode", referrer.getReferralCode(),
                    "walletAddress", referrer.getWalletAddress()));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()));
        }
    }

    @PostMapping("/track")
    @Operation(summary = "Track a referral", description = "Record that a user signed up via a referral link")
    public ResponseEntity<Map<String, Object>> trackReferral(@Valid @RequestBody TrackReferralRequest request) {
        try {
            affiliateService.trackReferral(request.getReferralCode(), request.getRefereeAddress());
            return ResponseEntity.ok(Map.of("success", true));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()));
        }
    }

    // ==================== Statistics ====================

    @GetMapping("/stats")
    @Operation(summary = "Get affiliate stats", description = "Get dashboard statistics for an affiliate")
    public ResponseEntity<?> getStats(@RequestParam String walletAddress) {
        try {
            AffiliateStatsDto stats = affiliateService.getStats(walletAddress);
            return ResponseEntity.ok(stats);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage()));
        }
    }

    @GetMapping("/referrals")
    @Operation(summary = "Get referrals list", description = "Get list of users referred by an affiliate")
    public ResponseEntity<?> getReferrals(@RequestParam String walletAddress) {
        try {
            List<ReferralDto> referrals = affiliateService.getReferrals(walletAddress);
            return ResponseEntity.ok(referrals);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage()));
        }
    }

    @GetMapping("/payouts")
    @Operation(summary = "Get payout history", description = "Get commission payout history for an affiliate")
    public ResponseEntity<?> getPayouts(@RequestParam String walletAddress) {
        try {
            List<PayoutDto> payouts = affiliateService.getPayouts(walletAddress);
            return ResponseEntity.ok(payouts);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage()));
        }
    }

    // ==================== Lookups ====================

    @GetMapping("/lookup/code/{code}")
    @Operation(summary = "Lookup by referral code", description = "Check if a referral code is valid")
    public ResponseEntity<Map<String, Object>> lookupByCode(@PathVariable String code) {
        return affiliateService.findByCode(code)
                .map(r -> ResponseEntity.ok(Map.<String, Object>of(
                        "valid", true,
                        "walletAddress", r.getWalletAddress())))
                .orElse(ResponseEntity.ok(Map.of("valid", false)));
    }

    @GetMapping("/lookup/wallet/{address}")
    @Operation(summary = "Lookup by wallet", description = "Check if a wallet is registered as affiliate")
    public ResponseEntity<Map<String, Object>> lookupByWallet(@PathVariable String address) {
        return affiliateService.findByWallet(address)
                .map(r -> ResponseEntity.ok(Map.<String, Object>of(
                        "registered", true,
                        "referralCode", r.getReferralCode(),
                        "tier", r.getTier().name())))
                .orElse(ResponseEntity.ok(Map.of("registered", false)));
    }

    // ==================== Volume Attribution (Internal API) ====================

    @PostMapping("/internal/volume")
    @Operation(summary = "Attribute volume (internal)", description = "Internal API to attribute trading volume to referrer")
    public ResponseEntity<Map<String, Object>> attributeVolume(
            @RequestParam String traderAddress,
            @RequestParam double volumeUsd) {
        try {
            affiliateService.attributeVolume(traderAddress, volumeUsd);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "error", e.getMessage()));
        }
    }
}
