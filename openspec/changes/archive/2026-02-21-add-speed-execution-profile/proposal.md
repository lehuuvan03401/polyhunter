# Change: Add speed execution profile and orderbook depth guardrails

## Why
To validate real copy‑trading quickly while keeping execution safe, we need a reproducible “speed mode” configuration and guardrails that prevent executing into thin liquidity or wide spreads.

## What Changes
- Add a speed‑profile configuration file (RPC, mempool provider, slippage, spread/depth thresholds).
- Apply orderbook spread/depth checks before execution (skip if liquidity is too thin).
- Provide a one‑click script/command for launching speed mode with safe defaults.

## Impact
- Affected specs: copy-execution
- Affected code: copy‑trading worker/execution paths, setup script, docs
- No breaking API payload changes
