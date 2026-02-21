# copy-trading (Delta)

## ADDED Requirements

### Requirement: Concurrency-Safe Recovery Scans
Recovery and retry scans SHALL claim rows atomically to prevent multiple workers from processing the same trade.

#### Scenario: Two workers scan the same pending set
- **GIVEN** two worker instances run concurrently
- **WHEN** both scan for `SETTLEMENT_PENDING` or `FAILED` trades
- **THEN** each trade is claimed by at most one worker
- **AND** duplicate execution or reconciliation does not occur
