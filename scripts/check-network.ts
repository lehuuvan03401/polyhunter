import { ethers } from 'ethers';
// import dotenv from 'dotenv';
import path from 'path';

import fs from 'fs';

// Manual env loader
function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env'); // Use CWD
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let value = match[2] || '';
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            });
        }
    } catch (e) {
        console.error('Failed to load env', e);
    }
}
loadEnv();

async function main() {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
    console.log(`Checking connection to: ${rpcUrl}`);

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);

    try {
        const network = await provider.getNetwork();
        console.log(`Connected to Chain ID: ${network.chainId}`);

        // Proxy Info
        // From error log: 0xA536e751Cc68997E898165b3213eec355e09c6d3
        const targetAddr = process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS || '0xA536e751Cc68997E898165b3213eec355e09c6d3';
        console.log(`Checking code at ${targetAddr}...`);

        const code = await provider.getCode(targetAddr);
        if (code === '0x') {
            console.error('❌ No code found at address! (EOA or empty)');
            console.error('Possible causes:');
            console.error('1. You are running a vanilla local node (not a fork).');
            console.error('2. You are connected to the wrong network.');
        } else {
            console.log(`✅ Code found! Length: ${code.length / 2} bytes`);
        }

    } catch (e) {
        console.error('Failed to connect:', e);
    }
}

main().catch(console.error);
