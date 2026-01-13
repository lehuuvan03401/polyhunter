import { ethers } from 'ethers';
import { TradingService, Orderbook } from './trading-service.js'; // Use .js extension for imports in this project
import {
    PROXY_FACTORY_ABI,
    POLY_HUNTER_PROXY_ABI,
    ERC20_ABI,
    CTF_ABI,
    CONTRACT_ADDRESSES,
    USDC_DECIMALS
} from '../core/contracts.js';

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
    proxyAddress?: string;
}

export class CopyTradingExecutionService {
    private tradingService: TradingService;
    private signer: ethers.Signer;
    private chainId: number;

    constructor(tradingService: TradingService, signer: ethers.Signer, chainId: number = 137) {
        this.tradingService = tradingService;
        this.signer = signer; // Bot signer (Operator)
        this.chainId = chainId;
    }

    /**
     * Get USDC balance of a Proxy wallet
     */
    async getProxyUsdcBalance(proxyAddress: string): Promise<number> {
        const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;

        // Check if addresses.usdc is set
        if (!addresses.usdc) throw new Error("USDC address not configured for this chain");

        const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, this.signer);
        const balance = await usdc.balanceOf(proxyAddress);
        return Number(balance) / (10 ** USDC_DECIMALS);
    }

    /**
     * Get Bot (Operator) USDC balance for Float check
     */
    async getBotUsdcBalance(): Promise<number> {
        const addresses = (this.chainId === 137 || this.chainId === 31337 || this.chainId === 1337) ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
        if (!addresses.usdc) throw new Error("USDC address not configured for this chain");

        const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, this.signer);
        const botAddress = await this.signer.getAddress();
        const balance = await usdc.balanceOf(botAddress);
        return Number(balance) / (10 ** USDC_DECIMALS);
    }

    /**
     * Resolve User's Proxy Address using Factory
     */
    async resolveProxyAddress(userAddress: string): Promise<string | null> {
        const addresses = (this.chainId === 137 || this.chainId === 31337 || this.chainId === 1337) ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;

        if (!addresses.proxyFactory || addresses.proxyFactory.includes('0xabc123')) {
            if (addresses.proxyFactory.includes('0xabc123')) {
                console.warn("Proxy Factory address is placeholder in SDK constants!");
                return null;
            }
        }

        const factory = new ethers.Contract(addresses.proxyFactory, PROXY_FACTORY_ABI, this.signer);
        const userProxy = await factory.getUserProxy(userAddress);
        if (userProxy && userProxy !== ethers.constants.AddressZero) {
            return userProxy;
        }
        return null;
    }

    /**
     * Transfer funds from Proxy to Bot (Operator)
     */
    async transferFromProxy(proxyAddress: string, amount: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = (this.chainId === 137 || this.chainId === 31337 || this.chainId === 1337) ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, this.signer);
            const botAddress = await this.signer.getAddress();

            // NEW STRATEGY: Use transferFrom (requires User approval)
            // proxy.execute(usdc, transfer) is BLOCKED by Contract.
            const usdc = new ethers.Contract(addresses.usdc, ERC20_ABI, this.signer);
            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Transferring $${amount} USDC from Proxy ${proxyAddress} to Bot (via transferFrom)...`);
            // Bot calls transferFrom(proxy, bot, amount)
            const tx = await usdc.transferFrom(proxyAddress, botAddress, amountWei);
            const receipt = await tx.wait();

            console.log(`[CopyExec] Transfer complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            console.error('[CopyExec] Transfer from Proxy failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Transfer funds from Bot back to Proxy
     */
    async transferToProxy(proxyAddress: string, tokenAddress: string, amount: number, decimals: number = USDC_DECIMALS): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
            const amountWei = ethers.utils.parseUnits(amount.toFixed(decimals), decimals);

            console.log(`[CopyExec] Returning funds to Proxy...`);
            const tx = await token.transfer(proxyAddress, amountWei);
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
    async transferTokensFromProxy(proxyAddress: string, tokenId: string, amount: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = (this.chainId === 137 || this.chainId === 31337 || this.chainId === 1337) ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, this.signer);
            const botAddress = await this.signer.getAddress();
            const ctfInterface = new ethers.utils.Interface(CTF_ABI);

            // Amount in shares.
            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Pulling ${amount} shares (Token ${tokenId}) from Proxy to Bot...`);

            // safeTransferFrom(from, to, id, amount, data)
            const transferData = ctfInterface.encodeFunctionData('safeTransferFrom', [
                proxyAddress, // from (Proxy is the holder)
                botAddress,
                tokenId,
                amountWei,
                "0x"
            ]);

            const tx = await proxy.execute(CONTRACT_ADDRESSES.ctf, transferData);
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
    async transferTokensToProxy(proxyAddress: string, tokenId: string, amount: number): Promise<{ success: boolean; txHash?: string; error?: string }> {
        try {
            const addresses = (this.chainId === 137 || this.chainId === 31337 || this.chainId === 1337) ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, this.signer);

            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Pushing ${amount} shares (Token ${tokenId}) from Bot to Proxy...`);

            // safeTransferFrom(from, to, id, amount, data)
            // Bot is signer, so we can call directly.
            const tx = await ctf.safeTransferFrom(
                await this.signer.getAddress(),
                proxyAddress,
                tokenId,
                amountWei,
                "0x"
            );
            const receipt = await tx.wait();

            console.log(`[CopyExec] Token Push complete: ${receipt.transactionHash}`);
            return { success: true, txHash: receipt.transactionHash };
        } catch (error: any) {
            console.error('[CopyExec] Token Push failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Execute Copy Trade
     * 1. Check/Resolve Proxy
     * 2. Fund Management (Float Check or Standard Pull)
     * 3. Execute Order (Immediate/Market)
     * 4. Return Assets (Settlement)
     */
    async executeOrderWithProxy(params: ExecutionParams): Promise<ExecutionResult> {
        const { tradeId, walletAddress, tokenId, side, amount, price, slippage = 0.02 } = params;
        let { proxyAddress } = params;

        // 1. Resolve Proxy
        if (!proxyAddress) {
            proxyAddress = await this.resolveProxyAddress(walletAddress) || undefined;
        }

        if (!proxyAddress) {
            return { success: false, error: "No Proxy wallet found for user", useProxyFunds: false };
        }

        console.log(`[CopyExec] Executing for ${walletAddress} via Proxy ${proxyAddress}`);

        // 2. Fund Management
        let useProxyFunds = false; // Indicates if we did a Standard Pull (pre-trade)
        let fundTransferTxHash: string | undefined;
        let tokenPullTxHash: string | undefined;

        let usedBotFloat = false; // NEW: Indicates Optimized Float Strategy

        try {
            if (side === 'BUY') {
                // FLOAT STRATEGY: Check Bot's USDC Balance first
                const botBalance = await this.getBotUsdcBalance();

                if (botBalance >= amount) {
                    // OPTIMIZED PATH: Use Bot's funds directly
                    console.log(`[CopyExec] ⚡️ Optimized BUY: Using Bot Float ($${botBalance} >= $${amount})`);
                    usedBotFloat = true;
                    // No transfer needed yet.
                } else {
                    // FALLBACK PATH: Check Proxy USDC Balance
                    console.log(`[CopyExec] 🐢 Standard BUY: Bot low funds ($${botBalance}), checking Proxy...`);
                    const proxyBalance = await this.getProxyUsdcBalance(proxyAddress);
                    if (proxyBalance < amount) {
                        return { success: false, error: `Insufficient Proxy funds: $${proxyBalance} < $${amount}`, proxyAddress };
                    }

                    // Transfer USDC from Proxy
                    const transferResult = await this.transferFromProxy(proxyAddress, amount);
                    if (!transferResult.success) {
                        return { success: false, error: `Proxy fund transfer failed: ${transferResult.error}` };
                    }
                    useProxyFunds = true;
                    fundTransferTxHash = transferResult.txHash;
                }

            } else { // SELL
                // Always Standard Path for SELL (Token Custody in Proxy)
                const sharesToSell = amount / price;

                const pullResult = await this.transferTokensFromProxy(proxyAddress, tokenId, sharesToSell);
                if (!pullResult.success) {
                    return { success: false, error: `Proxy token pull failed: ${pullResult.error}` };
                }
                useProxyFunds = true;
                tokenPullTxHash = pullResult.txHash;
            }
        } catch (e: any) {
            return { success: false, error: `Proxy prep failed: ${e.message}` };
        }

        // 3. Execute Order
        let orderResult;
        try {
            const effectiveSize = amount / price;

            // Calculate Dynamic Slippage if AUTO
            let finalSlippage = slippage || 0.02;
            if (params.slippageMode === 'AUTO') {
                const calculatedSlippage = await this.calculateDynamicSlippage(tokenId, side, effectiveSize, price);
                // Assuming maxSlippage passed as percentage (e.g. 2.0 for 2%) -> convert to decimal
                // Default to 5% max if not specified
                const maxAllowed = params.maxSlippage ? (params.maxSlippage / 100) : 0.05;
                finalSlippage = Math.min(calculatedSlippage, maxAllowed);
                console.log(`[CopyExec] 🌊 Auto Slippage: ${(finalSlippage * 100).toFixed(2)}% (Calc: ${(calculatedSlippage * 100).toFixed(2)}%, Max: ${(maxAllowed * 100).toFixed(2)}%)`);
            }

            // FORCE Market Order (FOK)
            const executionPrice = side === 'BUY' ? price * (1 + finalSlippage) : price * (1 - finalSlippage);

            console.log(`[CopyExec] Placing MARKET FOK order. Size: ${effectiveSize.toFixed(2)} shares, WorstPrice: ${executionPrice}`);

            orderResult = await this.tradingService.createMarketOrder({
                tokenId,
                side,
                amount: effectiveSize,
                price: executionPrice,
                orderType: 'FOK'
            });

        } catch (err: any) {
            // START RECOVERY (Refund)
            if (useProxyFunds) {
                if (side === 'BUY') {
                    // Refund USDC (Standard Path)
                    await this.transferToProxy(proxyAddress, (this.chainId === 137 ? CONTRACT_ADDRESSES.polygon.usdc : CONTRACT_ADDRESSES.amoy.usdc), amount);
                } else { // SELL
                    // Refund Tokens (Standard Path)
                    const sharesToReturn = amount / price;
                    await this.transferTokensToProxy(proxyAddress, tokenId, sharesToReturn);
                }
            }
            // NOTE: If usedBotFloat, we just spent nothing (failed before trade), so nothing to refund.
            return { success: false, error: err.message || 'Execution error', useProxyFunds };
        }

        if (!orderResult.success) {
            // Failed (Kill part of FOK), refund.
            if (useProxyFunds) {
                if (side === 'BUY') {
                    await this.transferToProxy(proxyAddress, (this.chainId === 137 ? CONTRACT_ADDRESSES.polygon.usdc : CONTRACT_ADDRESSES.amoy.usdc), amount);
                } else { // SELL
                    const sharesToReturn = amount / price;
                    await this.transferTokensToProxy(proxyAddress, tokenId, sharesToReturn);
                }
            }
            return { success: false, error: orderResult.errorMsg || "Order failed (FOK)", useProxyFunds: useProxyFunds || usedBotFloat };
        }

        // 4. Return Assets (Settlement)
        let returnTransferTxHash: string | undefined;
        let tokenPushTxHash: string | undefined;

        if (usedBotFloat && side === 'BUY') {
            // OPTIMIZED SETTLEMENT
            // 1. Push Tokens to Proxy
            const sharesBought = amount / price;
            const pushResult = await this.transferTokensToProxy(proxyAddress, tokenId, sharesBought);
            if (pushResult.success) {
                tokenPushTxHash = pushResult.txHash;
            }

            // 2. Reimburse Bot (Pull USDC from Proxy)
            console.log(`[CopyExec] 💰 Reimbursing Bot Float...`);
            // We use `transferFromProxy` but logic is same: Proxy -> Bot
            // Note: This relies on Proxy having funds. If this fails, Bot is out of pocket (Risk).
            // A robust system would have a retry queue. For MVP, we log error.
            try {
                const reimbursement = await this.transferFromProxy(proxyAddress, amount);
                if (reimbursement.success) {
                    returnTransferTxHash = reimbursement.txHash; // Re-use field for simplicity or add new one
                } else {
                    console.error(`[CopyExec] 🚨 REIMBURSEMENT FAILED! Bot paid but Proxy didn't pay back: ${reimbursement.error}`);
                }
            } catch (err: any) {
                console.error(`[CopyExec] 🚨 REIMBURSEMENT CRITICAL ERROR!`, err);
            }

        } else if (useProxyFunds) {
            // STANDARD SETTLEMENT
            const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;

            if (side === 'BUY') {
                // Return tokens to Proxy.
                const sharesBought = amount / price; // Approx.
                const pushResult = await this.transferTokensToProxy(proxyAddress, tokenId, sharesBought);
                if (pushResult.success) {
                    tokenPushTxHash = pushResult.txHash;
                }
            } else {
                // Return USDC to Proxy.
                const returnResult = await this.transferToProxy(proxyAddress, addresses.usdc, amount);
                if (returnResult.success) {
                    returnTransferTxHash = returnResult.txHash;
                }
            }
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
            proxyAddress
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
        usedBotFloat: boolean
    ): Promise<{ success: boolean; txHash?: string; error?: string }> {
        console.log(`[CopyExec] 🚑 Recovering settlement for ${side} trade...`);
        try {
            if (side === 'BUY') {
                // We bought. Need to Push Tokens to Proxy.
                // Also need to Reimburse Bot (Pull USDC from Proxy) if float was used.

                const sharesBought = amount / price;

                // 1. Push Tokens
                console.log(`[CopyExec] 🚑 Retry Push Tokens...`);
                const pushResult = await this.transferTokensToProxy(proxyAddress, tokenId, sharesBought);
                if (!pushResult.success) {
                    return { success: false, error: `Retry Push Failed: ${pushResult.error}` };
                }

                // 2. Reimburse (if float)
                if (usedBotFloat) {
                    console.log(`[CopyExec] 🚑 Retry Reimbursement...`);
                    const reimbursement = await this.transferFromProxy(proxyAddress, amount);
                    if (!reimbursement.success) {
                        // Critical but less critical than holding tokens.
                        console.error(`[CopyExec] 🚨 Reimbursement still failed: ${reimbursement.error}`);
                        return { success: false, error: `Reimbursement Failed: ${reimbursement.error}`, txHash: pushResult.txHash };
                    }
                }

                return { success: true, txHash: pushResult.txHash };

            } else { // SELL
                // We sold. Need to Push USDC to Proxy.
                console.log(`[CopyExec] 🚑 Retry Push USDC...`);
                const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
                const returnResult = await this.transferToProxy(proxyAddress, addresses.usdc, amount);
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
     * Calculate dynamic slippage based on Orderbook depth
     */
    async calculateDynamicSlippage(
        tokenId: string,
        side: 'BUY' | 'SELL',
        amountShares: number,
        currentPrice: number
    ): Promise<number> {
        try {
            const orderbook = await this.tradingService.getOrderBook(tokenId);
            // BUY needs ASKS to fill. SELL needs BIDS to fill.
            const bookSide = side === 'BUY' ? orderbook.asks : orderbook.bids;

            let accumulatedSize = 0;
            let worstPrice = currentPrice;

            for (const level of bookSide) {
                const levelSize = Number(level.size);
                const levelPrice = Number(level.price);

                accumulatedSize += levelSize;
                worstPrice = levelPrice;

                if (accumulatedSize >= amountShares) {
                    break;
                }
            }

            // Calculate impact
            // Slippage = |(Worst - Current) / Current|
            const impact = Math.abs((worstPrice - currentPrice) / currentPrice);

            // Add 20% safety buffer to the impact
            const buffer = impact * 0.2;
            const dynamicSlippage = impact + buffer;

            console.log(`[DynamicSlippage] Impact: ${(impact * 100).toFixed(2)}%, Buffer: ${(buffer * 100).toFixed(2)}%, Total: ${(dynamicSlippage * 100).toFixed(2)}%`);

            // Enforce minimum 0.5%
            return Math.max(dynamicSlippage, 0.005);
        } catch (e: any) {
            console.warn(`[DynamicSlippage] Failed to calc, using default 2%: ${e.message}`);
            return 0.02;
        }
    }
}
