## 1. Contracts
- [x] 1.1 Update `PolyHunterProxy` with executor binding, pause guard, and target allowlist.
- [x] 1.2 Update `ProxyFactory` to set executor + initialize allowlists, provide batch allowlist updates, and expose pause relay helpers.
- [x] 1.3 Update `PolyHunterExecutor` with pause guard + target allowlist.

## 2. SDK + Runtime
- [x] 2.1 Update contract ABIs/addresses in `src/core/contracts.ts`.
- [x] 2.2 Add runtime address validation before execution (fail fast).

## 3. Deployment + Docs
- [x] 3.1 Update deployment scripts to wire executor + allowlist defaults.
- [x] 3.2 Update docs/runbooks for migration and pause/allowlist operations.

## 4. Tests + Verification
- [x] 4.1 Add/extend tests for allowlist, pause, and executor binding.
- [x] 4.2 Add verification notes for migration and safety controls.
