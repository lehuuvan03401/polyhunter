# Proxy Transaction History

## Problem
Currently, users can deposit and withdraw funds from their trading proxy, but there is no persistent record of these transactions in the application interface. Users rely on checking their wallet activity or block explorer, which is a poor user experience.

## Solution
Implement a transaction history feature that logs all proxy-related financial activities (Deposit, Withdraw) to the database and displays them in the UI.

## Scope
1.  **Backend**:
    *   Add `ProxyTransaction` model to Prisma schema.
    *   Create API endpoints to log new transactions (`POST /api/proxy/transactions`) and fetch history (`GET /api/proxy/transactions`).
2.  **Frontend**:
    *   Update `useProxy` hook to call the logging API upon successful blockchain transactions.
    *   Create a `TransactionHistoryTable` component to display the records.
    *   Integrate this table into the Proxy Dashboard and/or Portfolio page.

## Out of Scope
*   Automatic indexing of past transactions from the blockchain (we will start logging from now on).
*   Detailed fee analytics (already handled by `FeeTransaction`).
