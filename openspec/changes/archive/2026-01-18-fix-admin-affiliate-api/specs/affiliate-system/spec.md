## ADDED Requirements

### Requirement: Admin API Input Validation
The admin affiliate API SHALL validate all input parameters. Invalid tier values SHALL be rejected with a 400 error response.

#### Scenario: Rejecting invalid tier value
- GIVEN an admin sends a PUT request with tier "INVALID_TIER"
- WHEN the API processes the request
- THEN the API returns 400 Bad Request
- AND the response includes error message "Invalid tier value"

#### Scenario: Accepting valid tier value
- GIVEN an admin sends a PUT request with tier "ELITE"
- WHEN the API processes the request
- THEN the tier is updated successfully
- AND the API returns 200 OK

---

### Requirement: Admin API Query Optimization
The admin affiliate list endpoint SHALL fetch team sizes in a single batch query. The endpoint SHALL NOT execute N+1 queries for team size aggregation.

#### Scenario: Fetching affiliates with team sizes
- GIVEN there are 20 affiliates in the database
- WHEN an admin requests the affiliate list
- THEN team sizes are fetched using at most 2 database queries (main query + aggregation)
- AND response includes teamSize for each affiliate

---

### Requirement: Admin Authorization
The system SHALL verify admin wallet addresses before allowing access to admin endpoints. In production mode, the ADMIN_WALLETS environment variable MUST be configured. Development mode bypass SHALL log a warning.

#### Scenario: Production mode without configuration
- GIVEN NODE_ENV is "production"
- AND ADMIN_WALLETS environment variable is not set
- WHEN the server starts
- THEN a warning is logged "ADMIN_WALLETS not configured - admin endpoints disabled"

#### Scenario: Development mode bypass
- GIVEN NODE_ENV is "development"
- AND ADMIN_WALLETS is not configured
- WHEN an admin request is made
- THEN access is granted
- AND a warning is logged "Admin auth bypassed in development mode"
