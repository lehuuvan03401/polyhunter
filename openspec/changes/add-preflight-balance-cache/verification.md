# Verification Notes: Preflight Balance Cache

## Manual Checks
- Preflight cache hit:
  - Trigger multiple signals for the same proxy/token within 2s.
  - Expect metrics: `Preflight Cache: hits>0` and fewer RPC reads.

- In-flight dedupe:
  - Trigger two concurrent preflight checks for the same proxy/token.
  - Expect `inflight` counter to increase and only one RPC call.

## Expected Outcome
- Reduced preflight RPC load under bursts.
- No change to execution-time fund transfer behavior.
