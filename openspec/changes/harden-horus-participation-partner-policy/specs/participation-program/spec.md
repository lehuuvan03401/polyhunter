## MODIFIED Requirements
### Requirement: Activation Gate
Participation MUST be activated only after both registration and qualified funding are completed. In production, managed subscription entry MUST require `ACTIVE` participation status with mode `MANAGED`.

#### Scenario: Managed subscription request without managed activation
- **GIVEN** a wallet is not `ACTIVE` in `MANAGED` mode
- **WHEN** the wallet submits managed subscription request
- **THEN** the request is rejected with reason `MANAGED_ACTIVATION_REQUIRED`

### Requirement: Asset Safety and Authorization Boundary
User principal MUST remain in user-controlled wallet/account unless explicit managed-custody authorization is granted. In production, managed flows MUST require active custody authorization.

#### Scenario: Managed flow without custody authorization
- **GIVEN** a wallet is in managed flow
- **AND** no active custody authorization exists
- **WHEN** managed execution or subscription is requested
- **THEN** the request is rejected with reason `CUSTODY_AUTH_REQUIRED`

## ADDED Requirements
### Requirement: FREE Mode Boundary Enforcement
The system SHALL enforce FREE mode as non-custodial-only scope and reject managed/custodial-only operations for wallets not in `MANAGED` mode.

#### Scenario: FREE-mode wallet calls managed-only endpoint
- **GIVEN** wallet participation mode is `FREE`
- **WHEN** wallet calls managed-only endpoint
- **THEN** request is rejected with mode-boundary validation error
