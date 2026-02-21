# Portfolio UI Requirements

## MODIFIED Requirements

### Requirement: Table Columns
The portfolio positions table MUST display clear and precise financial data.

#### Scenario: Viewing Positions
- **Given** a user views the portfolio positions table
- **Then** the table header for the prediction outcome (Yes/No/Up/Down) MUST be labeled "Side"
- **And** the table header for the average entry cost MUST be labeled "Avg. Price"
- **And** the table header for the position size MUST be labeled "Shares"
- **And** the table MUST display a "Total Invested" column showing the cost basis
- **And** the table MUST reflect these changes for both Real and Simulated positions

## ADDED Requirements

### Requirement: Investment Performance Metrics
The system MUST provide percentage-based performance metrics.

#### Scenario: ROI Display
- **Given** a position with a valid Current Price and Avg Price
- **When** the table renders the position row
- **Then** it MUST display the Return on Investment (ROI) as a percentage
- **And** positive ROI MUST be green, negative ROI MUST be red

### Requirement: Potential Return Info
The system MUST show the maximum potential value of the position.

#### Scenario: Max Payout
- **Given** an open position
- **Then** the table MUST display "Max Payout" calculated as `Shares * $1.00`
