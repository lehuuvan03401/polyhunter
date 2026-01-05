package com.polyhunter.affiliate.repository;

import com.polyhunter.affiliate.entity.Payout;
import com.polyhunter.affiliate.entity.PayoutStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PayoutRepository extends JpaRepository<Payout, UUID> {

    List<Payout> findByReferrerIdOrderByCreatedAtDesc(UUID referrerId);

    List<Payout> findByStatus(PayoutStatus status);

    @Query("SELECT SUM(p.amountUsd) FROM Payout p WHERE p.referrer.id = :referrerId AND p.status = 'COMPLETED'")
    Double sumCompletedPayoutsByReferrerId(UUID referrerId);
}
