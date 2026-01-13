# Copy Trading Best Practices & Optimization Guide

This document outlines the recommended settings for configuring real-world copy trading sessions and provides technical suggestions for optimizing the `poly-hunter` execution flow.

## I. Parameter Configuration Best Practices

In a live trading environment, the core objective is to **"precisely replicate profitable strategies with minimal slippage while strictly controlling risk."**

### 1. Funding & Mode (`Mode` Tab)

| Parameter | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Copy Amount** | **% of Trader's Shares** | **Alignment**: Keeps your position sizing relative to the trader's conviction. If they go heavy, you go heavy (proportionally); if they test the waters, you do the same. <br> **Start Small**: Begin with **10-20%** to validate performance. |
| **Infinite Mode** | **ON** | **Continuity**: Prevents copy trading from stopping abruptly if a single order drains the "allocated" amount. Ensures you don't miss sell signals due to "stopped" status. **Must be paired with `Max Per Market` limit.** |
| **Slippage** | **Auto (Dynamic)** or **1-3%** | **Volatility Handling**: Polymarket liquidity varies wildly. "Auto" helps avoid getting stuck on fast-moving markets, while a 3% cap prevents getting wrecked on illiquid ones. |

### 2. Filters & Risk Management (`Filters` Tab)

| Parameter | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Min Liquidity / Volume** | **REQUIRED** (e.g., >$5k) | **The #1 Rule**: Never copy into "ghost markets." Low liquidity = massive slippage on entry and inability to exit. |
| **Max Odds** | **80% - 90%** | **Risk/Reward**: Avoid copying "picking pennies in front of a steamroller" trades (e.g., buying YES at 98¢). A single black swan event here wipes out months of small gains. |
| **Max Per Market** | **10% - 20% of Total** | **Diversification**: Hard cap on how much capital can be exposed to a single event outcome. Prevents account blow-up from one bad prediction. |

### 3. Exit Strategy (`Sells` Tab)

| Parameter | Recommendation | Rationale |
| :--- | :--- | :--- |
| **Sell Mode** | **Same % as Trader** | **Sync**: The most accurate way to mirror strategy. If the trader sells 50% to take profit, you should do the same to lock in gains. |

---

## II. System Optimization Suggestions

Based on the analysis of `TradingService` and `CopyTradingExecutionService`, here are advanced technical optimizations for the platform:

### 1. Capital Efficiency: Bot Float Rebalancing
*   **Current State**: The "Bot Float" strategy is excellent—the bot fronts USDC to buy tokens, then pushes them to the user. This minimizes latency.
*   **Optimization**: Implement a **Rebalancing Script**.
    *   **Reason**: If the bot continuously buys for users, its USDC float will deplete while it accumulates "reimbursement rights" (or pending settlements).
    *   **Solution**: A background service that monitors the Bot's USDC balance and triggers immediate settlement/withdrawal from the Proxy if the Float drops below a threshold (e.g., $1,000).

### 2. Execution Speed: Optimistic Execution
*   **Current State**: Sequential processing (Event -> Config Check -> Balance Check -> Tx).
*   **Optimization**: **Optimistic Execution** for high-reputation traders.
    *   **Logic**: Upon receiving a signal from a "Whale" trader, immediately broadcast a small "scout" transaction while simultaneously validating configs.
    *   **Benefit**: Captures better odds in high-frequency scenarios.

### 3. Resilience: Smart Slippage Retry
*   **Current State**: Fails if slippage exceeds limit.
*   **Optimization**: **Adaptive Retry**.
    *   **Logic**: If an order fails due to `Slippage Exceeded`, but the price deviation is minor (e.g., target 0.50, executed 0.505, limit 0.502), automatically slightly widen the slippage tolerance (e.g., to 0.505) and retry immediately *once*.
    *   **Benefit**: Prevents missing highly profitable moves due to minor noise.

### 4. Safety: Independent Watcher (Force Exit)
*   **Current State**: Relies on Trader's sell signal.
*   **Optimization**: **Global Stop-Loss Watcher**.
    *   **Logic**: A standalone process that monitors all open positions. If any position hits a user-defined hard stop (e.g., -30% ROI), it triggers a sell **locally**, ignoring the trader.
    *   **Benefit**: Protects against traders who "hold to zero" or refuse to cut losses.

### 5. MEV Protection
*   **Optimization**: Integrate **Flashbots** or private RPC endpoints for Polygon.
*   **Reason**: Prevents front-running and sandwich attacks on large copy trade orders.
