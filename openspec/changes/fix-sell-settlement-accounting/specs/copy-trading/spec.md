## ADDED Requirements

### Requirement: SELL Settlement Uses Fill Notional
The system SHALL settle successful SELL copy trades using actual filled notional derived from execution records, not pre-trade approximation.

#### Scenario: SELL settlement transfer amount
- **GIVEN** a SELL copy trade executes successfully
- **WHEN** settlement transfers USDC back to proxy
- **THEN** the transfer amount equals the order's filled notional
- **AND** fallback approximation is used only when fill details are unavailable

#### Scenario: Persisted SELL accounting reflects fill
- **GIVEN** a SELL copy trade executes successfully with available fill details
- **WHEN** trade records are persisted
- **THEN** stored SELL notional and filled-share accounting are derived from fill-aware execution result
