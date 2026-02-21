# Verification: Execution Stage Metrics

## Steps
1. Start the worker with real or simulated trades.
2. Trigger at least one successful execution and one preflight failure.
3. Wait for the metrics interval log.

## Expected
- Metrics summary includes a "Stage Metrics" section.
- Each stage shows count, avg, and max latency.
- For preflight failures, execution/persistence counts remain unchanged.
