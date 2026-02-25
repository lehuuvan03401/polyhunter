import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.TRADING_PRIVATE_KEY || "";

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.24",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
            forking: process.env.ENABLE_FORK ? {
                // Use a distinct env var for Fork Source to avoid picking up 'localhost' from frontend .env
                url: process.env.MAINNET_FORK_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
                // Note: blockNumber pin removed — public RPCs don't keep archival state.
                // To pin a block, use an archival RPC (Alchemy, QuickNode, etc.)
            } : undefined,
            mining: {
                auto: true,
                interval: 0
            }
        },
        // Polygon Mainnet
        polygon: {
            url: process.env.MAINNET_FORK_RPC_URL || "https://polygon-rpc.com",
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 137,
        },
        // Polygon Amoy Testnet
        amoy: {
            url: process.env.AMOY_RPC_URL || "https://polygon-amoy-bor-rpc.publicnode.com",
            accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
            chainId: 80002,
        },
    },
    etherscan: {
        apiKey: {
            polygon: process.env.POLYGONSCAN_API_KEY || "",
            polygonAmoy: process.env.POLYGONSCAN_API_KEY || "",
        },
    },
};

export default config;
