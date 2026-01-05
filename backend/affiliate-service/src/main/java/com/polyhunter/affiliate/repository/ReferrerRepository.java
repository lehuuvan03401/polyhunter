package com.polyhunter.affiliate.repository;

import com.polyhunter.affiliate.entity.Referrer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReferrerRepository extends JpaRepository<Referrer, UUID> {

    Optional<Referrer> findByWalletAddress(String walletAddress);

    Optional<Referrer> findByReferralCode(String referralCode);

    boolean existsByWalletAddress(String walletAddress);

    boolean existsByReferralCode(String referralCode);
}
