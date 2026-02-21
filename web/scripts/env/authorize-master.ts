
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, EXECUTOR_ABI } from '../../../sdk/src/core/contracts';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from frontend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const MASTER_PK = process.env.TRADING_PRIVATE_KEY;

async function main() {
    console.log("👮 Authorizing Master Wallet as Worker...");

    if (!MASTER_PK) {
        throw new Error("Missing TRADING_PRIVATE_KEY in .env");
    }

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(MASTER_PK, provider);

    // Check balance
    const balance = await wallet.getBalance();
    console.log(`Wallet: ${wallet.address}`);
    console.log(`Balance: ${ethers.utils.formatEther(balance)} MATIC`);

    const executorAddress = process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS || CONTRACT_ADDRESSES.polygon.executor;
    console.log(`Executor Contract: ${executorAddress}`);

    const executor = new ethers.Contract(executorAddress, EXECUTOR_ABI, wallet);

    // Check if already authorized
    const isWorker = await executor.isWorker(wallet.address);
    if (isWorker) {
        console.log("✅ Wallet is ALREADY authorized.");
        return;
    }

    console.log("⚠️ Wallet not authorized. Sending addWorker transaction...");

    try {
        const feeData = await provider.getFeeData();
        const minTipGwei = 30;
        const minTip = ethers.utils.parseUnits(minTipGwei.toString(), 'gwei');
        const priorityFee = feeData.maxPriorityFeePerGas && feeData.maxPriorityFeePerGas.gt(minTip)
            ? feeData.maxPriorityFeePerGas
            : minTip;
        const maxFee = feeData.maxFeePerGas && feeData.maxFeePerGas.gt(priorityFee.mul(2))
            ? feeData.maxFeePerGas
            : priorityFee.mul(2);

        const tx = await executor.addWorker(wallet.address, {
            maxPriorityFeePerGas: priorityFee,
            maxFeePerGas: maxFee,
        });
        console.log(`Tx sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Authorization Success! Master Wallet is now a Worker.");
    } catch (e: any) {
        console.error("❌ Authorization Failed:", e.message);
        if (e.message.includes("Ownable")) {
            console.error("Reason: The wallet is not the OWNER of the Executor contract. Please use the deployer account.");
        }
    }
}

main().catch(console.error);
