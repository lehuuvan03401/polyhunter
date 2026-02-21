## MODIFIED Requirements
### Requirement: Price Fetching
The system SHALL fetch real-time market prices before calculating order sizes. Price data SHALL be cached with a maximum TTL of 5 seconds to reduce API load. If orderbook data is unavailable, the system SHALL use a fallback price source (e.g., Gamma or recent trade price) provided the fallback quote meets the same TTL and slippage validation rules. The selected price source SHALL be logged for observability.

#### Scenario: Fetching price for BUY order
- GIVEN a TransferSingle event is detected for a monitored trader buying token X
- WHEN the Supervisor dispatches jobs to subscribers
- THEN the system fetches the current ask price from the OrderBook before calculating position size
- AND the fetched price is used instead of hardcoded default

#### Scenario: Price caching within TTL
- GIVEN a price was fetched for token X at time T
- WHEN another event for token X occurs at time T+3s
- THEN the cached price is returned without making a new API call

#### Scenario: Fallback quote used when orderbook unavailable
- GIVEN the orderbook for token X is unavailable
- WHEN a trade execution is prepared
- THEN the system uses a fallback quote source that is within TTL and passes slippage checks
- AND logs the fallback source
