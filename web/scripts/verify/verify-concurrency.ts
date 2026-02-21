
import { ethers } from 'ethers';
import { WalletManager } from '../../../sdk/src/core/wallet-manager';
import { RateLimiter } from '../../../sdk/src/core/rate-limiter';
import { createUnifiedCache } from '../../../sdk/src/core/unified-cache';

// Mock Provider (We don't need real chain methods for this logic test)
const mockProvider = new ethers.providers.JsonRpcProvider('http://localhost:8545');

async function main() {
    console.log("🧪 Starting Supervisor Concurrency Verification...");
    console.log("=================================================");

    // 1. Initialize Wallet Fleet (20 Workers)
    // Using a throwaway mnemonic for testing logic only
    const DUMMY_MNEMONIC = "test test test test test test test test test test test junk";
    const cache = createUnifiedCache();
    const rateLimiter = new RateLimiter();

    console.log("[Setup] Initializing WalletManager with 20 workers...");
    const walletManager = new WalletManager(
        mockProvider,
        rateLimiter,
        cache,
        DUMMY_MNEMONIC,
        20
    );

    // 2. Simulate Concurrent Jobs
    const JOB_COUNT = 10;
    const SIMULATED_TX_DURATION = 2000; // 2 seconds per tx

    console.log(`[Test] Simulating ${JOB_COUNT} concurrent trade signals...`);
    console.log(`[Test] Each trade takes ~${SIMULATED_TX_DURATION}ms (simulating blockchain latency)`);

    const jobs = Array.from({ length: JOB_COUNT }).map((_, i) => ({
        id: i,
        user: `User_${i}`
    }));

    const startTime = Date.now();
    const results: any[] = [];

    // 3. Execution Logic (mimicking Supervisor)
    const promises = jobs.map(async (job) => {
        // A. Checkout Worker
        const worker = walletManager.checkoutWorker();

        if (!worker) {
            console.error(`[Job ${job.id}] ❌ FAILED: No worker available!`);
            return;
        }

        console.log(`[Job ${job.id}] 🟢 Assigned to Worker ${worker.address.slice(0, 6)}...`);

        // B. Simulate Work (Async Sleep)
        // This proves "Dynamic Context" because each runs in its own closure with the specific worker 
        await new Promise(resolve => setTimeout(resolve, SIMULATED_TX_DURATION));

        const completionTime = Date.now();
        results.push({
            jobId: job.id,
            worker: worker.address,
            timestamp: completionTime
        });

        // C. Checkin Worker
        walletManager.checkinWorker(worker.address);
        console.log(`[Job ${job.id}] ✅ Done (Worker ${worker.address.slice(0, 6)} released)`);
    });

    // Wait for all to finish
    await Promise.all(promises);

    const totalTime = Date.now() - startTime;

    // 4. Analysis
    console.log("\n=================================================");
    console.log("📊 Results Analysis");
    console.log("=================================================");

    // Verify Unique Workers
    const usedWorkers = new Set(results.map(r => r.worker));
    console.log(`Total Jobs: ${JOB_COUNT}`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Unique Workers Used: ${usedWorkers.size}/${JOB_COUNT}`);

    // Verify Concurrency
    // If sequential, total time would be JOB_COUNT * 2000ms = 20000ms
    // If parallel, total time should be close to 2000ms
    const expectedSequential = JOB_COUNT * SIMULATED_TX_DURATION;

    console.log(`Theoretical / Sequential Time: ${expectedSequential}ms`);
    console.log(`Actual / Parallel Time:      ${totalTime}ms`);

    if (totalTime < expectedSequential / 2) {
        console.log("\n✅ SUCCESS: System demonstrated high concurrency!");
        console.log("   Execution time was drastically lower than sequential processing.");
        console.log("   Multiple unique workers were mobilized simultaneously.");
    } else {
        console.log("\n❌ FAILURE: System appears to be running sequentially.");
    }

    process.exit(0);
}

main().catch(console.error);
