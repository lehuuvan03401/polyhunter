// npx tsx scripts/verify/parallel-order-placement.ts
import { CopyTradingExecutionService } from '../../src/services/copy-trading-execution-service.js';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
    const signer = {
        getAddress: async () => '0x000000000000000000000000000000000000dead',
        provider: null,
    } as any;

    let inFlight = 0;
    let maxConcurrent = 0;
    let barrierResolve: (() => void) | null = null;
    const barrier = new Promise<void>((resolve) => {
        barrierResolve = resolve;
    });

    const tradingService = {
        async getBalanceAllowance() {
            return { allowance: '1000000000' };
        },
        async createMarketOrder(params: any) {
            inFlight += 1;
            maxConcurrent = Math.max(maxConcurrent, inFlight);
            if (inFlight === 2 && barrierResolve) barrierResolve();
            await barrier;
            await sleep(50);
            inFlight -= 1;
            return {
                success: true,
                orderId: `order-${params.tokenId}-${Date.now()}`,
                transactionHashes: ['0xorder'],
            };
        },
        async getOrderBook() {
            return null;
        },
    } as any;

    class TestExecutionService extends CopyTradingExecutionService {
        async getBotUsdcBalance(): Promise<number> {
            return 1_000_000;
        }
    }

    const executionService = new TestExecutionService(tradingService, signer, 137);

    const params = {
        tradeId: 't1',
        walletAddress: '0x000000000000000000000000000000000000beef',
        tokenId: '0x000000000000000000000000000000000000cafe',
        side: 'BUY' as const,
        amount: 10,
        price: 0.5,
        proxyAddress: '0x000000000000000000000000000000000000babe',
        slippageMode: 'FIXED' as const,
        maxSlippage: 2,
        deferSettlement: true,
    };

    const timeout = sleep(2000).then(() => {
        throw new Error('Timeout waiting for parallel order placement');
    });

    await Promise.race([
        Promise.all([
            executionService.executeOrderWithProxy(params),
            executionService.executeOrderWithProxy({
                ...params,
                tradeId: 't2',
                proxyAddress: '0x000000000000000000000000000000000000f00d',
            }),
        ]),
        timeout,
    ]);

    if (maxConcurrent < 2) {
        throw new Error(`Expected parallel order placement; maxConcurrent=${maxConcurrent}`);
    }

    console.log(`[Verify] Parallel order placement observed (maxConcurrent=${maxConcurrent}).`);
}

run().catch((error) => {
    console.error('[Verify] Failed:', error?.message || error);
    process.exit(1);
});
