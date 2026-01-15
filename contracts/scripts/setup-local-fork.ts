
import { ethers, network } from 'hardhat';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from frontend root (adjusted path: ../../frontend/.env)
dotenv.config({ path: path.resolve(__dirname, '../../frontend/.env') });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const MASTER_PK = process.env.TRADING_PRIVATE_KEY;

async function main() {
    console.log("🛠️  Setting up Local Fork Environment...");

    // Fallback: If no provider (e.g. not running via hardhat run), this behaves oddly. 
    // But we are running via hardhat run, so `ethers` and `network` are injected.

    // Note: RPC_URL is actually irrelevant inside `npx hardhat run` because Hardhat connects 
    // to the network specified by `--network localhost`.

    // Get Localhost Signers
    const signers = await ethers.getSigners();
    let deployer = signers[0];

    // If TRADING_PRIVATE_KEY is set, we prefer to use that as the "Master Wallet".
    // But hardhat already derived signers from mnemonic or accounts in config.
    // If we're on localhost, signers[0] IS the master wallet if we used the same mnemonic.
    // Let's print to verify.
    console.log(`Deployer (Hardhat Account #0): ${deployer.address}`);

    // If MASTER_PK is provided but differs from deployer, we might want to use it?
    // Actually, for simplicity on localhost, we stick to the Hardhat-derived accounts.
    // They are pre-funded.

    // 1. Deploy ProxyFactory
    console.log("🏭 Deploying ProxyFactory...");

    const USDC_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"; // Polygon USDC
    const CTF_ADDRESS = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";   // Polymarket CTF
    const TREASURY_ADDRESS = deployer.address; // For local test, Master Wallet receives fees

    const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
    const factory = await ProxyFactory.deploy(
        USDC_ADDRESS,
        CTF_ADDRESS,
        TREASURY_ADDRESS,
        deployer.address // Owner
    );
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();
    console.log(`✅ ProxyFactory deployed: ${factoryAddress}`);

    // 2. Create Proxy for Master Wallet
    // We want the proxy to belong to the Deployer (who mimics the User).
    console.log(`👤 Creating Proxy for Master Wallet (${deployer.address})...`);
    // NOTE: If factory was just deployed, it might not be indexed immediately? No, local is instant.
    const tx = await factory.connect(deployer).createProxy(1); // Tier 1
    await tx.wait();

    const userProxy = await factory.getUserProxy(deployer.address);
    console.log(`✅ Proxy Created: ${userProxy}`);

    // 3. Fund Proxy with USDC (Simulated)
    // USDC_ADDRESS is already defined above
    const IMPERSONATE_USDC_WHALE = "0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245"; // Binance Hot Wallet

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
    console.log("📝 UPDATE YOUR .env WITH THIS:");
    console.log(`NEXT_PUBLIC_PROXY_FACTORY_ADDRESS="${factoryAddress}"`);
    console.log("============================================");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
