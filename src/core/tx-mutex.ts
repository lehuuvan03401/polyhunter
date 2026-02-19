/**
 * Simple Mutex for Transaction Synchronization
 * Prevents Nonce Collisions by ensuring only one transaction is signed/sent at a time.
 */
export class TxMutex {
    private mutex = Promise.resolve();
    // 预留字段：后续若需要显式 waiter 管理/取消，可在此扩展。
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

        // 通过 Promise 链把任务串成“单通道”：
        // 后来的任务必须等待前一个任务完成，避免并发发送导致 nonce 冲突。
        return new Promise<T>((resolve, reject) => {
            // 挂到当前链尾，形成严格顺序执行。
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
        // 当前实现返回占位值；调用方请优先使用 getQueueDepth() 判断拥塞。
        return false;
    }

    getQueueDepth(): number {
        // pendingCount 表示“已入队但未完成”的任务数，可用于背压观测。
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
            // 按 key 懒加载隔离锁：
            // 例如 proxy:A 与 proxy:B 可并行，proxy:A 内部仍保持串行。
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
