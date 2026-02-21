## 1. Implementation
- [x] 1.1 Add `tradeSizeMode` to `CopyTradingConfig` (default SHARES) and create migration.
- [x] 1.2 Add shared normalization helper (shares + notional) and update copy size calculations in worker/detect paths.
- [x] 1.3 Ensure copy-trade records persist normalized sizing consistently (originalSize/originalPrice usage).
- [x] 1.4 Add verification/test coverage for SHARES vs NOTIONAL sizing.
