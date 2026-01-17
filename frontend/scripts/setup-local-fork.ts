
import { ethers, network } from 'hardhat';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from frontend root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const MASTER_PK = process.env.TRADING_PRIVATE_KEY;

async function main() {
    console.log("🛠️  Setting up Local Fork Environment...");

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const deployer = MASTER_PK ? new ethers.Wallet(MASTER_PK, provider) : (await ethers.getSigners())[0]; // Fallback to hardhat #0

    console.log(`Deployer: ${deployer.address}`);

    // 1. Deploy ProxyFactory
    console.log("🏭 Deploying ProxyFactory...");
    // We assume the artifact exists in contracts/artifacts
    // We can use hardhat-deployed artifacts usually found in ../contracts/artifacts/...
    // But since this script is in `frontend/scripts`, loading artifacts is tricky without hardhat runtime context.
    // OPTION: We prefer to run this via `npx hardhat run scripts/setup-local-fork.ts` inside `contracts/` directory?
    // NO, we are in `frontend`.
    // Let's use the ABIs from the SDK if possible, OR Require the JSONs from relative path.

    // Actually, `deploy-executor.ts` used `ethers.getContractFactory`. That only works if running via Hardhat.
    // So this script MUST be run via `npx hardhat run ...` inside `contracts` folder, OR we just use raw ethers + bytecode.
    // BUT we don't have the bytecode easily here.

    // HACK: We will instruct user to run `npx hardhat run ../frontend/scripts/setup-local-fork.ts` FROM `contracts/` directory.
    // That way `ethers.getContractFactory` works.

    // However, for this file content, we assume it's running in Hardhat context.
    const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
    const factory = await ProxyFactory.deploy();
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`✅ ProxyFactory deployed: ${factoryAddress}`);

    // 2. Create Proxy for Master Wallet
    console.log(`👤 Creating Proxy for Master Wallet (${deployer.address})...`);
    const tx = await factory.connect(deployer).createProxy(1); // Tier 1
    await tx.wait();

    const userProxy = await factory.getUserProxy(deployer.address);
    console.log(`✅ Proxy Created: ${userProxy}`);

    // 3. Fund Proxy with USDC (Simulated)
    // We need USDC artifact or ABI.
    const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
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

        const fundAmount = ethers.parseUnits("1000", 6); // 1000 USDC
        await usdc.transfer(userProxy, fundAmount);
        console.log(`✅ Funded Proxy with 1000 USDC`);
    } catch (e: any) {
        console.warn("⚠️ Failed to fund USDC (Are you on a Fork?):", e.message);
    }

    console.log("\n============================================");
    console.log("\n============================================");
    console.log(`✅ Factory Address: ${factoryAddress}`);

    // Automate .env update
    try {
        const fs = require('fs');
        const envPath = path.resolve(__dirname, "../.env"); // relative to frontend/scripts/

        let envContent = "";
        if (fs.existsSync(envPath)) {
            envContent = fs.readFileSync(envPath, 'utf8');
        }

        const varName = "NEXT_PUBLIC_PROXY_FACTORY_ADDRESS";
        const newline = `${varName}="${factoryAddress}"`;

        if (envContent.includes(varName)) {
            const regex = new RegExp(`${varName}=.*`, 'g');
            envContent = envContent.replace(regex, newline);
        } else {
            envContent += `\n${newline}\n`;
        }

        fs.writeFileSync(envPath, envContent);
        console.log(`🤖 Auto-updated ${varName} in frontend/.env`);
    } catch (e: any) {
        console.warn(`⚠️ Failed to auto-update .env: ${e.message}`);
    }
    console.log("============================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
