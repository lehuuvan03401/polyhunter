## ADDED Requirements

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
