# copy-execution Delta

## MODIFIED Requirements

### Requirement: Execution Speed
The system MUST detect and execute copy trades with minimal latency to minimize slippage.

#### Scenario: WebSocket Trigger
- **WHEN** a target trader executes a match on the CLOB
- **THEN** the system MUST detect the `trade` event via WebSocket immediately (sub-second)
- **AND** submit the copy order covering the market difference
- **INSTEAD OF** waiting for the on-chain `TransferSingle` event (multi-second delay)
