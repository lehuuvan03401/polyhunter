# Tasks: Implement Scientific Trader Scoring

## 1. Core Scoring Service
- [ ] 1.1 Create `lib/services/trader-scoring-service.ts` with metric calculation functions
- [ ] 1.2 Implement Profit Factor calculation from closed positions
- [ ] 1.3 Implement Volume-Weighted Win Rate calculation
- [ ] 1.4 Implement Sharpe-like ratio calculation with rolling window
- [ ] 1.5 Implement Max Drawdown calculation
- [ ] 1.6 Implement Copy-Friendliness scoring logic

## 2. API Integration
- [ ] 2.1 Update `/api/traders/active/route.ts` to use new scoring service
- [ ] 2.2 Add new metrics to API response schema
- [ ] 2.3 Implement caching layer for computed scores (5-min TTL)
- [ ] 2.4 Add query params for filtering by risk profile

## 3. SDK Updates
- [ ] 3.1 Update `SmartMoneyWallet` interface with new metrics
- [ ] 3.2 Modify `SmartMoneyService.getSmartMoneyList()` to return enhanced data
- [ ] 3.3 Update score calculation formula in SDK

## 4. Frontend Display
- [ ] 4.1 Update `LeaderboardTable` to show new metric columns
- [ ] 4.2 Update `SmartMoneyTable` to show new metric columns
- [ ] 4.3 Add tooltips explaining each metric
- [ ] 4.4 Add filter/sort controls for different metrics

## 5. Testing & Validation
- [ ] 5.1 Add unit tests for all metric calculation functions
- [ ] 5.2 Add integration test for API endpoint with new scoring
- [ ] 5.3 Manual validation: compare old vs new rankings for reasonableness
- [ ] 5.4 Performance test: ensure API response time stays under 2s

## Dependencies
- Tasks 1.x can be parallelized
- Task 2.x depends on 1.x completion
- Task 3.x can run parallel to 2.x
- Task 4.x depends on 2.x and 3.x
- Task 5.x can start after respective components complete
