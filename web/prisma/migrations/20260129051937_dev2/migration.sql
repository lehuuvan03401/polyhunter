-- CreateIndex
CREATE INDEX "CopyTrade_configId_status_detectedAt_idx" ON "CopyTrade"("configId", "status", "detectedAt");

-- CreateIndex
CREATE INDEX "CopyTrade_configId_originalSide_idx" ON "CopyTrade"("configId", "originalSide");

-- CreateIndex
CREATE INDEX "CopyTrade_configId_tokenId_idx" ON "CopyTrade"("configId", "tokenId");

-- CreateIndex
CREATE INDEX "CopyTrade_tokenId_executedAt_idx" ON "CopyTrade"("tokenId", "executedAt");

-- CreateIndex
CREATE INDEX "CopyTrade_originalTrader_originalPrice_idx" ON "CopyTrade"("originalTrader", "originalPrice");

-- CreateIndex
CREATE INDEX "CopyTrade_txHash_idx" ON "CopyTrade"("txHash");

-- CreateIndex
CREATE INDEX "UserPosition_walletAddress_balance_idx" ON "UserPosition"("walletAddress", "balance");
