# View Proxy Transaction History

## ADDED Requirements

### Requirement: Log Proxy Transactions
The system MUST log all user-initiated proxy financial transactions (Deposit, Withdraw) to the database.

#### Scenario: User deposits funds
Given a user initiates a deposit of 100 USDC in `useProxy`
When the transaction is confirmed on-chain
Then the system should record a `ProxyTransaction` with:
  - Type: 'DEPOSIT'
  - Amount: 100
  - TxHash: <hash>
  - Status: 'COMPLETED'

#### Scenario: User withdraws funds
Given a user initiates a withdrawal of 50 USDC
When the transaction is confirmed on-chain
Then the system should record a `ProxyTransaction` with:
  - Type: 'WITHDRAW'
  - Amount: 50
  - TxHash: <hash>
  - Status: 'COMPLETED'

### Requirement: Display Transaction History
The Portfolio and Proxy Dashboard pages MUST display a chronological list of recent transactions.

#### Scenario: Viewing history
Given a user executes a deposit and a withdrawal
When they visit the Portfolio page
Then they should see a "History" tab or section
And it should list both transactions with correct amounts, types, dates, and links to the block explorer.
