## ADDED Requirements

### Requirement: Readiness status endpoint
The system SHALL provide an API endpoint that returns copy-trading readiness status for a wallet address.

#### Scenario: Wallet readiness check
- **WHEN** a client requests readiness for a wallet
- **THEN** the response includes wallet address, resolved proxy address, balance snapshots (MATIC, USDC.e), allowance status (USDC + CTF), and a list of required actions
- **AND** the response indicates whether trading is ready
