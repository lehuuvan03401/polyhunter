/**
 * Copy Trading Execute API
 * 
 * Execute pending copy trades through Polymarket CLOB
 * Supports both manual (frontend) and automatic (server-side) execution
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma, isDatabaseEnabled } from '@/lib/prisma';
import { GuardrailService } from '@/lib/services/guardrail-service';
import { createTTLCache } from '@/lib/server-cache';
import { getSpeedProfile } from '@/config/speed-profile';
import { resolveCopyTradingWalletContext } from '@/lib/copy-trading/request-wallet';

// Trading configuration from environment (Restored)
const TRADING_PRIVATE_KEY = process.env.TRADING_PRIVATE_KEY;
const WORKER_KEYS = (process.env.COPY_TRADING_WORKER_KEYS || '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
const WORKER_INDEX = parseInt(process.env.COPY_TRADING_WORKER_INDEX || '0', 10);
const CHAIN_ID = parseInt(process.env.CHAIN_ID || '137');
const RPC_URLS = (process.env.COPY_TRADING_RPC_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
const RPC_URL = process.env.COPY_TRADING_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || 'https://polygon-rpc.com';
const ASYNC_SETTLEMENT = process.env.COPY_TRADING_ASYNC_SETTLEMENT === 'true'
    || process.env.COPY_TRADING_ASYNC_SETTLEMENT === '1';

const PENDING_TRADES_TTL_MS = 20000;
const pendingTradesCache = createTTLCache<any>();
const speedProfile = getSpeedProfile();
const EXPIRY_CHECK_INTERVAL_MS = 60000;
let lastExpiryCheckAt = 0;

// Imports for Proxy Execution
import { ethers } from 'ethers';
import { PROXY_FACTORY_ABI, EXECUTOR_ABI, ERC20_ABI, CONTRACT_ADDRESSES, USDC_DECIMALS } from '@/lib/contracts/abis';

const CTF_APPROVAL_ABI = [
    'function isApprovedForAll(address account, address operator) external view returns (bool)',
];

interface AllowanceCheckResult {
    allowed: boolean;
    reason?: string;
    allowance?: number;
}

interface ExecutionServiceWithAllowance {
    resolveProxyAddress: (walletAddress: string) => Promise<string | null>;
    executeOrderWithProxy: (params: any) => Promise<any>;
    checkProxyAllowance?: (params: {
        proxyAddress: string;
        side: 'BUY' | 'SELL';
        tokenId: string;
        amount: number;
        signer?: ethers.Signer;
    }) => Promise<AllowanceCheckResult>;
}

const getChainAddresses = () => {
    if (CHAIN_ID === 137) return CONTRACT_ADDRESSES.polygon;
    if (CHAIN_ID === 80001 || CHAIN_ID === 80002) return CONTRACT_ADDRESSES.amoy;
    if (CHAIN_ID === 31337 || CHAIN_ID === 1337) return CONTRACT_ADDRESSES.localhost;
    return CONTRACT_ADDRESSES.polygon;
};

// Helper to get provider and signer
const getWorkerKey = (): { privateKey: string; index: number; total: number } | null => {
    if (WORKER_KEYS.length > 0) {
        if (Number.isNaN(WORKER_INDEX) || WORKER_INDEX < 0 || WORKER_INDEX >= WORKER_KEYS.length) {
            throw new Error(`COPY_TRADING_WORKER_INDEX out of range (0-${WORKER_KEYS.length - 1})`);
        }
        return { privateKey: WORKER_KEYS[WORKER_INDEX], index: WORKER_INDEX, total: WORKER_KEYS.length };
    }

    if (TRADING_PRIVATE_KEY) {
        return { privateKey: TRADING_PRIVATE_KEY, index: 0, total: 1 };
    }

    return null;
};

async function selectExecutionRpc(timeoutMs: number = 2000): Promise<string> {
    const candidates = RPC_URLS.length > 0 ? RPC_URLS : [RPC_URL];

    // 简单健康探测：按顺序尝试 RPC，首个可读区块高度的节点即作为本次执行节点。
    // 该策略降低单 RPC 故障导致的整批执行失败概率。
    for (const url of candidates) {
        try {
            const provider = new ethers.providers.JsonRpcProvider(url);
            await Promise.race([
                provider.getBlockNumber(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), timeoutMs)),
            ]);
            return url;
        } catch (error) {
            console.warn(`[CopyTradingExecute] RPC unhealthy, skipping: ${url}`);
        }
    }

    return RPC_URL;
}

// ============================================================================
// OPTION B: Proxy Fund Management Helpers
// ============================================================================

/**
 * Get USDC balance of a Proxy wallet
 */
