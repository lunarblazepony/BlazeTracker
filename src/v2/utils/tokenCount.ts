/**
 * Token Counting Utilities
 *
 * Provides token counting using SillyTavern's tokenizer API.
 * Includes a guesstimate fallback for environments without tokenizers.
 */

/**
 * Interface for token counting implementations.
 * Allows for different implementations (ST API, mock for testing, etc.)
 */
export interface TokenCounter {
	/**
	 * Count tokens in a text string.
	 * @param text - The text to count tokens for
	 * @returns Promise resolving to the token count
	 */
	countTokens(text: string): Promise<number>;

	/**
	 * Get the name of this counter implementation.
	 */
	getName(): string;
}

/**
 * Guesstimate token count based on character length.
 * Uses the ratio of ~3.35 characters per token.
 * This is a rough estimate used as fallback.
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count
 */
export function guesstimate(text: string): number {
	if (!text) return 0;
	return Math.ceil(text.length / 3.35);
}

/**
 * SillyTavern Token Counter - uses ST's getTokenCountAsync API.
 * Falls back to guesstimate if ST API is unavailable.
 */
export class STTokenCounter implements TokenCounter {
	getName(): string {
		return 'SillyTavern';
	}

	async countTokens(text: string): Promise<number> {
		if (!text) return 0;

		try {
			// Try to use ST's token counting API
			// The context has getTokenCountAsync available at runtime but not in our types
			const context = SillyTavern.getContext() as unknown as {
				getTokenCountAsync?: (text: string) => Promise<number>;
			};
			if (context && typeof context.getTokenCountAsync === 'function') {
				return await context.getTokenCountAsync(text);
			}
		} catch {
			// Fall through to guesstimate
		}

		// Fallback to guesstimate
		return guesstimate(text);
	}
}

/**
 * Mock Token Counter for testing.
 * Uses a configurable map of text to token counts.
 * Falls back to guesstimate for unknown text.
 */
export class MockTokenCounter implements TokenCounter {
	private tokenMap: Map<string, number>;
	private defaultFn: (text: string) => number;

	/**
	 * Create a mock token counter.
	 * @param tokenMap - Map of exact text to token counts
	 * @param defaultFn - Optional function for unknown text (defaults to guesstimate)
	 */
	constructor(
		tokenMap: Map<string, number> = new Map(),
		defaultFn: (text: string) => number = guesstimate,
	) {
		this.tokenMap = tokenMap;
		this.defaultFn = defaultFn;
	}

	getName(): string {
		return 'Mock';
	}

	async countTokens(text: string): Promise<number> {
		if (!text) return 0;

		// Check exact match first
		if (this.tokenMap.has(text)) {
			return this.tokenMap.get(text)!;
		}

		// Fall back to default function
		return this.defaultFn(text);
	}

	/**
	 * Add a token count mapping.
	 */
	addMapping(text: string, tokens: number): void {
		this.tokenMap.set(text, tokens);
	}

	/**
	 * Clear all mappings.
	 */
	clearMappings(): void {
		this.tokenMap.clear();
	}
}

/**
 * Fixed Ratio Token Counter for testing.
 * Always uses a fixed characters-per-token ratio.
 */
export class FixedRatioTokenCounter implements TokenCounter {
	private ratio: number;

	/**
	 * Create a fixed ratio token counter.
	 * @param ratio - Characters per token (default 4)
	 */
	constructor(ratio: number = 4) {
		this.ratio = ratio;
	}

	getName(): string {
		return `FixedRatio(${this.ratio})`;
	}

	async countTokens(text: string): Promise<number> {
		if (!text) return 0;
		return Math.ceil(text.length / this.ratio);
	}
}

// Default counter instance
let defaultCounter: TokenCounter | null = null;

/**
 * Get the default token counter.
 * Creates an STTokenCounter on first call.
 */
export function getDefaultTokenCounter(): TokenCounter {
	if (!defaultCounter) {
		defaultCounter = new STTokenCounter();
	}
	return defaultCounter;
}

/**
 * Set the default token counter (useful for testing).
 */
export function setDefaultTokenCounter(counter: TokenCounter): void {
	defaultCounter = counter;
}

/**
 * Count tokens using the default counter.
 * Convenience function for simple usage.
 */
export async function countTokens(text: string): Promise<number> {
	return getDefaultTokenCounter().countTokens(text);
}

/**
 * Count tokens for multiple strings in parallel.
 * Returns the total token count.
 */
export async function countTokensTotal(texts: string[]): Promise<number> {
	const counter = getDefaultTokenCounter();
	const counts = await Promise.all(texts.map(t => counter.countTokens(t)));
	return counts.reduce((sum, c) => sum + c, 0);
}
