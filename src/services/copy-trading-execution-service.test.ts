import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopyTradingExecutionService, ExecutionParams } from './copy-trading-execution-service.js';
import { TradingService } from './trading-service.js';
import { ethers } from 'ethers';

// Mock dependencies
const mockTradingService = {
    createMarketOrder: vi.fn(),
    getOrderBook: vi.fn(),
} as unknown as TradingService;

// Use valid addresses
const VALID_BOT_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const VALID_PROXY_ADDRESS = '0x1234567890123456789012345678901234567890';
const VALID_USER_ADDRESS = '0x9999999999999999999999999999999999999999';

const mockSigner = {
    getAddress: vi.fn().mockReturnValue(VALID_BOT_ADDRESS),
    address: VALID_BOT_ADDRESS,
} as unknown as ethers.Wallet;

// Mock ethers Contract
const mockContract = {
    balanceOf: vi.fn(),
    execute: vi.fn(),
    transfer: vi.fn(),
    safeTransferFrom: vi.fn(),
    getUserProxy: vi.fn(),
    wait: vi.fn().mockResolvedValue({ transactionHash: '0xFundTx' }),
};

// Mock Contract Construction
vi.mock('ethers', async (importOriginal) => {
    const actual = await importOriginal<typeof import('ethers')>();
    return {
        ...actual,
        ethers: {
            ...actual.ethers,
            Contract: vi.fn(() => mockContract),
            utils: actual.ethers.utils
        }
    }
});

