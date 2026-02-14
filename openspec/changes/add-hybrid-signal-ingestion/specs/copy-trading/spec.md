## ADDED Requirements

### Requirement: Configurable Signal Ingestion Mode
The system SHALL support configurable signal ingestion mode via `COPY_TRADING_SIGNAL_MODE` with allowed values `WS_ONLY`, `POLLING_ONLY`, and `HYBRID`.

#### Scenario: Polling-only mode
- **GIVEN** `COPY_TRADING_SIGNAL_MODE=POLLING_ONLY`
- **WHEN** the supervisor starts
- **THEN** it ingests trade signals exclusively from polling
- **AND** it does not require an active WebSocket activity stream

#### Scenario: Hybrid mode
- **GIVEN** `COPY_TRADING_SIGNAL_MODE=HYBRID`
- **WHEN** both WS and polling detect the same trade
- **THEN** the event is processed exactly once by shared dedup logic

### Requirement: Polling-based Signal Ingestion
The system SHALL provide polling-based signal ingestion using incremental cursor/watermark semantics.

#### Scenario: Incremental poll fetch
- **GIVEN** the last processed cursor at time `T0`
- **WHEN** the next polling cycle runs
- **THEN** only events newer than `T0` are fetched
- **AND** the cursor is advanced after successful processing

### Requirement: Automatic Source Degrade
In `HYBRID` mode, the system SHALL continue processing with polling source when WebSocket source becomes unhealthy.

#### Scenario: WebSocket outage fallback
- **GIVEN** WebSocket source has no successful events within the unhealthy threshold
- **WHEN** polling source remains healthy
- **THEN** copy-trading signal processing continues through polling
- **AND** a source-degrade metric/log is emitted

## MODIFIED Requirements

### Requirement: Event Deduplication
The system SHALL track processed blockchain events using a channel-agnostic dedup key. The key MUST include `txHash + logIndex` when available and MUST prevent duplicate execution across WebSocket and polling channels.

#### Scenario: Cross-channel dedup
- **GIVEN** a trade event is processed from WebSocket
- **WHEN** the same event arrives from polling within dedup TTL
- **THEN** the system skips re-processing
- **AND** records a dedup-hit metric for cross-channel duplicate
