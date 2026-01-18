# Immediate Auto Copy Trading (Supervisor Edition)

> [!IMPORTANT]
> **Status**: Feature Implemented & Verified (2026-01)  
> **Core Script**: `frontend/scripts/copy-trading-supervisor.ts`  
> **Architecture**: Parallel Wallet Fleet (Nonce-Free Execution)

## Overview

To support massive concurrency (1000+ users), we have upgraded from a single-worker model to a **Supervisor Model**.

- **Wallet Fleet**: 20+ "Operator Wallets" derived from `TRADING_MNEMONIC`
- **Parallel Execution**: Each user gets a unique Operator Wallet (no nonce blocking)
- **High Performance**: Zero-latency RPC Listener + In-memory job dispatch

## Configuration

```env
# Master Mnemonic for the Wallet Fleet
TRADING_MNEMONIC="your twelve word phrase here ..."
```

## How to Run (Production)

```bash
cd poly-hunter/frontend
export $(grep -v '^#' .env | xargs) && npx tsx scripts/copy-trading-supervisor.ts
```

> [!TIP]
> **Daemon Mode**: `pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor`

## Architecture Components

| Component | Responsibility |
|-----------|----------------|
| **Detector** | Listens to Blockchain for `TransferSingle` events |
| **WalletManager** | Manages "Checkout/Checkin" of Operator Wallets |
| **Dispatcher** | Matches Signal → Subscribers and creates Jobs |
| **ExecutionService** | Executes the trade using the assigned Operator Wallet |
| **DebtManager** | Recovers failed reimbursements |

## New Features (2026-01 Update)

| Feature | Description |
|---------|-------------|
| **Price Caching** | 5-second TTL cache for OrderBook prices |
| **Event Deduplication** | 60-second TTL prevents double execution |
| **Filter Validation** | Validates maxOdds before execution |
| **SELL Balance Check** | Verifies actual token balance before selling |
| **Startup Debt Recovery** | Recovers pending debts on startup |
| **Periodic Debt Recovery** | Recovers debts every 2 minutes |

## Startup Log Example

```
[Supervisor] 🩺 Checking for pending debts from previous sessions...
[WalletManager] Initializing fleet of 20 wallets...
[WalletManager] Loaded Worker #0: 0xf39F...
[WalletManager] Loaded Worker #1: 0x7099...
[Supervisor] Refreshed: 5 strategies. Fleet: 20/20 ready.
[Supervisor] 🎧 Listening for TransferSingle events...
```

## Enterprise Architecture

### 1. Wallet Fleet & Supervisor
**Status**: ✅ **Production Ready**

- `WalletManager` maintains pool of 20 isolated `ethers.Wallet` instances
- `Supervisor` dispatches jobs to free workers
- **Auto-Refuel**: Tops up workers when balance < 0.1 MATIC

### 2. Mempool Sniping (Alpha Layer)
**Status**: ⚠️ **Experimental**

- Requires **WebSocket (WSS)** provider or private node
- Standard HTTP Polling is too slow for true sniping
