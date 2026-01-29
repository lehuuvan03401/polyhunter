## ADDED Requirements

### Requirement: Funding and allowance status panel
The system SHALL display a funding/allowance status panel in the portfolio area for the active wallet.

#### Scenario: Insufficient funds or approvals
- **WHEN** the readiness status reports missing balance or approvals
- **THEN** the UI highlights the failing checks and provides clear next-step guidance (deposit or approve)
- **AND** the panel auto-refreshes on an interval and after wallet changes
