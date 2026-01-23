# Tasks: Enhance Smart Money Discovery

## 1. Frontend UI Changes
- [ ] 1.1 Add tab interface to `app/smart-money/page.tsx` (Top Performers | Rising Stars)
- [ ] 1.2 Create `RisingStarsTable` component or adapt `LeaderboardTable` for reuse
- [ ] 1.3 Style tabs consistently with existing design system
- [ ] 1.4 Handle tab state and lazy loading of Rising Stars data

## 2. Data Integration
- [ ] 2.1 Fetch Rising Stars data from `/api/traders/active?limit=20&period=30d`
- [ ] 2.2 Ensure scientific metrics display correctly for both sections
- [ ] 2.3 Handle loading and error states for each tab independently

## 3. UX Polish
- [ ] 3.1 Add visual indicator showing data source difference
- [ ] 3.2 Show "limited data" badge for traders without full metrics
- [ ] 3.3 Ensure mobile responsiveness of tabbed interface

## 4. Verification
- [ ] 4.1 Verify both tabs load correctly
- [ ] 4.2 Verify pagination works for each tab
- [ ] 4.3 Verify metrics display correctly
- [ ] 4.4 Test mobile layout

## Dependencies
- Requires `implement-scientific-scoring` to be deployed first (provides `/api/traders/active` with new metrics)
