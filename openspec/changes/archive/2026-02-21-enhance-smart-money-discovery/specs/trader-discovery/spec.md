# trader-discovery Specification Delta

## ADDED Requirements

### Requirement: Dual Data Source Discovery
The Smart Money page SHALL display traders from two distinct discovery sources: "Top Performers" from leaderboard and "Rising Stars" from scientific scoring.

#### Scenario: Default view shows Top Performers
- **WHEN** a user navigates to `/smart-money`
- **THEN** the system SHALL display the "Top Performers" tab as active by default
- **AND** load trader data from the Polymarket leaderboard via SDK

#### Scenario: Switching to Rising Stars tab
- **WHEN** a user clicks the "Rising Stars" tab
- **THEN** the system SHALL fetch data from `/api/traders/active`
- **AND** display traders ranked by scientific score

---

### Requirement: Rising Stars Data Source
The "Rising Stars" section SHALL use the scientific scoring API endpoint to display active traders with risk-adjusted metrics.

#### Scenario: Rising Stars data fetch
- **WHEN** the Rising Stars tab is activated
- **THEN** the system SHALL request `/api/traders/active?limit=20&period=30d`
- **AND** display traders sorted by scientific score descending

#### Scenario: Displaying scientific metrics
- **WHEN** displaying Rising Stars traders
- **THEN** the system SHALL show: Rank, Name, PnL, Profit Factor, Max Drawdown, Win Rate, Score
- **AND** use color coding: green (good), yellow (moderate), red (poor)

---

### Requirement: Consistent Metrics Display
Both data sources SHALL display metrics in a consistent format where available.

#### Scenario: Metrics available
- **GIVEN** a trader has full scientific metrics
- **WHEN** displayed in either tab
- **THEN** the system SHALL show PnL, Profit Factor, Max Drawdown, Win Rate, and Score

#### Scenario: Limited metrics available
- **GIVEN** a trader has only leaderboard data without full scientific metrics
- **WHEN** displayed
- **THEN** the system SHALL show available metrics (PnL, Volume, Score)
- **AND** display "—" or "N/A" for unavailable metrics

---

### Requirement: Tab State Persistence
The system SHALL remember the user's selected tab within a session.

#### Scenario: Tab persistence
- **GIVEN** user is viewing "Rising Stars" tab
- **WHEN** user navigates away and returns to `/smart-money`
- **THEN** the tab state MAY persist based on browser session

---

### Requirement: Independent Loading States
Each tab SHALL manage its own loading and error states independently.

#### Scenario: Tab-specific loading
- **WHEN** user switches tabs
- **THEN** the newly selected tab SHALL show its own loading indicator
- **AND** the previously loaded tab's data SHALL remain cached

#### Scenario: Tab-specific error
- **GIVEN** one data source fails
- **WHEN** user views that tab
- **THEN** the system SHALL display an error message for that tab only
- **AND** the other tab SHALL remain functional