describe('CopyTradingExecutionService', () => {
    let service: CopyTradingExecutionService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new CopyTradingExecutionService(mockTradingService, mockSigner, 137);

        // Default Mock behaviors
        mockContract.balanceOf.mockResolvedValue(ethers.utils.parseUnits('1000', 6)); // Default 1000 USDC
        mockContract.getUserProxy.mockResolvedValue(VALID_PROXY_ADDRESS);
        mockContract.execute.mockResolvedValue({ wait: () => Promise.resolve({ transactionHash: '0xFundTx' }) });
        mockContract.transfer.mockResolvedValue({ wait: () => Promise.resolve({ transactionHash: '0xReturnTx' }) });
        mockContract.safeTransferFrom.mockResolvedValue({ wait: () => Promise.resolve({ transactionHash: '0xTokenTx' }) });

        mockTradingService.createMarketOrder = vi.fn().mockResolvedValue({
            success: true,
            orderId: '0xOrder',
            transactionHashes: ['0xOrderTx']
        });
    });

    it('should execute BUY order: Pull USDC -> Execute FOK -> Push Tokens', async () => {
        const params: ExecutionParams = {
            tradeId: 't1',
            walletAddress: VALID_USER_ADDRESS,
            tokenId: '123456', // Valid uint string
            side: 'BUY',
            amount: 100, // $100
            price: 0.5,
            proxyAddress: VALID_PROXY_ADDRESS
        };

        const result = await service.executeOrderWithProxy(params);

        if (!result.success) console.error(result.error);
        expect(result.success).toBe(true);
        expect(result.useProxyFunds).toBe(true);

        // 1. Check Balance (Called)
        expect(mockContract.balanceOf).toHaveBeenCalled();

        // 2. Transfer USDC From Proxy
        // method ID for transfer(address,uint256) is typically '0xa9059cbb'
        expect(mockContract.execute).toHaveBeenCalledWith(expect.anything(), expect.stringMatching(/^0xa9059cbb/));

        // 3. Execute Order (FOK)
        expect(mockTradingService.createMarketOrder).toHaveBeenCalledWith(expect.objectContaining({
            side: 'BUY',
            orderType: 'FOK',
            amount: 200, // 100 / 0.5 = 200 shares
        }));

        // 4. Push Tokens To Proxy
        // Note: For BUY, we call `transferTokensToProxy`, which calls `ctf.safeTransferFrom(signer, proxy...)`.
        expect(mockContract.safeTransferFrom).toHaveBeenCalled();
    });

    it('should execute SELL order: Pull Tokens -> Execute FOK -> Push USDC', async () => {
        const params: ExecutionParams = {
            tradeId: 't2',
            walletAddress: VALID_USER_ADDRESS,
            tokenId: '123456',
            side: 'SELL',
            amount: 50, // Value $50
            price: 0.5,
            proxyAddress: VALID_PROXY_ADDRESS
        };

        const result = await service.executeOrderWithProxy(params);

        if (!result.success) console.error(result.error);
        expect(result.success).toBe(true);

        // 1. Pull Tokens
        // For SELL, we call `transferTokensFromProxy` which calls `proxy.execute(CTF, safeTransferFromData)`
        expect(mockContract.execute).toHaveBeenCalled();

        // 2. Execute Order (FOK)
        expect(mockTradingService.createMarketOrder).toHaveBeenCalledWith(expect.objectContaining({
            side: 'SELL',
            orderType: 'FOK',
            amount: 100, // 50 / 0.5 = 100 shares
        }));

        // 3. Return USDC (transfer)
        expect(mockContract.transfer).toHaveBeenCalled();
    });

    it('should use OPTIMIZED BUY (Float) if Bot has funds', async () => {
        // Mock Bot has 1000 USDC
        // first call is getBotUsdcBalance, second is getProxyUsdcBalance (if needed)
        // We mock balanceOf implementation to return based on address
        mockContract.balanceOf.mockImplementation(async (address) => {
            if (address === VALID_BOT_ADDRESS) return ethers.utils.parseUnits('1000', 6);
            return ethers.utils.parseUnits('500', 6);
        });

        const params: ExecutionParams = {
            tradeId: 't4',
            walletAddress: VALID_USER_ADDRESS,
            tokenId: '123456',
            side: 'BUY',
            amount: 100,
            price: 0.5,
            proxyAddress: VALID_PROXY_ADDRESS
        };

        const result = await service.executeOrderWithProxy(params);

        if (!result.success) console.error(result.error);
        expect(result.success).toBe(true);
        expect(result.useProxyFunds).toBe(true); // Should be true if we used float? Actually service logic sets this to true if float used too?
        // Wait, checking service logic: `useProxyFunds: useProxyFunds || usedBotFloat`. Yes.

        // 1. Check Bot Balance First
        expect(mockContract.balanceOf).toHaveBeenCalledWith(VALID_BOT_ADDRESS);

        // 2. NO pull from Proxy (execute called for Reimbursement LATER)
        // The first execute call should be Reimbursement, NOT initial pull
        // Initial Pull: `transferFromProxy`. Reimbursement: `transferFromProxy`.
        // Wait, if Optimized, we skip initial pull.
        // We do Trade -> Push -> Reimburse (Pull).

        // 3. Execute Order (Immediate)
        expect(mockTradingService.createMarketOrder).toHaveBeenCalledTimes(1);

        // 4. Push Tokens (safeTransferFrom)
        expect(mockContract.safeTransferFrom).toHaveBeenCalled();

        // 5. Reimburse (Pull USDC)
        expect(mockContract.execute).toHaveBeenCalledTimes(1); // Only 1 pull (reimbursement)
    });

    it('should use STANDARD BUY (Fallback) if Bot has NO funds', async () => {
        // Mock Bot has 0 USDC, Proxy has 1000
        mockContract.balanceOf.mockImplementation(async (address) => {
            if (address === VALID_BOT_ADDRESS) return ethers.utils.parseUnits('0', 6);
            if (address === VALID_PROXY_ADDRESS) return ethers.utils.parseUnits('1000', 6);
            return ethers.utils.parseUnits('0', 6);
        });

        const params: ExecutionParams = {
            tradeId: 't5',
            walletAddress: VALID_USER_ADDRESS,
            tokenId: '123456',
            side: 'BUY',
            amount: 100,
            price: 0.5,
            proxyAddress: VALID_PROXY_ADDRESS
        };

        const result = await service.executeOrderWithProxy(params);

        if (!result.success) console.error(result.error);
        expect(result.success).toBe(true);

        // 1. Check Bot Balance
        expect(mockContract.balanceOf).toHaveBeenCalledWith(VALID_BOT_ADDRESS);

        // 2. Check Proxy Balance (and Pull)
        expect(mockContract.balanceOf).toHaveBeenCalledWith(VALID_PROXY_ADDRESS);

        // 3. Pull from Proxy (Initial)
        // 4. (No Reimbursement needed in standard flow, or is it?)
        // Standard flow: Pull -> Trade -> Push.
        // So execute called ONCE (Pull).
        expect(mockContract.execute).toHaveBeenCalledTimes(1);

        // 5. Execute Order
        expect(mockTradingService.createMarketOrder).toHaveBeenCalled();

        // 6. Push Tokens
        expect(mockContract.safeTransferFrom).toHaveBeenCalled();
    });

    it('should recover settlement for BUY (Float): Push Tokens -> Reimburse', async () => {
        const result = await service.recoverSettlement(
            VALID_PROXY_ADDRESS,
            'BUY',
            '123456',
            100, // Amount
            0.5, // Price
            true // usedBotFloat
        );

        if (!result.success) console.error(result.error);
        expect(result.success).toBe(true);

        // 1. Push Tokens
        expect(mockContract.safeTransferFrom).toHaveBeenCalled();

        // 2. Reimburse (Pull USDC)
        expect(mockContract.execute).toHaveBeenCalled();
    });

    it('should recover settlement for SELL: Push USDC', async () => {
        const result = await service.recoverSettlement(
            VALID_PROXY_ADDRESS,
            'SELL',
            '123456',
            50, // USDC Amount
            0.5,
            false // usedBotFloat
        );

        expect(result.success).toBe(true);
        expect(mockContract.transfer).toHaveBeenCalled();
    });

    describe('calculateDynamicSlippage', () => {
        const mockOrderbook = {
            hash: '0x',
            asks: [
                { price: '0.6', size: '500' },
                { price: '0.65', size: '1000' }
            ],
            bids: [
                { price: '0.5', size: '500' },
                { price: '0.45', size: '1000' }
            ]
        };

        beforeEach(() => {
            mockTradingService.getOrderBook = vi.fn().mockResolvedValue(mockOrderbook);
        });

        it('should calculate minimal slippage for small BUY orders', async () => {
            // Buy 100 shares @ 0.5 (current). Asks start at 0.6.
            // Wait, currentPrice passed is 0.5. Asks start at 0.6.
            // Immediate impact: (0.6 - 0.5) / 0.5 = 20%.
            // This mock data implies a wide spread or wrong currentPrice.
            // Let's assume currentPrice is 0.6 (Best Ask).

            const result = await service.calculateDynamicSlippage('t1', 'BUY', 100, 0.6);
            // 100 shares fits in first level (500). Max price 0.6.
            // Impact: (0.6 - 0.6) / 0.6 = 0.
            // Buffer: 0. Total: 0.
            // Min Slippage: 0.5% (0.005).
            expect(result).toBe(0.005);
        });

        it('should calculate higher slippage for large BUY orders hitting depth', async () => {
            // Buy 1000 shares.
            // Level 1: 500 @ 0.6. Remaining 500.
            // Level 2: 1000 @ 0.65. Fits here.
            // Worst Price: 0.65.
            // Current Price: 0.6.
            // Impact: (0.65 - 0.60) / 0.60 = 0.05 / 0.60 = 0.0833 (8.33%).
            // Buffer: 20% of 8.33% = 1.666%.
            // Total: ~10%.

            const result = await service.calculateDynamicSlippage('t1', 'BUY', 1000, 0.6);
            const expected = (0.05 / 0.6) * 1.2;
            expect(result).toBeCloseTo(expected, 4);
        });

        it('should use default slippage on error', async () => {
            mockTradingService.getOrderBook = vi.fn().mockRejectedValue(new Error('API Error'));
            const result = await service.calculateDynamicSlippage('t1', 'BUY', 100, 0.6);
            expect(result).toBe(0.02);
        });
    });
});

