import "dotenv/config";
import { resolve } from "path";
import { config } from "dotenv";
config({ path: resolve(__dirname, ".env.local"), override: true });
import { TradingService } from "../sdk/src/services/trading-service.js";

async function run() {
    console.log("Starting TradingService initialization test...");
    const service = new TradingService(null as any, null as any, {
        privateKey: process.env.TRADING_PRIVATE_KEY!,
        chainId: 137,
        credentials: undefined
    });

    try {
        await service.initialize();
        console.log("Service initialization succeeded.");
        console.log("Credentials keys:", Object.keys((service as any).credentials || {}));
        console.log("Credentials key value:", (service as any).credentials?.key);
        console.log("Credentials secret defined?:", !!(service as any).credentials?.secret);
    } catch (e) {
        console.error("Initialization threw an error:", e);
    }
}
run();
