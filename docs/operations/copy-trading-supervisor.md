# Immediate Auto Copy Trading (Supervisor Edition)

> [!IMPORTANT]
> **Status**: Feature Implemented & Verified
> **Core Script**: `scripts/copy-trading-supervisor.ts`
> **Architecture**: Parallel Wallet Fleet (Nonce-Free Execution)

## Overview
To support massive concurrency (1000+ users), we have upgraded from a single-worker model to a **Supervisor Model**.
- **Wallet Fleet**: The system derives a pool of 20+ "Operator Wallets" from a single `TRADING_MNEMONIC`.
- **Parallel Execution**: When a trade signal is detected, the Supervisor assigns a unique Operator Wallet to each user's execution job. This prevents nonce blocking (where User B waits for User A's transaction to confirm).
- **High Performance**: 
    - **Detector**: Zero-latency RPC Listener.
    - **Dispatcher**: In-memory optimized job dispatch.

## Configuration

**New Environment Variable**:
You must set `TRADING_MNEMONIC` in your `.env` file to enable the Wallet Fleet.

```env
# Master Mnemonic for the Wallet Fleet
TRADING_MNEMONIC="your twelve word phrase here ..."
```

## How to Run (Production)

This script manages the entire copy trading operation.

```bash
# Navigate to frontend/
cd poly-hunter/frontend

# Run with environment variables loaded
export $(grep -v '^#' .env | xargs) && npx tsx scripts/copy-trading-supervisor.ts
```

> [!TIP]
> **Daemon Mode**:
> `pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor`

## Architecture Components

| Component | Responsibility |
|---|---|
|**Detector**|Listens to Blockchain for `TransferSingle` events.|
|**WalletManager**|Manages "Checkout/Checkin" of Operator Wallets.|
|**Dispatcher**|Matches Signal -> Subscribers and creates Jobs.|
|**ExecutionService**|Executes the trade using the assigned Operator Wallet.|

## Verification Evidence
Supervisor startup log (Dry Run):
```
[WalletManager] Initializing fleet of 20 wallets...
[WalletManager] Loaded Worker #0: 0xf39F...
[WalletManager] Loaded Worker #1: 0x7099...
...
[Supervisor] Refreshed: 0 strategies. Fleet: 20/20 ready.
[Supervisor] 🎧 Listening for TransferSingle events...
```
*(The fleet is initialized and ready for massively parallel execution)*
