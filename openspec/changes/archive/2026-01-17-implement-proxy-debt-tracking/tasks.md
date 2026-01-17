## 1. Implementation
- [ ] 1.1 Add `DebtRecord` model to `frontend/prisma/schema.prisma`
- [ ] 1.2 Run `npx prisma generate` to update client
- [ ] 1.3 Update `src/services/copy-trading-execution-service.ts` to log `DebtRecord` when reimbursement fails
- [ ] 1.4 Create `src/core/debt-manager.ts` service class for handling recovery logic
- [ ] 1.5 Integrate `DebtManager` into `scripts/copy-trading-supervisor.ts` (Periodic recovery loop)
