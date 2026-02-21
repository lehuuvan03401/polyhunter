# Match DB Count Spec

## MODIFIED Requirements

### Requirement: Consistent Order Count
The Simulation Summary MUST report an order count that matches the total number of records saved to the database, ensuring alignment with the Frontend Dashboard.

#### Scenario: Summary Output
Given a simulation session that executed 10 copy trades and 2 settlements
When the summary is printed
Then the "Total Orders Recorded" line MUST display "12" (matching the DB count)
