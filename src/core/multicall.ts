import { ethers } from 'ethers';

const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11'; // Same on Polygon & Mainnet
const MULTICALL_ABI = [
    'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)',
    'function getEthBalance(address addr) view returns (uint256)'
];

export class MulticallService {
    private multicall: ethers.Contract;

    constructor(provider: ethers.providers.Provider) {
        this.multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL_ABI, provider);
    }

    /**
     * Batch fetch ETH/MATIC balances for multiple addresses
     * Uses Multicall3.getEthBalance helper if available, or manual aggregate loop?
     * Multicall3 has `getEthBalance(address)`. We can aggregate calls to that.
     */
    async getEthBalances(addresses: string[]): Promise<Map<string, ethers.BigNumber>> {
        const calls = addresses.map(addr => ({
            target: MULTICALL3_ADDRESS,
            allowFailure: true,
            callData: this.multicall.interface.encodeFunctionData('getEthBalance', [addr])
        }));

        try {
            console.log(`[Multicall] 📦 Batching ${addresses.length} balance checks...`);
            const results: any[] = await this.multicall.callStatic.aggregate3(calls);

            const balances = new Map<string, ethers.BigNumber>();

            results.forEach((res, i) => {
                const addr = addresses[i];
                if (res.success) {
                    const balance = this.multicall.interface.decodeFunctionResult('getEthBalance', res.returnData)[0];
                    balances.set(addr, balance);
                } else {
                    console.warn(`[Multicall] Failed to fetch balance for ${addr}`);
                    balances.set(addr, ethers.BigNumber.from(0));
                }
            });

            return balances;

        } catch (error) {
            console.error("[Multicall] Batch fetch failed:", error);
            // Fallback? Assuming empty map triggers individual fetch fallback in caller if implemented
            return new Map();
        }
    }
}
