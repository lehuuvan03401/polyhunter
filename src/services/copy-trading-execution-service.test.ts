import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CopyTradingExecutionService, ExecutionParams } from './copy-trading-execution-service.js';
import { TradingService } from './trading-service.js';
import { ethers } from 'ethers';

// Mock dependencies
const mockTradingService = {
    createMarketOrder: vi.fn(),
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
    const actual = await importOriginal();
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

    it('should fail if Proxy funds are insufficient', async () => {
        mockContract.balanceOf.mockResolvedValue(ethers.utils.parseUnits('10', 6)); // Only $10

        const params: ExecutionParams = {
            tradeId: 't3',
            walletAddress: VALID_USER_ADDRESS,
            tokenId: '123456',
            side: 'BUY',
            amount: 100, // Needs start $100
            price: 0.5,
            proxyAddress: VALID_PROXY_ADDRESS
        };

        const result = await service.executeOrderWithProxy(params);
        expect(result.success).toBe(false);
        expect(result.error).toContain('Insufficient Proxy funds');
        expect(mockTradingService.createMarketOrder).not.toHaveBeenCalled();
    });
});
