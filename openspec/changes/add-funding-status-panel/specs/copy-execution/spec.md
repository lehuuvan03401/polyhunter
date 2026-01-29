## ADDED Requirements

### Requirement: Readiness guardrail telemetry
The system SHALL record readiness-related guardrails (insufficient balance or allowance) for real trading.

#### Scenario: Execution blocked by readiness guardrail
- **WHEN** execution is blocked due to missing funds or approvals
- **THEN** the system logs the guardrail reason and exposes it for operator review
