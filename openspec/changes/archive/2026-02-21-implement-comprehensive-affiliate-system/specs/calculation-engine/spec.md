# Spec: Calculation Engine

## ADDED Requirements

### Requirement: Zero Line Commission
The engine MUST calculate commissions for the direct upline (Zero Line).

#### Scenario: 5-Generation Payout
Upon strict profit recognition (Platform Fee), the engine SHALL pay:
- Gen 1: 25%
- Gen 2: 10%
- Gen 3: 5%
- Gen 4: 3%
- Gen 5: 2%
Validation: `depth > 0 AND depth <= 5` in `TeamClosure`.

### Requirement: Sun Line Differential
The engine MUST calculate team differential bonuses.

#### Scenario: Sun Line Identification
A member SHALL be flagged as `isSunLineLeader` if:
- Team Size >= 50 OR
- Team Volume >= $100,000 OR
- Rank >= ELITE

#### Scenario: Differential Logic
The engine SHALL calculate the reward as `(UplineBonusRate - DownlineBonusRate) * Volume`.
It MUST traverse up from the trade source until rates are exhausted or a cap is hit.
