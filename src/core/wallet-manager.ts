import { ethers } from 'ethers';
import { TradingService } from '../services/trading-service.js';
import { RateLimiter } from './rate-limiter.js';
import { UnifiedCache } from './unified-cache.js';

export interface WorkerContext {
    address: string;
    signer: ethers.Wallet;
    tradingService: TradingService;
}

export interface WalletStatus {
    address: string;
    isBusy: boolean;
    lastUsed: number;
    pendingCount: number;
}

export class WalletManager {
    private workers: Map<string, WorkerContext> = new Map();
    private status: Map<string, WalletStatus> = new Map();
    private provider: ethers.providers.Provider;
    private rateLimiter: RateLimiter;
    private cache: UnifiedCache;
    private chainId: number;

    constructor(
        provider: ethers.providers.Provider,
        rateLimiter: RateLimiter,
        cache: UnifiedCache,
        masterMnemonic: string,
        count: number = 10,
        startIndex: number = 0,
        chainId: number = 137
    ) {
        this.provider = provider;
        this.rateLimiter = rateLimiter;
        this.cache = cache;
        this.chainId = chainId;
        this.initializeFleet(masterMnemonic, count, startIndex);
    }

    /**
     * Initialize the wallet fleet from a master mnemonic
     */
    private initializeFleet(mnemonic: string, count: number, startIndex: number) {
        console.log(`[WalletManager] Initializing fleet of ${count} wallets...`);

        for (let i = 0; i < count; i++) {
            const index = startIndex + i;
            // BIP-44 path for standard Ethereum/Polygon: m/44'/60'/0'/0/index
            const path = `m/44'/60'/0'/0/${index}`;
            const wallet = ethers.Wallet.fromMnemonic(mnemonic, path).connect(this.provider);

            // Create dedicated TradingService for this worker
            const tradingService = new TradingService(
                this.rateLimiter,
                this.cache,
                {
                    privateKey: wallet.privateKey,
                    chainId: this.chainId
                }
            );

            this.workers.set(wallet.address, {
                address: wallet.address,
                signer: wallet,
                tradingService
            });

            this.status.set(wallet.address, {
                address: wallet.address,
                isBusy: false,
                lastUsed: 0,
                pendingCount: 0
            });

            // Log first few and last to verify
            if (i < 3 || i === count - 1) {
                console.log(`[WalletManager] Loaded Worker #${index}: ${wallet.address}`);
            }
        }
    }

    /**
     * Get an available wallet from the fleet.
     * Strategy: Round-robin or Least Recently Used.
     */
    /**
     * Get an available worker from the fleet.
     */
    public checkoutWorker(): WorkerContext | null {
        // Find all non-busy wallets
        const available = Array.from(this.status.values())
            .filter(s => !s.isBusy)
            .sort((a, b) => a.lastUsed - b.lastUsed); // Pick LRU

        if (available.length === 0) {
            return null; // All busy
        }

        const selected = available[0];
        // Mark as busy
        selected.isBusy = true;
        selected.lastUsed = Date.now();
        selected.pendingCount++;

        return this.workers.get(selected.address)!;
    }

    /**
     * Release a worker back to the pool
     */
    public checkinWorker(address: string) {
        const status = this.status.get(address);
        if (status) {
            status.isBusy = false;
            if (status.pendingCount > 0) status.pendingCount--;
        }
    }

    /**
     * Get fleet statistics
     */
    public getStats() {
        const total = this.status.size;
        const busy = Array.from(this.status.values()).filter(s => s.isBusy).length;
        return {
            total,
            busy,
            available: total - busy
        };
    }

    /**
     * Get all worker addresses
     */
    public getAllAddresses(): string[] {
        return Array.from(this.workers.keys());
    }
}
