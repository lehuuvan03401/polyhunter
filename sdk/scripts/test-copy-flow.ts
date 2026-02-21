
import { ethers } from 'ethers'; // Use ethers v5 as per project
import { CopyTradingExecutionService, ExecutionParams } from '../src/services/copy-trading-execution-service.ts';
import { TradingService, LimitOrderParams, MarketOrderParams, OrderResult, Order, Orderbook } from '../src/services/trading-service.ts';
import { CONTRACT_ADDRESSES, CTF_ABI, ERC20_ABI, PROXY_FACTORY_ABI, POLY_HUNTER_PROXY_ABI } from '../src/core/contracts.ts';
import { RateLimiter } from '../src/core/rate-limiter.ts';
import { createUnifiedCache } from '../src/core/unified-cache.ts';
import * as fs from 'fs';
import * as path from 'path';

// Hack for TSX to handle 'ethers' from hardhat or standard (we use standard ethers here)
// We assume this script runs via `npx tsx scripts/test-copy-flow.ts` connecting to localhost:8545

async function main() {
    console.log("🚀 Starting End-to-End Copy Trade Test...");

    // 1. Setup Provider & Signer
    const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545");
    const signer = provider.getSigner(0); // Account #0
    const signerAddress = await signer.getAddress();
    console.log(`👤 Actor: ${signerAddress}`);

    // Contracts
    const ADDRESSES = CONTRACT_ADDRESSES.polygon; // Assuming fork is Polygon
    const USDC_ADDRESS = ADDRESSES.usdc;
    const CTF_ADDRESS = CONTRACT_ADDRESSES.ctf; // Top level

    if (!USDC_ADDRESS || !CTF_ADDRESS) {
        throw new Error("❌ Missing Contract Addresses");
    }

    // Deploy Proxy Factory (Since Fork might not have it or address mismatch)
    console.log("\n🛠 Deploying ProxyFactory...");

    // Read ProxyFactory Artifact
    const artifactPath = path.join(process.cwd(), 'contracts/artifacts/contracts/ProxyFactory.sol/ProxyFactory.json');
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`❌ Artifact not found at ${artifactPath}. Did you run 'npx hardhat compile'?`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    const FactoryFactory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    // constructor(address _usdc, address _ctfExchange, address _treasury, address _owner)
    const treasury = signerAddress; // Use signer as treasury
    const factoryContract = await FactoryFactory.deploy(USDC_ADDRESS, CTF_ADDRESS, treasury, signerAddress);
    await factoryContract.deployed();
    const PROXY_FACTORY_ADDRESS = factoryContract.address;
    console.log(`   ✅ ProxyFactory Deployed at: ${PROXY_FACTORY_ADDRESS}`);

    // HACK: Overwrite USDC with MockERC20 to ensure standard behavior
    console.log("\n🤡 Overwriting USDC with MockERC20...");
    const mockArtifactPath = path.join(process.cwd(), 'contracts/artifacts/contracts/mocks/MockERC20.sol/MockERC20.json');
    if (!fs.existsSync(mockArtifactPath)) {
        throw new Error(`❌ MockERC20 Artifact not found at ${mockArtifactPath}.`);
    }
    const mockArtifact = JSON.parse(fs.readFileSync(mockArtifactPath, 'utf8'));
    // Deploy to get runtime bytecode (with constructor args setup if any? MockERC20 usually has mint)
    const MockERC20Factory = new ethers.ContractFactory(mockArtifact.abi, mockArtifact.bytecode, signer);
    const mockInstance = await MockERC20Factory.deploy("Mock USDC", "USDC", 6);
    await mockInstance.deployed();
    const mockBytecode = await provider.getCode(mockInstance.address);
    // Set Code at USDC_ADDRESS
    await provider.send("hardhat_setCode", [USDC_ADDRESS, mockBytecode]);

    // Now USDC_ADDRESS behaves like MockERC20
    // We need to initialize it or just Mint?
    // Usually MockERC20 has 'mint'. But the overwritten contract storage is from OLD USDC!
    // This is dangerous. Storage layout mismatch.
    // BUT MockERC20 usually just uses slot 0 or mappings.
    // Real USDC Proxy storage is complex.
    // BETTER: Just deploy MockERC20 and use IT, if avoiding 'USDC_ADDRESS' mismatch.
    // Failure: Contracts expect USDC_ADDRESS constant.
    // SO: Best is to 'hardhat_setCode', but STORAGE will be garbage.
    // We must RESET storage for balances.
    // Or just MINT to ourselves (which updates our slot).
    // Does MockERC20 work with dirty storage?
    // It might overwrite slots used by Proxy pattern.
    // Since we are replacing the CODE, the old storage is interpreted by NEW code.
    // If MockERC20 uses standard mapping (slot 0 usually is implementation or whatever), it might conflict.
    // BUT we only care about Our Balances.
    // Checks:
    // 1. Mint to Signer.
    // 2. Mint to Proxy.
    // 3. Allowance.

    const mockUsdcContract = new ethers.Contract(USDC_ADDRESS, mockArtifact.abi, signer); // Use Mock ABI

    // Reset Signer Balance (Mint)
    // Mint 1000000
    // MockERC20 needs 'mint' function. Assuming it has one.
    console.log("   Minting fresh USDC to Signer...");
    await (await mockUsdcContract.mint(signerAddress, ethers.utils.parseUnits('10000', 6))).wait();


    // Extended CTF ABI for Testing (Minting)
    const EXTENDED_CTF_ABI = [
        ...CTF_ABI,
        'function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external',
        'function split(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata partition, uint256 amount) external',
        'function merge(address collateralToken, bytes32 parentCollectionId, bytes32 conditionId, uint256[] calldata partition, uint256 amount) external'
    ];

    // Redeclare usdc with Mock ABI for consistency if needed, but ERC20 ABI is subset. 
    // We keep 'usdc' but initialize it here to avoid redeclaration if it was declared before? 
    // Actually, we just need to use the one declared below or rename.
    // The below declaration is: 'const usdc = ...'
    // We will just let the below declaration happen.

    const usdc = new ethers.Contract(USDC_ADDRESS, mockArtifact.abi, signer); // Use MOCK ABI for all
    const ctf = new ethers.Contract(CTF_ADDRESS, EXTENDED_CTF_ABI, signer);
    const factory = new ethers.Contract(PROXY_FACTORY_ADDRESS, PROXY_FACTORY_ABI, signer);

    // 2. Ensure Proxy Exists or Create One
    console.log("\n🔍 Checking Proxy...");
    let proxyAddress = await factory.getUserProxy(signerAddress);
    if (proxyAddress === ethers.constants.AddressZero) {
        console.log("   Creating new Proxy...");
        const tx = await factory.createProxy(0); // Tier 0 (Starter)
        await tx.wait();
        proxyAddress = await factory.getUserProxy(signerAddress);
    }
    console.log(`   ✅ Proxy: ${proxyAddress}`);

    // APPROVE TRADING (Allow Bot to spend Proxy Funds)
    const proxyContract = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, signer);
    console.log("   Approving Bot to spend Proxy funds...");
    await (await proxyContract.approveTrading(signerAddress, ethers.constants.MaxUint256)).wait();

    // 3. Fund Proxy with USDC (MINT)
    const FUND_AMOUNT = ethers.utils.parseUnits('100', 6); // 100 USDC
    console.log(`\n💸 MINTING 100 USDC to Proxy...`);
    await (await usdc.mint(proxyAddress, FUND_AMOUNT)).wait();
    console.log("   ✅ Funds Minted");

    // 4. Create a Valid Condition & Position Token
    console.log("\n🎲 Creating Condition & Minting Tokens (for Mock Market)...");

    // Use a random condition ID generation strategy
    const questionId = ethers.utils.hexlify(ethers.utils.randomBytes(32));
    const oracle = signerAddress; // We are the oracle
    const outcomeSlotCount = 2; // Yes/No

    // prepareCondition(oracle, questionId, outcomeSlotCount)
    const txPrep = await ctf.prepareCondition(oracle, questionId, outcomeSlotCount);
    await txPrep.wait();

    // Compute Condition ID
    const conditionId = ethers.utils.solidityKeccak256(
        ['address', 'bytes32', 'uint256'],
        [oracle, questionId, outcomeSlotCount]
    );
    console.log(`   Condition ID: ${conditionId}`);

    // Compute Collection ID for Outcome 0 (e.g. YES)
    // collectionId(parentCollectionId, conditionId, indexSet)
    // parentCollectionId = 0x0
    // indexSet for Outcome 0 (binary) = 1 (binary 01)
    // indexSet for Outcome 1 (binary) = 2 (binary 10)
    const indexSet = 1;
    const parentCollectionId = ethers.constants.HashZero;
    const collectionId = ethers.utils.solidityKeccak256(
        ['bytes32', 'bytes32', 'uint256'],
        [parentCollectionId, conditionId, indexSet]
    );

    // Token ID is the Collection ID (CTF uses 1155, ID=CollectionID)
    const tokenId = collectionId; // This is a BigNumber or hex string
    console.log(`   Target Token ID (Outcome 0): ${tokenId}`);

    // Verify CTF Code
    const code = await provider.getCode(CTF_ADDRESS);
    if (code === '0x') {
        throw new Error(`❌ No code at CTF Address ${CTF_ADDRESS}. Fork might be wrong.`);
    }

    // HELPER: overwrite CTF balance via storage
    // We probe slots 0..30 to find 'balances' mapping
    const setCTFBalance = async (account: string, id: string, amount: ethers.BigNumber) => {
        // Solidity mapping(uint256 => mapping(address => uint256))
        // or mapping(address => mapping(uint256 => uint256))?
        // Gnosis CTF is: mapping (address => mapping (uint256 => uint256)) balances;
        // Wait, standard 1155 is mapping(uint256 => mapping(address => uint256)).
        // Gnosis CTF source says: mapping (address => mapping (uint256 => uint256)) internal balances;
        // Let's try both permutations.

        const amountHex = ethers.utils.hexZeroPad(amount.toHexString(), 32);

        for (let slot = 0; slot < 50; slot++) {
            // Permutation 1: balances[id][account] (Standard 1155)
            // key1 = id, slot = slot
            // key2 = account, slot = hash(key1 . slot)
            const map1 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['uint256', 'uint256'], [id, slot]));
            const finalSlot1 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'bytes32'], [account, map1]));

            // Permutation 2: balances[account][id] (Gnosis variant?)
            const map2 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['address', 'uint256'], [account, slot]));
            const finalSlot2 = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['uint256', 'bytes32'], [id, map2]));

            // Try Permutation 1
            await provider.send("hardhat_setStorageAt", [CTF_ADDRESS, finalSlot1, amountHex]);
            const bal1 = await ctf.balanceOf(account, id);
            if (bal1.eq(amount)) {
                console.log(`   Found CTF Balance Slot: ${slot} (Standard 1155 layout)`);
                return;
            }
            await provider.send("hardhat_setStorageAt", [CTF_ADDRESS, finalSlot1, "0x0000000000000000000000000000000000000000000000000000000000000000"]); // Reset

            // Try Permutation 2
            await provider.send("hardhat_setStorageAt", [CTF_ADDRESS, finalSlot2, amountHex]);
            const bal2 = await ctf.balanceOf(account, id);
            if (bal2.eq(amount)) {
                console.log(`   Found CTF Balance Slot: ${slot} (Reverse layout)`);
                return;
            }
            await provider.send("hardhat_setStorageAt", [CTF_ADDRESS, finalSlot2, "0x0000000000000000000000000000000000000000000000000000000000000000"]); // Reset
        }
        throw new Error("Could not find CTF balance slot via probing");
    };

    console.log("   Minting Tokens via Storage Manipulation...");
    const splitAmount = ethers.utils.parseUnits('50', 6);
    await setCTFBalance(signerAddress, tokenId.toString(), splitAmount);
    console.log("   ✅ Minted 50 Outcome Tokens (Storage overwrite)");

    // 5. Setup Mock Trading Service
    class MockTradingService extends TradingService {
        constructor() {
            // Pass dummy config
            super(
                new RateLimiter(),
                createUnifiedCache(),
                { privateKey: "0x0123456789012345678901234567890123456789012345678901234567890123" }
            );
        }

        async createMarketOrder(params: MarketOrderParams): Promise<OrderResult> {
            console.log(`   [MockExchange] Executing ${params.side} ${params.amount} shares...`);

            // SIMULATE CLOB MATCHING
            // In reality, CLOB swaps USDC <-> Tokens.
            // Since we (Signer) are both the "Bot" and the "Exchange" (via Split), 
            // we already have tokens in hand from step 4 if we are simulating we acquired them.

            // Wait, logic check: 
            // If Side=BUY: Bot needs to HAVE tokens to push to Proxy. 
            // In this script, Signer (Bot) *Just* minted them. So we are good.
            // If Side=SELL: Bot needs to HAVE USDC to push to Proxy.
            // Signer (Bot) *Just* received USDC from Whale. So we are good.

            // So this Mock doesn't strictly need to do on-chain swaps because the Signer
            // was pre-funded with BOTH assets for the purpose of this test.
            // We just return SUCCESS.

            return {
                success: true,
                orderId: "mock-order-123",
                transactionHashes: ["0xmockhash..."]
            };
        }

        async getOrderBook(tokenId: string): Promise<Orderbook> {
            // Mock depth for slippage calc
            return {
                hash: "0x",
                asks: [{ price: "0.50", size: "1000" }],
                bids: [{ price: "0.50", size: "1000" }]
            };
        }

        async getBalanceAllowance() {
            return { balance: "1000000000", allowance: "1000000000" };
        }
    }

    const mockTrading = new MockTradingService();
    const execService = new CopyTradingExecutionService(mockTrading, signer, 137);

    // Override resolveProxyAddress logic to return our custom factory deployed address if needed.
    // BUT CopyTradingExecutionService uses 'CONTRACT_ADDRESSES' internally.
    // We cannot easily override constants in imported module.
    // We can Mock 'resolveProxyAddress' method on the service instance!
    execService.resolveProxyAddress = async (addr) => {
        return factory.getUserProxy(addr);
    }
    // Also override 'getProxyUsdcBalance' ? No, that takes address arg.

    // 6. Test BUY Execution (Copy Trade)
    console.log("\n🚀 Testing BUY Execution...");
    const buyAmount = 10; // 10 USDC copy size
    const buyPrice = 0.5; // $0.50 price

    // Proxy Balance Before
    const balanceBefore = await usdc.balanceOf(proxyAddress);

    const resultBuy = await execService.executeOrderWithProxy({
        tradeId: 'test-trade-1',
        walletAddress: signerAddress,
        tokenId: tokenId.toString(),
        side: 'BUY',
        amount: buyAmount,
        price: buyPrice,
        proxyAddress,
        slippageMode: "FIXED"
    });

    if (resultBuy.success) {
        console.log(`   ✅ BUY Success! TX: ${resultBuy.tokenPushTxHash}`);
    } else {
        console.error(`   ❌ BUY Failed: ${resultBuy.error}`);
    }

    // Verify Proxy Logic
    // Proxy should have less USDC (if not float) and More Tokens.
    // Wait, did we use Float? 
    // `CopyTradingExecutionService`: checks `getBotUsdcBalance`.
    // Bot has 100 USDC. Amount is 10.
    // So it will use **Float Strategy**.
    // Proxy USDC should NOT change (Simulated Reimbursement?)
    // Ah, `executeOrderWithProxy` calls `transferFromProxy` (Reimburse) at the end if float.
    // So Proxy USDC *Should* decrease by 10.
    const balanceAfter = await usdc.balanceOf(proxyAddress);
    console.log(`   Proxy USDC: ${ethers.utils.formatUnits(balanceBefore, 6)} -> ${ethers.utils.formatUnits(balanceAfter, 6)}`);

    // Verify Token Balance
    const proxyTokenBal = await ctf.balanceOf(proxyAddress, tokenId);
    console.log(`   Proxy Tokens: ${ethers.utils.formatUnits(proxyTokenBal, 6)} (Expected ~ ${(buyAmount / buyPrice)})`);


    // 7. Test SELL Execution
    console.log("\n🚀 Testing SELL Execution...");
    const sellAmount = 10; // 10 Shares? Or 10 USDC value?
    // Params: `amount`. Logic: `sharesToSell = amount / price`.
    // If we want to sell ALL the shares we just bought (20 shares = $10 / 0.5),
    // we should pass amount = 10 (USDC Value).

    const resultSell = await execService.executeOrderWithProxy({
        tradeId: 'test-trade-2',
        walletAddress: signerAddress,
        tokenId: tokenId.toString(),
        side: 'SELL',
        amount: sellAmount,
        price: buyPrice,
        proxyAddress,
        slippageMode: "FIXED"
    });

    if (resultSell.success) {
        console.log(`   ✅ SELL Success! TX: ${resultSell.returnTransferTxHash}`);
    } else {
        console.error(`   ❌ SELL Failed: ${resultSell.error}`);
    }

    const balanceFinal = await usdc.balanceOf(proxyAddress);
    console.log(`   Proxy USDC Final: ${ethers.utils.formatUnits(balanceFinal, 6)}`);

    console.log("\n✅ End-to-End Test Complete");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
