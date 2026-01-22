
import { ethers } from "hardhat";

async function main() {
    const targetAddress = process.env.ADDRESS;

    if (!targetAddress) {
        console.error("❌ Please provide an address via 'ADDRESS' env var.");
        console.error("Example: ADDRESS=0x123... npx hardhat run scripts/fund-wallet.ts --network localhost");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    console.log(`💰 Funding ${targetAddress} from Deployer (${deployer.address})...`);

    // Send 1000 native tokens (ETH/MATIC)
    const tx = await deployer.sendTransaction({
        to: targetAddress,
        value: ethers.parseEther("1000.0"),
    });

    await tx.wait();
    console.log(`✅ Sent 1000 ETH/POL/MATIC to ${targetAddress}`);
    console.log(`   Tx Hash: ${tx.hash}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