async function getProxyUsdcBalance(proxyAddress: string, signer: ethers.Wallet): Promise<number> {
    const addresses = getChainAddresses();
    const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, signer);
    const balance = await usdc.balanceOf(proxyAddress);
    return Number(balance) / (10 ** USDC_DECIMALS);
}

async function checkProxyAllowanceFallback(params: {
    proxyAddress: string;
    side: 'BUY' | 'SELL';
    amount: number;
    signer: ethers.Signer;
}): Promise<AllowanceCheckResult> {
    const addresses = getChainAddresses();
    if (!addresses.executor) return { allowed: false, reason: 'EXECUTOR_NOT_CONFIGURED' };

    if (params.side === 'BUY') {
        if (!addresses.usdc) return { allowed: false, reason: 'USDC_ADDRESS_NOT_CONFIGURED' };
        const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, params.signer);
        const allowanceRaw = await usdc.allowance(params.proxyAddress, addresses.executor);
        const allowance = Number(allowanceRaw) / (10 ** USDC_DECIMALS);
        if (allowance <= 0 || allowance < params.amount) {
            return { allowed: false, reason: 'ALLOWANCE_MISSING_USDC', allowance };
        }
        return { allowed: true, allowance };
    }

    const ctfAddress = addresses.ctfContract || CONTRACT_ADDRESSES.polygon.ctfContract;
    if (!ctfAddress) return { allowed: false, reason: 'CTF_ADDRESS_NOT_CONFIGURED' };
    const ctf = new ethers.Contract(ctfAddress, CTF_APPROVAL_ABI, params.signer);
    const approved = await ctf.isApprovedForAll(params.proxyAddress, addresses.executor);
    if (!approved) {
        return { allowed: false, reason: 'ALLOWANCE_MISSING_CTF' };
    }
    return { allowed: true };
}

function getLevelSize(level: any): number {
    return Number(level?.size ?? level?.amount ?? level?.quantity ?? 0);
}

function evaluateOrderbookGuardrails(params: {
    orderbook: any;
    side: 'BUY' | 'SELL';
    notionalUsd: number;
    maxSpreadBps: number;
    minDepthUsd: number;
    minDepthRatio: number;
    depthLevels: number;
}) {
    const { orderbook, side, notionalUsd, maxSpreadBps, minDepthUsd, minDepthRatio, depthLevels } = params;
    const bestAsk = Number(orderbook?.asks?.[0]?.price || 0);
    const bestBid = Number(orderbook?.bids?.[0]?.price || 0);

    if (bestAsk <= 0 || bestBid <= 0) {
        return { allowed: false, reason: 'ORDERBOOK_EMPTY', bestAsk, bestBid };
    }

    // 盘口守卫分两层：
    // 1) spread 限制，防止极端价差时追单
    // 2) depth 限制，防止浅盘口导致滑点失控
    const mid = (bestAsk + bestBid) / 2;
    const spreadBps = mid > 0 ? ((bestAsk - bestBid) / mid) * 10000 : 0;
    if (maxSpreadBps > 0 && spreadBps > maxSpreadBps) {
        return { allowed: false, reason: `SPREAD_${spreadBps.toFixed(1)}BPS`, spreadBps, bestAsk, bestBid };
    }

    const levels = side === 'BUY' ? orderbook.asks : orderbook.bids;
    const requiredShares = (side === 'BUY' ? bestAsk : bestBid) > 0
        ? notionalUsd / (side === 'BUY' ? bestAsk : bestBid)
        : 0;

    let depthShares = 0;
    for (let i = 0; i < Math.min(levels?.length || 0, depthLevels); i++) {
        depthShares += getLevelSize(levels[i]);
        if (requiredShares > 0 && depthShares >= requiredShares * minDepthRatio) break;
    }

    const depthUsd = depthShares * (side === 'BUY' ? bestAsk : bestBid);
    if (minDepthUsd > 0 && depthUsd < minDepthUsd) {
        return { allowed: false, reason: `DEPTH_USD_${depthUsd.toFixed(2)}`, depthUsd, depthShares, bestAsk, bestBid };
    }

    if (requiredShares > 0 && depthShares < requiredShares * minDepthRatio) {
        return { allowed: false, reason: `DEPTH_RATIO_${depthShares.toFixed(2)}`, depthUsd, depthShares, bestAsk, bestBid };
    }

    return { allowed: true, spreadBps, depthUsd, depthShares, bestAsk, bestBid };
}

