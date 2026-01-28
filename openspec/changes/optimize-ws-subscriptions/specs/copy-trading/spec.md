## ADDED Requirements
### Requirement: Filtered Activity Subscription
The system SHALL use WebSocket activity subscriptions filtered to watched trader addresses when supported by the SDK, and fall back to full activity subscriptions when filtering is unavailable.

#### Scenario: Filtered subscription available
- **GIVEN** the SDK supports address filters
- **WHEN** the worker subscribes to activity
- **THEN** the subscription includes only watched trader addresses

#### Scenario: Filtered subscription unavailable
- **GIVEN** the SDK does not support address filters
- **WHEN** the worker subscribes to activity
- **THEN** the worker uses the full activity subscription and filters locally
