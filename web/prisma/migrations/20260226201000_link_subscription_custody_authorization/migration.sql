-- Link managed subscriptions to custody authorization records for audit traceability.

ALTER TABLE "ManagedSubscription"
ADD COLUMN "custodyAuthorizationId" TEXT;

CREATE INDEX "ManagedSubscription_custodyAuthorizationId_idx"
ON "ManagedSubscription"("custodyAuthorizationId");

ALTER TABLE "ManagedSubscription"
ADD CONSTRAINT "ManagedSubscription_custodyAuthorizationId_fkey"
FOREIGN KEY ("custodyAuthorizationId") REFERENCES "ManagedCustodyAuthorization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
