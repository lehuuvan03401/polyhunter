# Tasks

- [ ] Modify `web/app/portfolio/page.tsx`
    - [ ] Rename table header "Outcome" to "Side"
    - [ ] Rename table header "Entry" to "Avg. Price"
    - [ ] Rename table header "Size" to "Shares"
    - [ ] Add "Total Invested" column (Calculated as `Shares * Avg. Price`)
    - [ ] Update table data row to render ROI column (Calculated from `(curPrice - avgPrice) / avgPrice`)
    - [ ] Update table data row to render Max Payout column (`size * 1$`) (Optional: replaces or adds to existing columns? Proposal suggests adding.)
    - [ ] Ensure conditional formatting for Side (Up/Yes = Green, Down/No = Red) remains consistent
- [ ] Verification
    - [ ] Check Portfolio page in browser
    - [ ] Verify columns appear with new names
    - [ ] Verify ROI and Max Payout calculations look correct
