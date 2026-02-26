## MODIFIED Requirements
### Requirement: Affiliate Commission Rate
The system MUST calculate participation profit fee at a fixed rate of 20% of realized profit for both `FREE` and `MANAGED` participation modes. Fee application scope MUST be explicit to prevent ambiguous overlapping fee paths.

#### Scenario: Fixed 20% fee for participation profit settlement
- **GIVEN** a participation trade realizes $100 profit
- **WHEN** participation profit fee is calculated
- **THEN** fee amount MUST be $20

#### Scenario: Fee-scope isolation
- **GIVEN** request path belongs to participation profit-fee scope
- **WHEN** fee settlement is processed
- **THEN** only the fixed 20% participation profit-fee path is applied
- **AND** conflicting fee routes are not applied to the same realized-profit event
