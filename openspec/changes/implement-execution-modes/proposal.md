# Proposal: Implement Security vs Speed Execution Modes

## Problem
Currently, Horus operates exclusively in **Proxy Mode** (Non-Custodial). While secure, this involves multiple on-chain transactions (Fund Pull -> Trade -> Fund Return) for every execution, which:
1.  Incurs higher gas costs (Proxy overhead).
2.  Increases latency (waiting for on-chain block inclusion before/after trading).
3.  Limits high-frequency capabilities.

Users request a "Speed Hosting Mode" (极速托管模式) to prioritize performance over non-custodial security, alongside the existing "Security Mode" (安全模式).

## Solution
Introduce a dual-mode execution engine:

1.  **Security Mode (Default)**:
    - Retains current Proxy architecture.
    - Non-custodial: User funds stay in Proxy.
    - Flow: `Worker` borrows funds -> Trades -> Returns funds.
    - Pros: Secure, funds isolated. Cons: Slower, expensive.

2.  **Speed Mode (Hosted/EOA)**:
    - User provides a dedicated "Trading Key" (or funds a generated one).
    - Custodial/Hosted: The Supervisor holds this key in memory/config.
    - Flow: Supervisor signs & executes directly using User Key.
    - **NO** Proxy interaction. **NO** Fund transfers per trade.
    - Pros: ~10x Faster (Direct CLOB/Contract call), cheaper gas. Cons: Requires trusting the runner with a specific key.

## Impact
- **Backend (`scripts/`)**: `Supervisor` and `ExecutionService` must handle `EOA` execution path (skipping `transferFromProxy`).
- **Frontend**: Add UI to select mode and safely input/manage the "Hosted Key" (for Speed Mode) or Deploy Proxy (for Security Mode).
- **Database**: Update `Config` schema to store `mode` and encrypted `credentials`.

## Risks
- **Security**: "Speed Mode" involves handling user private keys. We must emphasize using a *dedicated trading wallet* with limited funds, NOT the main cold wallet.
- **Complexity**: Execution logic branches significantly.
