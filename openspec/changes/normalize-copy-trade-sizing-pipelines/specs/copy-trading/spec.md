## ADDED Requirements
### Requirement: Consistent Trade Size Normalization
The system SHALL apply trade size normalization (SHARES vs NOTIONAL) across all copy-trading pipelines, including worker, supervisor, and simulation flows.

#### Scenario: Supervisor uses normalized sizing
- **GIVEN** tradeSizeMode is `NOTIONAL`
- **WHEN** the supervisor processes a trade signal
- **THEN** it converts raw size to shares and uses notional for sizing

#### Scenario: Simulation uses normalized sizing
- **GIVEN** tradeSizeMode is `SHARES`
- **WHEN** the simulation processes a trade signal
- **THEN** it uses raw size as shares and notional = shares * price
