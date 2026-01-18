<!--
    Implementation tasks for Comprehensive Affiliate System
-->

- [ ] Schema Migration <!-- id: 0 -->
    - [ ] Update `prisma/schema.prisma` with `Member`, `TeamClosure`, `CommissionRecord` <!-- id: 1 -->
    - [ ] Create migration and generate client <!-- id: 2 -->
- [ ] Core Logic: Team Structure <!-- id: 3 -->
    - [ ] Implement `AffiliateService.register(sponsorId)` (populates Closure Table) <!-- id: 4 -->
    - [ ] Implement `AffiliateService.getZeroLine(memberId)` <!-- id: 5 -->
    - [ ] Implement `AffiliateService.getSunLines(memberId)` (logic for identifying leaders) <!-- id: 6 -->
- [ ] Core Logic: Commission Engine <!-- id: 7 -->
    - [ ] Implement `CommissionCalculator.calculateDirectReward(trade)` <!-- id: 8 -->
    - [ ] Implement `CommissionCalculator.calculateTeamReward(trade)` (Differential) <!-- id: 9 -->
    - [ ] Integrate with `CopyTradingExecutionService` (or Event Listener hook) <!-- id: 10 -->
- [ ] API Implementation <!-- id: 11 -->
    - [ ] `GET /api/affiliate/team` (Hierarchy view) <!-- id: 12 -->
    - [ ] `GET /api/affiliate/commissions` (Breakdown by type) <!-- id: 13 -->
    - [ ] `GET /api/affiliate/rank` (Progress tracking) <!-- id: 14 -->
- [ ] Verification <!-- id: 15 -->
    - [ ] Unit Test: Tree traversal correctness <!-- id: 16 -->
    - [ ] Unit Test: Commission math (Zero/Sun lines) <!-- id: 17 -->
