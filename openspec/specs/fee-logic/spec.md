# fee-logic Specification

## Purpose
TBD - created by archiving change implement-profit-based-fees. Update Purpose after archive.
## Requirements
### Requirement: Affiliate Commission Trigger
The system MUST ONLY trigger commission distribution when a copy-trade or managed-trade closes with realized profit for the participant.

#### Scenario: Trade results in a loss
- **GIVEN** a participant closes a position below average entry price
- **WHEN** realized profit is less than or equal to zero
- **THEN** `distributeCommissions` MUST NOT be called
- **AND** no profit-fee commission log is created

#### Scenario: FREE mode trade results in a profit
- **GIVEN** a `FREE` mode participant closes a profitable position
- **WHEN** realized profit is greater than zero
- **THEN** `distributeCommissions` MUST be called with realized profit input

#### Scenario: MANAGED mode trade results in a profit
- **GIVEN** a `MANAGED` mode participant settles with positive realized profit
- **WHEN** settlement finalizes
- **THEN** `distributeCommissions` MUST be called with realized profit input

### Requirement: Affiliate Commission Rate
The system MUST calculate profit fee at a fixed rate of 20% of realized profit for both `FREE` and `MANAGED` participation modes.

#### Scenario: Fixed 20% fee calculation
- **GIVEN** a participant realizes profit of $100
- **WHEN** fee is calculated
- **THEN** fee amount MUST be $20

#### Scenario: Zero fee when no profit
- **GIVEN** a participant realizes profit of $0 or negative value
- **WHEN** fee is calculated
- **THEN** fee amount MUST be $0

