# Change: Normalize Copy Trade Sizing

## Why
Copy-trading currently assumes incoming trade size is always measured in shares, which can produce incorrect copy sizes if upstream signals switch to notional (USDC) sizing. This creates material risk for real execution.

## What Changes
- Introduce an explicit trade size interpretation mode (`SHARES` or `NOTIONAL`).
- Normalize trade size into both shares and notional before applying copy sizing rules.
- Use the normalized notional value for sizing across worker/detect paths.

## Impact
- Affected specs: `copy-trading`
- Affected code: copy-trading worker and detection paths; Prisma schema for `CopyTradingConfig`.
