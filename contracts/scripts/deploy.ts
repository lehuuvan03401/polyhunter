import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const network = await ethers.provider.getNetwork();
    const chainId = Number(network.chainId);
    let usdcAddress: string;
    let ctfExchangeAddress: string;

    // Polygon Mainnet - USDC.e (required for Polymarket CTF)
    const REAL_USDC = process.env.USDC_ADDRESS || "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";
    const REAL_CTF = process.env.CTF_EXCHANGE_ADDRESS || process.env.CTF_ADDRESS || "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";

    // check if we are forking mainnet (code exists at address)
    const usdcCode = await ethers.provider.getCode(REAL_USDC);
    const isFork = usdcCode !== "0x";

    if (chainId === 137 || isFork) {
        console.log("📝 Using Polygon Mainnet addresses (mainnet or fork detected)");
        usdcAddress = REAL_USDC;
        ctfExchangeAddress = REAL_CTF;
    } else if (chainId === 80002) {
        console.log("📝 Amoy testnet - deploying mock USDC...");

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUsdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
        await mockUsdc.waitForDeployment();
        usdcAddress = await mockUsdc.getAddress();
        ctfExchangeAddress = deployer.address; // Placeholder (mock)

        console.log("✅ Mock USDC deployed to:", usdcAddress);
    } else {
        console.log("📝 Local network - deploying mock USDC...");

        const MockERC20 = await ethers.getContractFactory("MockERC20");
        const mockUsdc = await MockERC20.deploy("Mock USDC", "USDC", 6);
        await mockUsdc.waitForDeployment();
        usdcAddress = await mockUsdc.getAddress();
        ctfExchangeAddress = deployer.address; // Placeholder (mock)

        console.log("✅ Mock USDC deployed to:", usdcAddress);
    }

    if (!usdcAddress || usdcAddress === ethers.ZeroAddress) {
        throw new Error("Invalid USDC address");
    }
    if (!ctfExchangeAddress || ctfExchangeAddress === ethers.ZeroAddress) {
        throw new Error("Invalid CTF/Exchange address");
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

    // Deploy Executor
    console.log("\n📦 Deploying PolyHunterExecutor...");
    const Executor = await ethers.getContractFactory("PolyHunterExecutor");
    const executor = await Executor.deploy(); // No args, Owner = valid msg.sender
    await executor.waitForDeployment();
    const executorAddress = await executor.getAddress();
    console.log("✅ PolyHunterExecutor deployed to:", executorAddress);

    // Summary
    console.log("\n========================================");
    console.log("🎉 Deployment Complete!");
    console.log("========================================");
    console.log("Network:", network.name, `(chainId: ${network.chainId})`);
    console.log("USDC:", usdcAddress);
    console.log("Treasury:", treasuryAddress);
    console.log("ProxyFactory:", proxyFactoryAddress);
    console.log("Executor:", executorAddress);
    console.log("CTF/Exchange:", ctfExchangeAddress);
    console.log("========================================");

    const deploymentPath = path.join(__dirname, "../../deployed-addresses.json");
    fs.writeFileSync(deploymentPath, JSON.stringify({
        usdc: usdcAddress,
        treasury: treasuryAddress,
        proxyFactory: proxyFactoryAddress,
        executor: executorAddress,
        ctfExchange: ctfExchangeAddress,
        chainId: Number(network.chainId)
    }, null, 2));
    console.log(`\n💾 Addresses saved to ${deploymentPath}`);

    console.log("\n🔧 Env snippet (frontend/.env):");
    console.log(`NEXT_PUBLIC_PROXY_FACTORY_ADDRESS=${proxyFactoryAddress}`);
    console.log(`NEXT_PUBLIC_TREASURY_ADDRESS=${treasuryAddress}`);
    console.log(`NEXT_PUBLIC_EXECUTOR_ADDRESS=${executorAddress}`);
    console.log(`NEXT_PUBLIC_CTF_ADDRESS=${ctfExchangeAddress}`);

    // Return addresses for verification
    return {
        usdc: usdcAddress,
        treasury: treasuryAddress,
        proxyFactory: proxyFactoryAddress,
        executor: executorAddress,
    };
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
