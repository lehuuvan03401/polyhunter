import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    server: {
        // 基础服务与数据库 (Database & Infra)
        DATABASE_URL: z.string().url().optional(),

        // 提示: 本地分叉网络的 RPC URL
        MAINNET_FORK_RPC_URL: z.string().url().optional(),

        // 重要密钥数据 (Private Keys - 仅服务端可用！)
        TRADING_PRIVATE_KEY: z.string().optional(),
        TRADING_MNEMONIC: z.string().optional(),

        // Polymarket 订单簿 API 鉴权 (Polymarket CLOB)
        POLY_API_KEY: z.string().optional(),
        POLY_API_SECRET: z.string().optional(),
        POLY_API_PASSPHRASE: z.string().optional(),

        // 跟单交易 (Copy Trading Execution) 基础风控参数
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

        // 代发交易 RPC
        COPY_TRADING_RPC_URL: z.string().url().optional(),
        COPY_TRADING_RPC_URLS: z.string().optional(),

        // Websocket 优化
        COPY_TRADING_WS_FILTER_BY_ADDRESS: z.coerce.boolean().optional().default(false),

        // 轮询 / 信号源模式 (Signal & Node Mode)
        COPY_TRADING_SIGNAL_MODE: z.enum(["WS_ONLY", "POLLING_ONLY", "HYBRID"]).optional().default("HYBRID"),
        SUPERVISOR_POLLING_BASE_INTERVAL_MS: z.coerce.number().optional().default(5000),
        SUPERVISOR_POLLING_MAX_INTERVAL_MS: z.coerce.number().optional().default(10000),
        SUPERVISOR_POLLING_LIMIT: z.coerce.number().optional().default(200),
        SUPERVISOR_POLLING_LOOKBACK_SECONDS: z.coerce.number().optional().default(90),
        SUPERVISOR_WS_UNHEALTHY_THRESHOLD_MS: z.coerce.number().optional().default(30000),
        SUPERVISOR_SIGNAL_SOURCE_WINDOW_MS: z.coerce.number().optional().default(120000),

        // 缓存生存期与幂等控制
        COPY_TRADING_PRICE_TTL_MS: z.coerce.number().optional().default(5000),
        COPY_TRADING_IDEMPOTENCY_BUCKET_MS: z.coerce.number().optional().default(5000),

        // Worker 集群池属性
        COPY_TRADING_WORKER_KEYS: z.string().optional(),
        COPY_TRADING_WORKER_INDEX: z.coerce.number().optional().default(0),

        // 监控报警阈值
        COPY_TRADING_METRICS_INTERVAL_MS: z.coerce.number().optional().default(300000),
        COPY_TRADING_BOT_USDC_WARN: z.coerce.number().optional(),
        COPY_TRADING_BOT_MATIC_WARN: z.coerce.number().optional(),
        COPY_TRADING_PROXY_USDC_WARN: z.coerce.number().optional(),
        COPY_TRADING_PROXY_CHECK_LIMIT: z.coerce.number().optional().default(5),

        // 常规丢单与重试队列
        COPY_TRADING_MAX_RETRY_ATTEMPTS: z.coerce.number().optional().default(2),
        COPY_TRADING_RETRY_BACKOFF_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_RETRY_INTERVAL_MS: z.coerce.number().optional().default(60000),

        // 异步结算重试控制
        COPY_TRADING_ASYNC_SETTLEMENT: z.coerce.boolean().optional().default(false),
        COPY_TRADING_SETTLEMENT_MAX_RETRY_ATTEMPTS: z.coerce.number().optional().default(5),
        COPY_TRADING_SETTLEMENT_RETRY_BACKOFF_MS: z.coerce.number().optional().default(60000),

        // 预支资金分类账 (Ledger) 功能
        COPY_TRADING_LEDGER_ENABLED: z.coerce.boolean().optional().default(false),
        COPY_TRADING_LEDGER_FLUSH_AMOUNT: z.coerce.number().optional().default(100),
        COPY_TRADING_LEDGER_MAX_AGE_MS: z.coerce.number().optional().default(300000),
        COPY_TRADING_LEDGER_OUTSTANDING_CAP: z.coerce.number().optional().default(0),
        COPY_TRADING_LEDGER_FLUSH_INTERVAL_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_LEDGER_MAX_RETRY_ATTEMPTS: z.coerce.number().optional().default(5),
        COPY_TRADING_LEDGER_RETRY_BACKOFF_MS: z.coerce.number().optional().default(60000),
        COPY_TRADING_LEDGER_CLAIM_BATCH: z.coerce.number().optional().default(50),

        // Mempool 提速
        MEMPOOL_PROVIDER: z.string().optional().default("STANDARD"),

        // 极速跟单与盘口防滑点 (Speed Mode)
        COPY_TRADING_SPEED_MODE: z.coerce.boolean().optional().default(false),
        COPY_TRADING_SPEED_PROFILE: z.string().optional().default("standard"),
        COPY_TRADING_MAX_SPREAD_BPS: z.coerce.number().optional().default(80),
        COPY_TRADING_MIN_DEPTH_USD: z.coerce.number().optional().default(10),
        COPY_TRADING_MIN_DEPTH_RATIO: z.coerce.number().optional().default(1.2),
        COPY_TRADING_DEPTH_LEVELS: z.coerce.number().optional().default(5),

        // ==========================================
        // Script & Feature Specific Configurations
        // ==========================================

        // 1. Managed Wealth Configuration
        MANAGED_WEALTH_LOOP_INTERVAL_MS: z.coerce.number().optional().default(60000),
        MANAGED_WEALTH_MAP_BATCH_SIZE: z.coerce.number().optional().default(100),
        MANAGED_WEALTH_NAV_BATCH_SIZE: z.coerce.number().optional().default(100),
        MANAGED_WEALTH_SETTLEMENT_BATCH_SIZE: z.coerce.number().optional().default(50),
        MANAGED_WEALTH_REQUIRE_SIGNATURE: z.coerce.boolean().optional().default(true),
        MANAGED_WEALTH_RUN_ONCE: z.coerce.boolean().optional().default(false),
        MW_VERIFY_ADMIN_WALLET: z.string().optional(),
        MW_VERIFY_BASE_URL: z.string().url().optional(),

        // 2. Supervisor & Monitoring Tuning
        SUPERVISOR_WORKER_POOL_SIZE: z.coerce.number().optional().default(10),
        SUPERVISOR_FANOUT_CONCURRENCY: z.coerce.number().optional().default(50),
        SUPERVISOR_CONFIG_FULL_REFRESH_MS: z.coerce.number().optional().default(3600000),
        SUPERVISOR_CONFIG_REFRESH_MS: z.coerce.number().optional().default(300000),
        SUPERVISOR_QUEUE_MAX_SIZE: z.coerce.number().optional().default(10000),
        SUPERVISOR_SHARD_COUNT: z.coerce.number().optional().default(1),
        SUPERVISOR_SHARD_INDEX: z.coerce.number().optional().default(0),
        ORDERS_LOG_PATH: z.string().optional().default("./logs/orders.log"),

        // 3. Live Copy Trading / Simulation
        FOLLOWER_WALLET: z.string().optional(),
        TARGET_TRADER: z.string().optional(),
        FIXED_COPY_AMOUNT: z.coerce.number().optional().default(10),
        SIM_COPY_MODE: z.string().optional().default("BUDGET_CONSTRAINED"),
        SIM_ACTIVITY_FILTER: z.string().optional().default("TRADER_ONLY"),
        SIM_WS_SERVER_FILTER: z.coerce.boolean().optional().default(false),

        // 4. Testing
        PLAYWRIGHT_BASE_URL: z.string().url().optional(),
        PLAYWRIGHT_PORT: z.coerce.number().optional(),

        // 5. Infrastructure
        REDIS_URL: z.string().url().optional(),
        SUPERVISOR_REDIS_URL: z.string().url().optional(),
        ENCRYPTION_KEY: z.string().optional(),
        POSTGRES_PRISMA_URL: z.string().url().optional(),
        CRON_SECRET: z.string().optional(),
        ADMIN_WALLETS: z.string().optional(),
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

        // Script & Features
        NEXT_PUBLIC_MANAGED_WEALTH_SIGN_REQUESTS: z.coerce.boolean().optional().default(true),
        NEXT_PUBLIC_E2E_MOCK_AUTH: z.coerce.boolean().optional().default(false),
        NEXT_PUBLIC_E2E_MOCK_WALLET: z.string().optional(),
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
        NEXT_PUBLIC_MANAGED_WEALTH_SIGN_REQUESTS: process.env.NEXT_PUBLIC_MANAGED_WEALTH_SIGN_REQUESTS,
        NEXT_PUBLIC_E2E_MOCK_AUTH: process.env.NEXT_PUBLIC_E2E_MOCK_AUTH,
        NEXT_PUBLIC_E2E_MOCK_WALLET: process.env.NEXT_PUBLIC_E2E_MOCK_WALLET,
    },
    emptyStringAsUndefined: true,
});
