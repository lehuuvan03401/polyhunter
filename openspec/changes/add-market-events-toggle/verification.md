# Verification Notes: Market Events Toggle

## Manual Checks
- Disabled mode:
  - Run worker with `COPY_TRADING_ENABLE_MARKET_EVENTS=false`.
  - Expect log: `Market lifecycle events disabled` and no market event subscriptions.

- Enabled mode (default):
  - Run worker without the env flag (or set to true).
  - Expect log: `Subscribing to market lifecycle events...`.

## Expected Outcome
- Worker skips market lifecycle subscriptions when disabled.
- Default behavior remains unchanged when enabled.
