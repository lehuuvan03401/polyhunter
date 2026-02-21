# Spec: Configuration Switch

This spec defines how the user controls the provider strategy.

## ADDED Requirements

### Requirement: Configuration Logic
The system SHALL support new variables in `.env`:
- `MEMPOOL_PROVIDER`: Enum `STANDARD` | `ALCHEMY`. Default `STANDARD`.
- `NEXT_PUBLIC_ALCHEMY_API_KEY`: API Key for Alchemy.

#### Scenario: Runtime Switching
The `MempoolManager` reads these values at instantiation time. Changing the mode requires a restart of the Supervisor.
