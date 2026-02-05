-- Add composite indexes for hot-path CopyTrade scans
CREATE INDEX "CopyTrade_status_expiresAt_idx" ON "CopyTrade"("status", "expiresAt");
CREATE INDEX "CopyTrade_status_nextRetryAt_idx" ON "CopyTrade"("status", "nextRetryAt");
CREATE INDEX "CopyTrade_status_executedAt_idx" ON "CopyTrade"("status", "executedAt");

-- Add composite index for time-window commission lookups per referrer
CREATE INDEX "CommissionLog_referrerId_createdAt_idx" ON "CommissionLog"("referrerId", "createdAt");
