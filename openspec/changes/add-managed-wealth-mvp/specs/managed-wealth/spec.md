## ADDED Requirements

### Requirement: Managed Product Catalog
The system SHALL expose a managed product catalog with strategy profile, supported terms, target return band, drawdown policy, and guarantee availability.

#### Scenario: User fetches product catalog
- **WHEN** a user requests the managed wealth product list
- **THEN** the response includes strategy profile, term options, target return band, and max drawdown policy for each active product
- **AND** each product indicates whether principal/minimum-yield guarantee is enabled

#### Scenario: Product details include binding terms
- **WHEN** a user opens a product detail
- **THEN** the system returns profit-sharing terms, disclosure policy, and guarantee clause text

### Requirement: Isolated Subscription Accounts
Each managed subscription MUST be isolated per user and per subscription order. The system MUST NOT pool principal across users in MVP.

#### Scenario: Two users subscribe to the same product
- **GIVEN** user A and user B both subscribe to product X term 30 days
- **WHEN** subscriptions are created
- **THEN** the system creates separate subscription records and execution mappings
- **AND** PnL, fees, and settlements are computed independently

### Requirement: Term-Based Strategy Configuration
The system SHALL support term buckets of 1, 3, 7, 15, 30, 60, 90, 180, and 365 days, each with independent target return and risk controls.

#### Scenario: Product offers multiple terms
- **WHEN** a user selects a product
- **THEN** the UI and API present all configured terms with their target return ranges and risk parameters
- **AND** selection binds the subscription to the chosen term configuration

### Requirement: Settlement with High-Water-Mark Fee
The system SHALL compute maturity settlement using high-water-mark performance fee charging and return auditable fee and payout breakdowns.

#### Scenario: Subscription settles with positive performance
- **GIVEN** a subscription reaches maturity with equity above principal
- **WHEN** settlement runs
- **THEN** the system computes gross PnL, high-water-mark-eligible profit, performance fee, and final payout
- **AND** stores the settlement record with these fields for user and ops visibility

#### Scenario: Subscription settles with non-positive performance
- **GIVEN** a non-guaranteed subscription reaches maturity with equity at or below principal
- **WHEN** settlement runs
- **THEN** performance fee is zero
- **AND** final payout equals pre-fee equity result

### Requirement: Conservative Guarantee with Reserve Fund
Only conservative strategy products MAY enable guarantee behavior. For guaranteed products, maturity payout MUST be topped up from reserve fund when below guaranteed threshold.

#### Scenario: Guaranteed subscription underperforms floor
- **GIVEN** a conservative guaranteed subscription has pre-guarantee payout below guaranteed payout
- **WHEN** settlement runs
- **THEN** the system debits reserve fund ledger by the shortfall
- **AND** final payout equals guaranteed payout

#### Scenario: Non-conservative products do not guarantee
- **WHEN** a moderate or aggressive product settles below principal or target floor
- **THEN** no reserve top-up is applied
- **AND** final payout follows strategy performance only

### Requirement: Reserve Coverage Safety Gate
The system MUST block new guaranteed subscriptions when reserve fund coverage ratio is below configured safety threshold.

#### Scenario: Coverage below threshold
- **GIVEN** reserve coverage ratio is lower than configured minimum
- **WHEN** a user tries to subscribe to a guaranteed product
- **THEN** the request is rejected with a clear "guaranteed subscriptions temporarily unavailable" reason

### Requirement: Transparency by Default
The system SHALL provide transparent visibility by default for positions, trades, NAV curve, and drawdown, with optional delayed disclosure policy per product.

#### Scenario: Default transparent product
- **WHEN** a user opens an active subscription
- **THEN** the UI shows positions, fills, NAV, and drawdown metrics in near real time

#### Scenario: Delayed disclosure product
- **GIVEN** a product disclosure policy is configured for delayed details
- **WHEN** the user views active subscription details
- **THEN** NAV and risk summary remain visible
- **AND** trade-level details are released after configured delay window
