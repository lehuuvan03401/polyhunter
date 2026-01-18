# Design: Fix Copy Trading Critical Issues

## Architectural Decisions

### 1. Price Fetching Strategy

**Decision**: Use cached OrderBook fetching with 5-second TTL.

**Rationale**: 
- Avoid hammering CLOB API on batch events
- 5 seconds is acceptable staleness for copy trading (not HFT)
- Single fetch shared across all subscribers for same token

**Implementation**:
```typescript
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5000; // 5 seconds

async function getCachedPrice(tokenId: string, side: 'BUY' | 'SELL'): Promise<number> {
    const cached = priceCache.get(tokenId);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
        return cached.price;
    }
    const ob = await masterTradingService.getOrderBook(tokenId);
    const price = side === 'BUY' 
        ? Number(ob.asks[0]?.price || 0.5) 
        : Number(ob.bids[0]?.price || 0.5);
    priceCache.set(tokenId, { price, timestamp: Date.now() });
    return price;
}
```

---

### 2. Debt Integration Point

**Decision**: Log debt immediately after reimbursement failure, before returning.

**Rationale**:
- Minimal code change
- Deferred recovery via existing `DebtManager.recoverPendingDebts()`
- Supervisor can call recovery on startup and periodically

**Location**: `executeOrderWithProxy` after line ~485 where reimbursement is attempted.

---

### 3. Duplicate Prevention Mechanism

**Decision**: Use in-memory TTL Map keyed by `txHash:logIndex`.

**Rationale**:
- Simple, no external dependency
- 60-second TTL covers typical reorg window
- Memory footprint minimal (few KB for active events)

**Implementation**:
```typescript
const processedEvents = new Map<string, number>(); // key -> timestamp
const EVENT_TTL = 60_000; // 60 seconds

function isEventProcessed(txHash: string, logIndex: number): boolean {
    const key = `${txHash}:${logIndex}`;
    const timestamp = processedEvents.get(key);
    if (timestamp && Date.now() - timestamp < EVENT_TTL) {
        return true;
    }
    return false;
}

function markEventProcessed(txHash: string, logIndex: number): void {
    const key = `${txHash}:${logIndex}`;
    processedEvents.set(key, Date.now());
    // Cleanup old entries periodically
}
```

---

### 4. SELL Balance Check

**Decision**: Query CTF contract for actual token balance before SELL.

**Implementation Location**: `executeOrderWithProxy`, before `transferTokensFromProxy`.

```typescript
// Before SELL
const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, signer);
const actualBalance = await ctf.balanceOf(proxyAddress, tokenId);
const actualShares = Number(actualBalance) / 1e6; // Assuming 6 decimals
const sharesToSell = Math.min(amount / price, actualShares);

if (sharesToSell <= 0) {
    return { success: false, error: 'No tokens to sell' };
}
```

---

### 5. Filter Validation Flow

**Decision**: Validate filters in `processJob` before worker checkout.

**Reason**: Avoid wasting worker pool on filtered-out trades.

**Filters to Check**:
| Filter | Data Source | Check |
|--------|-------------|-------|
| `minLiquidity` | OrderBook spread | Skip if total liquidity < threshold |
| `minVolume` | Market API | Skip if 24h volume < threshold |
| `maxOdds` | Current price | Skip if price > threshold |
| `maxDaysOut` | Market end date | Skip if days > threshold |

**Implementation**: Add helper `async function passesFilters(config, tokenId, side): Promise<boolean>`.

---

## File Change Summary

| File | Changes |
|------|---------|
| `copy-trading-supervisor.ts` | +price cache, +event dedup, +filter validation |
| `copy-trading-execution-service.ts` | +debt logging, +balance check |

## Verification Plan

### Automated Tests
1. Unit test: Price cache returns cached value within TTL
2. Unit test: Duplicate event rejected
3. Integration test: Debt record created on reimbursement failure

### Manual Verification
1. Start supervisor, observe price fetching in logs
2. Trigger same event twice, verify second is skipped
3. Simulate insufficient proxy balance, verify debt logged
