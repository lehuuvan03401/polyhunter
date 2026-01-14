# PolyHunter Production Deployment & Operations Manual

This guide outlines how to deploy the PolyHunter Copy Trading platform for a production environment capable of supporting high concurrency and mass users.

## 1. Infrastructure Requirements

### Servers
- **App Server**: Node.js v18+ (Running Next.js + Supervisor). Recommended: 4 vCPU, 8GB RAM.
- **Database**: PostgreSQL (Prisma supports SQLite, but Postgres is required for concurrency/locking in prod).
- **RPC Nodes**: 
    - **1x High-Performance HTTPS Endpoint** (for general queries).
    - **1x WebSocket (WSS) Endpoint** (REQUIRED for Mempool Sniping/Supervisor).
    - *Recomendation*: Alchemy Enterprise, Infura Pro, or private nodes (QuickNode/bloXroute).

### Wallet Preparation
- **Master Mnemonic**: You need ONE 12-word mnemonic phrase.
    - This generates the **Wallet Fleet** (Worker #0 - #19...).
    - **Funding**: Ensure the address at Index 0 (Master) has sufficient MATIC.
    - The `Auto-Refuel` system will automatically distribute MATIC from Master to Workers.

## 2. Environment Setup

Create a production `.env` file (`frontend/.env`).

```env
# --- Blockchain ---
NEXT_PUBLIC_CHAIN_ID=137
# MUST be a WebSocket URL for Supervisor to sniff mempool correctly
NEXT_PUBLIC_RPC_URL="wss://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
# Optional: Separate HTTP URL if needed for weak clients
# HTTP_RPC_URL="https://..."

# --- Secrets ---
# The Master Key for the fleet
TRADING_MNEMONIC="verify occur ... (12 words)"
# Fallback private key (optional, for scripts)
TRADING_PRIVATE_KEY="0x..."

# --- Database ---
# Use PostgreSQL for production!
DATABASE_URL="postgresql://user:password@localhost:5432/polyhunter?schema=public"

# --- Security ---
NEXTAUTH_SECRET="complex_random_string"
```

## 3. Deployment Sequence

Follow this exact order to start the system.

### Phase 1: Database Initialization
Before running any code, ensure the DB schema is synced.

```bash
cd poly-hunter/frontend

# 1. Install Dependencies
npm install

# 2. Generate Prisma Client
npx prisma generate

# 3. Push Schema to DB (do not use 'migrate dev' in prod)
npx prisma db push
```

### Phase 2: Start The "Brain" (Supervisor)
The Supervisor is the most critical process. It *must* run 24/7. We use **PM2** for process management.

```bash
# Install PM2 global
npm install -g pm2

# Start Supervisor
# We use 'tsx' to run the TypeScript file directly, or you can build it.
# Important: dedicated memory for the V8 engine
pm2 start "npx tsx scripts/copy-trading-supervisor.ts" --name poly-supervisor --max-memory-restart 2G

# Save PM2 list to respawn on reboot
pm2 save
pm2 startup
```

**Verification**:
Check logs to confirm fleet initialization:
```bash
pm2 logs poly-supervisor
# Expect: "[WalletManager] Initializing fleet of 20 wallets..."
# Expect: "[MempoolDetector] 🦈 Starting Mempool Sniffing..."
```

### Phase 3: Start The Web Interface
Now start the User Interface (Next.js).

```bash
# Build the application
npm run build

# Start production server
pm2 start "npm start" --name poly-frontend
```

## 4. Operational Maintenance

### Scaling (Handling More Users)
If you approach >1000 active concurrent copies, you may hit limits.
1.  **Increase Fleet Size**: Change `poolSize` in `copy-trading-supervisor.ts` from 20 to 50 or 100.
    *   *Note*: You must ensure the Master Wallet has enough MATIC to fund 100 wallets.
2.  **Horizontal Scaling**:
    *   You can run *multiple* Supervisors if you partition data (e.g., Supervisor A handles Users A-M, Supervisor B handles N-Z). *Requires code modification to partition the SQL query in `refreshConfigs`.*

### Monitoring
1.  **Balance Alert**: Use the `poly-supervisor` logs. It prints `[Auto-Refuel]` logs.
2.  **Performance**: Watch `pm2 monit`.
3.  **Transactions**: Monitor the **Master Wallet Address** on PolygonScan. All operational gas flows from there.

### Emergency Stop
If the platform malfunctions (e.g., bad oracle data, massive losses):

```bash
# Stop the Supervisor IMMEDIATELY. Pending txs may still mine, but no new ones will generate.
pm2 stop poly-supervisor
```

## 5. Architecture Diagram (Runtime)

```mermaid
graph TD
    User[Users] -->|Configure Strategy| Web[Next.js Web App]
    Web -->|Write Config| DB[(PostgreSQL)]
    
    subgraph "Operations Layer"
        Sup[Supervisor Daemon] -->|Read Configs| DB
        Sup -->|Listen (WSS)| Chain[Polygon Network]
        
        Detector[Mempool Detector] -.->|Sniff Pending| Chain
        
        Note[Fleet: 20+ Wallets]
        Sup -->|Dispatch| Fleet[Wallet Fleet]
    end
    
    Fleet -->|Execute Trade| Chain
    
    Master[Master Wallet] -.->|Auto Refuel| Fleet
```

先后次序:
第一步：数据库初始化 (Prisma)
第二步：启动 Supervisor (核心大脑，必须守护进程化)
第三步：启动 Next.js 前端 (用户界面)
服务编排:
推荐使用 PM2 来管理进程，确保 Supervisor 挂掉自动重启。
详细列出了配置要求（PostgreSQL, RPC WSS, Master Mnemonic）。
扩容策略:
当用户量暴增时，只需调整配置文件中的 poolSize 即可从 20 个 Worker 扩展到 100+。