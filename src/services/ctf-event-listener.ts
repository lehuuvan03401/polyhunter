import { ethers } from 'ethers';
import { ActivityTrade } from './realtime-service-v2.js';

// Polymarket exchange contracts (Polygon)
const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";

// OrderFilled event ABI
const ORDERFILLED_ABI = [
    "event OrderFilled(bytes32 indexed orderHash, address indexed maker, address indexed taker, uint256 makerAssetId, uint256 takerAssetId, uint256 makerAmountFilled, uint256 takerAmountFilled, uint256 fee)",
] as const;

export class CtfEventListener {
    private provider: ethers.providers.BaseProvider | null = null;
    private rpcUrl: string;
    private targetAddress: string;
    private onTradeCallback: ((trade: ActivityTrade) => void) | null = null;
    private seen = new Set<string>();
    private iface = new ethers.utils.Interface(ORDERFILLED_ABI);
    private reconnectTimer: NodeJS.Timeout | null = null;
    private isConnected = false;
    private pollingIntervalMs: number = 2000; // Default 2s polling for HTTP

    constructor(rpcUrl: string, targetAddress: string) {
        this.rpcUrl = rpcUrl;
        this.targetAddress = targetAddress.toLowerCase();
    }

    start(onTrade: (trade: ActivityTrade) => void) {
        this.onTradeCallback = onTrade;
        this.connect();
    }

