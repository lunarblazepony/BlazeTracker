/**
 * V2 Mock Generator
 *
 * Test mock with pattern matching for prompts.
 */

import type { Generator } from './Generator';
import { GeneratorAbortError } from './Generator';
import type { GeneratorPrompt, GeneratorSettings } from './types';

/**
 * A recorded call to the generator.
 */
export interface GeneratorCall {
	prompt: GeneratorPrompt;
	settings: GeneratorSettings;
	timestamp: number;
}

/**
 * Response handler function type.
 */
export type ResponseHandler = (prompt: GeneratorPrompt, settings: GeneratorSettings) => string;

/**
 * Response configuration.
 */
interface ResponseConfig {
	pattern: string | RegExp;
	handler: string | ResponseHandler;
	once: boolean;
	used: boolean;
}

/**
 * Mock generator for testing.
 * Allows setting up responses based on prompt patterns.
 */
export class MockGenerator implements Generator {
	private responses: ResponseConfig[] = [];
	private calls: GeneratorCall[] = [];
	private defaultResponse: string | ResponseHandler = '{}';
	private aborted = false;
	private delay = 0;

	/**
	 * Set a response for prompts matching a pattern.
	 * Pattern is matched against the combined system + user prompt content.
	 *
	 * @param pattern - String or RegExp to match against prompt content
	 * @param response - Response string or handler function
	 */
	setResponse(pattern: string | RegExp, response: string | ResponseHandler): this {
		this.responses.push({
			pattern,
			handler: response,
			once: false,
			used: false,
		});
		return this;
	}

	/**
	 * Set a one-time response for prompts matching a pattern.
	 * Will only be used once, then removed.
	 *
	 * @param pattern - String or RegExp to match against prompt content
	 * @param response - Response string or handler function
	 */
	setResponseOnce(pattern: string | RegExp, response: string | ResponseHandler): this {
		this.responses.push({
			pattern,
			handler: response,
			once: true,
			used: false,
		});
		return this;
	}

	/**
	 * Set the default response when no pattern matches.
	 */
	setDefaultResponse(response: string | ResponseHandler): this {
		this.defaultResponse = response;
		return this;
	}

	/**
	 * Set a delay in milliseconds before returning responses.
	 * Useful for testing abort behavior.
	 */
	setDelay(ms: number): this {
		this.delay = ms;
		return this;
	}

	/**
	 * Get all recorded calls.
	 */
	getCalls(): readonly GeneratorCall[] {
		return this.calls;
	}

	/**
	 * Get the last call made.
	 */
	getLastCall(): GeneratorCall | undefined {
		return this.calls[this.calls.length - 1];
	}

	/**
	 * Get calls matching a pattern.
	 */
	getCallsMatching(pattern: string | RegExp): GeneratorCall[] {
		return this.calls.filter(call => this.matchesPattern(call.prompt, pattern));
	}

	/**
	 * Clear all recorded calls.
	 */
	clearCalls(): this {
		this.calls = [];
		return this;
	}

	/**
	 * Clear all responses.
	 */
	clearResponses(): this {
		this.responses = [];
		return this;
	}

	/**
	 * Reset the mock completely.
	 */
	reset(): this {
		this.calls = [];
		this.responses = [];
		this.defaultResponse = '{}';
		this.aborted = false;
		this.delay = 0;
		return this;
	}

	async generate(prompt: GeneratorPrompt, settings: GeneratorSettings): Promise<string> {
		// Record the call
		this.calls.push({
			prompt,
			settings,
			timestamp: Date.now(),
		});

		// Check if already aborted
		if (settings.abortSignal?.aborted || this.aborted) {
			throw new GeneratorAbortError('Generation aborted');
		}

		// Apply delay if set
		if (this.delay > 0) {
			await this.waitWithAbort(this.delay, settings.abortSignal);
		}

		// Find matching response
		const response = this.findMatchingResponse(prompt, settings);
		return response;
	}

	abort(): void {
		this.aborted = true;
	}

	/**
	 * Reset the aborted state.
	 */
	resetAbort(): this {
		this.aborted = false;
		return this;
	}

	private async waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(resolve, ms);

			if (signal) {
				signal.addEventListener('abort', () => {
					clearTimeout(timeout);
					reject(new GeneratorAbortError('Generation aborted'));
				});
			}
		});
	}

	private matchesPattern(prompt: GeneratorPrompt, pattern: string | RegExp): boolean {
		const content = prompt.messages.map(m => m.content).join('\n');

		if (typeof pattern === 'string') {
			return content.includes(pattern);
		} else {
			return pattern.test(content);
		}
	}

	private findMatchingResponse(prompt: GeneratorPrompt, settings: GeneratorSettings): string {
		// Find first matching response
		for (const config of this.responses) {
			if (config.once && config.used) continue;

			if (this.matchesPattern(prompt, config.pattern)) {
				if (config.once) {
					config.used = true;
				}

				if (typeof config.handler === 'function') {
					return config.handler(prompt, settings);
				}
				return config.handler;
			}
		}

		// Use default response
		if (typeof this.defaultResponse === 'function') {
			return this.defaultResponse(prompt, settings);
		}
		return this.defaultResponse;
	}
}

/**
 * Create a new mock generator.
 */
export function createMockGenerator(): MockGenerator {
	return new MockGenerator();
}
