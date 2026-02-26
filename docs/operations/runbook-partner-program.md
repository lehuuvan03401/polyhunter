# Global Partner Program Runbook

This runbook covers monthly elimination cadence, 7-day refund SLA, and incident handling for the Horus Global Partner Program.

## Scope

- Seat cap: 100 active seats max.
- Monthly elimination: bottom 10 active seats by monthly ranking.
- Refund SLA: eliminated seats must be refunded within 7 calendar days.
- Refill: open seat count equals available seats under configured cap/price.

## API Surface

- `GET /api/partners/config`: seat cap, refill price, active/open seat stats.
- `POST /api/partners/config`: update cap/refill price (admin only).
- `GET /api/partners/rankings`: live/snapshot ranking view (admin only).
- `GET /api/partners/cycle/eliminate`: cycle preview and elimination history (admin only).
- `POST /api/partners/cycle/eliminate`: dry-run or execute month cycle (admin only).
- `GET /api/partners/refunds`: refund queue and status (admin only).
- `POST /api/partners/refunds`: mark refund complete/failed (admin only).
- `GET /api/partners/seats`: seat list and refill stats (admin only).

## Authentication

- Admin endpoints require header `x-admin-wallet` matching `ADMIN_WALLETS`.
- User-scoped endpoints require wallet headers/signature as defined by managed wallet auth.

## Monthly Cadence

1. T-1 day: config and seat health check
- Confirm seat cap and refill price:
```bash
curl -s "$BASE_URL/api/partners/config" \
  -H "x-admin-wallet: $ADMIN_WALLET"
```
- Confirm active/open seats and pending refunds.

2. T day: dry-run elimination
- Preview current ranking and elimination candidates:
```bash
curl -s -X POST "$BASE_URL/api/partners/cycle/eliminate" \
  -H "content-type: application/json" \
  -H "x-admin-wallet: $ADMIN_WALLET" \
  -d '{"monthKey":"2026-02","dryRun":true}'
```
- Validate candidate count is 10 (or lower when active seats < 10).

3. T day: execute elimination
```bash
curl -s -X POST "$BASE_URL/api/partners/cycle/eliminate" \
  -H "content-type: application/json" \
  -H "x-admin-wallet: $ADMIN_WALLET" \
  -d '{"monthKey":"2026-02","dryRun":false,"reason":"monthly-bottom-10"}'
```
- Persisted outputs:
  - monthly ranking snapshot
  - elimination rows
  - pending refunds
  - seat status changed to `ELIMINATED`

4. T+0 to T+7: refund execution
- Pull pending queue:
```bash
curl -s "$BASE_URL/api/partners/refunds?status=PENDING" \
  -H "x-admin-wallet: $ADMIN_WALLET"
```
- Mark refund completed:
```bash
curl -s -X POST "$BASE_URL/api/partners/refunds" \
  -H "content-type: application/json" \
  -H "x-admin-wallet: $ADMIN_WALLET" \
  -d '{"refundId":"<refund-id>","action":"COMPLETE","txHash":"<tx-hash>"}'
```

5. T+7: SLA audit
- Ensure no `PENDING` refunds are beyond `refundDeadlineAt`.
- Escalate any overdue refunds immediately.

## Refill Workflow

1. Determine open seats and current price:
```bash
curl -s "$BASE_URL/api/partners/config" \
  -H "x-admin-wallet: $ADMIN_WALLET"
```
2. Verify `stats.refill.openSeats` and `stats.refill.refillPriceUsd`.
3. `maxSeats` is immutable and fixed at 100 by policy; only refill price is operationally configurable.
4. Seat allocation uses `POST /api/partners/seats` and is blocked when cap is reached (`SEAT_CAP_REACHED`).

## Incident Handling

### 1. Duplicate elimination trigger attempt

Symptoms:
- `POST /api/partners/cycle/eliminate` returns `409` with `CYCLE_ALREADY_EXECUTED`.

Actions:
1. Confirm existing elimination result via `GET /api/partners/rankings?monthKey=...&source=SNAPSHOT`.
2. Do not re-run elimination for the same month.
3. Continue with refund pipeline.

### 2. Refund SLA breach risk

Symptoms:
- Pending refund age approaching 7 days or past `refundDeadlineAt`.

Actions:
1. Prioritize completion of oldest pending refunds first.
2. If on-chain payout is blocked, mark as `FAILED` with reason and retry immediately.
3. Open incident channel and track until all overdue refunds are cleared.

### 3. Incorrect elimination dispute

Symptoms:
- Partner challenges elimination rank.

Actions:
1. Retrieve snapshot ranking for the month (`source=SNAPSHOT`).
2. Validate tie-break order (score ascending for elimination, then joinedAt desc for worst-ranked tie-break).
3. If data inconsistency is confirmed, freeze refill and open correction incident with engineering.

## Release Checklist

- [ ] `openspec validate add-horus-participation-partner-program --strict --no-interactive`
- [ ] `GET /api/partners/config` healthy in staging and prod
- [ ] One dry-run cycle completed for current month
- [ ] Refund dashboard/report reviewed
- [ ] On-call ownership for monthly cycle assigned
