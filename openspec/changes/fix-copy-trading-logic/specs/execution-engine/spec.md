# Execution Engine Updates

## ADDED Requirements

### Requirement: EOA Preflight and Guardrails
The worker **MUST** apply execution guardrails for EOA-mode trades without requiring proxy resolution.

#### Scenario: EOA preflight uses wallet checks
Given a user configuration with `executionMode: 'EOA'`
When a copy trade signal is detected
Then the worker must verify the user's wallet balance and allowance
And must apply price freshness and slippage guardrails
And must not require a proxy address to proceed

### Requirement: Proxy Mode API Credentials
The worker **MUST** use user-provided CLOB API credentials for proxy-mode execution when available.

#### Scenario: Proxy mode with user credentials
Given a user configuration with `executionMode: 'PROXY'` and API credentials present
When a copy trade signal is detected
Then the worker must initialize the CLOB client with the user's credentials
And must apply a rate limiter scoped to those credentials

### Requirement: Global Circuit Breaker
The worker **MUST** enforce a global order cap independent of per-user limiters.

#### Scenario: Global cap triggered
Given the global order cap is exceeded
When a copy trade execution is attempted
Then the worker must skip execution with a global rate-limit reason
And must not consume per-user limiter capacity

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
