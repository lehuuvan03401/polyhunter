# trader-scoring Specification Delta

## ADDED Requirements

### Requirement: Scientific Trader Score Calculation
The system SHALL calculate a comprehensive trader score using weighted multi-factor analysis that includes risk-adjusted returns, profitability metrics, and copy-friendliness assessment.

#### Scenario: Score calculation with full data
- **WHEN** a trader has at least 10 closed trades in the past 30 days
- **THEN** the system SHALL calculate all six scoring factors
- **AND** combine them using the defined weights (Risk-Adjusted: 25%, Profit Factor: 20%, Max Drawdown: 15%, Win Rate: 15%, Activity: 10%, Copy-Friendliness: 15%)
- **AND** return a score between 0 and 100

#### Scenario: Score calculation with insufficient data
- **WHEN** a trader has fewer than 10 closed trades in the past 30 days
- **THEN** the system SHALL calculate a simplified score using only available metrics
- **AND** mark the score as "limited data" in the response

---

### Requirement: Profit Factor Calculation
The system SHALL calculate Profit Factor as the ratio of total gross profits to total gross losses from closed positions.

#### Scenario: Profitable trader
- **WHEN** a trader has total gross profits of $10,000 and total gross losses of $4,000
- **THEN** the Profit Factor SHALL be 2.5

#### Scenario: Break-even trader
- **WHEN** a trader has total gross profits of $5,000 and total gross losses of $5,000
- **THEN** the Profit Factor SHALL be 1.0

#### Scenario: No losses
- **WHEN** a trader has total gross profits of $1,000 and total gross losses of $0
- **THEN** the Profit Factor SHALL be capped at 10.0 (or marked as "infinite")

---

### Requirement: Volume-Weighted Win Rate
The system SHALL calculate win rate by weighting each trade by its USD value, not by simple count.

#### Scenario: Large winning trade
- **GIVEN** a trader has two trades:
  - Trade A: $10,000 position, +$500 profit
  - Trade B: $100 position, -$10 loss
- **WHEN** calculating volume-weighted win rate
- **THEN** the result SHALL be approximately 99% (10000/10100)

#### Scenario: Many small losses, few big wins
- **GIVEN** a trader has:
  - 10 trades of $100 each, all losing ($1,000 total, all loss)
  - 1 trade of $5,000, winning
- **WHEN** calculating volume-weighted win rate
- **THEN** the result SHALL be approximately 83% (5000/6000)

---

### Requirement: Maximum Drawdown Calculation
The system SHALL calculate the maximum peak-to-trough decline in the trader's equity curve over the evaluation period.

#### Scenario: Drawdown during recovery
- **GIVEN** a trader's equity curve: $10,000 → $12,000 → $9,000 → $11,000
- **WHEN** calculating max drawdown
- **THEN** the result SHALL be 25% (drop from $12,000 to $9,000)

#### Scenario: No drawdown
- **GIVEN** a trader's equity has only increased
- **WHEN** calculating max drawdown
- **THEN** the result SHALL be 0%

---

### Requirement: Risk-Adjusted Return (Sharpe-like Ratio)
The system SHALL calculate a Sharpe-like ratio using daily returns divided by the standard deviation of daily returns.

#### Scenario: Consistent returns
- **GIVEN** a trader has daily returns of [1%, 1%, 1%, 1%, 1%]
- **WHEN** calculating risk-adjusted return
- **THEN** the ratio SHALL be very high (low volatility with positive returns)

#### Scenario: Volatile returns
- **GIVEN** a trader has daily returns of [10%, -8%, 15%, -12%, 5%]
- **WHEN** calculating risk-adjusted return
- **THEN** the ratio SHALL be lower despite positive average (high volatility)

---

### Requirement: Copy-Friendliness Score
The system SHALL evaluate how suitable a trader is for copy trading based on order characteristics.

#### Scenario: Copy-friendly trader
- **WHEN** a trader typically places orders under $5,000
- **AND** orders are spread across multiple markets
- **AND** execution is not clustered (>5 minutes between orders typically)
- **THEN** the copy-friendliness score SHALL be high (>70)

#### Scenario: Difficult-to-copy trader
- **WHEN** a trader places orders over $50,000 frequently
- **AND** orders are concentrated in low-liquidity markets
- **AND** execution is rapid (<1 minute between consecutive orders)
- **THEN** the copy-friendliness score SHALL be low (<40)

---

### Requirement: Trader Leaderboard Display
The system SHALL display the new scientific metrics on both the homepage leaderboard and the Smart Money page.

#### Scenario: Full metrics display
- **WHEN** a user views the trader leaderboard
- **THEN** the system SHALL display:
  - Overall Score (0-100)
  - Profit Factor  
  - Max Drawdown percentage
  - Win Rate percentage
- **AND** provide tooltips explaining each metric

#### Scenario: Sorting by metric
- **WHEN** a user clicks on a metric column header
- **THEN** the leaderboard SHALL sort by that metric in descending order

---

### Requirement: Score Caching
The system SHALL cache computed scores to maintain performance.

#### Scenario: Cache hit
- **WHEN** a score was computed within the last 5 minutes
- **AND** a new request is made for the same trader
- **THEN** the cached score SHALL be returned

#### Scenario: Cache miss
- **WHEN** no cached score exists or cache is expired
- **THEN** the system SHALL compute the score fresh
- **AND** store it in cache for 5 minutes
