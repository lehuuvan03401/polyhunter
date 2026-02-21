# Duration Display Spec

## MODIFIED Requirements

### Requirement: strategy-history-details
The user MUST be able to see the lifespan of their past strategies.

#### Scenario: Viewing Stopped Strategies
Given a user is viewing the "Stopped" strategies tab
When they look at a card
Then the UI MUST display the date the strategy was stopped
AND the total duration the strategy was active (e.g., "10h 30m").
