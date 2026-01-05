package com.polyhunter.affiliate.repository;

import com.polyhunter.affiliate.entity.Referral;
import com.polyhunter.affiliate.entity.Referrer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReferralRepository extends JpaRepository<Referral, UUID> {

    List<Referral> findByReferrer(Referrer referrer);

    List<Referral> findByReferrerId(UUID referrerId);

    Optional<Referral> findByRefereeAddress(String refereeAddress);

    boolean existsByRefereeAddress(String refereeAddress);

    @Query("SELECT COUNT(r) FROM Referral r WHERE r.referrer.id = :referrerId")
    long countByReferrerId(UUID referrerId);

    @Query("SELECT SUM(r.lifetimeVolume) FROM Referral r WHERE r.referrer.id = :referrerId")
    Double sumLifetimeVolumeByReferrerId(UUID referrerId);
}
