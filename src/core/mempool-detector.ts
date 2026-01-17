
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from './contracts.js';

// ERC1155 safeTransferFrom selector: 0xf242432a
// safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)
const SAFE_TRANSFER_FROM_SELECTOR = '0xf242432a';

// Batch transfer: 0x2eb2c2d6
// safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data)
const SAFE_BATCH_TRANSFER_FROM_SELECTOR = '0x2eb2c2d6';

export type MempoolCallback = (
    txHash: string,
    operator: string,
    from: string,
    to: string,
    id: ethers.BigNumber,
    value: ethers.BigNumber
) => void;

export class MempoolDetector {
    private provider: ethers.providers.JsonRpcProvider;
    private monitoredTraders: Set<string>;
    private callback: MempoolCallback;
    private isRunning: boolean = false;

    // Interface for decoding
    private iface: ethers.utils.Interface;

    constructor(
        provider: ethers.providers.JsonRpcProvider,
        monitoredTraders: Set<string>,
        callback: MempoolCallback
    ) {
        this.provider = provider;
        this.monitoredTraders = monitoredTraders;
        this.callback = callback;

        // Minimal ABI for decoding
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
        console.log(`[MempoolDetector] 🦈 Starting Mempool Sniffing...`);

        // Ethers v5 'pending' event emits just the txHash
        this.provider.on("pending", this.handlePendingTx);
    }

    public stop() {
        this.isRunning = false;
        this.provider.off("pending", this.handlePendingTx);
        console.log(`[MempoolDetector] Stopped.`);
    }

    private handlePendingTx = async (txHash: string) => {
        try {
            // Optimization: In a real high-freq setup, we'd use a WebSocket provider 
            // that pushes the full TX object to avoid this round-trip GetTransaction.
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
                    this.callback(txHash, tx.from, from, to, id, amount);
                }

            } else if (tx.data.startsWith(SAFE_BATCH_TRANSFER_FROM_SELECTOR)) {
                // --- Batch Transfer ---
                console.log(`[Mempool] 📦 Detected BATCH Transfer: ${txHash}`);
                const decoded = this.iface.parseTransaction({ data: tx.data, value: tx.value });
                const from = decoded.args.from.toLowerCase();
                const to = decoded.args.to.toLowerCase();
                const ids = decoded.args.ids;     // Array
                const amounts = decoded.args.amounts; // Array

                // Optimization: Check trader ONCE before looping
                if (this.monitoredTraders.has(from) || this.monitoredTraders.has(to)) {
                    // Loop through batch and emit individual callbacks
                    for (let i = 0; i < ids.length; i++) {
                        this.callback(txHash, tx.from, from, to, ids[i], amounts[i]);
                    }
                }
            }

        } catch (error) {
            // Ignore errors (tx might be gone, decode fail, etc)
            // console.debug(`[Mempool] Error processing ${txHash}:`, error);
        }
    }
}
