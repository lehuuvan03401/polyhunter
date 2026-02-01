
import { ethers } from 'hardhat';

async function main() {
    // Target Address: Hardhat #0 (Default) or passed as argument
    const targetAddress = process.env.TARGET_ADDRESS || '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

    // USDC Address on Polygon
    const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    // A Known Whale on Polygon (Binance Hot Wallet)
    const WHALE_ADDRESS = '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245';
    const AMOUNT = ethers.parseUnits('3500', 6); // 3500 USDC
    yu
    console.log(`🚀 Funding ${targetAddress} with 3500 USDC...`);

    // 1. Impersonate Whale
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS]);
    const whale = await ethers.getSigner(WHALE_ADDRESS);

    // 2. Connect to USDC
    const usdc = await ethers.getContractAt("IERC20", USDC_ADDRESS);

    // 3. Transfer
    console.log(`💸 Transferring from Whale: ${WHALE_ADDRESS}...`);
    const tx = await usdc.connect(whale).transfer(targetAddress, AMOUNT);
    await tx.wait();

    // 4. Verify
    const balance = await usdc.balanceOf(targetAddress);
    console.log(`✅ Success! New Balance: ${ethers.formatUnits(balance, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
