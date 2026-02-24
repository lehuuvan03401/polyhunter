## ADDED Requirements

### Requirement: SELL Prefilter Uses DB Confirmation
The supervisor SHALL treat in-memory position cache misses as provisional for SELL trades and perform a DB confirmation before skipping.

#### Scenario: Cache miss but DB confirms position
- **GIVEN** a SELL signal arrives
- **AND** in-memory position cache shows no balance for the wallet/token
- **WHEN** supervisor checks persistent positions
- **THEN** the SELL is allowed to continue
- **AND** cache is refreshed with confirmed balance

#### Scenario: Cache miss and DB miss
- **GIVEN** a SELL signal arrives
- **AND** both cache and persistent positions show no balance
- **WHEN** supervisor evaluates prefilter
- **THEN** the SELL is skipped

### Requirement: Position Cache Updates On Execution
The supervisor SHALL update in-memory position cache immediately after successful executions.

#### Scenario: Successful BUY execution
- **GIVEN** a copy BUY executes successfully
- **WHEN** supervisor receives execution result with shares
- **THEN** cache balance for wallet/token increases by executed shares

#### Scenario: Successful SELL execution
- **GIVEN** a copy SELL executes successfully
- **WHEN** supervisor receives execution result with shares
- **THEN** cache balance for wallet/token decreases by executed shares
