## MODIFIED Requirements
### Requirement: Price Fetching
The system SHALL fetch real-time market prices before calculating order sizes. Price data SHALL be cached with a maximum TTL of 5 seconds to reduce API load. The worker SHALL deduplicate in-flight quote requests per token and side to avoid redundant orderbook fetches.

#### Scenario: Fetching price for BUY order
- GIVEN a TransferSingle event is detected for a monitored trader buying token X
- WHEN the Supervisor dispatches jobs to subscribers
- THEN the system fetches the current ask price from the OrderBook before calculating position size
- AND the fetched price is used instead of hardcoded default

#### Scenario: Price caching within TTL
- GIVEN a price was fetched for token X at time T
- WHEN another event for token X occurs at time T+3s
- THEN the cached price is returned without making a new API call

#### Scenario: In-flight quote deduplication
- GIVEN two trade signals for the same token X and side arrive concurrently
- WHEN the worker requests a price quote
- THEN the second request reuses the in-flight quote promise
- AND only one orderbook fetch is performed
