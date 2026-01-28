import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, ERC20_ABI, CTF_ABI, USDC_DECIMALS } from '../../src/core/contracts.js';

const RPC_URLS = (process.env.COPY_TRADING_RPC_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
const RPC_URL = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137', 10);
const PROXY_ADDRESS = process.env.VERIFY_PROXY_ADDRESS;
const TOKEN_ID = process.env.VERIFY_TOKEN_ID || '';

if (!PROXY_ADDRESS) {
    console.error('VERIFY_PROXY_ADDRESS is required.');
    process.exit(1);
}

const addresses = (CHAIN_ID === 137 || CHAIN_ID === 31337 || CHAIN_ID === 1337)
    ? CONTRACT_ADDRESSES.polygon
    : CONTRACT_ADDRESSES.amoy;

if (!addresses.executor) {
    console.error('Executor address not configured.');
    process.exit(1);
}

async function selectExecutionRpc(timeoutMs: number = 2000): Promise<string> {
    const candidates = RPC_URLS.length > 0 ? RPC_URLS : [RPC_URL];

    for (const url of candidates) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), timeoutMs)),
            ]);
            return url;
        } catch (error) {
            console.warn(`[AllowanceCheck] RPC unhealthy, skipping: ${url}`);
        }
    }

    return RPC_URL;
}

async function main() {
    const provider = new ethers.providers.JsonRpcProvider(await selectExecutionRpc());
    if (!addresses.usdc) {
        console.error('USDC address not configured.');
        process.exit(1);
    }

    const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, provider);
    const allowanceRaw = await usdc.allowance(PROXY_ADDRESS, addresses.executor);
    const allowance = Number(allowanceRaw) / (10 ** USDC_DECIMALS);
    console.log(`USDC allowance (proxy -> executor): ${allowance}`);

    if (!TOKEN_ID) {
        console.warn('VERIFY_TOKEN_ID not set; skipping CTF approval check.');
        return;
    }

    const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, provider);
    const approved = await ctf.isApprovedForAll(PROXY_ADDRESS, addresses.executor);
    console.log(`CTF isApprovedForAll (proxy -> executor): ${approved}`);
}

main().catch((err) => {
    console.error('Allowance verification failed:', err);
    process.exit(1);
});
