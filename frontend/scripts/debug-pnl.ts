
import { PolyClient } from "@catalyst-team/poly-sdk";
import * as dotenv from "dotenv";

dotenv.config();

// Default Hardhat Account 0 (from screenshot)
const USER_ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

async function main() {
    const client = new PolyClient({
        apiKey: process.env.POLY_API_KEY || "",
        endpoint: "http://localhost:3000/api" // Using local API if applicable, or SDK defaults
    });

    console.log(`Checking data for ${USER_ADDRESS}...`);

    try {
        console.log("Fetching Profile...");
        constprofile = await client.wallets.getWalletProfile(USER_ADDRESS);
        console.log("Profile Total PnL:", profile.totalPnL);
        console.log("Profile Data:", JSON.stringify(profile, null, 2));
    } catch (e) {
        console.error("Failed to fetch profile:", e.message);
    }

    try {
        console.log("\nFetching Positions...");
        const positions = await client.wallets.getWalletPositions(USER_ADDRESS);
        console.log(`Found ${positions.length} positions.`);

        positions.forEach((p, i) => {
            console.log(`\nPosition #${i + 1}: ${p.title}`);
            console.log(`  Outcome: ${p.outcome}`);
            console.log(`  Size (Shares):`, p.size);
            console.log(`  Avg Price (Buy):`, p.avgPrice);
            console.log(`  Cur Price (Market):`, p.curPrice);
            console.log(`  Percent PnL:`, p.percentPnl);

            // Calculate implied PnL
            if (p.size && p.avgPrice && p.curPrice) {
                const invest = p.size * p.avgPrice;
                const value = p.size * p.curPrice;
                const diff = value - invest;
                console.log(`  -> Implied PnL: $${diff.toFixed(4)}`);
            }
        });

    } catch (e) {
        console.error("Failed to fetch positions:", e.message);
    }
}

main();
