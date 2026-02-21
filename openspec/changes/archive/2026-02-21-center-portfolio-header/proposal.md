# Center Portfolio Header
> change-id: center-portfolio-header
> type: styling
> status: proposed

## Summary
Update the Portfolio page header to be centered and larger, matching the specific style of the Smart Money page.

## Problem
The user explicitly requested the "red marked text" (Dashboard header) to be centered "like" the Smart Money page. The current left-aligned, smaller text is visually inconsistent with this request.

## Solution
In `web/app/portfolio/page.tsx`:
- Add `text-center` to the header wrapper.
- Increase `h1` size to `text-4xl`.
- Increase spacing to `space-y-4`.

## Dependencies
- `web/app/portfolio/page.tsx`
