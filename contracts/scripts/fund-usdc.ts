
import { ethers } from 'hardhat';

type Erc20Like = {
    transfer(to: string, amount: bigint): Promise<{ wait: () => Promise<unknown> }>;
    balanceOf(account: string): Promise<bigint>;
};

async function main() {
    // Target Address: Hardhat #0 (Default) or passed as argument
    const targetAddress = process.env.TARGET_FUND_ADDRESS || '0x90F79bf6EB2c4f870365E785982E1f101E93b906';

    // USDC Address on Polygon
    const USDC_ADDRESS = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
    // A Known Whale on Polygon (Binance Hot Wallet)
    const WHALE_ADDRESS = '0xe7804c37c13166fF0b37F5aE0BB07A3aEbb6e245';
    const AMOUNT = ethers.parseUnits('85000', 6); // 85000 USDC
    console.log(`🚀 Funding ${targetAddress} with 85000 USDC...`);

    // Validate we are on a fork where Polygon USDC contract exists
    const code = await ethers.provider.getCode(USDC_ADDRESS);
    if (code === "0x") {
        throw new Error(
            `USDC contract not found at ${USDC_ADDRESS}. Start Hardhat with Polygon forking enabled (set ENABLE_FORK=true and MAINNET_FORK_RPC_URL).`
        );
    }

    // 1. Impersonate Whale
    await ethers.provider.send("hardhat_impersonateAccount", [WHALE_ADDRESS]);
    // Ensure the impersonated account has native token to pay gas on local fork
    await ethers.provider.send("hardhat_setBalance", [
        WHALE_ADDRESS,
        ethers.toBeHex(ethers.parseEther("1")),
    ]);
    const whale = await ethers.getSigner(WHALE_ADDRESS);

    // 2. Connect to USDC
    const usdc = new ethers.Contract(USDC_ADDRESS, [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)",
    ], whale) as unknown as Erc20Like;

    // 3. Transfer
    console.log(`💸 Transferring from Whale: ${WHALE_ADDRESS}...`);
    const tx = await usdc.transfer(targetAddress, AMOUNT);
    await tx.wait();

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [WHALE_ADDRESS]);

    // 4. Verify
    const balance = await usdc.balanceOf(targetAddress);
    console.log(`✅ Success! New Balance: ${ethers.formatUnits(balance, 6)} USDC`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