/**
 * Transfer USDC from Proxy to Bot wallet
 * Bot must be a whitelisted Executor worker
 */
async function transferFromProxy(
    proxyAddress: string,
    amount: number,
    signer: ethers.Wallet
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        const addresses = CHAIN_ID === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
        const botAddress = signer.address;

        // Encode USDC transfer call
        const usdcInterface = new ethers.utils.Interface(ERC20_ABI);
        const amountWei = ethers.utils.parseUnits(amount.toString(), USDC_DECIMALS);
        const transferData = usdcInterface.encodeFunctionData('transfer', [botAddress, amountWei]);

        // Execute transfer through executor
        if (!addresses.executor) {
            throw new Error('Executor address not configured');
        }
        console.log(`[Proxy] Transferring $${amount} USDC from Proxy to Bot via Executor...`);
        const executor = new ethers.Contract(addresses.executor, EXECUTOR_ABI, signer);
        const tx = await executor.executeOnProxy(proxyAddress, addresses.usdc, transferData);
        const receipt = await tx.wait();

        console.log(`[Proxy] Transfer complete: ${receipt.transactionHash}`);
        return { success: true, txHash: receipt.transactionHash };
    } catch (error: any) {
        console.error('[Proxy] Transfer from Proxy failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Transfer tokens (USDC or CTF) from Bot back to Proxy
 */
async function transferToProxy(
    proxyAddress: string,
    tokenAddress: string,
    amount: number,
    decimals: number,
    signer: ethers.Wallet
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
        const amountWei = ethers.utils.parseUnits(amount.toString(), decimals);

        console.log(`[Proxy] Transferring tokens back to Proxy...`);
        const tx = await token.transfer(proxyAddress, amountWei);
        const receipt = await tx.wait();

        console.log(`[Proxy] Return transfer complete: ${receipt.transactionHash}`);
        return { success: true, txHash: receipt.transactionHash };
    } catch (error: any) {
        console.error('[Proxy] Transfer to Proxy failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * POST /api/copy-trading/execute
 * Execute or mark a pending copy trade
 * 
 * Body: {
 *   tradeId: string,
 *   walletAddress: string,
 *   
 *   // For manual execution (frontend already executed):
 *   txHash?: string,
 *   status?: 'executed' | 'failed' | 'skipped',
 *   errorMessage?: string,
 *   
 *   // For server-side execution:
 *   executeOnServer?: boolean,
 *   orderMode?: 'market' | 'limit',
 *   slippage?: number,  // For market orders, default 2%
 * }
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            tradeId,
            walletAddress,
            txHash,
            status,
            errorMessage,
            executeOnServer = false,
            orderMode = 'limit',
            slippage = 0.02,
        } = body;

        const walletCheck = resolveCopyTradingWalletContext(request, {
            bodyWallet: walletAddress,
            requireHeader: true,
        });

        if (!tradeId) {
            return NextResponse.json(
                { error: 'Missing tradeId' },
                { status: 400 }
            );
        }
        if (!walletCheck.ok) {
            return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
        }
        const normalizedWallet = walletCheck.wallet;

        // 先校验交易归属，避免跨钱包越权执行。
        const trade = await prisma.copyTrade.findFirst({
            where: {
                id: tradeId,
                config: {
                    walletAddress: normalizedWallet,
                },
            },
            include: {
                config: true,
            },
        });

        if (!trade) {
            return NextResponse.json(
                { error: 'Trade not found or unauthorized' },
                { status: 404 }
            );
        }

        if (trade.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Trade is not in pending status', currentStatus: trade.status },
                { status: 400 }
            );
        }

        // === SERVER-SIDE EXECUTION ===
        // executeOnServer=true 表示由后端 worker 私钥直接执行；
        // false 则认为前端已自行执行，仅回写状态。
        if (executeOnServer) {
            const workerSelection = getWorkerKey();
            const workerAddress = workerSelection
                ? new ethers.Wallet(workerSelection.privateKey).address
                : undefined;
            // 先用 amount=0 做“全局开关检查”（Kill-Switch / Dry-Run / Emergency Pause），
            // 这样能在初始化交易服务之前快速失败，减少无效开销。
            const guardrail = await GuardrailService.checkExecutionGuardrails(normalizedWallet, 0, {
                source: 'api',
                workerAddress,
                tradeId: trade.id,
                tokenId: trade.tokenId || undefined,
                marketSlug: trade.marketSlug || undefined,
            });
            if (guardrail.reason === 'REAL_TRADING_DISABLED' || guardrail.reason === 'EMERGENCY_PAUSE' || guardrail.reason === 'DRY_RUN') {
                return NextResponse.json({
                    success: false,
                    requiresManualExecution: true,
                    message: guardrail.reason === 'DRY_RUN'
                        ? 'Dry-run mode enabled; execution skipped.'
                        : 'Real trading disabled by guardrails.',
                    trade: {
                        id: trade.id,
                        tokenId: trade.tokenId,
                        side: trade.originalSide,
                        size: trade.copySize,
                        price: trade.originalPrice,
                    },
                }, { status: 403 });
            }

            if (!workerSelection) {
                return NextResponse.json({
                    success: false,
                    requiresManualExecution: true,
                    message: 'Server-side trading not configured. Execute manually via wallet.',
                    trade: {
                        id: trade.id,
                        tokenId: trade.tokenId,
                        side: trade.originalSide,
                        size: trade.copySize,
                        price: trade.originalPrice,
                    },
                });
            }

            if (!trade.tokenId) {
                return NextResponse.json({
                    success: false,
                    error: 'Trade has no tokenId - cannot execute on CLOB',
                });
            }

            // 再按真实交易金额做一次完整 guardrail 校验（额度、频率等）。
            const serverGuardrail = await GuardrailService.checkExecutionGuardrails(normalizedWallet, trade.copySize, {
                source: 'api',
                workerAddress,
                tradeId: trade.id,
                tokenId: trade.tokenId || undefined,
                marketSlug: trade.marketSlug || undefined,
            });
            if (!serverGuardrail.allowed) {
                await prisma.copyTrade.update({
                    where: { id: trade.id },
                    data: {
                        status: 'SKIPPED',
                        errorMessage: serverGuardrail.reason || 'GUARDRAIL_BLOCKED',
                    },
                });

                return NextResponse.json({
                    success: false,
                    error: serverGuardrail.reason || 'Guardrail blocked execution',
                    status: 'SKIPPED',
                }, { status: 429 });
            }

            // --- EXECUTION VIA SERVICE ---
            try {
                const selectedRpc = await selectExecutionRpc();
                console.log(`[CopyTradingExecute] Using RPC: ${selectedRpc}`);
                // Dynamic import to avoid build-time issues if any
                const { TradingService, RateLimiter, createUnifiedCache, CopyTradingExecutionService } = await import('@catalyst-team/poly-sdk');
                const { ethers } = await import('ethers');

                // 初始化 TradingService + CopyTradingExecutionService，
                // 并沿用 SDK 的执行闭环（预检/资金搬运/下单/结算）。
                const rateLimiter = new RateLimiter();
                const cache = createUnifiedCache();
                const tradingService = new TradingService(rateLimiter, cache, {
                    privateKey: workerSelection.privateKey,
                    chainId: CHAIN_ID,
                });
                await tradingService.initialize();

                const orderbook = await tradingService.getOrderBook(trade.tokenId);
                // 在实际下单前追加盘口质量守卫，避免在极端盘口状态下成交。
                const orderbookGuard = evaluateOrderbookGuardrails({
                    orderbook,
                    side: trade.originalSide as 'BUY' | 'SELL',
                    notionalUsd: trade.copySize,
                    maxSpreadBps: speedProfile.maxSpreadBps,
                    minDepthUsd: speedProfile.minDepthUsd,
                    minDepthRatio: speedProfile.minDepthRatio,
                    depthLevels: speedProfile.depthLevels,
                });

                if (!orderbookGuard.allowed) {
                    GuardrailService.recordGuardrailTrigger({
                        reason: `ORDERBOOK_${orderbookGuard.reason}`,
                        source: 'api',
                        walletAddress: normalizedWallet,
                        amount: trade.copySize,
                        tokenId: trade.tokenId || undefined,
                        tradeId: trade.id,
                    });
                    await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: 'SKIPPED',
                            errorMessage: `ORDERBOOK_${orderbookGuard.reason}`,
                        },
                    });

                    return NextResponse.json({
                        success: false,
                        error: `Orderbook guardrail: ${orderbookGuard.reason}`,
                        status: 'SKIPPED',
                    }, { status: 422 });
                }

                // Initialize Execution Service
                const provider = new ethers.providers.JsonRpcProvider(selectedRpc);
                const signer = new ethers.Wallet(workerSelection.privateKey, provider);
                const executionService = new CopyTradingExecutionService(tradingService, signer, CHAIN_ID) as ExecutionServiceWithAllowance;
                const workerAddress = await signer.getAddress();

                const proxyAddress = await executionService.resolveProxyAddress(normalizedWallet);
                if (!proxyAddress) {
                    return NextResponse.json({
                        success: false,
                        error: 'No proxy wallet found for user',
                    }, { status: 400 });
                }

                const allowanceCheck = executionService.checkProxyAllowance
                    ? await executionService.checkProxyAllowance({
                    proxyAddress,
                    side: trade.originalSide as 'BUY' | 'SELL',
                    tokenId: trade.tokenId,
                    amount: trade.copySize,
                    signer,
                })
                    : await checkProxyAllowanceFallback({
                        proxyAddress,
                        side: trade.originalSide as 'BUY' | 'SELL',
                        amount: trade.copySize,
                        signer,
                    });
                if (!allowanceCheck.allowed) {
                    await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: 'SKIPPED',
                            errorMessage: allowanceCheck.reason || 'ALLOWANCE_MISSING',
                        },
                    });

                    return NextResponse.json({
                        success: false,
                        error: allowanceCheck.reason || 'Allowance missing',
                        status: 'SKIPPED',
                    }, { status: 403 });
                }

                // 执行后按“是否已完成结算”写入 EXECUTED / SETTLEMENT_PENDING，
                // 避免把尚未资产归集完成的交易误记为最终成功。
                const result = await executionService.executeOrderWithProxy({
                    tradeId: trade.id,
                    walletAddress: normalizedWallet,
                    tokenId: trade.tokenId,
                    side: trade.originalSide as 'BUY' | 'SELL',
                    amount: trade.copySize, // In USDC
                    price: trade.originalPrice,
                    slippage: trade.config.slippageType === 'FIXED' ? (trade.config.maxSlippage / 100) : undefined,
                    maxSlippage: trade.config.maxSlippage,
                    slippageMode: trade.config.slippageType as 'FIXED' | 'AUTO',
                    orderType: orderMode as 'market' | 'limit',
                    deferSettlement: ASYNC_SETTLEMENT,
                });

                // Update DB based on result
                if (result.success) {
                    const isSettled = result.settlementDeferred
                        ? false
                        : (trade.originalSide === 'BUY'
                            ? Boolean(result.tokenPushTxHash)
                            : Boolean(result.returnTransferTxHash));
                    const status = isSettled ? 'EXECUTED' : 'SETTLEMENT_PENDING';

                    const updatedTrade = await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status,
                            executedAt: new Date(),
                            txHash: result.transactionHashes?.[0] || result.orderId,
                            usedBotFloat: (result as any).usedBotFloat ?? false,
                            executedBy: workerAddress,
                            errorMessage: isSettled ? null : 'Settlement Pending',
                        },
                    });

                    return NextResponse.json({
                        success: true,
                        orderId: result.orderId,
                        transactionHashes: result.transactionHashes,
                        fundTransferTxHash: result.fundTransferTxHash,
                        returnTransferTxHash: result.returnTransferTxHash,
                        trade: updatedTrade,
                        useProxyFunds: result.useProxyFunds,
                        settlementDeferred: result.settlementDeferred ?? false,
                        settlementStatus: status,
                    });
                } else {
                    await prisma.copyTrade.update({
                        where: { id: trade.id },
                        data: {
                            status: 'FAILED',
                            errorMessage: result.error,
                        },
                    });

                    return NextResponse.json({
                        success: false,
                        error: result.error || 'Order execution failed',
                        fundsReturned: result.useProxyFunds, // Service handles returns
                    });
                }

            } catch (serviceError: any) {
                console.error('[Execute] Service error:', serviceError);
                return NextResponse.json({
                    success: false,
                    error: `Execution service failed: ${serviceError.message}`,
                });
            }
        }

        // === MANUAL EXECUTION (Frontend already executed) ===
        if (status === 'executed' && !txHash) {
            return NextResponse.json(
                { error: 'txHash is required when marking trade as executed manually' },
                { status: 400 }
            );
        }

        const executionStatus = status === 'executed' ? 'EXECUTED' :
            status === 'failed' ? 'FAILED' :
                status === 'skipped' ? 'SKIPPED' : 'FAILED';

        const updatedTrade = await prisma.copyTrade.update({
            where: { id: tradeId },
            data: {
                status: executionStatus,
                txHash: txHash || null,
                errorMessage: errorMessage || null,
                executedAt: executionStatus === 'EXECUTED' ? new Date() : null,
            },
        });

        return NextResponse.json({
            success: true,
            trade: updatedTrade
        });
    } catch (error) {
        console.error('Error executing copy trade:', error);
        return NextResponse.json(
            { error: 'Failed to execute trade', message: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/copy-trading/execute
 * Get pending trades that need user confirmation
 */
export async function GET(request: NextRequest) {
    try {
        if (!isDatabaseEnabled) {
            return NextResponse.json({
                pendingTrades: [],
                warning: 'Database not configured',
            });
        }

        const { searchParams } = new URL(request.url);
        const walletCheck = resolveCopyTradingWalletContext(request, {
            queryWallet: searchParams.get('wallet'),
        });
        if (!walletCheck.ok) {
            return NextResponse.json({ error: walletCheck.error }, { status: walletCheck.status });
        }
        const walletAddress = walletCheck.wallet;

        const cacheKey = `pending:${walletAddress.toLowerCase()}`;
        const responsePayload = await pendingTradesCache.getOrSet(cacheKey, PENDING_TRADES_TTL_MS, async () => {
            // 仅返回未过期的 PENDING，避免前端看到已失效确认单。
            const pendingTrades = await prisma.copyTrade.findMany({
                where: {
                    config: {
                        walletAddress: walletAddress.toLowerCase(),
                        isActive: true,
                    },
                    status: 'PENDING',
                    OR: [
                        { expiresAt: null },
                        { expiresAt: { gt: new Date() } },
                    ],
                },
                include: {
                    config: {
                        select: {
                            traderName: true,
                            traderAddress: true,
                        },
                    },
                },
                orderBy: { detectedAt: 'desc' },
            });

            const now = Date.now();
            if (now - lastExpiryCheckAt > EXPIRY_CHECK_INTERVAL_MS) {
                lastExpiryCheckAt = now;
                // 低频批量过期清理，避免每次 GET 都执行 updateMany。
                await prisma.copyTrade.updateMany({
                    where: {
                        status: 'PENDING',
                        expiresAt: {
                            lt: new Date(),
                        },
                    },
                    data: {
                        status: 'EXPIRED',
                    },
                });
            }

            return { pendingTrades };
        });
        return NextResponse.json(responsePayload);
    } catch (error) {
        console.error('Error fetching pending trades:', error);
        return NextResponse.json(
            { error: 'Failed to fetch pending trades' },
            { status: 500 }
        );
    }
}
