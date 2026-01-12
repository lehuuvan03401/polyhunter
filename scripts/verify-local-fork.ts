
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper for ESM directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
    console.log("🚀 Starting Local Fork Verification...");

    // 1. Load Deployed Addresses
    const configPath = path.resolve(__dirname, '../deployed-addresses.json');
    if (!fs.existsSync(configPath)) {
        throw new Error(`❌ deployed-addresses.json not found. Run 'npx hardhat run scripts/deploy.ts --network localhost' in 'contracts/' first.`);
    }
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    console.log("📝 Loaded Contract Addresses:", config);

    // 2. Set Environment Variables (Override constants)
    process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS = config.proxyFactory;
    process.env.USDC_ADDRESS = config.usdc;
    // Map Local (31337) to Amoy Env Vars because Service defaults to Amoy for non-137
    process.env.AMOY_PROXY_FACTORY_ADDRESS = config.proxyFactory;
    process.env.AMOY_USDC_ADDRESS = config.usdc;
    // Note: CTF address is usually standard on Polygon, but if we want to mock it fully locally we would need to deploy a Mock CTF.
    // For now assuming we are Forking Mainnet, so CTF address defaults to Real one in contracts.ts, which is fine.

    // 3. Dynamic Import of SDK
    const { CONTRACT_ADDRESSES, PROXY_FACTORY_ABI, POLY_HUNTER_PROXY_ABI, ERC20_ABI, CTF_ABI } = await import('../src/core/contracts.js');
    console.log("🔍 SDK CONTRACT_ADDRESSES:", JSON.stringify(CONTRACT_ADDRESSES, null, 2));

    const { CopyTradingExecutionService } = await import('../src/services/copy-trading-execution-service.js');

    // Mock Trading Service
    const mockTradingService: any = {
        getOrderBook: async () => ({ asks: [], bids: [] }),
        createMarketOrder: async (params: any) => {
            console.log("📈 [MockExchange] Executing Order:", params);
            return { success: true, orderId: `mock-${Date.now()}`, transactionHashes: ['0xMockOrderTx'] };
        }
    };

    // 4. Setup Provider & Signers
    // Assumes Hardhat Node is running at localhost:8545
    const provider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545');
    const network = await provider.getNetwork();
    console.log(`🔌 Connected to ${network.name} (ChainID: ${network.chainId})`);

    // Impersonate Generic Whale for USDC (Binance Hot Wallet) if on Fork
    // If using MockUSDC (local deployment), we can just mint.
    // Check if USDC is Mock (deployed by us) or Real.
    // If chainId is 137 (Hardhat Fork), deploy script might have used Real USDC.
    // BUT we ran deploy on 'localhost' which connects to 'hardhat node'.
    // If 'hardhat node' was started with '--fork', then chainId is 31337 or 137 depending on config.
    // Our 'deploy_and_save' wrote the chainId to json.

    const [deployer, user, bot] = [
        provider.getSigner(0), // Account #0
        provider.getSigner(1), // Account #1 (User)
        provider.getSigner(2)  // Account #2 (Bot)
    ];

    const deployerAddr = await deployer.getAddress();
    const userAddr = await user.getAddress();
    const botAddr = await bot.getAddress();

    console.log(`👤 User: ${userAddr}`);
    console.log(`🤖 Bot: ${botAddr}`);

    // 5. Fund User/Proxy with USDC
    const usdc = new ethers.Contract(config.usdc, [
        ...ERC20_ABI,
        'function mint(address to, uint256 amount) external', // Add mint for MockUSDC
    ], deployer);

    const FUND_AMOUNT = ethers.utils.parseUnits('5000', 6);

    try {
        console.log("💰 Minting Mock USDC to User Proxy...");
        // Get Proxy
        const factory = new ethers.Contract(config.proxyFactory, PROXY_FACTORY_ABI, user);
        let proxyAddr = await factory.getUserProxy(userAddr);

        if (proxyAddr === ethers.constants.AddressZero) {
            console.log("   Deploying Proxy...");
            const tx = await factory.createProxy(0);
            await tx.wait();
            proxyAddr = await factory.getUserProxy(userAddr);
        }
        console.log(`   User Proxy: ${proxyAddr}`);

        // Try minting (works if MockUSDC)
        try {
            const tx = await usdc.mint(proxyAddr, FUND_AMOUNT);
            await tx.wait();
            console.log("   ✅ Minted 5000 USDC to Proxy");
        } catch (e) {
            console.log("   ⚠️ Mint failed (likely Real USDC). Attempting Whale Transfer...");
            // Fallback: Impersonate Whale
            const WHALE = '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245';
            await provider.send('hardhat_impersonateAccount', [WHALE]);
            const whaleSigner = provider.getSigner(WHALE);
            const tx = await usdc.connect(whaleSigner).transfer(proxyAddr, FUND_AMOUNT);
            await tx.wait();
            console.log("   ✅ Transferred 5000 USDC from Whale");
        }

        // Fund Bot also (Float) - Mint to Bot
        try {
            await usdc.mint(botAddr, FUND_AMOUNT);
            console.log("   ✅ Minted 5000 USDC to Bot (Float)");
        } catch (e) {
            // Whale transfer to Bot
            const WHALE = '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245';
            const whaleSigner = provider.getSigner(WHALE);
            await usdc.connect(whaleSigner).transfer(botAddr, FUND_AMOUNT);
            console.log("   ✅ Transferred 5000 USDC to Bot (Float)");
        }

    } catch (error) {
        console.error("Fund Setup Failed:", error);
        process.exit(1);
    }

    // 6. Setup Delegation
    console.log("🔑 Setting Delegation...");
    const factory = new ethers.Contract(config.proxyFactory, PROXY_FACTORY_ABI, user);
    const proxyAddr = await factory.getUserProxy(userAddr);
    const proxy = new ethers.Contract(proxyAddr, POLY_HUNTER_PROXY_ABI, user);
    await (await proxy.setOperator(botAddr, true)).wait();
    console.log("   ✅ Bot is now an operator");

    // Approve Bot to spend Proxy USDC (Required for Pull)
    console.log("   🔑 Approving Bot to spend Proxy USDC...");
    const MAX_UINT = ethers.constants.MaxUint256;
    await (await proxy.approveTrading(botAddr, MAX_UINT)).wait();
    console.log("   ✅ Bot approved for USDC");

    // 7. Execute Copy Trade (BUY)
    console.log("\n⚡️ Executing Copy Trade (BUY)...");
    const executionService = new CopyTradingExecutionService(
        mockTradingService as any,
        bot as any, // Signer
        config.chainId // Chain ID from deployment
    );

    // Mock Orderbook for Dynamic Slippage
    mockTradingService.getOrderBook = async () => ({
        bids: [],
        asks: [{ price: '0.60', size: '1000' }] // Deep liquidity
    });

    const result = await executionService.executeOrderWithProxy({
        tradeId: 'local-test-1',
        walletAddress: userAddr,
        tokenId: '123456789', // Any dummy token ID unless we test CTF transfer
        side: 'BUY',
        amount: 100, // $100
        price: 0.5,
        proxyAddress: proxyAddr,
        slippageMode: 'AUTO',
        maxSlippage: 5.0
    });

    console.log("📝 Execution Result:", result);

    if (result.success) {
        console.log("✅ BUY Execution Successful!");
        // Verify Balance Deduction
        const finalBal = await usdc.balanceOf(proxyAddr);
        console.log(`   Proxy Balance: ${ethers.utils.formatUnits(finalBal, 6)} USDC`);
        // Note: Logic pulls $100 USDC.
        // If "Optimized Buy" (Bot Float) was used: Bot pays -> Push Tokens -> Pull USDC.
        // But Bot has NO Tokens (we didn't mint CTF).
        // So pushTokensToProxy will FAIL?
        // Service:
        //  executeOptimizedBuy -> trade -> transferTokensToProxy(ctf, tokenId, amount)
        // Since 'tokenId' doesn't exist/Bot has 0 balance, safeTransferFrom REVERTS.
        // Errors?
    } else {
        console.error("❌ Execution Failed:", result.error);

        // Expected Failure: "safeTransferFrom failed" because Bot has no CTF tokens to push.
        // This confirms the logic TRIED to work up to the Token Transfer.
        if (String(result.error).includes('transfer') || String(result.error).includes('revert')) {
            console.log("   (Expected failure if Bot has no CTF tokens to push)");
        }
    }
}

main().catch(console.error);
