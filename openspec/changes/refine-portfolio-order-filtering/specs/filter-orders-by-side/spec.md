# Filter Orders by Side

## ADDED Requirements

### Requirement: Filter orders by side in Portfolio
The Portfolio Order Status panel MUST allow users to filter orders by their side (Buy vs Sell) instead of order status, providing a clearer view of trading activity.

#### Scenario: Filtering by Buy Side
Given I am on the Portfolio page
And I see the "Order Status" panel
When I click the "Buy" tab
Then I should only see orders with the "BUY" side
And pagination should update based on the filtered count

#### Scenario: Filtering by Sell Side
Given I am on the Portfolio page
And I see the "Order Status" panel
When I click the "Sell" tab
Then I should only see orders with the "SELL" side
And pagination should update based on the filtered count

#### Scenario: Viewing All Orders
Given I am on the Portfolio page
When I click the "All" tab
Then I should see all orders regardless of side or status
