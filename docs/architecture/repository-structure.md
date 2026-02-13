# Repository Structure Audit (2026-02)

This document summarizes the major repository modules, current hierarchy issues, and a safe optimization path.

## Major System Parts

1. `src/` (SDK core)
   - Core abstractions, clients, services, and shared utilities.
   - Published package source (`@catalyst-team/poly-sdk`).

2. `frontend/` (Next.js app)
   - App routes, API routes, UI components, Prisma models, and frontend operational scripts.

3. `contracts/` (Hardhat)
   - Solidity contracts, deployment scripts, and contract tests.

4. `scripts/` (root operational tooling)
   - Runtime worker, approvals/deposit/trading helpers, and verification scripts.

5. `docs/` (product + operations + architecture)
   - Guides, runbooks, architecture docs, and historical archives.

6. `openspec/` (spec-driven change management)
   - Active proposals and current capability specifications.

## Current Hierarchy Pain Points

1. Script ownership is split across `scripts/` and `frontend/scripts/` with overlapping copy-trading context.
2. Runtime entrypoints are not consistently documented, causing “which script is canonical” confusion.
3. Existing script docs were stale and did not reflect new verify/supervisor/capacity flows.
4. Operational documents are rich but lack a single “script boundary” reference.

## Optimization Applied (Non-breaking)

1. Rewrote `scripts/README.md` to reflect actual directory layout and canonical root entrypoints.
2. Added `frontend/scripts/README.md` to define app-layer script scope and execution conventions.
3. Clarified root-vs-frontend runtime ownership for copy-trading operations.

## Recommended Next Refactor (Breaking / Proposal Required)

If we want stricter hierarchy, apply in a dedicated OpenSpec change:

1. Move copy-trading runtime scripts under a single namespace:
   - Option A: `runtime/copy-trading/*`
   - Option B: `scripts/runtime/*` + wrappers for backward compatibility
2. Add wrapper/alias scripts and deprecation warnings for old paths.
3. Update all runbooks and PM2 commands to canonical paths.
4. Remove stale duplicate worker implementations after one release cycle.

## Target Layout (Proposed)

```text
poly-hunter/
├── src/                     # SDK source
├── frontend/                # Next.js app
├── contracts/               # Solidity + Hardhat
├── scripts/
│   ├── runtime/             # Worker/supervisor orchestration entrypoints
│   ├── verify/              # Runtime verification flows
│   ├── ops/                 # approvals/deposit/wallet/trading helpers
│   └── research/
├── docs/
│   ├── architecture/
│   ├── operations/
│   └── guides/
└── openspec/
```
