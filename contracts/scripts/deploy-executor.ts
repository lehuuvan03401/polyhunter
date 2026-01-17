
import { ethers, network } from "hardhat";
import * as dotenv from "dotenv";
import { HDNodeWallet } from "ethers";

dotenv.config({ path: "../../frontend/.env" }); // Load from frontend .env where secrets are

async function main() {
    console.log("🚀 Starting deployment of PolyHunterExecutor...");

    let mnemonic = process.env.TRADING_MNEMONIC;

    // Fallback for Localhost/Fork testing
    if (!mnemonic && (network.name === "localhost" || network.name === "hardhat")) {
        console.warn("⚠️ No TRADING_MNEMONIC in env, using DEFAULT TEST MNEMONIC for Localhost!");
        mnemonic = "test test test test test test test test test test test junk";
    }

    // 1. Deploy Contract
    const PolyHunterExecutor = await ethers.getContractFactory("PolyHunterExecutor");
    const executor = await PolyHunterExecutor.deploy();
    await executor.waitForDeployment();
    const executorAddress = await executor.getAddress();

    console.log(`✅ PolyHunterExecutor deployed to: ${executorAddress}`);

    // 2. Derive Workers
    const workers: string[] = [];

    if (mnemonic) {
        console.log("👮 Deriving Worker Fleet from Mnemonic...");
        const poolSize = 20;
        // Base path: m / purpose' / coin_type' / account' / change
        const root = HDNodeWallet.fromPhrase(mnemonic, undefined, "m/44'/60'/0'/0");

        for (let i = 0; i < poolSize; i++) {
            const child = root.deriveChild(i);
            workers.push(child.address);
        }
    } else if (process.env.TRADING_PRIVATE_KEY) {
        console.warn("⚠️ NO MNEMONIC! Whitelisting Single Master Wallet (Legacy Mode)...");
        // Whitelist the deployer (Master Wallet)
        const [deployer] = await ethers.getSigners();
        workers.push(deployer.address);
    } else {
        throw new Error("Neither TRADING_MNEMONIC nor TRADING_PRIVATE_KEY found!");
    }

    console.log(`Adding ${workers.length} workers to whitelist...`);
    if (workers.length > 0) {
        console.log(`Sample: ${workers[0]}`);

        // 3. Whitelist Workers
        const tx = await executor.addWorkers(workers);
        await tx.wait();
        console.log(`✅ Fleet Whitelisted! Transaction: ${tx.hash}`);
    }

    console.log("\n============================================");
    console.log(`✅ PolyHunterExecutor deployed to: ${executorAddress}`);

    // Automate .env update
    try {
        const fs = require('fs');
        const path = require('path');
        const envPath = path.resolve(__dirname, "../../frontend/.env");

        let envContent = "";
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const varName = "NEXT_PUBLIC_EXECUTOR_ADDRESS";
        const newline = `${varName}="${executorAddress}"`;

        if (envContent.includes(varName)) {
            // Replace existing
            const regex = new RegExp(`${varName}=.*`, 'g');
            envContent = envContent.replace(regex, newline);
        } else {
            // Append
            envContent += `\n${newline}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`🤖 Auto-updated ${varName} in frontend/.env`);
    } catch (e: any) {
        console.warn(`⚠️ Failed to auto-update .env: ${e.message}`);
    }
    console.log("============================================\n");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
