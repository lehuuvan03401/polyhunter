# Lowercase Address Spec

## MODIFIED Requirements

### Requirement: Case-Insensitive Lookup
The Mock Redeem API MUST support mixed-case wallet addresses by normalizing them to lowercase before database lookup.

#### Scenario: Checksummed Address
Given a user with wallet "0xABC..." (Stored as "0xabc..." in DB)
When they attempt to Mock Redeem
Then the API converts "0xABC..." to "0xabc..."
And successfully finds the position
