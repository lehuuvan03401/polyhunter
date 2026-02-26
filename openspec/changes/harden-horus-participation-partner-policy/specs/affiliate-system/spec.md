## MODIFIED Requirements
### Requirement: Same-Level Bonus Distribution
The system SHALL distribute same-level bonus rates based on realized收益 percentage: first generation 4%, second generation 1%. In production, this distribution MUST be enabled by default and any emergency disablement MUST be auditable.

#### Scenario: Production default settlement
- **GIVEN** production environment
- **AND** same-level eligible profit event occurs
- **WHEN** bonus settlement runs
- **THEN** generation-1 and generation-2 bonuses are settled using 4% and 1% rates

#### Scenario: Emergency disablement is audited
- **GIVEN** same-level bonus path is temporarily disabled for incident handling
- **WHEN** settlement path skips bonus payout
- **THEN** system records auditable disablement reason and time window
