import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    server: {
        // Database
        DATABASE_URL: z.string().url().optional(),

        // Hardhat Forking
        MAINNET_FORK_RPC_URL: z.string().url().optional(),

        // Private Keys
        TRADING_PRIVATE_KEY: z.string().optional(),
        TRADING_MNEMONIC: z.string().optional(),

        // API credentials
        POLY_API_KEY: z.string().optional(),
        POLY_API_SECRET: z.string().optional(),
        POLY_API_PASSPHRASE: z.string().optional(),

        // Copy Trading Execution
        ENABLE_REAL_TRADING: z.coerce.boolean().optional().default(false),
        COPY_TRADING_API_URL: z.string().url().optional(),
        COPY_TRADING_DAILY_CAP_USD: z.coerce.number().optional(),
        COPY_TRADING_WALLET_DAILY_CAP_USD: z.coerce.number().optional(),
        COPY_TRADING_MARKET_DAILY_CAP_USD: z.coerce.number().optional(),
        COPY_TRADING_MARKET_CAPS: z.string().optional(),
        COPY_TRADING_EXECUTION_ALLOWLIST: z.string().optional(),
        COPY_TRADING_WORKER_ALLOWLIST: z.string().optional(),
        COPY_TRADING_MAX_TRADE_USD: z.coerce.number().optional(),
        COPY_TRADING_MAX_TRADES_PER_WINDOW: z.coerce.number().optional(),
        COPY_TRADING_TRADE_WINDOW_MS: z.coerce.number().optional().default(600000),
        COPY_TRADING_EMERGENCY_PAUSE: z.coerce.boolean().optional().default(false),
        COPY_TRADING_DRY_RUN: z.coerce.boolean().optional().default(false),
        COPY_TRADING_GUARDRAIL_LOG_INTERVAL_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_GUARDRAIL_ALERT_THRESHOLD: z.coerce.number().optional().default(20),
        COPY_TRADING_MIN_WALLET_MATIC: z.coerce.number().optional().default(0.1),
        COPY_TRADING_MIN_PROXY_USDC: z.coerce.number().optional().default(1),

        // Execution RPC
        COPY_TRADING_RPC_URL: z.string().url().optional(),
        COPY_TRADING_RPC_URLS: z.string().optional(),

        // WS
        COPY_TRADING_WS_FILTER_BY_ADDRESS: z.coerce.boolean().optional().default(false),

        // Signal Mode
        COPY_TRADING_SIGNAL_MODE: z.enum(["WS_ONLY", "POLLING_ONLY", "HYBRID"]).optional().default("HYBRID"),
        SUPERVISOR_POLLING_BASE_INTERVAL_MS: z.coerce.number().optional().default(5000),
        SUPERVISOR_POLLING_MAX_INTERVAL_MS: z.coerce.number().optional().default(10000),
        SUPERVISOR_POLLING_LIMIT: z.coerce.number().optional().default(200),
        SUPERVISOR_POLLING_LOOKBACK_SECONDS: z.coerce.number().optional().default(90),
        SUPERVISOR_WS_UNHEALTHY_THRESHOLD_MS: z.coerce.number().optional().default(30000),
        SUPERVISOR_SIGNAL_SOURCE_WINDOW_MS: z.coerce.number().optional().default(120000),

        // Fast settings etc.
        COPY_TRADING_PRICE_TTL_MS: z.coerce.number().optional().default(5000),
        COPY_TRADING_IDEMPOTENCY_BUCKET_MS: z.coerce.number().optional().default(5000),

        // Worker pool
        COPY_TRADING_WORKER_KEYS: z.string().optional(),
        COPY_TRADING_WORKER_INDEX: z.coerce.number().optional().default(0),

        // Monitoring
        COPY_TRADING_METRICS_INTERVAL_MS: z.coerce.number().optional().default(300000),
        COPY_TRADING_BOT_USDC_WARN: z.coerce.number().optional(),
        COPY_TRADING_BOT_MATIC_WARN: z.coerce.number().optional(),
        COPY_TRADING_PROXY_USDC_WARN: z.coerce.number().optional(),
        COPY_TRADING_PROXY_CHECK_LIMIT: z.coerce.number().optional().default(5),

        // Queues
        COPY_TRADING_MAX_RETRY_ATTEMPTS: z.coerce.number().optional().default(2),
        COPY_TRADING_RETRY_BACKOFF_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_RETRY_INTERVAL_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_ASYNC_SETTLEMENT: z.coerce.boolean().optional().default(false),
        COPY_TRADING_SETTLEMENT_MAX_RETRY_ATTEMPTS: z.coerce.number().optional().default(5),
        COPY_TRADING_SETTLEMENT_RETRY_BACKOFF_MS: z.coerce.number().optional().default(60000),

        // Ledger
        COPY_TRADING_LEDGER_ENABLED: z.coerce.boolean().optional().default(false),
        COPY_TRADING_LEDGER_FLUSH_AMOUNT: z.coerce.number().optional().default(100),
        COPY_TRADING_LEDGER_MAX_AGE_MS: z.coerce.number().optional().default(300000),
        COPY_TRADING_LEDGER_OUTSTANDING_CAP: z.coerce.number().optional().default(0),
        COPY_TRADING_LEDGER_FLUSH_INTERVAL_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_LEDGER_MAX_RETRY_ATTEMPTS: z.coerce.number().optional().default(5),
        COPY_TRADING_LEDGER_RETRY_BACKOFF_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_LEDGER_CLAIM_BATCH: z.coerce.number().optional().default(50),

        // Mempool
        MEMPOOL_PROVIDER: z.string().optional().default("STANDARD"),

        // Speed Mode
        COPY_TRADING_SPEED_MODE: z.coerce.boolean().optional().default(false),
        COPY_TRADING_SPEED_PROFILE: z.string().optional().default("standard"),
        COPY_TRADING_MAX_SPREAD_BPS: z.coerce.number().optional().default(80),
        COPY_TRADING_MIN_DEPTH_USD: z.coerce.number().optional().default(10),
        COPY_TRADING_MIN_DEPTH_RATIO: z.coerce.number().optional().default(1.2),
        COPY_TRADING_DEPTH_LEVELS: z.coerce.number().optional().default(5),
    },
    client: {
        NEXT_PUBLIC_NETWORK: z.string().min(1).default("localhost"),
        NEXT_PUBLIC_CHAIN_ID: z.coerce.number().int().default(31337),
        NEXT_PUBLIC_RPC_URL: z.string().url().default("http://127.0.0.1:8545"),
        NEXT_PUBLIC_PROXY_FACTORY_ADDRESS: z.string().optional(),
        NEXT_PUBLIC_TREASURY_ADDRESS: z.string().optional(),
        NEXT_PUBLIC_EXECUTOR_ADDRESS: z.string().optional(),
        NEXT_PUBLIC_USDC_ADDRESS: z.string().optional(),
        NEXT_PUBLIC_CTF_ADDRESS: z.string().optional(),
        NEXT_PUBLIC_BOT_ADDRESS: z.string().optional(),
        NEXT_PUBLIC_ALCHEMY_API_KEY: z.string().optional(),
    },
    experimental__runtimeEnv: {
        NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK,
        NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
        NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
        NEXT_PUBLIC_PROXY_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_PROXY_FACTORY_ADDRESS,
        NEXT_PUBLIC_TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS,
        NEXT_PUBLIC_EXECUTOR_ADDRESS: process.env.NEXT_PUBLIC_EXECUTOR_ADDRESS,
        NEXT_PUBLIC_USDC_ADDRESS: process.env.NEXT_PUBLIC_USDC_ADDRESS,
        NEXT_PUBLIC_CTF_ADDRESS: process.env.NEXT_PUBLIC_CTF_ADDRESS,
        NEXT_PUBLIC_BOT_ADDRESS: process.env.NEXT_PUBLIC_BOT_ADDRESS,
        NEXT_PUBLIC_ALCHEMY_API_KEY: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY,
    },
    emptyStringAsUndefined: true,
});
