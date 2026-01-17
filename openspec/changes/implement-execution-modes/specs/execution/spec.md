# Spec: Execution Engine Modes

## ADDED Requirements

### Requirement: Backend Support for Execution Modes
- **REQ-EXEC-001**: The system MUST support two execution modes: `PROXY` (non-custodial) and `EOA` (custodial/hosted).
    - `PROXY`: Use the existing `transferFromProxy` -> `executeOrder` -> `transferToProxy` flow.
    - `EOA`: Skip all Proxy interactions. Use the User's EOA signer directly for `executeOrder`.

#### Scenario 1: Setup EOA Mode
- **Given** a user configuration with `mode = 'EOA'` and a valid `encryptedKey`.
- **When** the Supervisor processes a signal.
- **Then** it MUST decrypt the key, instantiate a `Wallet` signer, and execute the order directly on the CLOB without calling `executeOnProxy`.

#### Scenario 2: Setup PROXY Mode (Regression)
- **Given** a user configuration with `mode = 'PROXY'` (or default).
- **When** the Supervisor processes a signal.
- **Then** it MUST proceed with the existing Proxy workflow (Borrow Worker -> Execute on Proxy).

### Requirement: Secure Key Storage
- **REQ-EXEC-002**: Private keys for `EOA` mode MUST be stored encrypted in the database.
    - Use a symmetric encryption algorithm (e.g., AES-256-CBC).
    - The encryption key should be sourced from an environment variable (`ENCRYPTION_KEY`).

#### Scenario: Key Encryption
- **Given** the frontend sends a raw private key.
- **When** the backend saves it to `CopyTradeConfig`.
- **Then** it MUST be encrypted before persistence.

## MODIFIED Requirements

### Requirement: Update Config Schema
- **REQ-DATA-001**: `CopyTradeConfig` model MUST have new fields.
    - **Add**: `mode` (String/Enum: "PROXY", "EOA"), default "PROXY".
    - **Add**: `encryptedKey` (String), nullable.
    - **Add**: `iv` (String), nullable (Initialization Vector for encryption).

#### Scenario: Default Mode
- **Given** a legacy configuration without a `mode`
- **When** it is read by the system
- **Then** it MUST default to `PROXY` mode.
