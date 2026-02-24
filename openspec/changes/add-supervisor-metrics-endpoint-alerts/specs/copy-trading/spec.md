## ADDED Requirements

### Requirement: Supervisor Must Expose Scrapeable Operational Metrics
The supervisor SHALL expose a scrapeable metrics endpoint for operational monitoring.

#### Scenario: Metrics endpoint returns Prometheus payload
- **GIVEN** supervisor process is running
- **WHEN** a client requests the configured `/metrics` endpoint
- **THEN** supervisor returns Prometheus text-format metrics including queue pressure, execution outcomes, reject counters, reconciliation drift, and load-shedding state

#### Scenario: Health endpoint is available
- **GIVEN** supervisor process is running
- **WHEN** a client requests `/health` or `/healthz`
- **THEN** supervisor returns liveness payload containing current load-shedding mode and dispatch state

### Requirement: Supervisor Must Emit Threshold-Based Operational Alerts
The supervisor SHALL emit throttled operational alerts when configured queue/reject thresholds are exceeded.

#### Scenario: Queue pressure alert
- **GIVEN** queue depth or queue lag p95 exceeds configured alert threshold
- **WHEN** alert evaluator runs
- **THEN** supervisor emits warning alert log
- **AND** suppresses repeated alerts until cooldown expires

#### Scenario: Reject-rate alert
- **GIVEN** execution attempts exceed minimum sample size
- **AND** reject rate exceeds configured threshold
- **WHEN** alert evaluator runs
- **THEN** supervisor emits warning alert log

#### Scenario: Critical mode alert
- **GIVEN** load-shedding mode is `CRITICAL`
- **WHEN** alert evaluator runs
- **THEN** supervisor emits warning alert log subject to cooldown
