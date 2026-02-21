## ADDED Requirements
### Requirement: Trade Size Normalization
The system SHALL interpret incoming trade size using an explicit mode (`SHARES` or `NOTIONAL`) and normalize each trade into both share size and notional value before applying copy sizing rules.

#### Scenario: SHARES sizing
- **GIVEN** a copy-trading config with tradeSizeMode set to `SHARES`
- **WHEN** a trade is detected with size S and price P
- **THEN** the system treats S as shares
- **AND** the normalized notional value is S * P

#### Scenario: NOTIONAL sizing
- **GIVEN** a copy-trading config with tradeSizeMode set to `NOTIONAL`
- **WHEN** a trade is detected with size N and price P
- **THEN** the system treats N as notional USDC
- **AND** the normalized share size is N / P
