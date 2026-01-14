
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../../src/core/contracts';
import * as fs from 'fs';
import * as path from 'path';

// Usage: export $(grep -v '^#' .env | xargs) && npx tsx scripts/simulate-ctf-tx.ts

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

async function main() {
    const pk = process.env.TRADING_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat Account 0
    const wallet = new ethers.Wallet(pk, provider);

    console.log(`Sending simulation TX from ${wallet.address}...`);

    const ctfAddress = CONTRACT_ADDRESSES.ctf;

    // 1. Check if we need to Mock (if on localhost we likely do, unless it's a perfect fork with tokens)
    console.log(`Target CTF Address: ${ctfAddress}`);
    console.log("Injecting MockCTF code to ensure simulation works on Fork...");

    try {
        // Path to artifact: ../../contracts/artifacts/contracts/mocks/MockCTF.sol/MockCTF.json
        const artifactPath = path.join(__dirname, '../../contracts/artifacts/contracts/mocks/MockCTF.sol/MockCTF.json');

        if (!fs.existsSync(artifactPath)) {
            throw new Error(`MockCTF artifact not found at ${artifactPath}. Please run 'npx hardhat compile' in contracts/ dir.`);
        }

        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        const bytecode = artifact.deployedBytecode;

        // HARDHAT MAGIC: Overwrite the code at the Real CTF address with our Mock that allows ANY transfer
        await provider.send("hardhat_setCode", [
            ctfAddress,
            bytecode
        ]);

        console.log("✅ Successfully injected MockCTF code!");

    } catch (e: any) {
        console.warn("⚠️ Could not inject Mock code (maybe not running on Hardhat Node?). Trying anyway...", e.message);
    }

    // 2. Execute Transfer
    const iface = new ethers.utils.Interface([
        "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
    ]);

    // Data for safeTransferFrom(from, to, id, amount, data)
    const data = iface.encodeFunctionData("safeTransferFrom", [
        wallet.address,
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Random "To" address (Target Trader)
        "123456789", // Token ID
        "1000000",   // Amount
        "0x"         // Bytes data
    ]);

    const tx = await wallet.sendTransaction({
        to: ctfAddress,
        data: data,
        gasLimit: 500000 // A bit more gas for safety
    });

    console.log(`Payload sent! Tx Hash: ${tx.hash}`);
    console.log("Check Supervisor logs for detection!");
}

main().catch(console.error);
