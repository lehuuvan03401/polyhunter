
import { ethers, network } from 'hardhat';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from frontend root
// Load env from frontend root
dotenv.config({ path: path.resolve(__dirname, "../../frontend/.env") });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const MASTER_PK = process.env.TRADING_PRIVATE_KEY;
const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
const CTF_EXCHANGE = process.env.CTF_EXCHANGE_ADDRESS || process.env.CTF_ADDRESS || "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

async function main() {
    console.log("🛠️  Setting up Local Fork Environment...");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const deployer = MASTER_PK ? new ethers.Wallet(MASTER_PK, provider) : (await ethers.getSigners())[0]; // Fallback to hardhat #0

    console.log(`Deployer: ${deployer.address}`);

    // 0. Deploy Treasury
    console.log("🏦 Deploying Treasury...");
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(USDC_ADDRESS, deployer.address);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log(`✅ Treasury deployed: ${treasuryAddress}`);

    // 1. Deploy Executor
    console.log("🚀 Deploying Executor...");
    const Executor = await ethers.getContractFactory("PolyHunterExecutor");
    const executor = await Executor.deploy();
    await executor.waitForDeployment();
    const executorAddress = await executor.getAddress();
    console.log(`✅ Executor deployed: ${executorAddress}`);

    console.log("🔐 Setting Executor allowlist...");
    const allowTx = await executor.setAllowedTargets([USDC_ADDRESS, CTF_EXCHANGE], true);
    await allowTx.wait();
    console.log("✅ Executor allowlist set");

    // 2. Deploy ProxyFactory
    console.log("🏭 Deploying ProxyFactory...");
    const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
    // ProxyFactory(usdc, ctfExchange, treasury, owner)
    const factory = await ProxyFactory.deploy(
        USDC_ADDRESS,
        CTF_EXCHANGE,
        treasuryAddress, // Actual Treasury Contract
        executorAddress, // Bound Executor
        deployer.address  // Owner = Deployer
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`✅ ProxyFactory deployed: ${factoryAddress}`);

    // 3. Create Proxy for Master Wallet
    console.log(`👤 Creating Proxy for Master Wallet (${deployer.address})...`);
    const tx = await (factory as any).connect(deployer).createProxy(1); // Tier 1
    await tx.wait();

    const userProxy = await factory.getUserProxy(deployer.address);
    console.log(`✅ Proxy Created: ${userProxy}`);

    // 4. Fund Proxy with USDC (Simulated)
    // We need USDC artifact or ABI.
    // USDC_ADDRESS defined at top
    const IMPERSONATE_USDC_WHALE = "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245"; // Binace Hot Wallet or similar

    console.log("💰 Funding Proxy with USDC (via Whale Impersonation)...");

    try {
        await network.provider.request({
            method: "hardhat_impersonateAccount",
            params: [IMPERSONATE_USDC_WHALE],
        });
        const whaleSigner = await ethers.getSigner(IMPERSONATE_USDC_WHALE);

        // ERC20 ABI Subset
        const usdc = new ethers.Contract(USDC_ADDRESS, [
            "function transfer(address to, uint256 amount) returns (bool)",
            "function balanceOf(address account) view returns (uint256)"
        ], whaleSigner);

        const fundAmount = ethers.parseUnits("100000", 6); // 100000 USDC
        await usdc.transfer(userProxy, fundAmount);
        console.log(`✅ Funded Proxy with 100000 USDC`);
    } catch (e: any) {
        console.warn("⚠️ Failed to fund USDC (Are you on a Fork?):", e.message);
    }

    console.log("\n============================================");
    console.log("\n============================================");
    console.log(`✅ Factory Address: ${factoryAddress}`);
    console.log(`✅ Treasury Address: ${treasuryAddress}`);
    console.log(`✅ Executor Address: ${executorAddress}`);

    // Automate .env update
    try {
        const fs = require('fs');
        const envPath = path.resolve(__dirname, "../../frontend/.env"); // relative to contracts/scripts/

        let envContent = "";
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const updates = {
            "NEXT_PUBLIC_PROXY_FACTORY_ADDRESS": factoryAddress,
            "NEXT_PUBLIC_TREASURY_ADDRESS": treasuryAddress,
            "NEXT_PUBLIC_EXECUTOR_ADDRESS": executorAddress
        };

        for (const [key, value] of Object.entries(updates)) {
            const newline = `${key}="${value}"`;
            if (envContent.includes(key)) {
                const regex = new RegExp(`${key}=.*`, 'g');
                envContent = envContent.replace(regex, newline);
            } else {
                envContent += `\n${newline}\n`;
            }
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`🤖 Auto-updated .env with Factory and Treasury addresses`);
    } catch (e: any) {
        console.warn(`⚠️ Failed to auto-update .env: ${e.message}`);
    }
    console.log("============================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
