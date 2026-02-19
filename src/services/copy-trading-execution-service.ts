import { ethers } from 'ethers';
import { gasStation } from './gas-station.js';
import { TradingService, Orderbook } from './trading-service.js'; // Use .js extension for imports in this project
import {
    PROXY_FACTORY_ABI,
    POLY_HUNTER_PROXY_ABI,
    EXECUTOR_ABI,
    ERC20_ABI,
    CTF_ABI,
    CONTRACT_ADDRESSES,
    USDC_DECIMALS
} from '../core/contracts.js';
import { scopedTxMutex } from '../core/tx-mutex.js';
import { TxMonitor, TrackedTx } from '../core/tx-monitor.js';

export interface ExecutionParams {
    tradeId: string;
    walletAddress: string; // User's wallet address (Owner of Proxy)
    tokenId: string;
    side: 'BUY' | 'SELL';
    amount: number; // In USDC (for BUY) or Shares (for SELL)? Copy logic usually calculates amount in USDC.
    price: number;
    proxyAddress?: string; // Optional, if already known
    slippage?: number;
    maxSlippage?: number; // Max allowed slippage (decimal, e.g. 0.05)
    slippageMode?: 'FIXED' | 'AUTO';
    orderType?: 'market' | 'limit';
    signer?: ethers.Signer; // Explicit signer for this execution (Worker Wallet)
    tradingService?: TradingService; // Explicit TradingService (with correct CLOB auth)
    overrides?: ethers.Overrides; // Gas overrides for On-Chain txs
    executionMode?: 'PROXY' | 'EOA'; // Execution Mode
    deferSettlement?: boolean; // Optional: defer settlement transfers (async queue)
    allowBotFloat?: boolean; // Optional: disable float usage (force proxy-funded path)
    deferReimbursement?: boolean; // Optional: defer reimbursement (ledger batching)
}

export interface ExecutionResult {
    success: boolean;
    orderId?: string;
    transactionHashes?: string[];
    fundTransferTxHash?: string;
    returnTransferTxHash?: string;
    tokenPullTxHash?: string;
    tokenPushTxHash?: string;
    error?: string;
    useProxyFunds?: boolean;
    usedBotFloat?: boolean;
    proxyAddress?: string;
    settlementDeferred?: boolean;
}

export interface AllowanceCheckResult {
    allowed: boolean;
    reason?: string;
    allowance?: number;
}

export interface DebtLogger {
    logDebt(debt: {
        proxyAddress: string;
        botAddress: string;
        amount: number;
        currency: string;
        error: string;
    }): Promise<void>;
}

export class CopyTradingExecutionService {
    private tradingService: TradingService;
    private defaultSigner: ethers.Signer;
    private chainId: number;
    private debtLogger?: DebtLogger;
    private proxyCache = new Map<string, string>(); // Optimization: Cache user -> proxy mapping
    private txMonitor?: TxMonitor;
    private txSignerByHash = new Map<string, ethers.Signer>();

    constructor(
        tradingService: TradingService,
        defaultSigner: ethers.Signer,
        chainId: number = 137,
        debtLogger?: DebtLogger
    ) {
        this.tradingService = tradingService;
        this.defaultSigner = defaultSigner; // Bot signer (Default worker)
        this.chainId = chainId;
        this.debtLogger = debtLogger;

        const provider = this.defaultSigner.provider;
        if (provider) {
            this.txMonitor = new TxMonitor(provider);
            // TxMonitor 只负责“发现卡单并触发替换”，真正替换交易由本服务执行，
            // 这样可以复用 signer mutex，避免替换交易与正常交易 nonce 冲突。
            this.txMonitor.start((tx, newGas) => this.replaceStuckTx(tx, newGas));
        } else {
            console.warn('[CopyExec] ⚠️ No provider on signer. TxMonitor disabled.');
        }
    }

    private getSigner(overrideSigner?: ethers.Signer): ethers.Signer {
        return overrideSigner || this.defaultSigner;
    }

    private async trackTx(tx: ethers.providers.TransactionResponse, signer: ethers.Signer): Promise<void> {
        if (!this.txMonitor) return;
        this.txSignerByHash.set(tx.hash, signer);

        const tracked: TrackedTx = {
            hash: tx.hash,
            submittedAt: Date.now(),
            nonce: tx.nonce,
            workerIndex: 0,
            replaced: false,
            data: tx.data || '0x',
            to: tx.to || ethers.constants.AddressZero,
            value: tx.value ?? ethers.constants.Zero,
            gasLimit: tx.gasLimit ?? ethers.constants.Zero,
            maxFeePerGas: tx.maxFeePerGas ?? undefined,
            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? undefined,
        };

        this.txMonitor.track(tracked);
    }

