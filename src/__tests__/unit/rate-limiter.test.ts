/**
 * Unit tests for rate-limiter.ts
 *
 * Tests cover:
 * - Rate limiter initialization
 * - Execute with rate limiting
 * - Batch execution
 * - Statistics tracking
 * - Unknown API type handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, ApiType } from '../../core/rate-limiter.js';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  describe('initialization', () => {
    it('should create limiters for all API types', () => {
      // Verify stats are available for all types
      expect(rateLimiter.getStats(ApiType.DATA_API)).not.toBeNull();
      expect(rateLimiter.getStats(ApiType.GAMMA_API)).not.toBeNull();
      expect(rateLimiter.getStats(ApiType.CLOB_API)).not.toBeNull();
      expect(rateLimiter.getStats(ApiType.SUBGRAPH)).not.toBeNull();
    });

    it('should return zero stats initially', () => {
      const stats = rateLimiter.getStats(ApiType.DATA_API);
      expect(stats?.running).toBe(0);
      expect(stats?.queued).toBe(0);
    });
  });

  describe('execute', () => {
    it('should execute a function and return result', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      const result = await rateLimiter.execute(ApiType.DATA_API, fn);

      expect(result).toBe('result');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass through errors from the function', async () => {
      const error = new Error('Test error');
      const fn = vi.fn().mockRejectedValue(error);

      await expect(rateLimiter.execute(ApiType.DATA_API, fn)).rejects.toThrow(
        'Test error'
      );
    });

    it('should throw for unknown API type', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await expect(
        rateLimiter.execute('unknown' as ApiType, fn)
      ).rejects.toThrow('Unknown API type');
    });

    it('should handle async functions', async () => {
      const fn = vi.fn().mockImplementation(async () => {
        return 'async-result';
      });

      const result = await rateLimiter.execute(ApiType.DATA_API, fn);
      expect(result).toBe('async-result');
    });

    it('should execute on different API types', async () => {
      const fn = vi.fn().mockResolvedValue('result');

      await rateLimiter.execute(ApiType.GAMMA_API, fn);
      await rateLimiter.execute(ApiType.CLOB_API, fn);
      await rateLimiter.execute(ApiType.SUBGRAPH, fn);

      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('executeBatch', () => {
    it('should execute multiple functions in order', async () => {
      const order: number[] = [];
      const fns = [1, 2, 3].map((id) => {
        return vi.fn().mockImplementation(async () => {
          order.push(id);
          return id * 10;
        });
      });

      const results = await rateLimiter.executeBatch(ApiType.DATA_API, fns);

      expect(results).toEqual([10, 20, 30]);
      expect(order).toEqual([1, 2, 3]);
    });

    it('should handle empty batch', async () => {
      const results = await rateLimiter.executeBatch(ApiType.DATA_API, []);
      expect(results).toEqual([]);
    });

    it('should propagate errors in batch', async () => {
      const fns = [
        vi.fn().mockResolvedValue(1),
        vi.fn().mockRejectedValue(new Error('Batch error')),
        vi.fn().mockResolvedValue(3),
      ];

      await expect(
        rateLimiter.executeBatch(ApiType.DATA_API, fns)
      ).rejects.toThrow('Batch error');
    });

    it('should handle single item batch', async () => {
      const fns = [vi.fn().mockResolvedValue('single')];
      const results = await rateLimiter.executeBatch(ApiType.DATA_API, fns);

      expect(results).toEqual(['single']);
    });
  });

  describe('getStats', () => {
    it('should return stats for valid API type', () => {
      const stats = rateLimiter.getStats(ApiType.DATA_API);

      expect(stats).not.toBeNull();
      expect(stats).toHaveProperty('running');
      expect(stats).toHaveProperty('queued');
    });

    it('should return null for unknown API type', () => {
      const stats = rateLimiter.getStats('unknown' as ApiType);
      expect(stats).toBeNull();
    });

    it('should return different stats for different API types', () => {
      const stats1 = rateLimiter.getStats(ApiType.DATA_API);
      const stats2 = rateLimiter.getStats(ApiType.GAMMA_API);

      expect(stats1).not.toBeNull();
      expect(stats2).not.toBeNull();
    });
  });
});

describe('ApiType enum', () => {
  it('should have all expected API types', () => {
    expect(ApiType.DATA_API).toBe('data-api');
    expect(ApiType.GAMMA_API).toBe('gamma-api');
    expect(ApiType.CLOB_API).toBe('clob-api');
    expect(ApiType.SUBGRAPH).toBe('subgraph');
  });

  it('should be usable as object keys', () => {
    const limits: Partial<Record<ApiType, number>> = {
      [ApiType.DATA_API]: 100,
      [ApiType.GAMMA_API]: 1000,
    };

    expect(limits[ApiType.DATA_API]).toBe(100);
    expect(limits[ApiType.GAMMA_API]).toBe(1000);
    expect(limits[ApiType.CLOB_API]).toBeUndefined();
  });
});
