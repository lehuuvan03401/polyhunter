import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // Get USDC address based on network
    const network = await ethers.provider.getNetwork();
    let usdcAddress: string;
    let ctfExchangeAddress: string;

    if (network.chainId === 137n) {
        // Polygon Mainnet - USDC.e (required for Polymarket CTF)
        usdcAddress = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
        // Polymarket CTF Exchange (Neg Risk)
        ctfExchangeAddress = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
    } else if (network.chainId === 80002n) {
        // Polygon Amoy Testnet
        // You'll need to deploy a mock USDC for testing
        console.log("⚠️  Amoy testnet - using mock addresses");
        usdcAddress = "0x0000000000000000000000000000000000000000"; // Replace with deployed mock
        ctfExchangeAddress = "0x0000000000000000000000000000000000000000";
    } else {
        // Local/Hardhat network - will use mock
        console.log("📝 Local network - deploying mock USDC...");

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUsdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
        await mockUsdc.waitForDeployment();
        usdcAddress = await mockUsdc.getAddress();
        ctfExchangeAddress = deployer.address; // Use deployer as mock CTF

        console.log("✅ Mock USDC deployed to:", usdcAddress);
    }

    // Deploy Treasury
    console.log("\n📦 Deploying Treasury...");
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(usdcAddress, deployer.address);
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();
    console.log("✅ Treasury deployed to:", treasuryAddress);

    // Deploy ProxyFactory
    console.log("\n📦 Deploying ProxyFactory...");
    const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
    const proxyFactory = await ProxyFactory.deploy(
        usdcAddress,
        ctfExchangeAddress,
        treasuryAddress,
        deployer.address
    );
    await proxyFactory.waitForDeployment();
    const proxyFactoryAddress = await proxyFactory.getAddress();
    console.log("✅ ProxyFactory deployed to:", proxyFactoryAddress);

    // Summary
    console.log("\n========================================");
    console.log("🎉 Deployment Complete!");
    console.log("========================================");
    console.log("Network:", network.name, `(chainId: ${network.chainId})`);
    console.log("USDC:", usdcAddress);
    console.log("Treasury:", treasuryAddress);
    console.log("ProxyFactory:", proxyFactoryAddress);
    console.log("========================================");

    // Return addresses for verification
    return {
        usdc: usdcAddress,
        treasury: treasuryAddress,
        proxyFactory: proxyFactoryAddress,
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
