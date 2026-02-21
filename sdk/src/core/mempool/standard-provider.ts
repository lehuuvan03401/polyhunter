
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../contracts.js';
import { IMempoolProvider, MempoolCallback } from './types.js';

// ERC1155 safeTransferFrom selector: 0xf242432a
const SAFE_TRANSFER_FROM_SELECTOR = '0xf242432a';
// Batch transfer: 0x2eb2c2d6
const SAFE_BATCH_TRANSFER_FROM_SELECTOR = '0x2eb2c2d6';

export class StandardMempoolProvider implements IMempoolProvider {
    private provider: ethers.providers.JsonRpcProvider;
    private monitoredTraders: Set<string>;
    private callback: MempoolCallback;
    private isRunning: boolean = false;
    private iface: ethers.utils.Interface;

    constructor(
        provider: ethers.providers.JsonRpcProvider,
        monitoredTraders: Set<string>,
        callback: MempoolCallback
    ) {
        this.provider = provider;
        this.monitoredTraders = monitoredTraders;
        this.callback = callback;

        this.iface = new ethers.utils.Interface([
            "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
            "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)"
        ]);
    }

    public updateMonitoredTraders(traders: Set<string>) {
        this.monitoredTraders = traders;
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log(`[StandardMempoolProvider] 🦈 Starting Mempool Sniffing...`);
        this.provider.on("pending", this.handlePendingTx);
    }

    public stop() {
        this.isRunning = false;
        this.provider.off("pending", this.handlePendingTx);
        console.log(`[StandardMempoolProvider] Stopped.`);
    }

    private handlePendingTx = async (txHash: string) => {
        try {
            const tx = await this.provider.getTransaction(txHash);

            if (!tx || !tx.to) return;

            // 1. Filter: Must be interaction with CTF
            if (tx.to.toLowerCase() !== CONTRACT_ADDRESSES.ctf.toLowerCase()) return;

            // 2. Decode based on Selector
            if (tx.data.startsWith(SAFE_TRANSFER_FROM_SELECTOR)) {
                // --- Single Transfer ---
                const decoded = this.iface.parseTransaction({ data: tx.data, value: tx.value });
                const from = decoded.args.from.toLowerCase();
                const to = decoded.args.to.toLowerCase();
                const id = decoded.args.id;
                const amount = decoded.args.amount;

                // Check Trader (Sender or Receiver)
                if (this.monitoredTraders.has(from) || this.monitoredTraders.has(to)) {
                    this.callback(
                        txHash,
                        tx.from,
                        from,
                        to,
                        id,
                        amount,
                        { maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas }
                    );
                }

            } else if (tx.data.startsWith(SAFE_BATCH_TRANSFER_FROM_SELECTOR)) {
                // --- Batch Transfer ---
                // console.log(`[Mempool] 📦 Detected BATCH Transfer: ${txHash}`);
                const decoded = this.iface.parseTransaction({ data: tx.data, value: tx.value });
                const from = decoded.args.from.toLowerCase();
                const to = decoded.args.to.toLowerCase();
                const ids = decoded.args.ids;     // Array
                const amounts = decoded.args.amounts; // Array

                // Optimization: Check trader ONCE before looping
                if (this.monitoredTraders.has(from) || this.monitoredTraders.has(to)) {
                    for (let i = 0; i < ids.length; i++) {
                        this.callback(
                            txHash,
                            tx.from,
                            from,
                            to,
                            ids[i],
                            amounts[i],
                            { maxFeePerGas: tx.maxFeePerGas, maxPriorityFeePerGas: tx.maxPriorityFeePerGas }
                        );
                    }
                }
            }

        } catch (error) {
            // Ignore errors (tx might be gone, decode fail, etc)
        }
    }
}
