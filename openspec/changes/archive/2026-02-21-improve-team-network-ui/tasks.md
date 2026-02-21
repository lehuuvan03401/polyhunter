# Tasks

## Phase 1: API Enhancement
- [ ] 1.1 Add `GET /api/affiliate/team/summary` endpoint to return generation breakdown
- [ ] 1.2 Update `GET /api/affiliate/team` to return nested tree structure

## Phase 2: Frontend Components
- [ ] 2.1 Create `GenerationSummaryBar` component (horizontal bar showing Gen 1: X, Gen 2: Y, ...)
- [ ] 2.2 Create `TeamTreeView` component with expandable/collapsible nodes
- [ ] 2.3 Create `TeamMemberCard` component for tree nodes

## Phase 3: Integration
- [ ] 3.1 Replace flat table with tree view in `/affiliate/page.tsx`
- [ ] 3.2 Add tab toggle for "Summary" vs "Tree" view
- [ ] 3.3 Add loading states and empty states for new components

## Phase 4: Testing
- [ ] 4.1 Verify with seeded test data (5 direct + 15 gen2 + 30 gen3)
- [ ] 4.2 Test expand/collapse interactions
- [ ] 4.3 Test responsive layout on mobile

## Dependencies
- Requires Phase 1 API changes before Phase 2-3 frontend work
- Phase 2.2 and 2.3 can be parallelized
