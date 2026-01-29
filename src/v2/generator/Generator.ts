/**
 * V2 Generator Interface
 *
 * Abstract interface for LLM generation, allowing for production and mock implementations.
 */

import type { GeneratorPrompt, GeneratorSettings } from './types';

/**
 * Abstract generator interface.
 * Allows for production (SillyTavern) and mock implementations.
 */
export interface Generator {
	/**
	 * Generate a response from the LLM.
	 *
	 * @param prompt - The prompt to send
	 * @param settings - Generation settings
	 * @returns The generated text
	 * @throws AbortError if aborted
	 * @throws Error on generation failure
	 */
	generate(prompt: GeneratorPrompt, settings: GeneratorSettings): Promise<string>;

	/**
	 * Abort any in-progress generation.
	 */
	abort(): void;
}

/**
 * Error thrown when generation is aborted.
 */
export class GeneratorAbortError extends Error {
	constructor(message: string = 'Generation aborted') {
		super(message);
		this.name = 'GeneratorAbortError';
	}
}

/**
 * Error thrown when generation fails.
 */
export class GeneratorError extends Error {
	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(message);
		this.name = 'GeneratorError';
	}
}

/**
 * Check if an error is an abort error.
 */
export function isAbortError(error: unknown): boolean {
	if (error instanceof GeneratorAbortError) return true;
	if (error instanceof DOMException && error.name === 'AbortError') return true;
	if (error instanceof Error && error.name === 'AbortError') return true;
	return false;
}
