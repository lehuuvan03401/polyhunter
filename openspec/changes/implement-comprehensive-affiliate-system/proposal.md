# Proposal: Comprehensive Affiliate System (MLM)

## Why
The current affiliate system is a simple single-level referral program. The project requires a sophisticated multi-level marketing (MLM) structure "Zero Line & Sun Line" to drive rapid user acquisition and volume growth. The new system needs to support 15-generation deep rewards, dynamic team identification (Sun Lines), and complex performance-based incentives.

## What Changes
1.  **Schema Upgrade**: Introduce `Member` hierarchy with `sponsor` relations and a `TeamClosure` table for efficient O(1) ancestor/descendant lookups (essential for 15-gen calculations).
2.  **Calculation Engine**: Implement a backend service to calculating "Zero Line" (Direct) commissions and "Sun Line" (Team) differential bonuses.
3.  **Tier System**: Replace static enums with a dynamic 5-level rank system (Ordinary -> Super Partner) with automated upgrade logic.
4.  **API Expansion**: New endpoints for detailed team analytics, rank progress, and commission history.
