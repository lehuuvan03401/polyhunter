import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env') });

const EXECUTOR_ADDRESS = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS;
const WORKER_ADDRESS = (process.env.WORKER_ADDRESS || '').trim();

async function main() {
    if (!EXECUTOR_ADDRESS) {
        throw new Error('NEXT_PUBLIC_EXECUTOR_ADDRESS is missing.');
    }
    if (!WORKER_ADDRESS) {
        throw new Error('WORKER_ADDRESS is missing.');
    }

    const executor = await ethers.getContractAt('PolyHunterExecutor', EXECUTOR_ADDRESS);
    const tx = await executor.addWorker(WORKER_ADDRESS);
    await tx.wait();

    console.log(`✅ Added worker ${WORKER_ADDRESS} to executor ${EXECUTOR_ADDRESS}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
