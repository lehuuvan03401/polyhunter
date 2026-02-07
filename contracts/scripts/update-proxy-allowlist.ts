import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env') });

const PROXY_ADDRESS = (process.env.PROXY_ADDRESS || '').trim();
const TARGET_ADDRESS = (process.env.TARGET_ADDRESS || '').trim();
const ALLOWED = (process.env.ALLOWED || 'true').toLowerCase() !== 'false';

async function main() {
    if (!PROXY_ADDRESS) {
        throw new Error('PROXY_ADDRESS is missing.');
    }
    if (!TARGET_ADDRESS) {
        throw new Error('TARGET_ADDRESS is missing.');
    }

    const proxy = await ethers.getContractAt('PolyHunterProxy', PROXY_ADDRESS);
    const tx = await proxy.setAllowedTarget(TARGET_ADDRESS, ALLOWED);
    await tx.wait();

    console.log(`✅ Proxy allowlist updated: proxy=${PROXY_ADDRESS} target=${TARGET_ADDRESS} allowed=${ALLOWED}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
