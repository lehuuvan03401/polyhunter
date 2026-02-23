import { copyTradingWorker } from '../workers/copy-trading-worker';
import { TradeOrchestrator } from '../../../sdk/src/core/trade-orchestrator';

async function main() {
    console.log("Setting up simulated FOK environment...");
}
main().catch(console.error);
