# Tasks: Optimize Simple Mode Sizing

## Overview
Change Simple Mode from Fixed $ to Range Mode with proportional sizing (10%, $5-$100 default).

---

## Tasks

- [x] **1. Update Simple Mode UI to Range Mode**
  - File: `web/components/copy-trading/copy-trader-modal.tsx`
  - Change Simple Mode form from single "Amount per Trade" input to:
    - Proportional % input (default 10%)
    - Max per Trade input (default $100)
  - Keep UI simple - hide Min input (use $5 default internally)
  - Update preview text to explain Range behavior

- [x] **2. Update API payload defaults for Simple Mode**
  - File: `web/components/copy-trading/copy-trader-modal.tsx`
  - Modify `handleStartCopying()` to send:
    - `mode: 'percentage'` instead of `'fixed_amount'`
    - `sizeScale: 0.10` (10%)
    - `minSizePerTrade: 0.5`
    - `maxSizePerTrade: 100` (or user's Max input)
  - Remove `fixedAmount` for Simple Mode

- [x] **3. Add Quick Preset Buttons for Range Mode**
  - Add preset buttons: "Conservative" (5%, $50 max), "Moderate" (10%, $100 max), "Aggressive" (20%, $200 max)
  - Update UI with clear labels

- [x] **4. Update info card text**
  - Change "Risk Protection Active" card to reflect new proportional behavior
  - Update preview example text

- [x] **5. Manual Testing**
  - Verify Simple Mode sends correct Range parameters
  - Verify copy trades execute with proportional sizing
  - Confirm max cap is respected for large trader positions