    stop() {
        this.isConnected = false;
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.provider) {
            this.provider.removeAllListeners();
            // Destroy only if it's a websocket provider
            if (this.provider instanceof ethers.providers.WebSocketProvider) {
                this.provider.destroy();
            }
            this.provider = null;
        }
    }

    private connect() {
        if (this.isConnected) return;

        try {
            const isWs = this.rpcUrl.startsWith('wss://') || this.rpcUrl.startsWith('ws://');
            console.log(`🔌 [CtfEvent] Connecting to ${this.rpcUrl.substring(0, 25)}... (${isWs ? 'WebSocket' : 'HTTP Polling'})`);

            if (isWs) {
                // WebSocket Mode
                const wsProvider = new ethers.providers.WebSocketProvider(this.rpcUrl);
                this.provider = wsProvider;

                const ws = (wsProvider as any)._websocket;
                ws.on('open', () => {
                    console.log('✅ [CtfEvent] WS Connected.');
                    this.isConnected = true;
                    this.subscribe();
                });

                ws.on('close', () => {
                    console.log('⚠️ [CtfEvent] WS Disconnected. Reconnecting...');
                    this.handleDisconnect();
                });

                ws.on('error', (err: any) => {
                    console.error('❌ [CtfEvent] WS Error:', err.message);
                    this.handleDisconnect();
                });
            } else {
                // HTTP Polling Mode
                // Use StaticJsonRpcProvider for better performance (caches chainId)
                const httpProvider = new ethers.providers.StaticJsonRpcProvider(this.rpcUrl);
                httpProvider.pollingInterval = this.pollingIntervalMs;
                this.provider = httpProvider;

                // HTTP is "always connected" conceptually, but we verify with a block number check
                this.provider.getBlockNumber().then(() => {
                    console.log('✅ [CtfEvent] HTTP Polling Started.');
                    this.isConnected = true;
                    this.subscribe();
                }).catch(err => {
                    console.error('❌ [CtfEvent] HTTP Connection failed:', err.message);
                    this.handleDisconnect();
                });
            }

        } catch (error) {
            console.error('❌ [CtfEvent] Connection setup failed:', error);
            this.handleDisconnect();
        }
    }

    private handleDisconnect() {
        this.isConnected = false;
        if (this.provider) {
            this.provider.removeAllListeners();
            if (this.provider instanceof ethers.providers.WebSocketProvider) {
                // Don't destroy immediately if it might be auto-reconnecting internally, 
                // but for custom logic usually we recreate.
                // Actually destroying avoids zombie callbacks.
                this.provider.destroy();
            }
            this.provider = null;
        }

        if (!this.reconnectTimer) {
            this.reconnectTimer = setTimeout(() => {
                this.reconnectTimer = null;
                this.connect();
            }, 5000);
        }
    }

    private subscribe() {
        if (!this.provider) return;

        const topic0 = this.iface.getEventTopic("OrderFilled");
        const filters = [
            { address: CTF_EXCHANGE, topics: [topic0] },
            { address: NEG_RISK_CTF_EXCHANGE, topics: [topic0] },
        ];

        // Ethers v5 supports on(filter) for both WS (subscription) and HTTP (polling)
        // This unifies the logic!
        console.log(`🎧 [CtfEvent] Listening for OrderFilled events...`);
        for (const f of filters) {
            this.provider.on(f, (log) => this.handleLog(log));
        }
    }

    private handleLog(log: ethers.providers.Log) {
        // Basic dedupe
        const dedupKey = `${log.transactionHash}:${log.logIndex}`;
        if (this.seen.has(dedupKey)) return;
        this.seen.add(dedupKey);

        // Memory cleanup cap
        if (this.seen.size > 10000) {
            const arr = Array.from(this.seen);
            // keep last 5000
            this.seen = new Set(arr.slice(5000));
        }

        try {
            const parsed = this.iface.parseLog(log);
            const maker = String(parsed.args.maker).toLowerCase();

            // Filter TARGET
            if (maker !== this.targetAddress) return;

            const fill = this.decodeFill(parsed.args);
            if (!fill) return;

            // Construct minimal ActivityTrade
            // Note: Missing slug/conditionId/outcome will be enriched by the main script
            const trade: ActivityTrade = {
                asset: fill.tokenID,
                conditionId: "",
                marketSlug: "",
                eventSlug: "",
                outcome: "",
                price: fill.price,
                side: fill.side,
                size: fill.shares,
                timestamp: Date.now() / 1000,
                transactionHash: log.transactionHash,
                trader: {
                    address: maker,
                    name: "Target"
                }
            };

            if (this.onTradeCallback) {
                this.onTradeCallback(trade);
            }

        } catch (e) {
            console.error('[CtfEvent] Error parsing log:', e);
        }
    }

    /**
     * Ported from Polymarket-Copy-Trading-Bot
     */
    private decodeFill(args: any) {
        const makerAssetId = ethers.BigNumber.from(args.makerAssetId);
        const takerAssetId = ethers.BigNumber.from(args.takerAssetId);
        const makerAmt = ethers.BigNumber.from(args.makerAmountFilled);
        const takerAmt = ethers.BigNumber.from(args.takerAmountFilled);
        const SCALE = ethers.BigNumber.from(1_000_000);

        // CASE 1: Maker is buying (Giving USDC=0, Getting Token=TakerAsset)
        // Wait, standard CTF Exchange logic:
        // makerAsset=0 (USDC) -> Maker is BUYING tokens (giving USDC)
        if (makerAssetId.eq(0)) {
            const tokenID = takerAssetId.toString();
            const usdc = makerAmt;
            const shares = takerAmt;
            if (shares.isZero()) return null;
            const priceScaled = usdc.mul(SCALE).div(shares);
            return {
                side: "BUY" as const,
                tokenID,
                shares: Number(ethers.utils.formatUnits(shares, 6)),
                price: Number(ethers.utils.formatUnits(priceScaled, 6)),
            };
        }

        // CASE 2: Maker is selling (Giving Token, Getting USDC=0)
        // takerAsset=0 (USDC) -> Maker is SELLING tokens (getting USDC)
        if (takerAssetId.eq(0)) {
            const tokenID = makerAssetId.toString();
            const shares = makerAmt;
            const usdc = takerAmt;
            if (shares.isZero()) return null;
            const priceScaled = usdc.mul(SCALE).div(shares);
            return {
                side: "SELL" as const,
                tokenID,
                shares: Number(ethers.utils.formatUnits(shares, 6)),
                price: Number(ethers.utils.formatUnits(priceScaled, 6)),
            };
        }

        return null;
    }
}
