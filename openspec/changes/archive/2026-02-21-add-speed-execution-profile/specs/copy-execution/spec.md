## ADDED Requirements
### Requirement: Speed execution profile
The system SHALL support a speed execution profile that defines RPC/mempool settings and execution guardrails (slippage, spread, depth).

#### Scenario: Loading speed profile defaults
- **GIVEN** a speed profile config is present
- **WHEN** the execution worker starts
- **THEN** it loads the profile and applies the defined slippage and liquidity guardrails

### Requirement: Orderbook spread and depth guardrails
The system SHALL validate orderbook spread and minimum depth before executing a copy trade.

#### Scenario: Skip execution on thin liquidity
- **GIVEN** an orderbook with insufficient depth for the requested size
- **WHEN** a copy trade is about to execute
- **THEN** the trade is skipped and logged with a guardrail reason

#### Scenario: Skip execution on wide spread
- **GIVEN** an orderbook with a spread wider than the configured threshold
- **WHEN** a copy trade is about to execute
- **THEN** the trade is skipped and logged with a guardrail reason
