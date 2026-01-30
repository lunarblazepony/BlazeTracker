import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('constructor', () => {
		it('stores maxRequestsPerMinute', () => {
			const limiter = new RateLimiter(10);
			expect(limiter.maxRequestsPerMinute).toBe(10);
		});
	});

	describe('waitForSlot - disabled', () => {
		it('returns immediately when maxRequestsPerMinute is 0', async () => {
			const limiter = new RateLimiter(0);
			const start = Date.now();
			await limiter.waitForSlot();
			expect(Date.now() - start).toBe(0);
		});

		it('returns immediately when maxRequestsPerMinute is negative', async () => {
			const limiter = new RateLimiter(-1);
			const start = Date.now();
			await limiter.waitForSlot();
			expect(Date.now() - start).toBe(0);
		});
	});

	describe('waitForSlot - enabled', () => {
		it('returns immediately when under rate limit', async () => {
			const limiter = new RateLimiter(10);
			await limiter.waitForSlot();
			// Should complete without delay
		});

		it('enforces buffer between requests', async () => {
			const limiter = new RateLimiter(10);

			// First request
			await limiter.waitForSlot();
			limiter.recordRequest();

			// Second request should wait for buffer
			const waitPromise = limiter.waitForSlot();

			// Advance time by 500ms (less than buffer)
			await vi.advanceTimersByTimeAsync(500);

			// Advance remaining time to complete buffer
			await vi.advanceTimersByTimeAsync(600);

			await waitPromise;
		});

		it('waits when rate limit is reached', async () => {
			const limiter = new RateLimiter(2);

			// Make 2 requests quickly
			await limiter.waitForSlot();
			limiter.recordRequest();

			// Advance past buffer
			await vi.advanceTimersByTimeAsync(1100);

			await limiter.waitForSlot();
			limiter.recordRequest();

			// Third request should wait
			const waitPromise = limiter.waitForSlot();
			let resolved = false;
			waitPromise.then(() => {
				resolved = true;
			});

			// Advance some time but not enough
			await vi.advanceTimersByTimeAsync(30000);
			expect(resolved).toBe(false);

			// Advance past the window for first request to expire
			await vi.advanceTimersByTimeAsync(35000);
			await waitPromise;
			expect(resolved).toBe(true);
		});
	});

	describe('waitForSlot - abort handling', () => {
		it('throws when abort signal is already aborted', async () => {
			const limiter = new RateLimiter(10);
			const controller = new AbortController();
			controller.abort();

			await expect(limiter.waitForSlot(controller.signal)).rejects.toThrow(
				'Aborted',
			);
		});

		it('throws when aborted during wait', async () => {
			const limiter = new RateLimiter(1);

			// Use up the rate limit
			await limiter.waitForSlot();
			limiter.recordRequest();

			const controller = new AbortController();

			// Start wait, then abort synchronously after advancing timers
			const waitPromise = limiter.waitForSlot(controller.signal);

			// Advance time a bit, then abort
			await vi.advanceTimersByTimeAsync(50);
			controller.abort();

			await expect(waitPromise).rejects.toThrow('Aborted');
		});

		it('throws when aborted during buffer wait', async () => {
			const limiter = new RateLimiter(10);

			// First request
			await limiter.waitForSlot();
			limiter.recordRequest();

			// Second request will wait for buffer
			const controller = new AbortController();
			const waitPromise = limiter.waitForSlot(controller.signal);

			// Advance time a bit, then abort
			await vi.advanceTimersByTimeAsync(50);
			controller.abort();

			await expect(waitPromise).rejects.toThrow('Aborted');
		});
	});

	describe('recordRequest - disabled', () => {
		it('does nothing when rate limiting is disabled', () => {
			const limiter = new RateLimiter(0);
			// Should not throw
			limiter.recordRequest();
			limiter.recordRequest();
			limiter.recordRequest();
		});
	});

	describe('sliding window', () => {
		it('correctly prunes old timestamps', async () => {
			const limiter = new RateLimiter(2);

			// Make a request
			await limiter.waitForSlot();
			limiter.recordRequest();

			// Advance time past buffer
			await vi.advanceTimersByTimeAsync(1100);

			// Make another request
			await limiter.waitForSlot();
			limiter.recordRequest();

			// Now at limit, advance past first request's window
			await vi.advanceTimersByTimeAsync(59000);

			// Should still be waiting (first request still in window)
			const waitPromise = limiter.waitForSlot();
			let resolved = false;
			waitPromise.then(() => {
				resolved = true;
			});

			// Advance just past the first request's expiry
			await vi.advanceTimersByTimeAsync(2000);
			await waitPromise;
			expect(resolved).toBe(true);
		});
	});
});
