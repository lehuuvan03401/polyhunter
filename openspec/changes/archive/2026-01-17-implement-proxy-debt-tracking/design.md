## Context
The "Optimized Float" execution strategy speeds up copy trading by having the Worker Bot front the capital. However, this creates a counterparty risk where the Worker Bot is not reimbursed by the User Proxy. We need a system to persist this "debt" and automatically recover it.

## Goals / Non-Goals
- **Goal**: Persist instances where reimbursement fails.
- **Goal**: Automatically retry reimbursement when funds become available.
- **Goal**: Prevent data loss of "who owes what".
- **Non-Goal**: Enforce on-chain debt (Smart Contract storage). We accept the centralized risk of the Supervisor DB for now, as on-chain storage implies extra gas and complexity for every trade.

## Decisions
- **Decision**: Use PostgreSQL (Prisma) to store `DebtRecord`.
    - **Why**: Low latency, fits existing stack, no gas cost for recording failures.
- **Decision**: Implement Active Recovery Loop in Supervisor.
    - **Why**: Debts should be recovered as soon as User deposits funds, even if they don't trade. A background job checking every few minutes is appropriate.

## Risks / Trade-offs
- **Risk**: Database loss means lost debt records.
    - **Mitigation**: Standard DB backups.
- **Risk**: Race conditions during recovery vs new trades.
    - **Mitigation**: Database transactions or simple atomic checks. Since Recovery is just "Transfer from Proxy to Bot", if it fails (balance moved), it just stays Pending.

## Data Model
New Prisma Model:
```prisma
model DebtRecord {
  id           String   @id @default(cuid())
  proxyAddress String
  botAddress   String
  amount       Float
  currency     String   // e.g. "USDC" or Token Address
  status       String   // "PENDING", "REPAID"
  errorLog     String?
  createdAt    DateTime @default(now())
  repaidAt     DateTime?
}
```
