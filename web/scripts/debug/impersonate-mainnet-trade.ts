
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CTF_ABI } from '../../../sdk/src/core/contracts';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

// Real data from Polygon Mainnet
const REAL_WHALE = "0x892555E75350E11f2058d086C7236e8731778375"; // A known active trader or just a random whale?
// Let's use a known top holder of a specific CTF token if possible.
// Or just pick a random address from a block explorer.
// For demo, we will use a "Simulated Whale" address but we need to FUND it with tokens first.
// Wait, "Impersonate" means we can act as ANYONE.
// So we should pick an address that WE KNOW sends transactions.

// BETTER STRATEGY: 
// 1. Pick a real Token ID that exists on Mainnet CTF.
// 2. Find a holder of that Token ID (using block explorer or just minting if we could).
// 3. Since we are forking, we can just "deal" (setStorage/balance) ourselves tokens?
// No, impersonating is cleaner.

// Let's try to impersonate a known address.
// If we don't know a holder, we can just MINT tokens to our impersonated signer using `hardhat_setStorageAt` or similar cheats,
// BUT CTF state is complex.
// EASIEST: Just impersonate a random address and use `hardhat_setBalance` to give it MATIC, 
// then try to interact? 
// Actually, if we want to trigger "TransferSingle" from a specific trader, we just need that trader to call CTF.safeTransferFrom.
// Whether they actually hold the token? The contract checks balance.
// So we MUST impersonate someone who HOLDS the token.

// Let's assume we want to simulate Trader "0x123..."
// We can use `hardhat_setStorageAt` to overwrite the CTF contract storage to give 0x123 balance.
// However, finding the storage slot for a mapping(uint256 => mapping(address => uint256)) is annoying.

// ALTERNATIVE:
// Deploy a MOCK CTF? No, we are on Mainnet Fork. We must use REAL CTF.
// OK, simply use `hardhat_impersonateAccount` on the `CTF_ADDRESS` itself (if it has mint powers? unlikely).
// What if we impersonate the `Deployer` or `Owner` of CTF?

// BACKUP PLAN:
// Just pick a random address, use `hardhat_setBalance` to give it MATIC.
// Then use `hardhat_setCode` to replace the REAL CTF code with our MOCK CTF code that allows free minting?
// That breaks the "Real Mainnet" illusion slightly but is very effective for testing logic.

// BUT wait, we want to test Supervisor listening to REAL CTF address.
// So we must interact with 0x4D97...
// Let's try to IMPERSONATE A WHALE.
// Target Token: 1000...001 (Does it exist?) 
// Let's use a random valid-looking ID. 
// Or better: Just use `hardhat_setCode` to overwrite the CTF at 0x4D97... with a MockCTF.
// This preserves the ADDRESS (which Supervisor checks) but gives us full control logic.
// This is the standard "Fork + Mock" technique.

async function main() {
    console.log("🐳 Starting Mainnet Fork Simulation...");
    console.log(`RPC: ${RPC_URL}`);

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

    // 1. Setup Trader
    // We will impersonate this specific address as the "Signal Source"
    const TRADER_ADDRESS = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Hardhat #1
    console.log(`Target Trader: ${TRADER_ADDRESS}`);

    // Adjust Trader Balance (Give gas)
    await provider.send("hardhat_setBalance", [
        TRADER_ADDRESS,
        "0x56BC75E2D63100000" // 100 ETH
    ]);

    const traderSigner = provider.getSigner(TRADER_ADDRESS);
    await provider.send("hardhat_impersonateAccount", [TRADER_ADDRESS]);

    // 2. Hot-Swap CTF Contract at the Real Address
    // We want to verify Supervisor listens to the REAL address: 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
    // But we don't have tokens there. So we replace its code with MockCTF code.
    const REAL_CTF_ADDRESS = CONTRACT_ADDRESSES.ctf;
    console.log(`Real CTF Address: ${REAL_CTF_ADDRESS}`);

    // Compile MockCTF artifact (needs to be available) or just simple ABI bytecode
    // We assume MockCTF is compiled.
    // Ideally we fetch ABI/Bytecode from artifacts.
    // For this script, let's assuming artifacts are in `../contracts/artifacts/...`
    const mockArtifact = require("../../contracts/artifacts/contracts/mocks/MockCTF.sol/MockCTF.json");

    console.log("🛠️ Hot-swapping Real CTF with MockCTF bytecode...");
    await provider.send("hardhat_setCode", [
        REAL_CTF_ADDRESS,
        mockArtifact.deployedBytecode
    ]);

    const ctf = new ethers.Contract(REAL_CTF_ADDRESS, [
        ...CTF_ABI,
        'function mint(address to, uint256 id, uint256 amount, bytes data) external'
    ], traderSigner);

    // 3. Mint & Trade
    const TOKEN_ID = "2153435423452342345"; // Random ID

    console.log(`Minting (simulated) tokens to Trader on "Real" CTF...`);
    await (await ctf.mint(TRADER_ADDRESS, TOKEN_ID, ethers.utils.parseUnits("1000", 6), "0x")).wait();

    console.log("🚀 Executing SELL Signal (TransferSingle)...");
    const randomBuyer = ethers.Wallet.createRandom().address;

    // This transaction mimics a real user interaction with the (now mocked) Polymerket CTF
    const tx = await ctf.safeTransferFrom(
        TRADER_ADDRESS,
        randomBuyer,
        TOKEN_ID,
        ethers.utils.parseUnits("50", 6),
        "0x"
    );

    console.log(`✅ Signal Sent! Hash: ${tx.hash}`);
    await tx.wait();
    console.log("All done. Supervisor should have picked this up.");
}

main().catch(console.error);
