# affiliate-system Specification

## Purpose
TBD - created by archiving change fix-affiliate-system-issues. Update Purpose after archive.
## Requirements
### Requirement: Automatic Tier Upgrade
The system SHALL automatically evaluate and upgrade a referrer's tier after commission distribution based on team size and volume thresholds.

#### Scenario: Tier upgrade triggered after commission
- **WHEN** a referrer receives commission from a trade
- **AND** their total team size OR total volume exceeds the threshold for the next tier
- **THEN** the system SHALL upgrade their tier automatically
- **AND** commission calculations SHALL use the new tier rate for subsequent trades

#### Scenario: Tier remains unchanged below threshold
- **WHEN** a referrer receives commission from a trade
- **AND** their metrics do not meet the next tier threshold
- **THEN** the system SHALL NOT change their tier

---

### Requirement: Volume Tracking
The system SHALL track trading volume at multiple levels to support tier progression and analytics.

#### Scenario: Referral lifetime volume update
- **WHEN** a referred user executes a trade
- **THEN** the system SHALL increment `Referral.lifetimeVolume` by the trade volume
- **AND** update `Referral.last30DaysVolume` for rolling window calculations

#### Scenario: Referrer total volume update
- **WHEN** any user in a referrer's downline executes a trade
- **THEN** the system SHALL increment the referrer's `totalVolume` field

#### Scenario: Team volume cascade
- **WHEN** a trade occurs
- **THEN** the system SHALL increment `teamVolume` for all ancestors up to 15 generations via the Closure Table

---

### Requirement: Secure Payout Authorization
The system SHALL verify wallet ownership before processing payout requests to prevent unauthorized withdrawals.

#### Scenario: Valid signature accepted
- **WHEN** a payout request includes a valid EIP-191 signature
- **AND** the recovered address matches the requested wallet address
- **THEN** the system SHALL process the payout request

#### Scenario: Invalid signature rejected
- **WHEN** a payout request includes an invalid or missing signature
- **THEN** the system SHALL reject the request with HTTP 401
- **AND** return an error message indicating signature verification failed

#### Scenario: Signature message format
- **WHEN** requesting a payout
- **THEN** the signature message SHALL be: `Withdraw ${amount} USDC from PolyHunter Affiliate Program. Nonce: ${timestamp}`

---

### Requirement: Commission Log Detail
The system SHALL record detailed metadata with each commission entry for audit and analytics purposes.

#### Scenario: Generation recorded in commission log
- **WHEN** a Zero Line commission is distributed
- **THEN** the `CommissionLog.generation` field SHALL contain the generation number (1-5)

#### Scenario: Source user recorded
- **WHEN** a commission is distributed from a trade
- **THEN** the `CommissionLog.sourceUserId` field SHALL contain the trader's wallet address

---

### Requirement: Team API Pagination
The system SHALL support pagination for team member queries to ensure performance with large teams.

#### Scenario: Paginated team response
- **WHEN** a client requests `/api/affiliate/team` with `limit` and `offset` parameters
- **THEN** the system SHALL return at most `limit` team members starting from `offset`
- **AND** include `total` count in the response

#### Scenario: Default pagination
- **WHEN** a client requests `/api/affiliate/team` without pagination parameters
- **THEN** the system SHALL default to `limit=50` and `offset=0`

---

### Requirement: Daily Volume Aggregation
The system SHALL maintain daily volume records for historical analysis and reporting.

#### Scenario: Daily volume record creation
- **WHEN** a referrer's downline generates trading volume
- **THEN** the system SHALL create or update a `ReferralVolume` record for that date
- **AND** increment `volumeUsd`, `commissionUsd`, and `tradeCount` fields

