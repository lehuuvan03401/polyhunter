# Center Affiliate Header
> change-id: center-affiliate-header
> type: styling
> status: proposed

## Summary
Update the Affiliate Dashboard header to match the `text-4xl` centered style of Portfolio and Markets pages, and add a subtitle for consistency.

## Problem
The user requested optimization of the header text "like previous pages". Previous pages (Portfolio, Markets) have a centered `text-4xl` title AND a `text-lg` subtitle. The current Affiliate Dashboard has only a `text-3xl` title.

## Solution
In `frontend/app/affiliate/page.tsx` (AuthenticatedView):
- Change `h1` to `text-4xl font-bold tracking-tight`.
- Add subtitle "Track earnings and manage your team" (or similar relevant text) with `text-muted-foreground text-lg`.
- Update container to `mb-8 space-y-4 text-center`.

## Dependencies
- `frontend/app/affiliate/page.tsx`
