/**
 * V2 Generator Types
 *
 * Types for the LLM generation interface.
 */

/**
 * A message in the prompt.
 */
export interface GeneratorMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * A complete prompt for generation.
 */
export interface GeneratorPrompt {
	/** Messages to send to the LLM */
	messages: GeneratorMessage[];
	/** Human-readable name for logging/debugging */
	name?: string;
}

/**
 * Settings for a generation request.
 */
export interface GeneratorSettings {
	/** Maximum tokens to generate */
	maxTokens: number;
	/** Temperature for generation (0-2, default 0.5) */
	temperature?: number;
	/** Abort signal for cancellation */
	abortSignal?: AbortSignal;
}

/**
 * Configuration for the generator.
 */
export interface GeneratorConfig {
	/** SillyTavern connection profile ID */
	profileId: string;
}

/**
 * Build a standard extraction prompt with system and user messages.
 */
export function buildPrompt(
	systemPrompt: string,
	userPrompt: string,
	name?: string,
): GeneratorPrompt {
	return {
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
		],
		name,
	};
}

/**
 * Build a prompt with an assistant prefill.
 */
export function buildPromptWithPrefill(
	systemPrompt: string,
	userPrompt: string,
	assistantPrefill: string,
	name?: string,
): GeneratorPrompt {
	return {
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: userPrompt },
			{ role: 'assistant', content: assistantPrefill },
		],
		name,
	};
}
