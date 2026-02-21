# Change: Optimize WebSocket Subscriptions for Copy Trading

## Why
The worker currently subscribes to all activity and filters client-side, which can increase latency and load. If the SDK supports address-level filtering, we should only subscribe to watched trader addresses.

## What Changes
- Use filtered subscription to monitored trader addresses when supported.
- Fall back to full subscription if filters are unavailable.
- Log which subscription mode is used.

## Impact
- Affected specs: `copy-trading`
- Affected code: copy-trading worker and realtime service usage.
