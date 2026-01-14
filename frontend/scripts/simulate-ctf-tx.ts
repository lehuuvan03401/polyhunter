
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../../src/core/contracts';

// Usage: npx tsx scripts/simulate-ctf-tx.ts <privateKey>
// Or just uses default hardhat key if on local

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

async function main() {
    const pk = process.env.TRADING_PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Hardhat Account 0
    const wallet = new ethers.Wallet(pk, provider);

    console.log(`Sending simulation TX from ${wallet.address}...`);

    const iface = new ethers.utils.Interface([
        "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)"
    ]);

    // Data for safeTransferFrom(from, to, id, amount, data)
    // Using random ID and Amount
    const data = iface.encodeFunctionData("safeTransferFrom", [
        wallet.address,
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Random "To" address
        "123456789", // Token ID
        "1000000",   // Amount
        "0x"         // Bytes data
    ]);

    const tx = await wallet.sendTransaction({
        to: CONTRACT_ADDRESSES.ctf,
        data: data,
        gasLimit: 200000
    });

    console.log(`Payload sent! Tx Hash: ${tx.hash}`);
}

main().catch(console.error);
