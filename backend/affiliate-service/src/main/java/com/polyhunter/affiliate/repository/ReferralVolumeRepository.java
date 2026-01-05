package com.polyhunter.affiliate.repository;

import com.polyhunter.affiliate.entity.ReferralVolume;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ReferralVolumeRepository extends JpaRepository<ReferralVolume, UUID> {

    Optional<ReferralVolume> findByReferrerIdAndDate(UUID referrerId, LocalDate date);

    @Query("SELECT SUM(v.volumeUsd) FROM ReferralVolume v WHERE v.referrer.id = :referrerId")
    Double sumVolumeByReferrerId(UUID referrerId);

    @Query("SELECT SUM(v.commissionUsd) FROM ReferralVolume v WHERE v.referrer.id = :referrerId")
    Double sumCommissionByReferrerId(UUID referrerId);

    @Query("SELECT SUM(v.volumeUsd) FROM ReferralVolume v WHERE v.referrer.id = :referrerId AND v.date >= :since")
    Double sumVolumeByReferrerIdSince(UUID referrerId, LocalDate since);
}
