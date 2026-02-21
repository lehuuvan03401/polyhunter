# Change: Implement Proxy Debt Tracking

## Why
When using the "Optimized Float" strategy (where the Bot uses its own funds to buy tokens for the User Proxy to speed up execution), there is a risk that the subsequent reimbursement (User Proxy -> Bot) fails due to insufficient funds in the Proxy. Currently, this results in the Bot losing funds (holding tokens or having paid for them without repayment) with no automated mechanism for recovery.

## What Changes
- **Database Schema**: Add a `DebtRecord` model to track failed reimbursements (who owes what to whom).
- **Execution Logic**: In `CopyTradingExecutionService`, if reimbursement fails, automatically record the debt in the database instead of just logging an error.
- **Recovery Logic**: Introduce a new `DebtManager` or periodic task in `Supervisor` to retry collecting debts when the Proxy has sufficient funds.

## Impact
- **Affected Specs**: `copy-execution`
- **Affected Code**: 
    - `web/prisma/schema.prisma`
    - `src/services/copy-trading-execution-service.ts`
    - `scripts/copy-trading-supervisor.ts`
