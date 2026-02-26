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
- **THEN** the signature message SHALL be: `Withdraw ${amount} USDC from Horus Affiliate Program. Nonce: ${timestamp}`

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

### Requirement: Admin API Input Validation
The admin affiliate API SHALL validate all input parameters. Invalid tier values SHALL be rejected with a 400 error response.

#### Scenario: Rejecting invalid tier value
- GIVEN an admin sends a PUT request with tier "INVALID_TIER"
- WHEN the API processes the request
- THEN the API returns 400 Bad Request
- AND the response includes error message "Invalid tier value"

#### Scenario: Accepting valid tier value
- GIVEN an admin sends a PUT request with tier "ELITE"
- WHEN the API processes the request
- THEN the tier is updated successfully
- AND the API returns 200 OK

---

### Requirement: Admin API Query Optimization
The admin affiliate list endpoint SHALL fetch team sizes in a single batch query. The endpoint SHALL NOT execute N+1 queries for team size aggregation.

#### Scenario: Fetching affiliates with team sizes
- GIVEN there are 20 affiliates in the database
- WHEN an admin requests the affiliate list
- THEN team sizes are fetched using at most 2 database queries (main query + aggregation)
- AND response includes teamSize for each affiliate

---

### Requirement: Admin Authorization
The system SHALL verify admin wallet addresses before allowing access to admin endpoints. In production mode, the ADMIN_WALLETS environment variable MUST be configured. Development mode bypass SHALL log a warning.

#### Scenario: Production mode without configuration
- GIVEN NODE_ENV is "production"
- AND ADMIN_WALLETS environment variable is not set
- WHEN the server starts
- THEN a warning is logged "ADMIN_WALLETS not configured - admin endpoints disabled"

#### Scenario: Development mode bypass
- GIVEN NODE_ENV is "development"
- AND ADMIN_WALLETS is not configured
- WHEN an admin request is made
- THEN access is granted
- AND a warning is logged "Admin auth bypassed in development mode"

### Requirement: One-Time Referral Subscription Extension
The system SHALL extend the referrer's active subscription period by exactly 1 day when a direct referral completes first qualified participation. Each referee wallet MUST trigger this reward at most once.

#### Scenario: First qualified referral extends referrer
- **GIVEN** referee wallet completes its first qualified participation
- **AND** referee is linked to a referrer
- **WHEN** reward is processed
- **THEN** referrer's active subscription end time is extended by 1 day
- **AND** referee reward-consumed flag is recorded

#### Scenario: Duplicate reward attempt is blocked
- **GIVEN** referee wallet already triggered extension once
- **WHEN** another participation is created by same referee wallet
- **THEN** no additional extension is applied

### Requirement: Net Deposit Accounting
The system SHALL compute performance on net deposits, where `netDeposit = deposits - withdrawals`, and aggregate this metric for team-level progression.

#### Scenario: Net deposit updates after funding and withdrawal
- **GIVEN** a wallet has historical net deposit
- **WHEN** a confirmed deposit or withdrawal is posted
- **THEN** wallet net deposit is updated using `deposits - withdrawals`

#### Scenario: Team net deposit aggregation
- **GIVEN** a wallet belongs to an upline hierarchy
- **WHEN** wallet net deposit changes
- **THEN** team net deposit aggregates for eligible uplines are updated

### Requirement: V1-V9 Daily Level Evaluation
The system SHALL evaluate V1-V9 level eligibility daily based on configured net-deposit thresholds and assign corresponding team profit dividend rates.

#### Scenario: User reaches V5 threshold
- **GIVEN** team net deposit reaches 3,000,000U
- **WHEN** daily level evaluation runs
- **THEN** user level is set to `V5`
- **AND** team profit dividend rate is set to 50%

#### Scenario: Daily re-evaluation maintains deterministic level
- **GIVEN** a user has prior level snapshot
- **WHEN** daily evaluation is re-run
- **THEN** resulting level and dividend rate are derived from latest net-deposit thresholds only

### Requirement: Same-Level Bonus Distribution
The system SHALL distribute same-level bonus rates based on realized收益 percentage: first generation 4%, second generation 1%.

#### Scenario: First-generation same-level bonus
- **GIVEN** same-level eligible profit event occurs on generation 1
- **WHEN** bonus is settled
- **THEN** bonus rate is 4%

#### Scenario: Second-generation same-level bonus
- **GIVEN** same-level eligible profit event occurs on generation 2
- **WHEN** bonus is settled
- **THEN** bonus rate is 1%

### Requirement: Double-Zone Promotion Progress
The system SHALL track one-push-two double-zone promotion progress and expose current progress up to V9 target.

#### Scenario: Promotion progress query
- **WHEN** user requests promotion progress
- **THEN** response includes left-zone/right-zone contribution and next-level requirement gap

#### Scenario: Promotion level update
- **GIVEN** double-zone requirement for next level is satisfied
- **WHEN** promotion engine evaluates progress
- **THEN** user promotion level is updated and persisted

