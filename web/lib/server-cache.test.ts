import { describe, expect, it } from 'vitest';
import { createTTLCache } from './server-cache';

describe('createTTLCache', () => {
    it('evicts oldest entries when maxEntries is exceeded', async () => {
        const cache = createTTLCache<number>({ maxEntries: 2, sweepIntervalMs: 1000 });

        cache.set('a', 1, 60_000);
        cache.set('b', 2, 60_000);
        cache.set('c', 3, 60_000);

        expect(cache.get('a')).toBeUndefined();
        expect(cache.get('b')).toBe(2);
        expect(cache.get('c')).toBe(3);
        expect(cache.size()).toBe(2);
    });

    it('removes expired entries during access and sweep', async () => {
        const cache = createTTLCache<number>({ maxEntries: 10, sweepIntervalMs: 1 });

        cache.set('a', 1, 5);
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(cache.get('a')).toBeUndefined();
        cache.sweep();
        expect(cache.size()).toBe(0);
    });

    it('deduplicates inflight fetches', async () => {
        const cache = createTTLCache<number>({ maxEntries: 10, sweepIntervalMs: 1000 });
        let calls = 0;

        const [first, second] = await Promise.all([
            cache.getOrSet('shared', 1000, async () => {
                calls += 1;
                return 42;
            }),
            cache.getOrSet('shared', 1000, async () => {
                calls += 1;
                return 99;
            }),
        ]);

        expect(first).toBe(42);
        expect(second).toBe(42);
        expect(calls).toBe(1);
    });

    it('stays bounded under sustained write pressure', async () => {
        const cache = createTTLCache<number>({ maxEntries: 100, sweepIntervalMs: 1000 });

        for (let index = 0; index < 5_000; index += 1) {
            cache.set(`key-${index}`, index, 60_000);
        }

        expect(cache.size()).toBe(100);
        expect(cache.get('key-0')).toBeUndefined();
        expect(cache.get('key-4999')).toBe(4999);
    });
});
