export type CacheEntry<T> = {
    value: T;
    expiresAt: number;
};

export function createTTLCache<T>() {
    const store = new Map<string, CacheEntry<T>>();
    const inflight = new Map<string, Promise<T>>();

    const get = (key: string): T | undefined => {
        const entry = store.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expiresAt) {
            store.delete(key);
            return undefined;
        }
        return entry.value;
    };

    const set = (key: string, value: T, ttlMs: number) => {
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
    };

    const getOrSet = async (key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> => {
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

    return { get, set, getOrSet };
}