    private async replaceStuckTx(
        tx: TrackedTx,
        newGas: { maxPriorityFeePerGas: ethers.BigNumber }
    ): Promise<string | null> {
        const signer = this.txSignerByHash.get(tx.hash) || this.defaultSigner;
        if (!signer) return null;

        try {
            const bumpedMaxFee = tx.maxFeePerGas
                ? tx.maxFeePerGas.mul(120).div(100)
                : undefined;

            const replacement = await this.runWithSignerMutex(signer, 'replace', () => signer.sendTransaction({
                to: tx.to,
                data: tx.data,
                value: tx.value,
                gasLimit: tx.gasLimit,
                nonce: tx.nonce,
                maxPriorityFeePerGas: newGas.maxPriorityFeePerGas,
                maxFeePerGas: bumpedMaxFee,
            }));

            this.txSignerByHash.delete(tx.hash);
            this.txSignerByHash.set(replacement.hash, signer);
            return replacement.hash;
        } catch (error: any) {
            console.error('[CopyExec] ❌ Tx replacement failed:', error?.message || error);
            return null;
        }
    }

    private getProxyMutexKey(proxyAddress: string): string {
        return `proxy:${proxyAddress.toLowerCase()}`;
    }

    private getSignerMutexKey(signerAddress: string): string {
        return `signer:${signerAddress.toLowerCase()}`;
    }

    private async runWithProxyMutex<T>(proxyAddress: string, label: string, task: () => Promise<T>): Promise<T> {
        const key = this.getProxyMutexKey(proxyAddress);
        const queueDepth = scopedTxMutex.getQueueDepth(key);
        if (queueDepth > 0) {
            console.log(`[CopyExec] ⏳ Waiting on proxy mutex ${proxyAddress.slice(0, 6)} (${label}) queue=${queueDepth}`);
        }
        // proxy 维度互斥：保证同一个用户资金搬运/结算严格串行，防止账务交错。
        return scopedTxMutex.getMutex(key).run(task);
    }

    private async runWithSignerMutex<T>(signer: ethers.Signer, label: string, task: () => Promise<T>): Promise<T> {
        const signerAddress = await signer.getAddress();
        const key = this.getSignerMutexKey(signerAddress);
        const queueDepth = scopedTxMutex.getQueueDepth(key);
        if (queueDepth > 0) {
            console.log(`[CopyExec] ⏳ Waiting on signer mutex ${signerAddress.slice(0, 6)} (${label}) queue=${queueDepth}`);
        }
        // signer 维度互斥：保证单 signer nonce 连续，避免 pending nonce 竞争。
        return scopedTxMutex.getMutex(key).run(task);
    }

    private shouldDeferSettlement(params: ExecutionParams): boolean {
        // 参数优先于环境变量，便于单次调用覆盖全局策略。
        if (typeof params.deferSettlement === 'boolean') return params.deferSettlement;
        const flag = process.env.COPY_TRADING_ASYNC_SETTLEMENT;
        return flag === 'true' || flag === '1';
    }

    private shouldDeferReimbursementFlag(flag?: boolean): boolean {
        // 报销延迟默认关闭，必须调用侧显式开启。
        if (typeof flag === 'boolean') return flag;
        return false;
    }

    private getChainAddresses() {
        // 本地 fork（31337/1337）复用 polygon 地址配置，简化本地执行链路。
        return (this.chainId === 137 || this.chainId === 31337 || this.chainId === 1337)
            ? CONTRACT_ADDRESSES.polygon
            : CONTRACT_ADDRESSES.amoy;
    }

    private async getExecutorAddress(signer?: ethers.Signer): Promise<string> {
        const addresses = this.getChainAddresses();
        if (addresses.executor) return addresses.executor;
        const executionSigner = this.getSigner(signer);
        return executionSigner.getAddress();
    }

    private assertExecutionAddresses(): void {
        const addresses = this.getChainAddresses();
        const missing: string[] = [];

        if (!addresses.proxyFactory || addresses.proxyFactory.includes('0xabc123')) {
            missing.push('proxyFactory');
        }
        if (!addresses.executor) {
            missing.push('executor');
        }
        if (!addresses.usdc) {
            missing.push('usdc');
        }
        if (!CONTRACT_ADDRESSES.ctf) {
            missing.push('ctf');
        }

        if (missing.length > 0) {
            // 启动前快速失败，避免执行中途才发现配置缺失。
            throw new Error(`[CopyExec] Missing execution addresses: ${missing.join(', ')}`);
        }
    }

