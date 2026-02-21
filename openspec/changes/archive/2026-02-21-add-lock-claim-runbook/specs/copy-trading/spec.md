# copy-trading (Delta)

## ADDED Requirements

### Requirement: Operational Lock-Claim Verification
The project SHALL provide an operational runbook and verification tooling to validate that CopyTrade lock-claiming prevents multi-worker double-processing.

#### Scenario: Multi-worker lock-claim validation
- **GIVEN** two worker instances run concurrently
- **AND** a set of `SETTLEMENT_PENDING` and `FAILED` CopyTrade rows exist
- **WHEN** operators follow the runbook steps
- **THEN** each trade is claimed by at most one worker
- **AND** the runbook captures expected logs and DB checks
