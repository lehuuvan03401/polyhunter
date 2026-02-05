## ADDED Requirements
### Requirement: Forced Fallback Pricing
The copy-trading worker SHALL support a configuration flag to force fallback pricing and skip orderbook quotes for verification.

#### Scenario: Forced fallback enabled
- **GIVEN** forced fallback pricing is enabled
- **WHEN** the worker evaluates a trade price
- **THEN** the worker skips orderbook quotes and uses fallback pricing
- **AND** logs that fallback mode is forced

#### Scenario: Forced fallback disabled (default)
- **GIVEN** forced fallback pricing is disabled
- **WHEN** the worker evaluates a trade price
- **THEN** the worker attempts to fetch orderbook quotes before using fallback
