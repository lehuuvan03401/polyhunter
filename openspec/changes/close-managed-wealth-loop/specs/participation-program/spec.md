## MODIFIED Requirements

### Requirement: Asset Safety and Authorization Boundary
User principal MUST remain in user-controlled wallet/account unless explicit managed-custody authorization is granted. Managed subscriptions MUST also maintain principal reservation linkage between qualified managed balance and active subscriptions.

#### Scenario: Managed subscription without reservation linkage
- **GIVEN** wallet has active managed custody authorization
- **AND** no valid principal reservation can be established
- **WHEN** managed subscription creation is requested
- **THEN** request is rejected

## ADDED Requirements

### Requirement: Managed Principal Availability Enforcement
Managed subscription principal SHALL be constrained by managed-qualified available balance after reservation deductions.

#### Scenario: Reservation consumes available managed balance
- **GIVEN** wallet has managed-qualified net deposits
- **WHEN** managed subscription is created
- **THEN** available managed balance is reduced by reserved principal amount

#### Scenario: Settlement releases reserved principal
- **GIVEN** managed subscription is settled or canceled
- **WHEN** reservation release is processed
- **THEN** reserved principal is released back to available managed balance

