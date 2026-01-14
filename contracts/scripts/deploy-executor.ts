
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { HDNodeWallet } from "ethers";

dotenv.config({ path: "../../frontend/.env" }); // Load from frontend .env where secrets are

async function main() {
    console.log("🚀 Starting deployment of PolyHunterExecutor...");

    const mnemonic = process.env.TRADING_MNEMONIC;
    if (!mnemonic) {
        throw new Error("TRADING_MNEMONIC not found in environment!");
    }

    // 1. Deploy Contract
    const PolyHunterExecutor = await ethers.getContractFactory("PolyHunterExecutor");
    const executor = await PolyHunterExecutor.deploy();
    await executor.waitForDeployment();
    const executorAddress = await executor.getAddress();

    console.log(`✅ PolyHunterExecutor deployed to: ${executorAddress}`);

    // 2. Derive Fleet Addresses
    console.log("👮 Deriving Worker Fleet for Whitelisting...");
    const poolSize = 20;
    const workers: string[] = [];

    // Base path: m / purpose' / coin_type' / account' / change
    const root = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0");

    for (let i = 0; i < poolSize; i++) {
        const child = root.deriveChild(i);
        workers.push(child.address);
    }

    console.log(`Adding ${workers.length} workers to whitelist...`);
    console.log(`Sample Start: ${workers[0]}`);
    console.log(`Sample End:   ${workers[workers.length - 1]}`);

    // 3. Whitelist Workers
    const tx = await executor.addWorkers(workers);
    await tx.wait();

    console.log(`✅ Fleet Whitelisted! Transaction: ${tx.hash}`);

    console.log("\n IMPORTANT: UPDATE YOUR ENV WITH:");
    console.log(`NEXT_PUBLIC_EXECUTOR_ADDRESS="${executorAddress}"`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
