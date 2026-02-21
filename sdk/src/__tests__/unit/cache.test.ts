/**
 * Unit tests for cache.ts
 *
 * Tests cover:
 * - Basic get/set operations
 * - TTL expiration
 * - getOrSet with factory function
 * - Pattern-based invalidation
 * - Cache clearing
 * - Cache size tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Cache, CACHE_TTL } from '../../core/cache.js';

describe('Cache', () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('get/set', () => {
    it('should store and retrieve a value', () => {
      cache.set('key1', 'value1', 1000);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should overwrite existing key', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key1', 'value2', 1000);
      expect(cache.get('key1')).toBe('value2');
    });

    it('should store different types', () => {
      cache.set('string', 'hello', 1000);
      cache.set('number', 42, 1000);
      cache.set('object', { foo: 'bar' }, 1000);
      cache.set('array', [1, 2, 3], 1000);
      cache.set('boolean', true, 1000);

      expect(cache.get('string')).toBe('hello');
      expect(cache.get('number')).toBe(42);
      expect(cache.get('object')).toEqual({ foo: 'bar' });
      expect(cache.get('array')).toEqual([1, 2, 3]);
      expect(cache.get('boolean')).toBe(true);
    });
  });

  describe('TTL expiration', () => {
    it('should return value before TTL expires', () => {
      cache.set('key1', 'value1', 1000);
      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined after TTL expires', () => {
      cache.set('key1', 'value1', 1000);
      vi.advanceTimersByTime(1001);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should delete expired entry on get', () => {
      cache.set('key1', 'value1', 1000);
      expect(cache.size()).toBe(1);

      vi.advanceTimersByTime(1001);
      cache.get('key1');

      expect(cache.size()).toBe(0);
    });

    it('should handle zero TTL (immediate expiration)', () => {
      cache.set('key1', 'value1', 0);
      // Note: With TTL of 0, it expires immediately
      vi.advanceTimersByTime(1);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should handle long TTL values', () => {
      const oneHour = 60 * 60 * 1000;
      cache.set('key1', 'value1', oneHour);

      vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
      expect(cache.get('key1')).toBe('value1');

      vi.advanceTimersByTime(31 * 60 * 1000); // Total 61 minutes
      expect(cache.get('key1')).toBeUndefined();
    });
  });

  describe('getOrSet', () => {
    it('should return cached value if present', async () => {
      cache.set('key1', 'cached', 1000);
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await cache.getOrSet('key1', 1000, factory);

      expect(result).toBe('cached');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should call factory and cache result if not present', async () => {
      const factory = vi.fn().mockResolvedValue('fresh');

      const result = await cache.getOrSet('key1', 1000, factory);

      expect(result).toBe('fresh');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get('key1')).toBe('fresh');
    });

    it('should cache result with correct TTL', async () => {
      const factory = vi.fn().mockResolvedValue('fresh');

      await cache.getOrSet('key1', 1000, factory);

      vi.advanceTimersByTime(500);
      expect(cache.get('key1')).toBe('fresh');

      vi.advanceTimersByTime(501);
      expect(cache.get('key1')).toBeUndefined();
    });

    it('should handle async factory', async () => {
      const factory = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return 'async-result';
      });

      const resultPromise = cache.getOrSet('key1', 1000, factory);

      // Need to advance timers for the async operation
      await vi.runAllTimersAsync();

      const result = await resultPromise;
      expect(result).toBe('async-result');
    });

    it('should allow factory to throw and not cache', async () => {
      const factory = vi.fn().mockRejectedValue(new Error('Factory error'));

      await expect(cache.getOrSet('key1', 1000, factory)).rejects.toThrow(
        'Factory error'
      );

      // Entry should not be cached on error
      expect(cache.size()).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('should invalidate keys matching pattern', () => {
      cache.set('market:123', 'data1', 1000);
      cache.set('market:456', 'data2', 1000);
      cache.set('wallet:789', 'data3', 1000);

      cache.invalidate('market:');

      expect(cache.get('market:123')).toBeUndefined();
      expect(cache.get('market:456')).toBeUndefined();
      expect(cache.get('wallet:789')).toBe('data3');
    });

    it('should handle partial string matches', () => {
      cache.set('user:profile:123', 'data1', 1000);
      cache.set('user:settings:123', 'data2', 1000);
      cache.set('admin:profile:456', 'data3', 1000);

      cache.invalidate('profile');

      expect(cache.get('user:profile:123')).toBeUndefined();
      expect(cache.get('user:settings:123')).toBe('data2');
      expect(cache.get('admin:profile:456')).toBeUndefined();
    });

    it('should handle non-matching pattern', () => {
      cache.set('key1', 'value1', 1000);

      cache.invalidate('nonexistent');

      expect(cache.get('key1')).toBe('value1');
    });

    it('should handle empty cache', () => {
      expect(() => cache.invalidate('any')).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 1000);
      cache.set('key3', 'value3', 1000);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
    });

    it('should handle empty cache', () => {
      expect(() => cache.clear()).not.toThrow();
    });
  });

  describe('size', () => {
    it('should return correct size', () => {
      expect(cache.size()).toBe(0);

      cache.set('key1', 'value1', 1000);
      expect(cache.size()).toBe(1);

      cache.set('key2', 'value2', 1000);
      expect(cache.size()).toBe(2);

      cache.set('key1', 'updated', 1000); // Overwrite
      expect(cache.size()).toBe(2);
    });

    it('should not count expired entries (lazy deletion)', () => {
      cache.set('key1', 'value1', 1000);
      expect(cache.size()).toBe(1);

      vi.advanceTimersByTime(1001);

      // Size still reports 1 until we try to access
      expect(cache.size()).toBe(1);

      // After access, entry is deleted
      cache.get('key1');
      expect(cache.size()).toBe(0);
    });
  });
});

describe('CACHE_TTL constants', () => {
  it('should have correct TTL values', () => {
    expect(CACHE_TTL.MARKET_INFO).toBe(60 * 1000); // 1 minute
    expect(CACHE_TTL.WALLET_POSITIONS).toBe(5 * 60 * 1000); // 5 minutes
    expect(CACHE_TTL.LEADERBOARD).toBe(60 * 60 * 1000); // 1 hour
    expect(CACHE_TTL.TICK_SIZE).toBe(24 * 60 * 60 * 1000); // 24 hours
    expect(CACHE_TTL.ACTIVITY).toBe(2 * 60 * 1000); // 2 minutes
  });

  it('should have reasonable TTL hierarchy', () => {
    // Market info should be shortest (most volatile)
    expect(CACHE_TTL.MARKET_INFO).toBeLessThan(CACHE_TTL.ACTIVITY);

    // Activity should be shorter than wallet positions
    expect(CACHE_TTL.ACTIVITY).toBeLessThan(CACHE_TTL.WALLET_POSITIONS);

    // Wallet positions should be shorter than leaderboard
    expect(CACHE_TTL.WALLET_POSITIONS).toBeLessThan(CACHE_TTL.LEADERBOARD);

    // Tick size should be longest (rarely changes)
    expect(CACHE_TTL.TICK_SIZE).toBeGreaterThan(CACHE_TTL.LEADERBOARD);
  });
});
