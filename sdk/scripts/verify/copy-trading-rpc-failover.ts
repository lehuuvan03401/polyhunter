import { ethers } from 'ethers';

const RPC_URLS = (process.env.COPY_TRADING_RPC_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
const FALLBACK_RPC = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';

async function selectExecutionRpc(timeoutMs: number = 2000): Promise<string> {
    const candidates = RPC_URLS.length > 0 ? RPC_URLS : [FALLBACK_RPC];

    for (const url of candidates) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), timeoutMs)),
            ]);
            return url;
        } catch (error) {
            console.warn(`[RPC Failover] Unhealthy: ${url}`);
        }
    }

    return FALLBACK_RPC;
}

async function main() {
    const selected = await selectExecutionRpc();
    console.log(`✅ Selected RPC: ${selected}`);
}

main().catch((error) => {
    console.error('RPC failover verification failed:', error);
    process.exit(1);
});
