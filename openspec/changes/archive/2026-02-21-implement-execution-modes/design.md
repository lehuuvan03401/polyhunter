# Design: Security vs Speed Execution Modes

## Architecture Changes

### Data Model
New `StartupMode` enum in `ActiveConfig`:
- `PROXY` (Existing)
- `EOA` (New)

### Execution Flow
The `CopyTradingExecutionService` will branch based on `mode`:

#### 1. PROXY Mode (Existing)
- **Pre-Trade**: `transferFromProxy` (On-Chain) -> Wait for Tx.
- **Trade**: `executeOrder` (CLOB) using Worker Signer.
- **Post-Trade**: `transferToProxy` (On-Chain) -> Wait for Tx.

#### 2. EOA Mode (New)
- **Pre-Trade**: None (Funds assumed in EOA).
- **Trade**: `executeOrder` (CLOB) using **User EOA Signer**.
- **Post-Trade**: None.

### Key Management
- **Security Mode**: User connects Frontend Wallet (Owner) -> Authorizes Proxy -> Supervisor uses system `Worker` keys.
- **Speed Mode**: User enters Private Key in Frontend -> Saved to DB (Encrypted) -> Supervisor decrypts and instantiates `ethers.Wallet`.

> [!SECURITY NOTE]
> For this MVC, we will store the Private Key in the (local) database or `.env`. In a production SaaS, this requires a KMS (Key Management System). We will implement basic encryption (AES) for the stored key to prevent plain-text exposure in the DB.

### Frontend UI
- **Trading Dashboard**: Toggle Switch [🛡️ Security] <-> [⚡ Speed].
- **Setup Flow**:
  - If Security: Show "Deploy Proxy" / "Authorize".
  - If Speed: Show "Input Trading Private Key" (Masked Input) + Warning ("Use a sub-account!").

