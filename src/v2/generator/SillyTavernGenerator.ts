/**
 * V2 SillyTavern Generator
 *
 * Production implementation using SillyTavern's generation API.
 */

import type { ExtractedData } from 'sillytavern-utils-lib/types';
import { Generator as STGenerator } from 'sillytavern-utils-lib';
import type { Generator } from './Generator';
import { GeneratorAbortError, GeneratorError } from './Generator';
import type { GeneratorPrompt, GeneratorSettings, GeneratorConfig } from './types';
import { RateLimiter } from '../utils/rateLimiter';
import { getV2Settings } from '../settings';

// Module-level rate limiter instance
let rateLimiter: RateLimiter | null = null;
let lastMaxReqsPerMinute: number | null = null;

/**
 * Get or create the rate limiter instance.
 * Re-creates if settings have changed.
 */
function getRateLimiter(): RateLimiter {
	const settings = getV2Settings();
	const maxReqs = settings.v2MaxReqsPerMinute;

	if (!rateLimiter || lastMaxReqsPerMinute !== maxReqs) {
		rateLimiter = new RateLimiter(maxReqs);
		lastMaxReqsPerMinute = maxReqs;
	}

	return rateLimiter;
}

/**
 * Production generator using SillyTavern's API.
 */
export class SillyTavernGenerator implements Generator {
	private readonly generator: STGenerator;
	private readonly config: GeneratorConfig;
	private abortController: AbortController | null = null;

	constructor(config: GeneratorConfig) {
		this.config = config;
		this.generator = new STGenerator();
	}

	async generate(prompt: GeneratorPrompt, settings: GeneratorSettings): Promise<string> {
		const { maxTokens, temperature = 0.5, abortSignal } = settings;

		// Check if already aborted
		if (abortSignal?.aborted) {
			throw new GeneratorAbortError('Generation aborted before start');
		}

		// Wait for rate limit slot
		try {
			await getRateLimiter().waitForSlot(abortSignal);
		} catch (e) {
			if (e instanceof Error && e.message === 'Aborted') {
				throw new GeneratorAbortError(
					'Generation aborted while waiting for rate limit',
				);
			}
			throw e;
		}

		return new Promise<string>((resolve, reject) => {
			// Create abort controller for this request
			this.abortController = new AbortController();

			// Link external abort signal
			if (abortSignal) {
				abortSignal.addEventListener('abort', () => {
					this.abortController?.abort();
				});
			}

			this.generator.generateRequest(
				{
					profileId: this.config.profileId,
					prompt: prompt.messages,
					maxTokens,
					custom: { signal: this.abortController.signal },
					overridePayload: {
						temperature,
					},
				},
				{
					abortController: this.abortController,
					onFinish: (_requestId, data, error) => {
						this.abortController = null;

						if (error) {
							if (error.name === 'AbortError') {
								return reject(
									new GeneratorAbortError(
										'Generation aborted',
									),
								);
							}
							return reject(
								new GeneratorError(
									error.message,
									error,
								),
							);
						}

						if (!data) {
							return reject(
								new GeneratorAbortError(
									'Generation aborted',
								),
							);
						}

						// Record successful request for rate limiting
						getRateLimiter().recordRequest();

						const content = (data as ExtractedData).content;
						if (typeof content === 'string') {
							resolve(content);
						} else {
							resolve(JSON.stringify(content));
						}
					},
				},
			);
		});
	}

	abort(): void {
		this.abortController?.abort();
		this.abortController = null;
	}
}

/**
 * Create a SillyTavern generator with the given profile ID.
 */
export function createSillyTavernGenerator(profileId: string): SillyTavernGenerator {
	return new SillyTavernGenerator({ profileId });
}
