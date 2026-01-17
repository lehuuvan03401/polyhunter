
import { ethers } from 'ethers';
import { CONTRACT_ADDRESSES } from '../contracts.js';
import { IMempoolProvider, MempoolCallback } from './types.js';

// ERC1155 safeTransferFrom selector: 0xf242432a
const SAFE_TRANSFER_FROM_SELECTOR = '0xf242432a';
// Batch transfer: 0x2eb2c2d6
const SAFE_BATCH_TRANSFER_FROM_SELECTOR = '0x2eb2c2d6';

export class AlchemyMempoolProvider implements IMempoolProvider {
    private wsProvider: ethers.providers.WebSocketProvider;
    private monitoredTraders: Set<string>;
    private callback: MempoolCallback;
    private isRunning: boolean = false;
    private iface: ethers.utils.Interface;

    constructor(
        apiKey: string,
        network: string, // 'polygon' | 'amoy'
        monitoredTraders: Set<string>,
        callback: MempoolCallback
    ) {
        // Construct Alchemy WSS URL
        const networkSubdomain = network === 'amoy' ? 'polygon-amoy' : 'polygon-mainnet';
        const wsUrl = `wss://${networkSubdomain}.g.alchemy.com/v2/${apiKey}`;

        this.wsProvider = new ethers.providers.WebSocketProvider(wsUrl);
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
        console.log(`[AlchemyMempoolProvider] 🧪 Starting Enhanced Mempool Subscription...`);

        this.subscribeToAlchemyPendingTransactions();
    }

    public stop() {
        this.isRunning = false;
        // Destroy websocket connection
        this.wsProvider.destroy();
        console.log(`[AlchemyMempoolProvider] Stopped.`);
    }

    private async subscribeToAlchemyPendingTransactions() {
        try {
            // "alchemy_pendingTransactions" subscription
            // We use the low-level 'send' to create the subscription if ethers doesn't wrap it nicely.
            // Ethers v5 WebSocketProvider handles JSON-RPC notifications.
            // We can send "eth_subscribe" and listen to the emitted events.

            // HOWEVER, ethers.js v5 WebSocketProvider doesn't expose a clean way to listen to custom subscription ID events
            // without using the .on('message') from the underlying socket?
            // Actually, ethers v5 WebSocketProvider treats events as standard Ethereum events.
            // Alchemy's custom subscription mimics eth_subscribe.

            // Alternative: Use the websocket property directly.
            // this.wsProvider._websocket.on('message', ...)

            // Let's try sending the subscription and listening to "pending" is for standard txs...
            // Standard ethers .on("pending") uses "newPendingTransactions".

            // We need to send the custom subscribe command.
            // And then we need to catch the notifications.

            // Let's use the low-level access for maximum control over this custom generic.
            // Or easier: Just use 'ws' lib? No, keep it inside ethers if possible.

            // Check if we can use `wsProvider.on` with a custom topic? No.

            // Let's rely on the underlying `_websocket` if available (TypeScript might complain).
            // Or use the public `send` to subscribe and `on("message")?` -> No, "message" is not emitted by Provider.

            // HACK: Ethers v5 WebSocketProvider exposes `_websocket` as `any` usually.
            const ws = (this.wsProvider as any)._websocket;

            ws.on('open', () => {
                this.wsProvider.send("eth_subscribe", [
                    "alchemy_pendingTransactions",
                    {
                        toAddress: CONTRACT_ADDRESSES.ctf, // Server-side filtering
                        hashesOnly: false // We want the full TX!
                    }
                ]).then((subscriptionId: string) => {
                    console.log(`[AlchemyMempoolProvider] ✅ Subscribed! ID: ${subscriptionId}`);
                }).catch((err: any) => {
                    console.error("[AlchemyMempoolProvider] Subscription failed:", err);
                });
            });

            ws.on('message', (data: string) => {
                try {
                    const msg = JSON.parse(data);
                    // Standard JSON-RPC Notification: { method: "eth_subscription", params: { subscription: "ID", result: TX_OBJECT } }
                    if (msg.method === 'eth_subscription' && msg.params && msg.params.result) {
                        this.handleTransaction(msg.params.result);
                    }
                } catch (e) {
                    // Ignore keepalives or non-json
                }
            });

        } catch (e) {
            console.error("[AlchemyMempoolProvider] Setup failed:", e);
        }
    }

    private handleTransaction(tx: any) {
        try {
            // tx is the Full Transaction Object from Alchemy
            if (!tx || !tx.to) return;
            // Double check 'to' (Alchemy should have filtered it, but safety first)
            if (tx.to.toLowerCase() !== CONTRACT_ADDRESSES.ctf.toLowerCase()) return;

            // Decode Input Data
            // Alchemy returns 'input' field usually, or 'data'. verify.
            const data = tx.input || tx.data;
            if (!data) return;

            // 2. Decode based on Selector
            if (data.startsWith(SAFE_TRANSFER_FROM_SELECTOR)) {
                // --- Single Transfer ---
                const decoded = this.iface.parseTransaction({ data: data, value: tx.value });
                const from = decoded.args.from.toLowerCase();
                const to = decoded.args.to.toLowerCase();
                const id = decoded.args.id;
                const amount = decoded.args.amount;

                // Check Trader (Sender or Receiver)
                if (this.monitoredTraders.has(from) || this.monitoredTraders.has(to)) {
                    this.callback(
                        tx.hash, // hash
                        tx.from, // operator
                        from,
                        to,
                        id,
                        amount,
                        {
                            maxFeePerGas: tx.maxFeePerGas ? ethers.BigNumber.from(tx.maxFeePerGas) : undefined,
                            maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.BigNumber.from(tx.maxPriorityFeePerGas) : undefined
                        }
                    );
                }
            } else if (data.startsWith(SAFE_BATCH_TRANSFER_FROM_SELECTOR)) {
                // --- Batch Transfer ---
                const decoded = this.iface.parseTransaction({ data: data, value: tx.value });
                const from = decoded.args.from.toLowerCase();
                const to = decoded.args.to.toLowerCase();
                const ids = decoded.args.ids;
                const amounts = decoded.args.amounts;

                if (this.monitoredTraders.has(from) || this.monitoredTraders.has(to)) {
                    for (let i = 0; i < ids.length; i++) {
                        this.callback(
                            tx.hash,
                            tx.from,
                            from,
                            to,
                            ids[i],
                            amounts[i],
                            {
                                maxFeePerGas: tx.maxFeePerGas ? ethers.BigNumber.from(tx.maxFeePerGas) : undefined,
                                maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? ethers.BigNumber.from(tx.maxPriorityFeePerGas) : undefined
                            }
                        );
                    }
                }
            }
        } catch (e) {
            // Decode error
        }
    }
}
