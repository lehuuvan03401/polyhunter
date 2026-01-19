# affiliate-withdrawals Specification

## Purpose
TBD - created by archiving change implement-affiliate-withdrawals. Update Purpose after archive.
## Requirements
### Requirement: User Withdrawal Page
The system SHALL provide a dedicated page for users to withdraw their affiliate earnings.

#### Scenario: Viewing available balance
- **GIVEN** a user navigates to `/affiliate/withdrawals`
- **WHEN** the page loads
- **THEN** the system SHALL display their available balance (pendingPayout)
- **AND** show a withdrawal form with signature-based authorization

#### Scenario: Submitting a withdrawal request
- **GIVEN** a user has balance >= $10
- **WHEN** they submit a withdrawal request with wallet signature
- **THEN** a Payout record SHALL be created with status `PENDING`
- **AND** the user SHALL see the new payout in their history

#### Scenario: Viewing withdrawal history
- **GIVEN** a user has previous withdrawal requests
- **WHEN** they view the withdrawals page
- **THEN** the system SHALL display all their payouts with status badges

---

### Requirement: Admin Payout Management
The admin dashboard SHALL provide a tab for managing affiliate payout requests.

#### Scenario: Listing pending payouts
- **GIVEN** an admin accesses the Payouts tab
- **WHEN** the tab loads
- **THEN** the system SHALL display all payout requests with filters by status

#### Scenario: Approving a payout
- **GIVEN** an admin views a PENDING payout
- **WHEN** they click "Approve"
- **THEN** the payout status SHALL change to `PROCESSING`
- **AND** the admin SHALL manually send USDC to the user's wallet

#### Scenario: Completing a payout
- **GIVEN** a payout is in PROCESSING status
- **WHEN** admin enters the transaction hash and clicks "Complete"
- **THEN** the payout status SHALL change to `COMPLETED`
- **AND** the txHash SHALL be recorded

#### Scenario: Rejecting a payout
- **GIVEN** an admin views a PENDING payout
- **WHEN** they click "Reject"
- **THEN** the payout status SHALL change to `REJECTED`
- **AND** the amount SHALL be returned to the user's pendingPayout balance

