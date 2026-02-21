-- Marketing proposal phase-1:
-- 1) one-day trial marker for first managed subscription
-- 2) one-time referral-based subscription extension reward

ALTER TABLE "Referral"
ADD COLUMN "subscriptionBonusGrantedAt" TIMESTAMP(3);

ALTER TABLE "ManagedSubscription"
ADD COLUMN "isTrial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trialEndsAt" TIMESTAMP(3);

CREATE INDEX "ManagedSubscription_walletAddress_isTrial_idx"
ON "ManagedSubscription"("walletAddress", "isTrial");
