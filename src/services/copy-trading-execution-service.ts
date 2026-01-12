import { ethers } from 'ethers';
import { TradingService } from './trading-service.js'; // Use .js extension for imports in this project
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
    private signer: ethers.Wallet;
    private chainId: number;

    constructor(tradingService: TradingService, signer: ethers.Wallet, chainId: number = 137) {
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
     * Resolve User's Proxy Address using Factory
     */
    async resolveProxyAddress(userAddress: string): Promise<string | null> {
        const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;

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
            const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, this.signer);
            const botAddress = this.signer.address;

            // Encode USDC transfer call
            const usdcInterface = new ethers.utils.Interface(ERC20_ABI);
            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);
            const transferData = usdcInterface.encodeFunctionData('transfer', [botAddress, amountWei]);

            console.log(`[CopyExec] Transferring $${amount} USDC from Proxy ${proxyAddress} to Bot...`);
            const tx = await proxy.execute(addresses.usdc, transferData);
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
            const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const proxy = new ethers.Contract(proxyAddress, POLY_HUNTER_PROXY_ABI, this.signer);
            const botAddress = this.signer.address;
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
            const addresses = this.chainId === 137 ? CONTRACT_ADDRESSES.polygon : CONTRACT_ADDRESSES.amoy;
            const ctf = new ethers.Contract(CONTRACT_ADDRESSES.ctf, CTF_ABI, this.signer);

            const amountWei = ethers.utils.parseUnits(amount.toFixed(USDC_DECIMALS), USDC_DECIMALS);

            console.log(`[CopyExec] Pushing ${amount} shares (Token ${tokenId}) from Bot to Proxy...`);

            // safeTransferFrom(from, to, id, amount, data)
            // Bot is signer, so we can call directly.
            const tx = await ctf.safeTransferFrom(
                this.signer.address,
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
     * 2. Fund Management (Get USDC or Get Tokens)
     * 3. Execute Order (Immediate/Market)
     * 4. Return Assets (Return Tokens or Return USDC)
     */
    async executeOrderWithProxy(params: ExecutionParams): Promise<ExecutionResult> {
        const { tradeId, walletAddress, tokenId, side, amount, price, slippage = 0.02, orderType = 'limit' } = params;
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
        let useProxyFunds = false;
        let fundTransferTxHash: string | undefined;
        let tokenPullTxHash: string | undefined;

        try {
            if (side === 'BUY') {
                // Check USDC Balance
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

            } else { // SELL
                // Pull Tokens from Proxy
                // Calculate Shares
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
            // FORCE Market Order (FOK) or Limit FOK/IOC if supported.
            // Calculate size in shares
            const executionPrice = side === 'BUY' ? price * (1 + slippage) : price * (1 - slippage);
            const effectiveSize = amount / price;

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
                    // Refund USDC
                    await this.transferToProxy(proxyAddress, (this.chainId === 137 ? CONTRACT_ADDRESSES.polygon.usdc : CONTRACT_ADDRESSES.amoy.usdc), amount);
                } else { // SELL
                    // Refund Tokens
                    const sharesToReturn = amount / price;
                    await this.transferTokensToProxy(proxyAddress, tokenId, sharesToReturn);
                }
            }
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
            return { success: false, error: orderResult.errorMsg || "Order failed (FOK)", useProxyFunds };
        }

        // 4. Return Assets (Success)
        let returnTransferTxHash: string | undefined;
        let tokenPushTxHash: string | undefined;

        if (useProxyFunds) {
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
            useProxyFunds,
            proxyAddress
        };
    }
}
