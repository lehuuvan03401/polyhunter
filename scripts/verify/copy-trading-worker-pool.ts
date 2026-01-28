import { ethers } from 'ethers';

const WORKER_KEYS = (process.env.COPY_TRADING_WORKER_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
const WORKER_INDEX = parseInt(process.env.COPY_TRADING_WORKER_INDEX || '0', 10);
const FALLBACK_KEY = process.env.TRADING_PRIVATE_KEY || '';

function selectWorkerKey(): { privateKey: string; index: number; total: number } | null {
    if (WORKER_KEYS.length > 0) {
        if (Number.isNaN(WORKER_INDEX) || WORKER_INDEX < 0 || WORKER_INDEX >= WORKER_KEYS.length) {
            throw new Error(`COPY_TRADING_WORKER_INDEX out of range (0-${WORKER_KEYS.length - 1})`);
        }
        return { privateKey: WORKER_KEYS[WORKER_INDEX], index: WORKER_INDEX, total: WORKER_KEYS.length };
    }

    if (FALLBACK_KEY) {
        return { privateKey: FALLBACK_KEY, index: 0, total: 1 };
    }

    return null;
}

async function main() {
    const workerSelection = selectWorkerKey();
    if (!workerSelection) {
        console.error('No worker key configured.');
        process.exit(1);
    }

    const wallet = new ethers.Wallet(workerSelection.privateKey);
    const address = await wallet.getAddress();

    console.log(`Selected worker index: ${workerSelection.index + 1}/${workerSelection.total}`);
    console.log(`Worker address: ${address}`);
}

main().catch((err) => {
    console.error('Worker pool verification failed:', err);
    process.exit(1);
});
