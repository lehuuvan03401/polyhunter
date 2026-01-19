# affiliate-landing-ui Specification (Delta)

## ADDED Requirements

### Requirement: Affiliate Landing Page for Non-Members
The system SHALL display a comprehensive landing page explaining the affiliate program when a user visits `/affiliate` without being registered.

#### Scenario: Viewing landing page as non-member
- **GIVEN** a user visits `/affiliate`
- **AND** they are not registered as an affiliate
- **WHEN** the page loads
- **THEN** the system SHALL display:
  - Hero section with value proposition
  - Benefits grid highlighting key features
  - How-it-works section with steps
  - Tier comparison table
  - Zero Line rate breakdown
  - Call-to-action button to register

#### Scenario: Registration from landing page
- **GIVEN** a user is viewing the landing page
- **WHEN** they click "Become an Affiliate"
- **THEN** the system SHALL initiate the registration flow
- **AND** display the full dashboard upon successful registration

#### Scenario: Non-authenticated user
- **GIVEN** a user visits `/affiliate` without being logged in
- **WHEN** the page loads
- **THEN** the system SHALL display the same landing page content
- **AND** the CTA button SHALL prompt wallet connection first
