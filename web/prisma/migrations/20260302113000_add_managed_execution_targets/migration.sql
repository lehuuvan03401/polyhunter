-- CreateTable
CREATE TABLE "ManagedSubscriptionExecutionTarget" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "copyConfigId" TEXT NOT NULL,
    "allocationVersion" INTEGER,
    "targetWeight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "targetOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagedSubscriptionExecutionTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagedSubscriptionExecutionTarget_subscriptionId_copyConfigId_key"
ON "ManagedSubscriptionExecutionTarget"("subscriptionId", "copyConfigId");

-- CreateIndex
CREATE INDEX "ManagedSubscriptionExecutionTarget_subscriptionId_isActive_target_idx"
ON "ManagedSubscriptionExecutionTarget"("subscriptionId", "isActive", "targetOrder");

-- CreateIndex
CREATE INDEX "ManagedSubscriptionExecutionTarget_copyConfigId_isActive_idx"
ON "ManagedSubscriptionExecutionTarget"("copyConfigId", "isActive");

-- AddForeignKey
ALTER TABLE "ManagedSubscriptionExecutionTarget"
ADD CONSTRAINT "ManagedSubscriptionExecutionTarget_subscriptionId_fkey"
FOREIGN KEY ("subscriptionId") REFERENCES "ManagedSubscription"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagedSubscriptionExecutionTarget"
ADD CONSTRAINT "ManagedSubscriptionExecutionTarget_copyConfigId_fkey"
FOREIGN KEY ("copyConfigId") REFERENCES "CopyTradingConfig"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
