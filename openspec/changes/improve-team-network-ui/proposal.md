# Improve Team Network Structure UI

## Summary
Enhance the "Team Network Structure" section in the Affiliate Dashboard to display hierarchical relationships in a more intuitive way, showing generation breakdown and team composition at a glance.

## Problem
The current table-based view shows all team members in a flat list with a "Gen" column, but:
1. Users cannot easily see the tree structure (who referred whom)
2. No aggregated summary by generation (e.g., "5 Direct + 15 Gen 2 + 30 Gen 3")
3. Team size per member shows "-" for most entries
4. No visual indication of hierarchy depth or branching

## Proposed Solution
1. **Generation Summary Bar**: Add a horizontal bar showing count per generation (Gen 1: 5, Gen 2: 15, Gen 3: 30)
2. **Expandable Tree View**: Replace flat table with collapsible tree structure
3. **Direct Referrals First**: Prominently display direct referrals with their sub-team sizes
4. **Tab Toggle**: Allow users to switch between "Summary View" and "Tree View"

## User Stories
- As an affiliate, I want to see how many members I have at each generation level at a glance
- As an affiliate, I want to expand/collapse my direct referrals to see their sub-teams
- As an affiliate, I want to understand my team composition without scrolling through a long list

## Scope
- **In Scope**: Frontend UI changes to `/affiliate` page, API enhancement for tree data
- **Out of Scope**: Admin dashboard changes, commission calculation logic

## Affected Specs
- `affiliate-system` (UI display requirements)

## Design Reference
See `design.md` for mockups and component breakdown.
