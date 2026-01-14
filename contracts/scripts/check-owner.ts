import { ethers } from "hardhat";

async function main() {
    const PROXY_FACTORY_ADDRESS = "0x9f3F78951bBf68fc3cBA976f1370a87B0Fc13cd4";

    console.log(`Checking owner of ProxyFactory at ${PROXY_FACTORY_ADDRESS}...`);

    try {
        const ProxyFactory = await ethers.getContractFactory("ProxyFactory");
        const factory = ProxyFactory.attach(PROXY_FACTORY_ADDRESS);

        const owner = await factory.owner();
        console.log("Current Owner (Deployer):", owner);

        // Also check if we have access to this account
        const [signer] = await ethers.getSigners();
        console.log("Current Signer:", signer.address);

        if (owner.toLowerCase() === signer.address.toLowerCase()) {
            console.log("✅ You are the owner of this contract.");
        } else {
            console.log("⚠️ You are NOT the owner of this contract.");
        }

    } catch (error) {
        console.error("Error checking owner:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
