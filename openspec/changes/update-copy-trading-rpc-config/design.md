## Context
The worker and server execution route currently instantiate providers using `https://polygon-rpc.com` (or `NEXT_PUBLIC_RPC_URL`). This makes it difficult to switch to a high-performance RPC without code edits.

## Goals / Non-Goals
- Goals:
  - Add a dedicated env for copy-trading execution RPC selection.
  - Keep defaults backward-compatible.
- Non-Goals:
  - Introduce new RPC vendors or mempool streaming logic.

## Decisions
- Decision: Prefer `COPY_TRADING_RPC_URL`, fallback to `NEXT_PUBLIC_RPC_URL`, then public RPC.
- Decision: Log the selected RPC in worker startup.

## Risks / Trade-offs
- Misconfigured RPC could break execution; mitigated by clear logs.

## Migration Plan
No schema changes required.
