## ADDED Requirements

### Requirement: Dual Funding Channels
The system SHALL support two participation funding channels: exchange funding and TP wallet funding. All recorded values MUST be normalized to MCN-equivalent and USD-equivalent amounts.

#### Scenario: Exchange funding is accepted
- **GIVEN** a user submits a verified exchange funding transaction
- **WHEN** funding confirmation is completed
- **THEN** the system records the funding with channel `EXCHANGE`
- **AND** persists normalized MCN-equivalent and USD-equivalent amounts

#### Scenario: TP wallet funding is accepted
- **GIVEN** a user funds from TP wallet address
- **WHEN** on-chain confirmation succeeds
- **THEN** the system records the funding with channel `TP_WALLET`
- **AND** persists normalized MCN-equivalent and USD-equivalent amounts

### Requirement: Activation Gate
Participation MUST be activated only after both registration and qualified funding are completed.

#### Scenario: Registration without funding
- **GIVEN** a user has completed registration
- **AND** has no qualified funding
- **WHEN** the user requests activation
- **THEN** activation is rejected with reason `QUALIFIED_FUNDING_REQUIRED`

#### Scenario: Registration plus qualified funding
- **GIVEN** a user has completed registration
- **AND** has confirmed funding meeting minimum threshold
- **WHEN** activation is requested
- **THEN** the participation account is activated

### Requirement: Position Modes and Entry Thresholds
The system SHALL support `FREE` and `MANAGED` modes with different minimum participation thresholds.

#### Scenario: FREE mode threshold enforcement
- **GIVEN** a user selects `FREE` mode
- **WHEN** confirmed funding is below 100U MCN-equivalent
- **THEN** mode activation is rejected

#### Scenario: MANAGED mode threshold enforcement
- **GIVEN** a user selects `MANAGED` mode
- **WHEN** confirmed funding is below 500U MCN-equivalent
- **THEN** mode activation is rejected

### Requirement: Strategy and Service Period Options
The system SHALL expose three strategy profiles (`CONSERVATIVE`, `MODERATE`, `AGGRESSIVE`) and formal service periods (1-day trial, 7/30/90/180/360 days).

#### Scenario: User fetches strategy and service-period metadata
- **WHEN** the user requests participation configuration metadata
- **THEN** the response includes the three strategy profiles
- **AND** includes the supported service periods `1/7/30/90/180/360`

#### Scenario: Unsupported service period is rejected
- **GIVEN** a user submits a service period outside supported values
- **WHEN** the system validates subscription input
- **THEN** the request fails with validation error

### Requirement: Managed Return Matrix by Principal Band
Managed projected return ranges SHALL be configured by principal bands A/B/C, strategy profile, and service period.

#### Scenario: Matrix lookup for band A
- **GIVEN** principal is within 500U to 5000U
- **WHEN** user selects 30-day `MODERATE` strategy
- **THEN** the response returns configured range `23% - 30%`

#### Scenario: Matrix lookup for band C
- **GIVEN** principal is within 50000U to 300000U
- **WHEN** user selects 360-day `AGGRESSIVE` strategy
- **THEN** the response returns configured range `3.06x - 3.90x`

### Requirement: Newcomer Trial Window
The system SHALL provide a 1-day newcomer basic-service trial for first-time qualified participants.

#### Scenario: First-time user receives trial
- **GIVEN** a wallet has no historical qualified participation records
- **WHEN** the first eligible participation is created
- **THEN** the account receives 1-day trial entitlement

#### Scenario: Returning user does not receive duplicate trial
- **GIVEN** the wallet has already consumed trial entitlement
- **WHEN** another participation is created
- **THEN** no additional trial entitlement is granted

### Requirement: Asset Safety and Authorization Boundary
User principal MUST remain in user-controlled wallet/account unless explicit managed-custody authorization is granted.

#### Scenario: FREE mode remains user-controlled
- **GIVEN** a user is in `FREE` mode
- **WHEN** trades are executed
- **THEN** the system executes only within user-authorized non-custodial scope
- **AND** platform cannot transfer principal outside authorized trade actions

#### Scenario: MANAGED mode requires explicit custody authorization
- **GIVEN** a user is in `MANAGED` mode
- **WHEN** managed execution is enabled
- **THEN** the system stores explicit custody authorization proof
- **AND** all managed actions are auditable by authorization reference
