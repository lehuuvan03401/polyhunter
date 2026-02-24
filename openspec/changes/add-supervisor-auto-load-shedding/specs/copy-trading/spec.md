## ADDED Requirements

### Requirement: Supervisor Must Auto-Shed Load Under Queue Pressure
The supervisor SHALL automatically reduce execution pressure when queue depth or queue lag p95 exceeds configured thresholds.

#### Scenario: Enter degraded mode on warning threshold
- **GIVEN** queue depth or queue lag p95 exceeds warning threshold
- **WHEN** load-shedding evaluator runs
- **THEN** supervisor enters `DEGRADED` mode
- **AND** dispatch fanout concurrency is reduced from normal mode

#### Scenario: Enter critical mode on critical threshold
- **GIVEN** queue depth or queue lag p95 exceeds critical threshold
- **WHEN** load-shedding evaluator runs
- **THEN** supervisor enters `CRITICAL` mode
- **AND** dispatch fanout concurrency is reduced to critical limit
- **AND** mempool dispatch is paused

#### Scenario: Recover to normal mode after stable healthy windows
- **GIVEN** supervisor is in `DEGRADED` or `CRITICAL` mode
- **AND** queue metrics return below warning thresholds for required recovery windows
- **WHEN** load-shedding evaluator runs
- **THEN** supervisor transitions back to `NORMAL` mode

#### Scenario: Mempool callback uses execution handler
- **GIVEN** mempool detector emits a decoded transfer signal
- **WHEN** callback is invoked
- **THEN** supervisor routes signal into mempool execution handler
- **AND** load-shedding mempool pause guard is enforced before dispatch
