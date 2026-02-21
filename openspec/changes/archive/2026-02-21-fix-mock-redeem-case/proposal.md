# Fix Mock Redeem Case Sensitivity
> change-id: fix-mock-redeem-case
> type: fix
> status: proposed

## Summary
Ensure `walletAddress` is lowercased in the `redeem-sim` API route to match the database format, preventing "Position not found" errors.

## Problem
The database stores all wallet addresses in lowercase. The frontend (Privy) often provides checksummed addresses (mixed case). When the API tries to find a position using the mixed-case address, the lookup fails with 404, even though the position exists.

## Solution
In `web/app/api/copy-trading/redeem-sim/route.ts`:
- Convert `walletAddress` to lowercase before using it in `prisma.userPosition.findUnique`.

## Dependencies
- `web/app/api/copy-trading/redeem-sim/route.ts`
