# Team Network UI Spec Delta

## MODIFIED Requirements

### Requirement: Team Network Display
The Affiliate Dashboard MUST display team network information in a hierarchical format that clearly shows generation relationships.

#### Scenario: User views team network summary
**Given** a user with 50 team members across 3 generations
**When** they view the Team Network Structure section
**Then** they MUST see a generation breakdown showing:
  - Generation 1: 5 members (direct referrals)
  - Generation 2: 15 members
  - Generation 3: 30 members
  - Total: 50 members

#### Scenario: User expands direct referral details
**Given** a user viewing the Team Network Structure
**When** they click on a direct referral entry
**Then** the entry MUST expand to show:
  - All sub-referrals under that direct referral
  - Each sub-referral's tier, volume, and team size
  - Nested entries for deeper generations (collapsible)

#### Scenario: User toggles between summary and tree view
**Given** a user viewing the Team Network Structure
**When** they click the view toggle
**Then** the display MUST switch between:
  - Summary View: Generation breakdown bar + direct referral cards
  - Tree View: Full expandable tree with all generations visible

---

## ADDED Requirements

### Requirement: Team Summary API
The backend MUST provide an endpoint to retrieve aggregated team statistics by generation.

#### Scenario: Fetch generation breakdown
**Given** an authenticated affiliate
**When** they request `GET /api/affiliate/team/summary`
**Then** the response MUST include:
  - `total`: Total team member count
  - `byGeneration`: Array of `{ generation: number, count: number }`

### Requirement: Tree-structured Team Data
The backend MUST support returning team data in a nested tree format.

#### Scenario: Fetch team as tree
**Given** an authenticated affiliate
**When** they request `GET /api/affiliate/team?format=tree`
**Then** the response MUST include:
  - `directReferrals`: Array of direct referral objects
  - Each referral object MUST have `children` array for sub-referrals
  - Tree depth MUST be limited to 5 levels for performance
