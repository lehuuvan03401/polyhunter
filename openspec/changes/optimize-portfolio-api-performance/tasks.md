## 1. Implementation
- [ ] 1.1 Add in‑memory TTL cache utilities for API responses and external price lookups.
- [ ] 1.2 Apply caching + batching to `/api/copy-trading/positions` and `/api/copy-trading/metrics`.
- [ ] 1.3 Optimize `/api/copy-trading/positions/history` and `/api/copy-trading/orders` queries to avoid N+1 patterns.
- [ ] 1.4 Add Prisma indexes for hot query paths (CopyTrade and UserPosition).
- [ ] 1.5 Update portfolio UI polling intervals/adaptive refresh to reduce concurrent load.
- [ ] 1.6 Validate locally with repeated polling and document expected improvements.
