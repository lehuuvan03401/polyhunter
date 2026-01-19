# Tasks: Implement Affiliate Withdrawals

## Phase 1: User Withdrawals Page
- [ ] Create `/affiliate/withdrawals/page.tsx`
  - Show available balance prominently
  - Withdrawal form with amount input and confirmation
  - Connect existing signature-based POST API
- [ ] Add payout history section with status badges
- [ ] Add navigation link from main dashboard to withdrawals page

## Phase 2: Admin Payouts Management
- [ ] Create `GET /api/admin/payouts` - List all payouts with filters
- [ ] Create `PUT /api/admin/payouts` - Update payout status (approve/reject/process)
- [ ] Add "Payouts" sub-tab in Admin Dashboard (`/dashboard/admin`)
- [ ] Implement payout list with status filters (PENDING, PROCESSING, COMPLETED)
- [ ] Add approve/reject action buttons per payout

## Phase 3: Integration & Polish
- [ ] Add toast notifications for payout status changes
- [ ] Update affiliate stats to show pending vs available balance clearly
- [ ] Add withdrawal minimum ($10) validation on frontend

## Dependencies
- Existing `/api/affiliate/payouts` API endpoints
- Existing `Payout` Prisma model

## Parallelizable Work
- Phase 1 (user page) and Phase 2 (admin API) can be developed in parallel
