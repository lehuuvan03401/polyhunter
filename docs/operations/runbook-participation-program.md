# Participation Program Daily Operations Runbook

This runbook covers the daily operational cadence for participation level snapshots (`V1-V9`) and double-zone promotion snapshots.

## Scope

- Daily level evaluation based on latest net-deposit aggregation.
- Daily double-zone promotion progress snapshot.
- Admin-triggered snapshot APIs with optional dry-run and scoped-wallet execution.

## API Surface

- `POST /api/participation/levels`: run level snapshot (admin only).
- `GET /api/participation/levels`: inspect current wallet progress and latest snapshot (wallet-scoped).
- `POST /api/participation/promotion`: run promotion snapshot (admin only).
- `GET /api/participation/promotion`: inspect current wallet promotion progress and latest snapshot (wallet-scoped).

## Authentication

- Admin snapshot endpoints require header `x-admin-wallet` matching `ADMIN_WALLETS`.
- User-scoped `GET` endpoints require wallet headers/signature as defined by managed wallet auth.

## Daily Cadence

1. Run level snapshot
```bash
cd web
PARTICIPATION_OPS_BASE_URL=https://<host> \
PARTICIPATION_OPS_ADMIN_WALLET=0x... \
npm run participation:levels:daily
```

2. Run promotion snapshot
```bash
cd web
PARTICIPATION_OPS_BASE_URL=https://<host> \
PARTICIPATION_OPS_ADMIN_WALLET=0x... \
npm run participation:promotion:daily
```

3. Verify a wallet sample
```bash
curl -s "$BASE_URL/api/participation/levels?wallet=0x..." \
  -H "x-wallet-address: 0x..." \
  -H "x-wallet-signature: <sig>"

curl -s "$BASE_URL/api/participation/promotion?wallet=0x..." \
  -H "x-wallet-address: 0x..." \
  -H "x-wallet-signature: <sig>"
```

## Dry-Run / Backfill

Dry-run a daily snapshot without writing rows:

```bash
cd web
PARTICIPATION_OPS_BASE_URL=https://<host> \
PARTICIPATION_OPS_ADMIN_WALLET=0x... \
PARTICIPATION_LEVELS_DRY_RUN=true \
PARTICIPATION_LEVELS_SNAPSHOT_DATE=2026-03-02T00:00:00.000Z \
npm run participation:levels:daily
```

```bash
cd web
PARTICIPATION_OPS_BASE_URL=https://<host> \
PARTICIPATION_OPS_ADMIN_WALLET=0x... \
PARTICIPATION_PROMOTION_DRY_RUN=true \
PARTICIPATION_PROMOTION_SNAPSHOT_DATE=2026-03-02T00:00:00.000Z \
npm run participation:promotion:daily
```

Limit execution to specific wallets:

- `PARTICIPATION_LEVELS_WALLETS=0xaaa...,0xbbb...`
- `PARTICIPATION_PROMOTION_WALLETS=0xaaa...,0xbbb...`

## Failure Handling

### 1. Unauthorized snapshot trigger

Symptoms:
- Snapshot script fails with `401 Unauthorized`.

Actions:
1. Confirm `PARTICIPATION_OPS_ADMIN_WALLET` is set.
2. Confirm the wallet is present in `ADMIN_WALLETS`.
3. Re-run after correcting environment configuration.

### 2. Unexpected zero processed rows

Symptoms:
- Script succeeds but logs `processed=0`.

Actions:
1. Confirm `ParticipationAccount` rows exist for registered wallets.
2. Check whether `PARTICIPATION_*_WALLETS` is over-restrictive.
3. Run a dry-run without wallet filters to confirm the global candidate set.

### 3. Snapshot data drift

Symptoms:
- Latest snapshot does not match expected net deposits or promotion legs.

Actions:
1. Re-run with explicit `PARTICIPATION_*_SNAPSHOT_DATE` for deterministic replay.
2. Verify recent `ParticipationFundingRecord` / `NetDepositLedger` writes.
3. Check referral tree integrity (`Referrer`, `TeamClosure`) before re-running.

## Release Checklist

- [ ] `npm run participation:levels:daily` succeeds in staging.
- [ ] `npm run participation:promotion:daily` succeeds in staging.
- [ ] Dry-run mode returns expected `processed` counts for a sample date.
- [ ] Runbook ownership for daily snapshot monitoring is assigned.
