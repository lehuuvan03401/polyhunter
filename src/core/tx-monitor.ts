/**
 * Transaction Monitor
 * 
 * Monitors pending transactions and automatically replaces stuck ones
 * with higher gas to prevent execution blocking.
 */

import { ethers } from 'ethers';

export interface TrackedTx {
    hash: string;
    submittedAt: number;
    nonce: number;
    workerIndex: number;
    replaced: boolean;
    data: string;
    to: string;
    value: ethers.BigNumber;
    gasLimit: ethers.BigNumber;
    maxFeePerGas?: ethers.BigNumber;
    maxPriorityFeePerGas?: ethers.BigNumber;
}

export interface TxMonitorConfig {
    /** Time in ms before TX is considered stuck (default: 300000 = 5 minutes) */
    stuckThresholdMs?: number;
    /** Gas bump percentage for replacement (default: 0.2 = 20%) */
    gasBumpPercent?: number;
    /** Polling interval in ms (default: 30000 = 30 seconds) */
    pollIntervalMs?: number;
}

export class TxMonitor {
    private provider: ethers.providers.Provider;
    private pendingTxs: Map<string, TrackedTx> = new Map();
    private config: Required<TxMonitorConfig>;
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private onReplacementNeeded?: (tx: TrackedTx, newGas: { maxPriorityFeePerGas: ethers.BigNumber }) => Promise<string | null>;

    constructor(
        provider: ethers.providers.Provider,
        config: TxMonitorConfig = {}
    ) {
        this.provider = provider;
        this.config = {
            stuckThresholdMs: config.stuckThresholdMs ?? 300_000, // 5 minutes
            gasBumpPercent: config.gasBumpPercent ?? 0.2, // 20%
            pollIntervalMs: config.pollIntervalMs ?? 30_000, // 30 seconds
        };
    }

    /**
     * Start monitoring pending transactions
     */
    start(onReplacementNeeded: (tx: TrackedTx, newGas: { maxPriorityFeePerGas: ethers.BigNumber }) => Promise<string | null>): void {
        this.onReplacementNeeded = onReplacementNeeded;
        this.pollTimer = setInterval(() => this.checkStuckTransactions(), this.config.pollIntervalMs);
        console.log(`[TxMonitor] 🚀 Started monitoring (stuck threshold: ${this.config.stuckThresholdMs / 1000}s)`);
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        console.log('[TxMonitor] ⏹️ Stopped monitoring');
    }

    /**
     * Track a newly submitted transaction
     */
    track(tx: TrackedTx): void {
        this.pendingTxs.set(tx.hash, tx);
        console.log(`[TxMonitor] 📝 Tracking TX ${tx.hash.slice(0, 10)}... (nonce: ${tx.nonce}, worker: ${tx.workerIndex})`);
    }

    /**
     * Mark a transaction as confirmed (remove from tracking)
     */
    confirm(hash: string): void {
        if (this.pendingTxs.has(hash)) {
            this.pendingTxs.delete(hash);
            console.log(`[TxMonitor] ✅ TX confirmed: ${hash.slice(0, 10)}...`);
        }
    }

    /**
     * Get count of pending transactions
     */
    getPendingCount(): number {
        return this.pendingTxs.size;
    }

    /**
     * Check for stuck transactions and trigger replacement
     */
    private async checkStuckTransactions(): Promise<void> {
        const now = Date.now();
        const stuckTxs: TrackedTx[] = [];

        for (const [hash, tx] of this.pendingTxs.entries()) {
            // Skip already replaced
            if (tx.replaced) continue;

            // Check if confirmed
            try {
                const receipt = await this.provider.getTransactionReceipt(hash);
                if (receipt) {
                    this.confirm(hash);
                    continue;
                }
            } catch (e) {
                // Receipt not found = still pending
            }

            // Check if stuck
            if (now - tx.submittedAt > this.config.stuckThresholdMs) {
                stuckTxs.push(tx);
            }
        }

        // Process stuck transactions
        for (const tx of stuckTxs) {
            if (!this.onReplacementNeeded) continue;

            console.log(`[TxMonitor] ⚠️ Stuck TX detected: ${tx.hash.slice(0, 10)}... (pending for ${Math.round((now - tx.submittedAt) / 1000)}s)`);

            // Calculate new gas
            const currentPriority = tx.maxPriorityFeePerGas ?? ethers.utils.parseUnits('30', 'gwei');
            const bumpedPriority = currentPriority.mul(100 + Math.round(this.config.gasBumpPercent * 100)).div(100);

            try {
                const newHash = await this.onReplacementNeeded(tx, { maxPriorityFeePerGas: bumpedPriority });
                if (newHash) {
                    tx.replaced = true;
                    console.log(`[TxMonitor] 🔄 TX replaced: ${tx.hash.slice(0, 10)}... → ${newHash.slice(0, 10)}...`);
                    // Track the new TX
                    this.track({
                        ...tx,
                        hash: newHash,
                        submittedAt: Date.now(),
                        maxPriorityFeePerGas: bumpedPriority,
                        replaced: false,
                    });
                }
            } catch (e) {
                console.error(`[TxMonitor] ❌ Replacement failed for ${tx.hash.slice(0, 10)}...:`, e);
            }
        }
    }
}
