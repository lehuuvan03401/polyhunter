## ADDED Requirements

### Requirement: Liquidity and Volume Filters Must Be Enforced
The supervisor SHALL enforce `minLiquidity` and `minVolume` filters using cached market metrics.

#### Scenario: Liquidity filter blocks shallow market
- **GIVEN** a config sets `minLiquidity`
- **AND** side-aware available depth/liquidity is below threshold
- **WHEN** supervisor evaluates `passesFilters`
- **THEN** the trade is skipped with a liquidity filter reason

#### Scenario: Volume filter blocks low-activity market
- **GIVEN** a config sets `minVolume`
- **AND** market volume metric is below threshold
- **WHEN** supervisor evaluates `passesFilters`
- **THEN** the trade is skipped with a volume filter reason

#### Scenario: Required metrics unavailable
- **GIVEN** a config sets `minLiquidity` or `minVolume`
- **AND** required market metrics cannot be resolved
- **WHEN** supervisor evaluates `passesFilters`
- **THEN** the trade is skipped with metrics-unavailable reason
