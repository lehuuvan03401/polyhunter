
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES, CTF_ABI } from '../../../sdk/src/core/contracts';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env from frontend root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const TRADER_PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Hardhat #1
// Corresponds to: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

const MOCK_TOKEN_ID = "1000000000000000000001"; // Some random token ID

async function main() {
    console.log("🚀 Simulating Local Trade...");
    console.log(`RPC: ${RPC_URL}`);

    const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
    const traderWallet = new ethers.Wallet(TRADER_PK, provider);

    const ctfAddress = process.env.NEXT_PUBLIC_CTF_ADDRESS || CONTRACT_ADDRESSES.ctf;
    console.log(`CTF: ${ctfAddress}`);

    const ctf = new ethers.Contract(ctfAddress, [
        ...CTF_ABI,
        'function mint(address to, uint256 id, uint256 amount, bytes data) external', // Mock mint
    ], traderWallet);

    // 1. Mint tokens to Trader (simulating they bought them or have them)
    console.log(`\n1️⃣  Minting tokens to Trader (${traderWallet.address})...`);
    // Note: MockCTF must have a mint function exposed, or we use transfer if they already have balance.
    // Assuming deploying MockCTF allows public minting or owner minting.
    try {
        const txMint = await ctf.mint(traderWallet.address, MOCK_TOKEN_ID, ethers.utils.parseUnits("100", 6), "0x");
        await txMint.wait();
        console.log("✅ Minted.");
    } catch (e) {
        console.warn("⚠️ Mint failed (maybe not MockCTF or no permission). Trying Transfer anyway if balance exists.");
    }

    // 2. Execute Transfer (Simulating a SELL or a MOVEMENT that triggers the supervisor)
    // Transfer from Trader -> Random User (Sell)
    const randomBuyer = ethers.Wallet.createRandom().address;
    console.log(`\n2️⃣  Simulating SELL: Trader -> Buyer (${randomBuyer})...`);

    const amount = ethers.utils.parseUnits("10", 6); // 10 Shares
    const tx = await ctf.safeTransferFrom(
        traderWallet.address,
        randomBuyer,
        MOCK_TOKEN_ID,
        amount,
        "0x"
    );

    console.log(`✅ Tx Sent: ${tx.hash}`);
    await tx.wait();
    console.log("🎉 Transfer Confirmed! Supervisor should pick this up.");
}

main().catch(console.error);
