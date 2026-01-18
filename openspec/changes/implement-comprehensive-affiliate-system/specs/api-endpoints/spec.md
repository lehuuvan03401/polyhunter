# Spec: API Endpoints

## ADDED Requirements

### Requirement: Team Visualization
The API MUST expose hierarchy data.

#### Scenario: Get Team Tree
`GET /api/affiliate/team` SHALL return a nested or flattened list of descendants, including:
- `depth` relative to requester.
- `volume` stats.
- `isSunLine` status.

### Requirement: Commission Analytics
The API MUST provide detailed breakdown of earnings.

#### Scenario: Earning History
`GET /api/affiliate/commissions` SHALL differentiate between:
- `TYPE_ZERO_LINE` (Direct)
- `TYPE_SUN_LINE` (Differential)
- `TYPE_RANKING` (Bonus)
