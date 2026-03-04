export type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

export type TTLCacheOptions = {
    maxEntries?: number;
    sweepIntervalMs?: number;
};

export function createTTLCache<T>(options: TTLCacheOptions = {}) {
    const store = new Map<string, CacheEntry<T>>();
    const inflight = new Map<string, Promise<T>>();
    const maxEntries = Math.max(1, options.maxEntries ?? 1000);
    const sweepIntervalMs = Math.max(1000, options.sweepIntervalMs ?? 30000);
    let lastSweepAt = 0;

    const sweep = (now = Date.now()) => {
        for (const [key, entry] of store.entries()) {
            if (entry.expiresAt <= now) {
                store.delete(key);
            }
        }

        while (store.size > maxEntries) {
            const oldestKey = store.keys().next().value;
            if (oldestKey === undefined) break;
            store.delete(oldestKey);
        }

        lastSweepAt = now;
    };

    const maybeSweep = (now = Date.now()) => {
        if (store.size > maxEntries || now - lastSweepAt >= sweepIntervalMs) {
            sweep(now);
        }
    };

    const get = (key: string): T | undefined => {
        maybeSweep();
        const entry = store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return undefined;
        }
        return entry.value;
    };

    const set = (key: string, value: T, ttlMs: number) => {
        maybeSweep();
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
        if (store.size > maxEntries) {
            sweep();
        }
    };

    const getOrSet = async (key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
        maybeSweep();
        const cached = get(key);
        if (cached !== undefined) return cached;

        const pending = inflight.get(key);
        if (pending) return pending;

        const promise = (async () => {
            try {
                const value = await fetcher();
                set(key, value, ttlMs);
                return value;
            } finally {
                inflight.delete(key);
            }
        })();

        inflight.set(key, promise);
        return promise;
    };

    const del = (key: string) => {
        inflight.delete(key);
        store.delete(key);
    };

    const clear = () => {
        inflight.clear();
        store.clear();
        lastSweepAt = Date.now();
    };

    const size = () => {
        maybeSweep();
        return store.size;
    };

    return { get, set, getOrSet, delete: del, clear, size, sweep };
}
