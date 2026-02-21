## 1. Implementation
- [x] 1.1 Insert CopyTrade record (PENDING) before any execution attempt and skip execution on unique constraint failure.
- [x] 1.2 Use prewritten CopyTrade ID for execution updates and retry/error handling.
- [x] 1.3 Add stale PENDING recovery logic (mark failed or retry-safe after TTL).
- [x] 1.4 Update logs/metrics to reflect prewrite failures and duplicate skips.
- [x] 1.5 Add tests or verification steps for duplicate prevention and prewrite failure handling.
