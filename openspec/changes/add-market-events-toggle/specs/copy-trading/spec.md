## ADDED Requirements
### Requirement: Market Lifecycle Subscription Toggle
The copy-trading worker SHALL support disabling market lifecycle (clob_market) subscriptions via configuration for environments where these topics are unavailable.

#### Scenario: Market events disabled
- **GIVEN** market lifecycle subscriptions are disabled in configuration
- **WHEN** the worker starts
- **THEN** the worker skips market event subscriptions and logs that market events are disabled

#### Scenario: Market events enabled
- **GIVEN** market lifecycle subscriptions are enabled (default)
- **WHEN** the worker starts
- **THEN** the worker subscribes to market lifecycle events and logs that market events are enabled
