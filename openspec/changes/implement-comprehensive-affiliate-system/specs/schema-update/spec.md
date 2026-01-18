# Spec: Schema Update for MLM

## ADDED Requirements

### Requirement: Hierarchy Data Structure
The system MUST support efficient tree traversal for 15-generation queries.

#### Scenario: Closure Table
A new model `TeamClosure` SHALL be added to `schema.prisma`.
- `ancestorId`: String (references Referrer)
- `descendantId`: String (references Referrer)
- `depth`: Int (0 for self, 1 for direct, etc.)

#### Scenario: Tier Enum Expansion
The `AffiliateTier` enum SHALL be updated/replaced to map to:
- `ORDINARY` (Level 1)
- `VIP` (Level 2)
- `ELITE` (Level 3)
- `PARTNER` (Level 4)
- `SUPER_PARTNER` (Level 5)

### Requirement: Performance Tracking
The `Referrer` model MUST track metrics required for Sun Line identification.

#### Scenario: Extended Metrics
Fields SHALL be added to `Referrer`:
- `maxDepth`: Int (Deepest level of team)
- `sunLineCount`: Int (Number of qualified sun lines)
- `teamVolume`: Float (Total volume of subtree)
