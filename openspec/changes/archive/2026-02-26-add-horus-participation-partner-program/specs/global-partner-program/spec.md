## ADDED Requirements

### Requirement: Fixed Global Partner Seat Cap
The system SHALL enforce a hard cap of 100 global partner seats and MUST NOT allocate seats beyond this cap.

#### Scenario: Seat allocation under cap
- **GIVEN** active seats are below 100
- **WHEN** a qualified applicant purchases a seat
- **THEN** seat is allocated successfully

#### Scenario: Seat allocation at cap
- **GIVEN** active seats are exactly 100
- **WHEN** another applicant attempts seat purchase
- **THEN** allocation is rejected with reason `SEAT_CAP_REACHED`

### Requirement: Monthly Bottom-10 Elimination
The system SHALL perform monthly ranking and eliminate the lowest 10 partner seats at month end.

#### Scenario: Month-end elimination run
- **GIVEN** monthly ranking snapshot is generated
- **WHEN** month-end elimination job executes
- **THEN** the lowest 10 ranked active partners are marked `ELIMINATED`

### Requirement: Elimination Refund SLA
The system SHALL complete eliminated seat refunds within 7 days after elimination.

#### Scenario: Refund completed within SLA
- **GIVEN** a partner seat is eliminated
- **WHEN** refund workflow runs
- **THEN** refund is issued and marked completed within 7 calendar days

### Requirement: Seat Refill After Elimination
The system SHALL reopen eliminated seat capacity and support market-configurable refill pricing.

#### Scenario: Refill seat opened with current price
- **GIVEN** seats were eliminated in monthly cycle
- **WHEN** refill window opens
- **THEN** matching seat count is published for re-application
- **AND** current configured refill price is applied

### Requirement: Partner Privilege Mapping
An active global partner seat SHALL grant V5-equivalent benefit scope and dedicated partner backend permissions.

#### Scenario: Seat activation grants privileges
- **GIVEN** a partner seat is in `ACTIVE` status
- **WHEN** authorization is evaluated
- **THEN** account receives V5-equivalent rights and partner-console access

#### Scenario: Seat elimination revokes privileges
- **GIVEN** a partner seat changes to `ELIMINATED`
- **WHEN** authorization is re-evaluated
- **THEN** partner-console access and seat-derived privileges are revoked
