# Task Plan: Verify Fix Copy Trading Logic (EOA/Proxy)
<!--
  WHAT: Verify fix-copy-trading-logic execution paths for EOA and Proxy modes.
  WHY: Ensure real execution paths behave correctly before Phase 5 real-funds testing.
-->

## Goal
Run verification for EOA and Proxy execution paths, capture evidence/logs, and update OpenSpec verification/tasks accordingly.

## Current Phase
Phase 4: Delivery

## Phases

### Phase 1: Discovery
- [x] Read relevant OpenSpec change + specs
- [x] Identify required env/config/DB setup for EOA + Proxy verification
- [x] Confirm current execution flow and logs in worker/service
- **Status:** complete

### Phase 2: Setup
- [x] Prepare local verification harness for EOA execution mode (encrypted key + iv in-script)
- [x] Prepare local verification harness for Proxy execution mode (mock token bypass)
- [x] Select local mock token + env to avoid mainnet dependencies
- **Status:** complete

### Phase 3: Validation
- [x] Run execution path verification script (EOA + Proxy)
- [x] Capture logs + update verification docs
- **Status:** complete

### Phase 4: Delivery
- [x] Update `openspec/changes/fix-copy-trading-logic/verification.md`
- [x] Update tasks checklist if needed
- **Status:** complete

## Key Questions
1. Which trader address(s) to use for EOA/Proxy verification?
2. Should we use live WS activity or seed trades for deterministic verification?
3. Are we verifying on mainnet RPC or local fork?

## Decisions Made
| Decision | Rationale |
|---|---|
|  |  |

## Errors Encountered
| Error | Attempt | Resolution |
|---|---|---|
| session-catchup failed (/scripts/session-catchup.py not found) | 4 | Proceeded without catchup; updated plan manually |
