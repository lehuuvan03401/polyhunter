# affiliate-rules-ui Specification (Delta)

## ADDED Requirements

### Requirement: Affiliate Rules Documentation Page
The system SHALL provide a dedicated page explaining the affiliate program rules, commission structure, and tier requirements.

#### Scenario: Accessing rules page from dashboard
- **GIVEN** a user is on the affiliate dashboard
- **WHEN** they click the "Learn More" or help icon
- **THEN** they are navigated to `/affiliate/rules`
- **AND** the page displays comprehensive program documentation

#### Scenario: Tier comparison display
- **GIVEN** the user is on the rules page
- **THEN** the system SHALL display a comparison table with all 5 tiers
- **AND** show requirements (Direct Referrals, Team Size) for each tier
- **AND** show benefits (Zero Line %, Team Diff %) for each tier
- **AND** highlight the user's current tier

#### Scenario: Commission calculation explanation
- **GIVEN** the user is on the rules page
- **THEN** the system SHALL display Zero Line generation percentages (Gen 1: 25%, Gen 2: 10%, Gen 3: 5%, Gen 4: 3%, Gen 5: 2%)
- **AND** explain Sun Line (Team Differential) calculation with examples

#### Scenario: Visual commission flow
- **GIVEN** the user is on the rules page
- **THEN** the system SHALL display a visual diagram showing how commissions flow through the team hierarchy
