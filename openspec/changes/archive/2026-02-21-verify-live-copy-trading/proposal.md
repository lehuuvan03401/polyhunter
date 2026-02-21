# Change: Verify Live Copy Trading with Real Mainnet Trader

## Why
The current copy trading verification relies on local simulation (`impersonate-mainnet-trade.ts`) which cannot reflect real production behavior. To validate the system works correctly in production, we need to verify against a real, active trader on Polygon mainnet.

Target trader: `0x63ce342161250d705dc0b16df89036c8e5f9ba9a` ([@0x8dxd](https://polymarket.com/@0x8dxd))
- Total PnL: +$741K
- Volume: $63.8M
- Win Rate: 91%
- Trades frequently (multiple trades per minute)

## What Changes

### 1. Create Live Verification Script
- New script `scripts/verify-live-copy-trading.ts` that:
  - Connects to Polygon mainnet (read-only mode)
  - Monitors target trader's real-time trades via WebSocket
  - Seeds a test config to copy the target trader
  - Verifies signal detection latency (<500ms)
  - Logs trade details without executing (dry-run mode)

### 2. Add DRY_RUN Mode to Supervisor
- Add `DRY_RUN` environment variable support
- When enabled, logs all execution decisions without placing orders
- Allows validation of detection + dispatch logic without risking funds

### 3. Fix/Improve Issues Discovered During Verification
- Any bugs found during live testing will be documented and fixed

## Impact
- Affected specs: `copy-trading`
- Affected code: 
  - `web/scripts/` (new verification script)
  - `web/scripts/copy-trading-supervisor.ts` (dry-run mode)
  - `src/services/realtime-service-v2.ts` (possible fixes)
