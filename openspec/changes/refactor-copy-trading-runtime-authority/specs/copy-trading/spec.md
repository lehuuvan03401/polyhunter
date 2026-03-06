## ADDED Requirements

### Requirement: Single Automated Execution Authority

The copy-trading system SHALL route all automated copy-trade execution through a single authority runtime.

#### Scenario: Supervisor owns automatic signal execution
- **GIVEN** copy-trading automation is enabled for a strategy
- **WHEN** a trader signal is ingested from supported channels
- **THEN** the Supervisor authority runtime claims and executes the copy-trade flow
- **AND** no secondary runtime independently advances the same trade through a separate automatic path

#### Scenario: Deprecated worker cannot remain an independent authority
- **GIVEN** the legacy copy-trading worker is still present in the repository
- **WHEN** operators run the supported production path
- **THEN** the legacy worker is not required as an independent automatic execution authority
- **AND** supported scripts and docs point to the authority runtime

### Requirement: Compatibility Entry Points Delegate to Authority Semantics

Compatibility or manual execution entry points SHALL delegate to the authority runtime semantics instead of maintaining a separate automatic execution state machine.

#### Scenario: Compatibility API does not create divergent automation state
- **GIVEN** a compatibility API route is used to finalize a copy trade
- **WHEN** automatic mode is enabled in production
- **THEN** the route delegates to shared authority logic or rejects unsupported autonomous execution
- **AND** it does not maintain a separate automatic settlement or ledger lifecycle
