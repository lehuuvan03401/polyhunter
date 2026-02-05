# Execution Engine Updates

## MODIFIED Requirements

### Requirement: Execution Mode Support
The worker **MUST** dynamically select the execution strategy based on the users configuration.

#### Scenario: EOA Mode Execution
Given a user configuration with `executionMode: 'EOA'` and valid encrypted credentials
When a copy trade signal is detected
Then the worker must decrypt the user's private key within secure memory
And initialize a `TradingService` instance using this key
And execute the trade directly against the CLOB (bypassing Proxy)

#### Scenario: Proxy Mode Execution
Given a user configuration with `executionMode: 'PROXY'` (or default)
When a copy trade signal is detected
Then the worker must use the existing Fleet Wallet service
And execute the trade via the `Proxy` contract

### Requirement: Multi-Tenant Rate Limiting
The worker **MUST** respect API rate limits on a per-user basis when possible.

#### Scenario: Per-User API Client
Given a user configuration with custom API credentials
Then the `TradingService` created for that user must use their specific API Key/Secret
And the rate limiter for that user must be independent of the global rate limiter
