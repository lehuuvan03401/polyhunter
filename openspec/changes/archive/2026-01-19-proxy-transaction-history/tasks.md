# Tasks

- [ ] Add `ProxyTransaction` model to `schema.prisma` <!-- id: 1 -->
- [ ] Run `prisma generate` and `prisma db push` <!-- id: 2 -->
- [ ] Create API route `POST /api/proxy/transactions` for logging <!-- id: 3 -->
- [ ] Create API route `GET /api/proxy/transactions` for fetching history <!-- id: 4 -->
- [ ] Update `useProxy.ts` to call the logging API after `deposit` success <!-- id: 5 -->
- [ ] Update `useProxy.ts` to call the logging API after `withdraw` success <!-- id: 6 -->
- [ ] Create `TransactionHistoryTable` component <!-- id: 7 -->
- [ ] Add `TransactionHistoryTable` to `Portfolio` page <!-- id: 8 -->
- [ ] Add `TransactionHistoryTable` to `ProxyDashboard` page <!-- id: 9 -->
