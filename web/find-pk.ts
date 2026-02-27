import { ethers } from "ethers";

const mnemonic = "test test test test test test test test test test test junk";
for (let i = 0; i < 20; i++) {
    const wallet = ethers.Wallet.fromMnemonic(mnemonic, `m/44'/60'/0'/0/${i}`);
    if (wallet.address.toLowerCase() === "0xdD2FD4581271e230360230F9337D5c0430Bf44C0".toLowerCase()) {
        console.log(`Found! Path: m/44'/60'/0'/0/${i}`);
        console.log(`Address: ${wallet.address}`);
        console.log(`Private Key: ${wallet.privateKey}`);
        process.exit(0);
    }
}
// Maybe it's not from standard mnemonic path. Let's check environment fallback.
