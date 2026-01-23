# Change: Enhance Smart Money Discovery with Dual Data Sources

## Why

Currently, the `/smart-money` "Top Performers" page only uses one data source: the Polymarket leaderboard via SDK. This limits discovery to traders who are already on the official leaderboard.

The homepage "Top 10 Most Followed Traders" uses a different, more sophisticated approach via `/api/traders/active` that:
- Applies scientific scoring with risk-adjusted metrics
- Filters by recent activity and active positions
- Uses multi-factor ranking (Profit Factor, Max Drawdown, Win Rate, etc.)

By combining both data sources on the Smart Money page, users can discover:
1. **Top Performers** - Established high-volume traders from leaderboard
2. **Rising Stars** - Active traders with strong risk-adjusted metrics who may not be on leaderboard yet

## What Changes

### New Capabilities
- Add a second data section "Rising Stars" or "Active Traders" to Smart Money page
- Use `/api/traders/active` endpoint with scientific scoring
- Allow users to toggle between or see both sections

### UI Enhancements
- Tab or section switch between "Top Performers" and "Rising Stars"
- Consistent display of scientific metrics across both sections
- Clear labeling of data source differences

## Impact

- **Affected code**:
  - `app/smart-money/page.tsx` - Add new section/tabs
  - Create new component or reuse `LeaderboardTable` for Rising Stars section
  - Potentially add a new API endpoint for filtered smart money discovery
