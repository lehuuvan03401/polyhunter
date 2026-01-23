## ADDED Requirements

### Requirement: Leader Transaction Verification
The system MUST provide a link or icon that opens the Leader's original transaction on a block explorer (e.g., PolygonScan).

#### Scenario: View Leader Transaction
Given I am viewing the Order Status panel
And a copy trade order has been executed
When I look at the order details
Then I should see a link/icon to the Leader's original transaction on PolygonScan
And clicking it should open the block explorer in a new tab.

### Requirement: Price Execution Comparison
The system SHALL display both the Leader's Entry Price (Original Price) and the User's Execution Price for executed orders.

#### Scenario: Compare Execution Prices
Given I am viewing the Order Status panel
When I expand an order's details
Then I should see the Leader's Entry Price in the details
And I should see my own Execution Price
And I should see the calculated price difference (slippage) between them.
