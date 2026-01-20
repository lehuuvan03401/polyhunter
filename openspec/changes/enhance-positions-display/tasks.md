# Tasks: Enhance Positions Display

## Phase 1: Fix Critical Bugs
- [x] **1.1** Fix PnL calculation edge cases in `/api/copy-trading/positions`
  - Handle `avgEntryPrice = 0` (return 0% PnL)
  - Handle `curPrice = null` (use avgEntryPrice as fallback)
  - Add validation tests

## Phase 2: Improve Market Display
- [x] **2.1** Fetch market title from `CopyTrade.marketSlug` or external API
  - Fallback to formatted slug if title unavailable
- [x] **2.2** Parse time-based market slugs into human-readable format
  - e.g., `btc-updown-15m-1768895100` → "BTC 15min Up/Down (Jan 20, 3:58 PM)"

## Phase 3: Add Position Status
- [x] **3.1** Add status field to positions API response
  - Determine status based on market resolution state
- [x] **3.2** Display status badge in UI (OPEN, SETTLED_WIN, SETTLED_LOSS)

## Phase 4: UI Enhancements
- [x] **4.1** Add "Est. Value" column (Size × Current Price)
- [x] **4.2** Improve Outcome badges with color coding
- [ ] **4.3** Add quick action button (View Market link)

## Dependencies
- Task 2.1 requires understanding of market slug format
- Task 3.1 requires market resolution data (may need external API)
