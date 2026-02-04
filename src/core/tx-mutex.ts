/**
 * Simple Mutex for Transaction Synchronization
 * Prevents Nonce Collisions by ensuring only one transaction is signed/sent at a time.
 */
export class TxMutex {
    private mutex = Promise.resolve();
    private queue: Array<() => void> = [];
    private maxQueueSize: number;
    private pendingCount = 0;

    constructor(maxQueueSize = 50) {
        this.maxQueueSize = maxQueueSize;
    }

    /**
     * Execute a task sequentially
     */
    async run<T>(task: () => Promise<T>): Promise<T> {
        if (this.pendingCount >= this.maxQueueSize) {
            throw new Error(`TxMutex Queue Full (${this.pendingCount})`);
        }
        this.pendingCount++;

        // Return a promise that resolves when it's this task's turn
        return new Promise<T>((resolve, reject) => {
            // Chain to the end of the mutex
            this.mutex = this.mutex.then(async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (err) {
                    reject(err);
                } finally {
                    this.pendingCount = Math.max(0, this.pendingCount - 1);
                }
            });
        });
    }

    /**
     * Check if locked (approximate)
     */
    isLocked(): boolean {
        // Not easily doable with simple promise chain without external state,
        // but for our purpose, we just trust the chain.
        return false;
    }

    getQueueDepth(): number {
        return this.pendingCount;
    }
}

// Global Singleton instance for the Worker
export const globalTxMutex = new TxMutex();

export class ScopedTxMutex {
    private mutexes = new Map<string, TxMutex>();

    getMutex(key: string): TxMutex {
        let mutex = this.mutexes.get(key);
        if (!mutex) {
            mutex = new TxMutex();
            this.mutexes.set(key, mutex);
        }
        return mutex;
    }

    getQueueDepth(key: string): number {
        return this.getMutex(key).getQueueDepth();
    }
}

export const scopedTxMutex = new ScopedTxMutex();
