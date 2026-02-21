# Refine Portfolio Order Filtering
> change-id: refine-portfolio-order-filtering
> type: enhancement
> status: proposed

## Summary
Replace the "Open" and "History" tabs in the Portfolio "Order Status" panel with "Buy" and "Sell" tabs to allow users to filter orders by side (BUY/SELL) rather than status. The "All" tab will remain to show all orders.

## Problem
The current "Open" and "History" tabs provide limited utility as they overlap significantly with the comprehensive "All" view and do not offer a quick way to distinct between Buy and Sell orders, which is a more common filtering need for traders analyzing their activity.

## Solution
1.  **Rename Tabs**: Change "Open" to "Buy" and "History" to "Sell" in the `OrderStatusPanel`.
2.  **Update Logic**:
    -   "Buy" tab: Filters orders where `side` is 'BUY', regardless of status.
    -   "Sell" tab: Filters orders where `side` is 'SELL', regardless of status.
    -   "All" tab: Remains unchanged (shows all orders).
3.  **Preserve Pagination**: Ensure pagination works correctly with the new filtered subsets.

## Risks
-   Users used to filtering by "Active" (Open) vs "Closed" (History) via tabs will lose this quick filter. However, the order list usually sorts by time, and status is visible on each row.
-   "Buy" and "Sell" might be ambiguous if some orders are complex, but currently `Order` model supports explicit `side` string.

## Dependencies
-   `web/components/copy-trading/order-status-panel.tsx`
-   `web/lib/hooks/useOrderStatus.ts` (Data provider)
