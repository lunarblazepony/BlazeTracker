/**
 * Parse LLM responses with retry logic.
 */

import type { Generator } from '../../generator';
import { buildPrompt } from '../../generator';
import type { PromptTemplate, BuiltPrompt } from '../../prompts';
import { debugLog, debugWarn, errorLog } from '../../../utils/debug';
import { getV2Settings } from '../../settings';

/**
 * Options for parsing with retry.
 */
export interface ParseOptions {
	/** Maximum number of retry attempts */
	maxRetries?: number;
	/** Temperature for retries (usually lower) */
	retryTemperature?: number;
	/** Log reasoning to console */
	logReasoning?: boolean;
	/** Abort signal for cancellation */
	abortSignal?: AbortSignal;
}

/**
 * Result of a parse attempt.
 */
export interface ParseResult<T> {
	success: boolean;
	data?: T;
	reasoning?: string;
	rawResponse?: string;
	error?: string;
	/** Whether the request was aborted */
	aborted?: boolean;
}

/**
 * Extract reasoning from a parsed response if present.
 */
export function extractReasoning(parsed: unknown): string | undefined {
	if (typeof parsed === 'object' && parsed !== null && 'reasoning' in parsed) {
		const reasoning = (parsed as { reasoning: unknown }).reasoning;
		if (typeof reasoning === 'string') {
			return reasoning;
		}
	}
	return undefined;
}

/**
 * Generate and parse a response with retry logic.
 *
 * @param generator - The generator to use
 * @param prompt - The prompt template
 * @param builtPrompt - The built prompt with placeholders filled
 * @param temperature - Initial temperature
 * @param options - Parse options
 * @returns Parse result with data or error
 */
export async function generateAndParse<T>(
	generator: Generator,
	prompt: PromptTemplate<T>,
	builtPrompt: BuiltPrompt,
	temperature: number,
	options: ParseOptions = {},
): Promise<ParseResult<T>> {
	const {
		maxRetries = 2,
		retryTemperature = 0.1,
		logReasoning = true,
		abortSignal,
	} = options;

	// Check if already aborted before starting
	if (abortSignal?.aborted) {
		return {
			success: false,
			aborted: true,
		};
	}

	let lastError: string | undefined;
	let lastResponse: string | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const currentTemp = attempt === 0 ? temperature : retryTemperature;

		try {
			const generatorPrompt = buildPrompt(
				builtPrompt.system,
				builtPrompt.user,
				prompt.name,
			);

			const settings = getV2Settings();
			const response = await generator.generate(generatorPrompt, {
				temperature: currentTemp,
				maxTokens: settings.v2MaxTokens,
				abortSignal,
			});

			lastResponse = response;

			// Try to parse the response
			const parsed = prompt.parseResponse(response);

			if (parsed !== null) {
				const reasoning = extractReasoning(parsed);

				if (logReasoning && reasoning) {
					debugLog(`${prompt.name} reasoning:`, reasoning);
				}

				return {
					success: true,
					data: parsed,
					reasoning,
					rawResponse: response,
				};
			}

			lastError = 'parseResponse returned null';
		} catch (error) {
			// Check if this was an abort
			if (abortSignal?.aborted) {
				return {
					success: false,
					aborted: true,
				};
			}
			lastError = error instanceof Error ? error.message : String(error);
		}

		// Check if aborted between retries
		if (abortSignal?.aborted) {
			return {
				success: false,
				aborted: true,
			};
		}

		// If we're going to retry, log the failure
		if (attempt < maxRetries) {
			debugWarn(
				`${prompt.name} parse failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}`,
			);
		}
	}

	// All attempts failed
	errorLog(`${prompt.name} failed after ${maxRetries + 1} attempts:`, lastError);
	if (lastResponse) {
		errorLog(`Last response:`, lastResponse.substring(0, 500));
	}

	return {
		success: false,
		error: lastError,
		rawResponse: lastResponse,
	};
}

/**
 * Simple parse without retry - for cases where we don't want to retry.
 */
export async function generateAndParseOnce<T>(
	generator: Generator,
	prompt: PromptTemplate<T>,
	builtPrompt: BuiltPrompt,
	temperature: number,
	logReasoning = true,
): Promise<ParseResult<T>> {
	return generateAndParse(generator, prompt, builtPrompt, temperature, {
		maxRetries: 0,
		logReasoning,
	});
}
