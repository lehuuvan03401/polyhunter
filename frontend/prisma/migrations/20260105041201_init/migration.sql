-- CreateTable
CREATE TABLE "Referrer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walletAddress" TEXT NOT NULL,
    "referralCode" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'BRONZE',
    "totalVolume" REAL NOT NULL DEFAULT 0,
    "totalEarned" REAL NOT NULL DEFAULT 0,
    "pendingPayout" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "refereeAddress" TEXT NOT NULL,
    "lifetimeVolume" REAL NOT NULL DEFAULT 0,
    "last30DaysVolume" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" DATETIME,
    CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferralVolume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "volumeUsd" REAL NOT NULL DEFAULT 0,
    "commissionUsd" REAL NOT NULL DEFAULT 0,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ReferralVolume_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referrerId" TEXT NOT NULL,
    "amountUsd" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "txHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "errorMessage" TEXT,
    CONSTRAINT "Payout_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "Referrer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_walletAddress_key" ON "Referrer"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Referrer_referralCode_key" ON "Referrer"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeAddress_key" ON "Referral"("refereeAddress");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "ReferralVolume_referrerId_idx" ON "ReferralVolume"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralVolume_referrerId_date_key" ON "ReferralVolume"("referrerId", "date");

-- CreateIndex
CREATE INDEX "Payout_referrerId_idx" ON "Payout"("referrerId");
