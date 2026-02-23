import { CopyTradingExecutionService } from '../src/services/copy-trading-execution-service';
import { TradingService } from '../src/services/trading-service';
import { ethers } from 'ethers';

// Mock implementations
const mockTradingService = {
    createMarketOrder: jest.fn(),
    getOrderBook: jest.fn().mockResolvedValue(null),
    verifyAndApproveAllowance: jest.fn().mockResolvedValue(true),
} as unknown as TradingService;

const mockSigner = {
    getAddress: jest.fn().mockResolvedValue('0xBot'),
} as unknown as ethers.Signer;

describe('CopyTradingExecutionService - FOK Scale Down', () => {
    let service: CopyTradingExecutionService;

    beforeEach(() => {
        service = new CopyTradingExecutionService(mockTradingService, mockSigner);
        // Override the proxy pull methods to pretend they succeed without real RPC
        (service as any).resolveProxyAddress = jest.fn().mockResolvedValue('0xProxy');
        (service as any).getBotUsdcBalance = jest.fn().mockResolvedValue(1000);
        (service as any).getProxyUsdcBalance = jest.fn().mockResolvedValue(1000);
        (service as any).transferFromProxy = jest.fn().mockResolvedValue({ success: true, txHash: '0x123' });
        (service as any).transferToProxy = jest.fn().mockResolvedValue({ success: true, txHash: '0x123' });
        (service as any).transferTokensToProxy = jest.fn().mockResolvedValue({ success: true, txHash: '0x123' });
        (service as any).transferTokensFromProxy = jest.fn().mockResolvedValue({ success: true, txHash: '0x123' });
        (service as any).runWithProxyMutex = async (proxy: string, name: string, fn: any) => fn();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should retry a SELL order at 75% scale if the first FOK is rejected', async () => {
        (mockTradingService.createMarketOrder as jest.Mock)
            .mockResolvedValueOnce({ success: false, errorMsg: 'Fill-or-kill order killed' }) // First fails
            .mockResolvedValueOnce({ success: true, orderId: 'scaled_order', transactionHashes: ['0xScaletx'] }); // Second succeeds

        const result = await service.executeOrderWithProxy({
            tradeId: 't1',
            walletAddress: '0xUser',
            tokenId: '123',
            side: 'SELL',
            amount: 100, // $100 notional
            price: 0.5,
            slippageMode: 'FIXED',
            allowPartialFill: true
        });

        expect(result.success).toBe(true);
        expect(result.scaledDown).toBe(true);
        expect(result.executedAmount).toBe(75); // 75% of 100
        expect(mockTradingService.createMarketOrder).toHaveBeenCalledTimes(2);

        // First attempt checking
        expect(mockTradingService.createMarketOrder).toHaveBeenNthCalledWith(1, expect.objectContaining({
            amount: 200, // 100 / 0.5 shares
            orderType: 'FOK'
        }));

        // Second attempt checking (75% of amount = $75. $75 / 0.5 = 150 shares)
        expect(mockTradingService.createMarketOrder).toHaveBeenNthCalledWith(2, expect.objectContaining({
            amount: 150,
            orderType: 'FOK'
        }));
    });
});
