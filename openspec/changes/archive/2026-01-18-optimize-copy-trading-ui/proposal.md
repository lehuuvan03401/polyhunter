# Optimize Copy Trading UI

## Why

The current copy trading modal has UX issues:
1. **Take Profit / Stop Loss** inputs are displayed but not implemented in backend
2. **EOA private key** has no validation before saving
3. Users lack visibility into what copying will cost them

These issues create confusion and potential data integrity problems.

## What Changes

### Clean Up Misleading Features
- Conditionally hide TP/SL inputs until backend implementation ready
- Add tooltip explaining "Coming Soon" for disabled features

### Add Validation
- Validate EOA private key format (0x + 64 hex chars)
- Check EOA balance has minimum required amount

### Improve Clarity
- Add trade preview calculation
- Show trader performance summary

## Scope

### In Scope
- `frontend/components/copy-trading/copy-trader-modal.tsx`
- Input validation logic
- UI polish

### Out of Scope
- Backend TP/SL implementation (separate proposal)
- WebSocket notifications (separate proposal)
