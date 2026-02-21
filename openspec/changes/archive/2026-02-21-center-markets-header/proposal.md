# Center Markets Header
> change-id: center-markets-header
> type: styling
> status: proposed

## Summary
Update the Markets page header to be centered and larger, matching the specific style of the Smart Money and Portfolio pages.

## Problem
The user explicitly requested the "Participate in Markets" header to be centered "like" the other pages. The current left-aligned styling is inconsistent.

## Solution
In `web/app/markets/page.tsx` (for both auth and non-auth states):
- Add `text-center` to the header wrapper.
- Increase `h1` size to `text-4xl`.
- Increase subtitle to `text-lg`.

## Dependencies
- `web/app/markets/page.tsx`
