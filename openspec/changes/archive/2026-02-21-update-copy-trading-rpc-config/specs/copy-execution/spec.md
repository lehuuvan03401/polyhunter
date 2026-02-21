## ADDED Requirements
### Requirement: Execution RPC Configuration
The system SHALL allow configuring the RPC URL used for copy-trading execution via environment variables.

#### Scenario: Custom RPC configured
- **GIVEN** `COPY_TRADING_RPC_URL` is set
- **WHEN** the worker initializes the execution provider
- **THEN** the provider uses `COPY_TRADING_RPC_URL`

#### Scenario: Default fallback
- **GIVEN** `COPY_TRADING_RPC_URL` is not set
- **WHEN** the worker initializes the execution provider
- **THEN** it falls back to `NEXT_PUBLIC_RPC_URL` or the default public RPC
