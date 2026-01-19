# Proposal: Implement Affiliate Withdrawals

## Summary
Add a dedicated withdrawals page and admin management interface for affiliate commission payouts.

## Problem
1. Users see their earnings ($1714.50) but have no clear withdrawal UI beyond a small "Withdraw" button
2. No dedicated withdrawal page with history and status tracking
3. Admin panel lacks payout management capabilities (approve, reject, process)

## Proposed Solution

### User-Facing: `/affiliate/withdrawals` Page
- Display available balance and pending payouts
- Withdrawal form with signature-based authorization
- Payout history table with status (PENDING, PROCESSING, COMPLETED, REJECTED)

### Admin-Facing: Payouts Tab in Admin Dashboard
- List all pending withdrawal requests across all affiliates
- Ability to approve/reject/process payouts
- Filter by status, search by wallet
- Batch processing capability

## Existing Infrastructure
- **API**: `POST /api/affiliate/payouts` - already has signature verification
- **API**: `GET /api/affiliate/payouts` - returns payout history
- **Model**: `Payout` with status field (PENDING, PROCESSING, COMPLETED, REJECTED)
- **Admin API**: `/api/admin/affiliates` - tier management pattern to follow

## Scope
- **In Scope**: 
  - User withdrawal page with improved UX
  - Admin payouts management tab
  - Admin API for payout status updates
- **Out of Scope**: Auto-transfer via smart contract (manual admin processing for now)
