# Proposal: Add Affiliate Rules Page

## Summary
Create a dedicated "Affiliate Rules" page (`/affiliate/rules`) with visual diagrams and clear explanations of the commission structure, tier system, and earning mechanics.

## Problem
Currently, users can only see their current tier and percentage rates (e.g., "Zero Line: 3%, Team Diff: 3%") on the dashboard header. This is insufficient for users to understand:
- How commissions are calculated
- What each tier unlocks
- How to upgrade to higher tiers
- The difference between Zero Line and Sun Line earnings

## Proposed Solution
Create a new `/affiliate/rules` page with:

1. **Tier Comparison Table** - Visual table showing all 5 tiers with requirements and benefits
2. **Commission Flow Diagram** - Mermaid diagram showing how commissions flow through generations
3. **Zero Line vs Sun Line Explanation** - Clear breakdown with examples
4. **Upgrade Path Visualization** - Progress indicators showing how to reach next tier
5. **FAQ Section** - Common questions answered

## Scope
- **In Scope**: Frontend UI page, navigation link from dashboard
- **Out of Scope**: Backend changes, new API endpoints

## Affected Specs
- `affiliate-system` (adding UI documentation requirements)
