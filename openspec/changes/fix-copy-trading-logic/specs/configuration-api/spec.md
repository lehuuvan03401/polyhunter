# Configuration API Updates

## ADDED Requirements

### Requirement: API Credential Storage
The configuration API **MUST** support robust storage for Polymarket CLOB credentials.

#### Scenario: Encrypted API Credentials
Given a user config payload containing `apiKey`, `apiSecret`, and `apiPassphrase`
When the POST/PATCH request is received
Then these fields must be encrypted using the `EncryptionService` (similar to Private Key)
And stored in the `CopyTradingConfig` table
And never returned in plain text in GET responses (return masked or null)