    /**
     * Get USDC balance of a Proxy wallet
     */
    async getProxyUsdcBalance(proxyAddress: string, signer?: ethers.Signer): Promise<number> {
        const addresses = this.getChainAddresses();
        const executionSigner = this.getSigner(signer);

        // Check if addresses.usdc is set
        if (!addresses.usdc) throw new Error("USDC address not configured for this chain");

        const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, executionSigner);
        const balance = await usdc.balanceOf(proxyAddress);
        return Number(balance) / (10 ** USDC_DECIMALS);
    }

    /**
     * Get Bot (Worker) USDC balance for Float check
     */
    async getBotUsdcBalance(signer?: ethers.Signer): Promise<number> {
        const addresses = this.getChainAddresses();
        const executionSigner = this.getSigner(signer);
        if (!addresses.usdc) throw new Error("USDC address not configured for this chain");

        const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, executionSigner);
        const botAddress = await executionSigner.getAddress();
        const balance = await usdc.balanceOf(botAddress);
        return Number(balance) / (10 ** USDC_DECIMALS);
    }

    /**
     * Resolve User's Proxy Address using Factory (Cached)
     */
    async resolveProxyAddress(userAddress: string, signer?: ethers.Signer): Promise<string | null> {
        // 1. Check Cache
        if (this.proxyCache.has(userAddress)) {
            // console.log(`[CopyExec] ⚡️ Proxy Cache Hit for ${userAddress}`);
            return this.proxyCache.get(userAddress) || null;
        }
        const addresses = this.getChainAddresses();
        const executionSigner = this.getSigner(signer);

        if (!addresses.proxyFactory || addresses.proxyFactory.includes('0xabc123')) {
            if (addresses.proxyFactory.includes('0xabc123')) {
                console.warn("Proxy Factory address is placeholder in SDK constants!");
                return null;
            }
        }

        const factory = new ethers.Contract(addresses.proxyFactory, PROXY_FACTORY_ABI, executionSigner);
        const userProxy = await factory.getUserProxy(userAddress);
        if (userProxy && userProxy !== ethers.constants.AddressZero) {
            // 仅缓存有效 proxy，避免缓存空地址导致长时间误判。
            this.proxyCache.set(userAddress, userProxy); // Update Cache
            return userProxy;
        }
        return null;
    }

    /**
     * Transfer funds from Proxy to Bot (Pull-First)
     */
    async transferFromProxy(proxyAddress: string, amount: number, signer?: ethers.Signer, overrides?: ethers.Overrides): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = this.getChainAddresses();
            const executionSigner = this.getSigner(signer);
            const botAddress = await executionSigner.getAddress();

            // Executor 代理执行路径：Worker -> Executor -> Proxy -> USDC.transfer(Bot)。
            // 这样可复用单一执行器授权模型，避免每次都依赖 transferFrom allowance。

            if (!addresses.executor) throw new Error("Executor address not configured");
            const executor = new ethers.Contract(addresses.executor, EXECUTOR_ABI, executionSigner);
            const erc20Interface = new ethers.utils.Interface(ERC20_ABI);
            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Requesting Proxy ${proxyAddress} to PUSH $${amount} to Bot ${botAddress} (via Executor)...`);

            // 在 Proxy 上编码执行 usdc.transfer(botAddress, amountWei)。
            const transferData = erc20Interface.encodeFunctionData('transfer', [
                botAddress,
                amountWei
            ]);

            // 真实发交易前仍走 signer mutex，保证同 signer nonce 不冲突。
            const tx = await this.runWithSignerMutex<ethers.providers.TransactionResponse>(executionSigner, 'proxy-push', () => executor.executeOnProxy(
                proxyAddress,
                addresses.usdc,
                transferData,
                overrides || {} // Apply overrides here
            ));
            await this.trackTx(tx, executionSigner);
            const receipt = await tx.wait();

            console.log(`[CopyExec] Proxy Push (USDC) complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            console.error('[CopyExec] Proxy Fund Push failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Transfer funds from Bot back to Proxy
     */
    async transferToProxy(proxyAddress: string, tokenAddress: string, amount: number, decimals: number = USDC_DECIMALS, signer?: ethers.Signer, overrides?: ethers.Overrides): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const executionSigner = this.getSigner(signer);
            const token = new ethers.Contract(tokenAddress, ERC20_ABI, executionSigner);
            const amountWei = ethers.utils.parseUnits(amount.toFixed(decimals), decimals);

            console.log(`[CopyExec] Returning funds to Proxy...`);
            const tx = await this.runWithSignerMutex<ethers.providers.TransactionResponse>(executionSigner, 'return', () => token.transfer(proxyAddress, amountWei, overrides || {}));
            await this.trackTx(tx, executionSigner);
            const receipt = await tx.wait();

            console.log(`[CopyExec] Return transfer complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            console.error('[CopyExec] Transfer to Proxy failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Pull Tokens from Proxy to Bot (for SELL)
     */
    async transferTokensFromProxy(proxyAddress: string, tokenId: string, amount: number, signer?: ethers.Signer, overrides?: ethers.Overrides): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = this.getChainAddresses();
            const executionSigner = this.getSigner(signer);
            const botAddress = await executionSigner.getAddress();

            if (!addresses.executor) throw new Error("Executor address not configured");
            const executor = new ethers.Contract(addresses.executor, EXECUTOR_ABI, executionSigner);
            const ctfInterface = new ethers.utils.Interface(CTF_ABI);

            // CTF token 与 shares 使用相同精度口径（6 位）进行转换。
            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Requesting Proxy to PUSH ${amount} shares (Token ${tokenId}) to Bot (via Executor)...`);

            // 在 Proxy 上编码 ERC1155 safeTransferFrom，把仓位 token 拉到 bot。
            const transferData = ctfInterface.encodeFunctionData('safeTransferFrom', [
                proxyAddress, // from (Proxy is the holder)
                botAddress,
                tokenId,
                amountWei,
                "0x"
            ]);

            // 通过 executor 统一执行，绕开“直接由 bot 操作 proxy 持仓”的权限限制。
            const tx = await this.runWithSignerMutex<ethers.providers.TransactionResponse>(executionSigner, 'token-pull', () => executor.executeOnProxy(
                proxyAddress,
                CONTRACT_ADDRESSES.ctf,
                transferData,
                overrides || {} // Apply overrides here
            ));
            await this.trackTx(tx, executionSigner);
            const receipt = await tx.wait();

            console.log(`[CopyExec] Token Pull complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            console.error('[CopyExec] Token Pull failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Push Tokens from Bot to Proxy (after BUY)
     */
    async transferTokensToProxy(proxyAddress: string, tokenId: string, amount: number, signer?: ethers.Signer, overrides?: ethers.Overrides): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = this.getChainAddresses();
            const executionSigner = this.getSigner(signer);
            const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, executionSigner);

            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Pushing ${amount} shares (Token ${tokenId}) from Bot to Proxy...`);

            // BUY 完成后由 bot 直接把份额推回 proxy（bot 是当前 token 持有人）。
            const botAddress = await executionSigner.getAddress();
            const tx = await this.runWithSignerMutex<ethers.providers.TransactionResponse>(executionSigner, 'token-push', () => ctf.safeTransferFrom(
                botAddress,
                proxyAddress,
                tokenId,
                amountWei,
                "0x",
                overrides || {}
            ));
            await this.trackTx(tx, executionSigner);
            const receipt = await tx.wait();

            console.log(`[CopyExec] Token Push complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            console.error('[CopyExec] Token Push failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Check Proxy allowances/approvals before executing trades.
     */
    async checkProxyAllowance(params: {
        proxyAddress: string;
        side: 'BUY' | 'SELL';
        tokenId: string;
        amount: number;
        signer?: ethers.Signer;
    }): Promise<AllowanceCheckResult> {
        const { proxyAddress, side, signer } = params;
        const addresses = this.getChainAddresses();

        if (!addresses.executor) {
            return { allowed: false, reason: 'EXECUTOR_NOT_CONFIGURED' };
        }
        if (!addresses.usdc) {
            return { allowed: false, reason: 'USDC_ADDRESS_NOT_CONFIGURED' };
        }
        if (!CONTRACT_ADDRESSES.ctf) {
            return { allowed: false, reason: 'CTF_ADDRESS_NOT_CONFIGURED' };
        }

        const executionSigner = this.getSigner(signer);
        const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, executionSigner);
        const executor = new ethers.Contract(addresses.executor, EXECUTOR_ABI, executionSigner);

        const paused = await proxy.paused().catch(() => false);
        if (paused) {
            // proxy 被暂停时必须硬阻断，避免绕过合约级安全开关。
            return { allowed: false, reason: 'PROXY_PAUSED' };
        }

        const target = side === 'BUY' ? addresses.usdc : CONTRACT_ADDRESSES.ctf;
        const [proxyAllowed, executorAllowed] = await Promise.all([
            proxy.allowedTargets(target).catch(() => false),
            executor.allowedTargets(target).catch(() => false),
        ]);

        if (!proxyAllowed) {
            return { allowed: false, reason: 'PROXY_ALLOWLIST_BLOCKED' };
        }
        if (!executorAllowed) {
            // executor 与 proxy 双边白名单都必须放行，缺一不可。
            return { allowed: false, reason: 'EXECUTOR_ALLOWLIST_BLOCKED' };
        }

        return { allowed: true };
    }

    /**
     * Execute Copy Trade
     * 1. Check/Resolve Proxy (Parallel, No Mutex)
     * 2. Fetches & Checks (Parallel, No Mutex)
     * 3. Fund Management (Mutex - TX)
     * 4. Execute Order
     * 5. Return Assets (Mutex - TX)
     */
    async executeOrderWithProxy(params: ExecutionParams): Promise<ExecutionResult> {
        const { tradeId, walletAddress, tokenId, side, amount, price, slippage = 0.02, signer, tradingService } = params;
        const execService = tradingService || this.tradingService;
        const allowBotFloat = params.allowBotFloat !== false;

        // 总体模型：
        // 1) 并行预检（无锁）：查 proxy、余额、盘口、gas、授权状态
        // 2) 串行执行（加锁）：资金搬运 + 下单 + 结算
        // 3) 失败回滚：把已拉出的资金/Token 退回 proxy
        console.log(`[CopyExec] 🚀 Starting Execution for ${walletAddress}. Parallelizing fetches (No Mutex)...`);

        this.assertExecutionAddresses();



        // ==================================================================
        // 1. Parallel Fetch (Non-Blocking, No Mutex)
        // 1. 并行预检 (非阻塞，无锁)
        // 此阶段同时进行所有不需要 "写操作" 的数据查询，节省约 200-500ms
        // ==================================================================
        const fetchStart = Date.now();

        // A. Resolve Proxy
        const proxyPromise = params.proxyAddress
            ? Promise.resolve(params.proxyAddress)
            : this.resolveProxyAddress(walletAddress, signer);

        // B. Check Bot Balance (Float Strategy)
        const botBalancePromise = side === 'BUY' && allowBotFloat ? this.getBotUsdcBalance(signer) : Promise.resolve(0);

        // C. Fetch Orderbook (Auto Slippage)
        const orderBookPromise = params.slippageMode === 'AUTO'
            ? execService.getOrderBook(tokenId).catch(() => null)
            : Promise.resolve(null);

        // D. Gas Fees
        const gasPromise = gasStation.getGasFees().catch(err => {
            console.warn('[CopyExec] Gas fetch failed, using defaults', err);
            return {} as ethers.Overrides;
        });

        // E. Optimistic Allowance Check (Read-Only)
        // 乐观授权检查：只有当余额确实不足时，才会在后续的 Mutex 锁中进行 Approve
        // 绝大多数情况下，Bot 已经有授权，这里并行检查可以避免无谓的串行等待
        // Check if we ALREADY have allowance so we can skip the Mutex-locked approval step
        const allowancePromise = (async () => {
            try {
                if (side === 'BUY') {
                    const { allowance } = await execService.getBalanceAllowance('COLLATERAL');
                    return { ok: Number(allowance) >= 1000000 }; // Check for ample allowance
                } else {
                    const { allowance } = await execService.getBalanceAllowance('CONDITIONAL', tokenId);
                    // For Conditional tokens, allowance is usually for ALL if approved for CTF exchange
                    // But getBalanceAllowance returns specific token allowance?
                    // Polymarket CTF usually isApprovedForAll. 
                    // Let's assume strict check:
                    return { ok: Number(allowance) > 0 };
                }
            } catch (e) {
                return { ok: false }; // Fail safe -> force check inside mutex
            }
        })();

        const [proxyAddress, botBalance, orderbook, gasOverrides, allowanceStatus] = await Promise.all([
            proxyPromise,
            botBalancePromise,
            orderBookPromise,
            gasPromise,
            allowancePromise
        ]);

        console.log(`[CopyExec] ⚡️ Fetches complete in ${Date.now() - fetchStart}ms. Gas: ${gasOverrides.maxFeePerGas ? 'Dynamic' : 'Default'}. Allowance OK? ${allowanceStatus.ok}`);

        if (!proxyAddress) {
            return { success: false, error: "No Proxy wallet found for user", useProxyFunds: false, usedBotFloat: false };
        }

        // 合并 gas 参数：动态 gas 为默认值，手动 overrides 拥有最高优先级。
        const effectiveOverrides = { ...gasOverrides, ...params.overrides };

        // 本地联调中对 mock token 快速放行，避免阻塞链路验证。
        if (this.chainId === 1337 && tokenId.length > 15 && !tokenId.startsWith("0x")) {
            console.log(`[CopyExec] ⚠️ Mock Token Detected. Skipping.`);
            return { success: true, orderId: "mock", transactionHashes: [], useProxyFunds: false, usedBotFloat: false, proxyAddress, settlementDeferred: false };
        }

        // ==================================================================
        // 2. Execution Critical Section (Scoped mutexes)
        // 2. 核心执行区 (互斥锁)
        // 锁分层：
        // - signer 锁：保护 nonce 顺序
        // - proxy 锁：保护同一用户资金/持仓状态一致性
        // ==================================================================
        const mutexSigner = this.getSigner(signer);

        // 0) 条件授权：
        // 只有预检判断“可能未授权”才在 signer 锁里执行授权，减少链上写操作等待。
        if (!allowanceStatus.ok) {
            console.log(`[CopyExec] 🛡️ Validating Allowance (Signer Mutex)...`);
            await this.runWithSignerMutex(mutexSigner, 'allowance', async () => {
                if (side === 'BUY') {
                    await execService.verifyAndApproveAllowance('COLLATERAL', undefined, 1000000);
                } else {
                    await execService.verifyAndApproveAllowance('CONDITIONAL', tokenId);
                }
            });
        }

        console.log(`[CopyExec] 🔒 Entering Proxy Mutex for ${proxyAddress}`);

        // 2) 资金准备（proxy 作用域）：
        // BUY: 优先用 Bot Float，余额不足再从 Proxy 拉资金
        // SELL: 先把 token 从 Proxy 拉到 Bot 再卖
        let useProxyFunds = false;
        let fundTransferTxHash: string | undefined;
        let tokenPullTxHash: string | undefined;
        let usedBotFloat = false;

        try {
            await this.runWithProxyMutex(proxyAddress, 'funds', async () => {
                if (side === 'BUY') {
                    // FLOAT 模式：优先消耗 bot 浮动资金，减少一次链上 pull。
                    if (allowBotFloat && botBalance >= amount) {
                        console.log(`[CopyExec] ⚡️ Optimized BUY: Using Bot Float ($${botBalance} >= $${amount})`);
                        usedBotFloat = true;
                        return;
                    }

                    // 余额不足则走标准路径：从 proxy 拉取对应 USDC。
                    console.log(`[CopyExec] 🐢 Standard BUY: Pulling from Proxy...`);
                    const proxyBalance = await this.getProxyUsdcBalance(proxyAddress, signer);
                    if (proxyBalance < amount) {
                        throw new Error('Insufficient Proxy funds');
                    }

                    const transferResult = await this.transferFromProxy(proxyAddress, amount, signer, effectiveOverrides);
                    if (!transferResult.success) {
                        throw new Error(transferResult.error || 'Proxy pull failed');
                    }
                    useProxyFunds = true;
                    fundTransferTxHash = transferResult.txHash;
                    return;
                }

                // SELL 的资金准备是“拉 token 份额”，不是拉 USDC。
                const pullResult = await this.transferTokensFromProxy(proxyAddress, tokenId, amount / price, signer, effectiveOverrides);
                if (!pullResult.success) {
                    throw new Error(`Proxy token pull failed: ${pullResult.error}`);
                }
                useProxyFunds = true;
                tokenPullTxHash = pullResult.txHash;
            });

        } catch (e: any) {
            return { success: false, error: `Proxy prep failed: ${e.message}`, usedBotFloat, proxyAddress };
        }

        // 3) CLOB 下单：
        // 统一使用 MARKET + FOK，保证“要么全成，要么全撤”，避免复制单产生残单状态。
        let orderResult;
        try {
            // 动态滑点只在 AUTO 模式启用；最终值还会被 maxSlippage 上限裁剪。
            let finalSlippage = slippage;
            if (params.slippageMode === 'AUTO') {
                const calculatedSlippage = await this.calculateDynamicSlippage(tokenId, side, amount, price, orderbook);
                finalSlippage = Math.min(calculatedSlippage, params.maxSlippage ? (params.maxSlippage / 100) : 0.05);
            }

            const executionPrice = side === 'BUY' ? price * (1 + finalSlippage) : price * (1 - finalSlippage);
            const orderAmount = side === 'BUY' ? amount : amount / price;

            console.log(`[CopyExec] Placing MARKET FOK order. Size: ${orderAmount.toFixed(4)}, Price: ${executionPrice}`);

            // 下单关键点：
            // 1. 使用 Market Order 确保立即执行
            // 2. 传入 price 作为保护 (Slippage Cap)
            // 3. 强制 FOK (Fill-Or-Kill)：要么全部成交，要么完全失败。不留残单 (Partial Fill Risk)。
            orderResult = await execService.createMarketOrder({
                tokenId,
                side,
                amount: orderAmount,
                price: executionPrice,
                orderType: 'FOK',
            });

        } catch (err: any) {
            // 下单异常后立即回滚，把此前资金准备阶段搬出的资产退回 Proxy。
            if (useProxyFunds) {
                console.log(`[CopyExec] ⚠️ Order Failed. refunding...`);
                await this.runWithProxyMutex(proxyAddress, 'refund', async () => {
                    if (side === 'BUY') {
                        await this.transferToProxy(proxyAddress, (this.chainId === 137 ? CONTRACT_ADDRESSES.polygon.usdc : CONTRACT_ADDRESSES.amoy.usdc), amount, USDC_DECIMALS, signer, params.overrides);
                    } else { // SELL
                        const sharesToReturn = amount / price;
                        await this.transferTokensToProxy(proxyAddress, tokenId, sharesToReturn, signer, params.overrides);
                    }
                });
            }
            return { success: false, error: err.message || 'Execution error', useProxyFunds, usedBotFloat };
        }

        if (!orderResult.success) {
            // 业务失败（非异常）同样执行资金回滚，保持账务一致性。
            if (useProxyFunds) {
                await this.runWithProxyMutex(proxyAddress, 'refund', async () => {
                    if (side === 'BUY') {
                        await this.transferToProxy(proxyAddress, (this.chainId === 137 ? CONTRACT_ADDRESSES.polygon.usdc : CONTRACT_ADDRESSES.amoy.usdc), amount, USDC_DECIMALS, signer);
                    } else {
                        const sharesToReturn = amount / price;
                        await this.transferTokensToProxy(proxyAddress, tokenId, sharesToReturn, signer);
                    }
                });
            }
            return { success: false, error: orderResult.errorMsg || "Order failed (FOK)", useProxyFunds: useProxyFunds || usedBotFloat, usedBotFloat };
        }

        const deferSettlement = this.shouldDeferSettlement(params);
        const deferReimbursement = this.shouldDeferReimbursementFlag(params.deferReimbursement);
        let returnTransferTxHash: string | undefined;
        let tokenPushTxHash: string | undefined;

        if (deferSettlement) {
            console.log(`[CopyExec] ⏱️ Deferring settlement (async queue enabled).`);
        } else {
            // 4) 结算归集：
            // BUY 成功后把 shares 推回 Proxy；
            // SELL 成功后把卖出得到的 USDC 归还 Proxy。
            await this.runWithProxyMutex(proxyAddress, 'settlement', async () => {
                if (usedBotFloat && side === 'BUY') {
                    // 浮资 BUY：先把买到的 token 归位到 proxy。
                    const sharesBought = amount / price;
                    const pushResult = await this.transferTokensToProxy(proxyAddress, tokenId, sharesBought, signer);
                    if (pushResult.success) tokenPushTxHash = pushResult.txHash;

                    if (deferReimbursement) {
                        console.log('[CopyExec] ⏱️ Deferring reimbursement (ledger batching enabled).');
                        return;
                    }

                    // 报销策略：仅当 bot 余额跌破 buffer 才回补，减少链上交易频率。
                    // 策略优化：如果 Bot 余额还很充裕 (Buffer > 50 USDC)，暂不发起链上报销。
                    // 这能节省 50% 的 On-Chain TX，极大提升连续下单速度。
                    // 只有当 Bot "钱包瘪了" 时才触发报销补货。
                    const MIN_BOT_BUFFER = 50;
                    const projectedBalance = (Number(botBalance) || 0) - amount;

                    if (projectedBalance > MIN_BOT_BUFFER) {
                        console.log(`[CopyExec] ⚡️ SmartBuffer: Deferring reimbursement. Bot has $${projectedBalance.toFixed(2)} (>$${MIN_BOT_BUFFER}). Saving 1 TX.`);
                        return;
                    }

                    console.log(`[CopyExec] 📉 Low Buffer ($${projectedBalance.toFixed(2)}). Triggering Reimbursement...`);
                    const reimbursement = await this.transferFromProxy(proxyAddress, amount, signer);
                    if (reimbursement.success) {
                        returnTransferTxHash = reimbursement.txHash;
                    } else {
                        console.error(`[CopyExec] 🚨 REIMBURSEMENT FAILED!`);
                        if (this.debtLogger) {
                            const botAddr = await signer!.getAddress();
                            this.debtLogger.logDebt({
                                proxyAddress,
                                botAddress: botAddr,
                                amount,
                                currency: 'USDC',
                                error: reimbursement.error || 'Transfer Failed'
                            });
                        }
                    }
                    return;
                }

                    if (useProxyFunds) {
                        if (side === 'BUY') {
                            // 标准 BUY：把新买到的份额推回 proxy，闭合资产归属。
                            const sharesBought = amount / price;
                            const pushResult = await this.transferTokensToProxy(proxyAddress, tokenId, sharesBought, signer);
                            if (pushResult.success) tokenPushTxHash = pushResult.txHash;
                        } else {
                            // SELL：把 bot 收到的 USDC 归还 proxy，维持账务一致。
                            const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
                            const returnResult = await this.transferToProxy(proxyAddress, addresses.usdc, amount, USDC_DECIMALS, signer);
                            if (returnResult.success) returnTransferTxHash = returnResult.txHash;
                    }
                }
            });
        }

        return {
            success: true,
            orderId: orderResult.orderId,
            transactionHashes: orderResult.transactionHashes,
            fundTransferTxHash,
            returnTransferTxHash,
            tokenPullTxHash,
            tokenPushTxHash,
            useProxyFunds: useProxyFunds || usedBotFloat,
            usedBotFloat,
            proxyAddress,
            settlementDeferred: deferSettlement
        };
    }
    /**
     * Recover Failed Settlement
     * Retries the "Push Token" or "Push USDC" step.
     */
    async recoverSettlement(
        proxyAddress: string,
        side: 'BUY' | 'SELL',
        tokenId: string,
        amount: number, // Total amount (USDC value for SELL, USDC cost for BUY)
        price: number,
        usedBotFloat: boolean,
        deferReimbursement?: boolean
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        console.log(`[CopyExec] 🚑 Recovering settlement for ${side} trade...`);
        try {
            if (side === 'BUY') {
                // BUY 恢复路径：
                // 1) 先补做 token push（最关键，关系到用户持仓归属）
                // 2) 若使用过 float，再补做报销

                const sharesBought = amount / price;

                // 1. Push Tokens
                console.log(`[CopyExec] 🚑 Retry Push Tokens...`);
                const pushResult = await this.runWithProxyMutex(proxyAddress, 'recovery-push', async () => {
                    return this.transferTokensToProxy(proxyAddress, tokenId, sharesBought);
                });
                if (!pushResult.success) {
                    return { success: false, error: `Retry Push Failed: ${pushResult.error}` };
                }

                // 2. Reimburse (if float)
                const shouldDeferReimbursement = this.shouldDeferReimbursementFlag(deferReimbursement);
                if (usedBotFloat && !shouldDeferReimbursement) {
                    console.log(`[CopyExec] 🚑 Retry Reimbursement...`);
                    const reimbursement = await this.runWithProxyMutex(proxyAddress, 'recovery-reimburse', async () => {
                        return this.transferFromProxy(proxyAddress, amount);
                    });
                    if (!reimbursement.success) {
                        // tokens 已归位但报销失败，仍记为失败让上层继续追偿。
                        console.error(`[CopyExec] 🚨 Reimbursement still failed: ${reimbursement.error}`);
                        return { success: false, error: `Reimbursement Failed: ${reimbursement.error}`, txHash: pushResult.txHash };
                    }
                }

                if (usedBotFloat && shouldDeferReimbursement) {
                    console.log('[CopyExec] ⏱️ Reimbursement deferred (ledger batching enabled).');
                }
                return { success: true, txHash: pushResult.txHash };

            } else { // SELL
                // SELL 恢复路径：卖出已完成，只需把 USDC 推回 Proxy 即可闭环。
                console.log(`[CopyExec] 🚑 Retry Push USDC...`);
                const addresses = this.getChainAddresses();
                const returnResult = await this.runWithProxyMutex(proxyAddress, 'recovery-return', async () => {
                    return this.transferToProxy(proxyAddress, addresses.usdc, amount);
                });
                if (!returnResult.success) {
                    return { success: false, error: `Retry Push USDC Failed: ${returnResult.error}` };
                }
                return { success: true, txHash: returnResult.txHash };
            }
        } catch (e: any) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Redeem Winning Positions (Settlement)
     * Calls CTF.redeemPositions via Proxy
     */
    async redeemPositions(
        proxyAddress: string,
        conditionId: string,
        indexSets: number[],
        signer?: ethers.Signer,
        overrides?: ethers.Overrides
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = this.getChainAddresses();
            const executionSigner = this.getSigner(signer); // Worker Signer

            if (!addresses.executor) throw new Error("Executor address not configured");
            const executor = new ethers.Contract(addresses.executor, EXECUTOR_ABI, executionSigner);
            const ctfInterface = new ethers.utils.Interface(CTF_ABI);

            console.log(`[CopyExec] 🏛️ Redeeming positions via Proxy ${proxyAddress}...`);
            console.log(`           Condition: ${conditionId}`);
            console.log(`           IndexSets: ${indexSets.join(', ')}`);

            // Encode: ctf.redeemPositions(collateral, parentCollectionId, conditionId, indexSets)
            // Collateral is USDC. ParentCollectionId is bytes32(0) for atomic conditions.
            const cancelData = ctfInterface.encodeFunctionData('redeemPositions', [
                addresses.usdc,
                ethers.constants.HashZero, // parentCollectionId
                conditionId,
                indexSets
            ]);

            // redeem 同时涉及 nonce 与 proxy 状态，因此叠加 signer+proxy 双锁。
            const tx = await this.runWithProxyMutex(proxyAddress, 'redeem', async () => {
                return this.runWithSignerMutex<ethers.providers.TransactionResponse>(executionSigner, 'redeem', () => executor.executeOnProxy(
                    proxyAddress,
                    CONTRACT_ADDRESSES.ctf,
                    cancelData,
                    overrides || {}
                ));
            });
            await this.trackTx(tx, executionSigner);
            const receipt = await tx.wait();

            console.log(`[CopyExec] ✅ Redemption Complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };

        } catch (error: any) {
            console.error('[CopyExec] ❌ Redemption Failed:', error.message);
            return { success: false, error: error.message };
        }
    }


    /**
     * Calculate dynamic slippage based on Orderbook depth
     */
    async calculateDynamicSlippage(
        tokenId: string,
        side: 'BUY' | 'SELL',
        amountUSDC: number,
        currentPrice: number,
        preFetchedBook?: Orderbook | null // Optional optimization
    ): Promise<number> {
        try {
            // 未传入盘口快照时才回源请求，避免执行链路重复拉取。
            if (!preFetchedBook) {
                preFetchedBook = await this.tradingService.getOrderBook(tokenId);
            }

            const orderbook = preFetchedBook;
            if (!orderbook) return 0.05;

            // BUY 消耗 asks，SELL 消耗 bids。
            const levels = side === 'BUY' ? orderbook.asks : orderbook.bids;
            if (!levels || levels.length === 0) return 0.05;

            // 注意：这里把订单规模近似为“USDC 价值”做深度消耗模拟，
            // 对 SELL 场景属于估算（level.size 是 shares），但在风控层足够保守。
            let remaining = amountUSDC;
            // NOTE: amountUSDC is the "Size Value". 
            // For BUY: We are spending $amountUSDC.
            // For SELL: We are selling shares worth roughly $amountUSDC (at approx price).
            //           BUT level.size is SHARES. 

            let worstPrice = 0;
            let bestPrice = parseFloat(levels[0].price);

            for (const level of levels) {
                const levelPrice = parseFloat(level.price);
                const levelSize = parseFloat(level.size); // Shares
                const levelValue = levelPrice * levelSize; // USDC Value

                // 流动性消耗模型（简化版）：
                // 把每档可成交价值按 value 递减 remaining，直到满足目标规模。
                // 该模型偏向执行前预估，不用于精确成交仿真。

                const valueToTake = Math.min(remaining, levelValue);
                remaining -= valueToTake;
                worstPrice = levelPrice;

                if (remaining <= 0) break;
            }

            if (remaining > 0) {
                // 深度不足时直接抬高滑点上限，防止在浅盘口硬冲导致连环失败。
                console.warn(`[SmartSlippage] ⚠️ Warning: Orderbook shallow! Requested: ${amountUSDC}, Remaining unfillable: ${remaining}`);
                return 0.10; // 10% safety cap for illiquid
            }

            // Impact
            // BUY: (Worst - Best) / Best
            // SELL: (Best - Worst) / Best
            let impact = 0;
            if (side === 'BUY') {
                impact = (worstPrice - bestPrice) / bestPrice;
            } else {
                impact = (bestPrice - worstPrice) / bestPrice;
            }

            if (impact < 0) impact = 0;

            const buffer = 0.005; // 0.5% buffer
            const totalSlippage = impact + buffer;

            console.log(`[SmartSlippage] 🌊 ${side} $${amountUSDC} -> Impact: ${(impact * 100).toFixed(2)}% (Worst: ${worstPrice}), Final: ${(totalSlippage * 100).toFixed(2)}%`);

            return totalSlippage;

        } catch (e) {
            console.error(`[SmartSlippage] Error calculating:`, e);
            return 0.05; // Default error fallback
        }
    }
}
