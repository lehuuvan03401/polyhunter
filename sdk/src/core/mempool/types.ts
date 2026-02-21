
import { ethers } from 'ethers';

export type MempoolCallback = (
    txHash: string,
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber,
    gasInfo?: { maxFeePerGas?: ethers.BigNumber, maxPriorityFeePerGas?: ethers.BigNumber }
) => void;

export interface IMempoolProvider {
    /**
     * Start monitoring the mempool
     */
    start(): void;

    /**
     * Stop monitoring
     */
    stop(): void;

    /**
     * Update the set of traders we are interested in.
     * This allows dynamic updates without restarting the connection if possible.
     */
    updateMonitoredTraders(traders: Set<string>): void;
}

export enum MempoolProviderType {
    STANDARD = 'STANDARD',
    ALCHEMY = 'ALCHEMY'
}
