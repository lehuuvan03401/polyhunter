
import { ethers } from 'ethers';
import { IMempoolProvider, MempoolCallback, MempoolProviderType } from './mempool/types.js';
import { StandardMempoolProvider } from './mempool/standard-provider.js';
import { AlchemyMempoolProvider } from './mempool/alchemy-provider.js';

export { MempoolCallback }; // Re-export for compatibility

export class MempoolDetector {
    private providerStrategy: IMempoolProvider;

    constructor(
        provider: ethers.providers.JsonRpcProvider,
        monitoredTraders: Set<string>,
        callback: MempoolCallback
    ) {
        const network = process.env.NEXT_PUBLIC_NETWORK || 'polygon';
        const strategyType = process.env.MEMPOOL_PROVIDER as MempoolProviderType || MempoolProviderType.STANDARD;
        const alchemyKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY;

        console.log(`[MempoolDetector] 🧠 Strategy: ${strategyType}`);

        if (strategyType === MempoolProviderType.ALCHEMY) {
            if (alchemyKey) {
                this.providerStrategy = new AlchemyMempoolProvider(alchemyKey, network, monitoredTraders, callback);
            } else {
                console.warn("[MempoolDetector] ⚠️ MEMPOOL_PROVIDER=ALCHEMY but no NEXT_PUBLIC_ALCHEMY_API_KEY found. Falling back to STANDARD.");
                this.providerStrategy = new StandardMempoolProvider(provider, monitoredTraders, callback);
            }
        } else {
            this.providerStrategy = new StandardMempoolProvider(provider, monitoredTraders, callback);
        }
    }

    public updateMonitoredTraders(traders: Set<string>) {
        this.providerStrategy.updateMonitoredTraders(traders);
    }

    public start() {
        this.providerStrategy.start();
    }

    public stop() {
        this.providerStrategy.stop();
    }
}
