/**
 * Rate Limiter for LLM Requests
 *
 * Implements a sliding window rate limiter with configurable requests per minute
 * and a buffer between requests to prevent bursts.
 */

import { debugLog } from '../../utils/debug';

/**
 * Rate limiter using sliding window algorithm.
 * Provides non-blocking async wait for rate limit slots.
 */
export class RateLimiter {
	private timestamps: number[] = [];
	private readonly windowMs = 60_000; // 1 minute window
	private readonly bufferMs = 1000; // 1 second buffer between requests

	constructor(private readonly _maxRequestsPerMinute: number) {}

	/**
	 * Get the max requests per minute setting.
	 */
	get maxRequestsPerMinute(): number {
		return this._maxRequestsPerMinute;
	}

	/**
	 * Wait until a rate limit slot is available.
	 * @param abortSignal - Optional signal to abort waiting
	 * @throws Error if aborted
	 */
	async waitForSlot(abortSignal?: AbortSignal): Promise<void> {
		// Disabled when maxRequestsPerMinute <= 0
		if (this._maxRequestsPerMinute <= 0) return;

		while (true) {
			// Check abort signal
			if (abortSignal?.aborted) {
				throw new Error('Aborted');
			}

			const now = Date.now();
			this.pruneOldTimestamps(now);

			// Check if we have capacity
			if (this.timestamps.length < this._maxRequestsPerMinute) {
				// Check buffer from last request
				const lastRequest = this.timestamps[this.timestamps.length - 1];
				if (lastRequest && now - lastRequest < this.bufferMs) {
					const waitTime = this.bufferMs - (now - lastRequest);
					debugLog(`Rate limit: waiting ${waitTime}ms for buffer between requests`);
					await this.sleep(waitTime, abortSignal);
					continue;
				}
				// Slot available
				return;
			}

			// Wait until oldest request falls out of window
			const oldestTimestamp = this.timestamps[0];
			const waitTime = this.windowMs - (now - oldestTimestamp) + 10;
			const actualWait = Math.max(waitTime, this.bufferMs);
			debugLog(
				`Rate limit: ${this.timestamps.length}/${this._maxRequestsPerMinute} requests in window, waiting ${actualWait}ms`,
			);
			await this.sleep(actualWait, abortSignal);
		}
	}

	/**
	 * Record that a request was made.
	 * Call this after successful request completion.
	 */
	recordRequest(): void {
		if (this._maxRequestsPerMinute <= 0) return;
		this.timestamps.push(Date.now());
	}

	/**
	 * Remove timestamps older than the window.
	 */
	private pruneOldTimestamps(now: number): void {
		const cutoff = now - this.windowMs;
		this.timestamps = this.timestamps.filter(t => t > cutoff);
	}

	/**
	 * Sleep for a given duration, supporting abort.
	 */
	private sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
		return new Promise((resolve, reject) => {
			// Check if already aborted
			if (abortSignal?.aborted) {
				reject(new Error('Aborted'));
				return;
			}

			let settled = false;

			const onAbort = () => {
				if (!settled) {
					settled = true;
					clearTimeout(timeout);
					reject(new Error('Aborted'));
				}
			};

			const timeout = setTimeout(() => {
				if (!settled) {
					settled = true;
					if (abortSignal) {
						abortSignal.removeEventListener('abort', onAbort);
					}
					resolve();
				}
			}, ms);

			if (abortSignal) {
				abortSignal.addEventListener('abort', onAbort, { once: true });
			}
		});
	}
}
