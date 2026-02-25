/**
 * Generate Shakeup
 *
 * Orchestrates the LLM call to generate scene shakeup suggestions.
 */

import type { Generator } from '../generator/Generator';
import type { Projection } from '../types/snapshot';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { buildPrompt } from '../generator/types';
import { formatStateForInjection } from '../injectors/state';
import {
	SHAKEUP_SYSTEM_PROMPT,
	buildShakeupUserPrompt,
	parseShakeupResponse,
} from './shakeupPrompt';
import type { ShakeupSuggestion } from './types';
import { debugLog, debugWarn } from '../../utils/debug';

/**
 * Parameters for generating shakeup suggestions.
 */
export interface GenerateShakeupParams {
	generator: Generator;
	projection: Projection;
	store: EventStore;
	swipeContext: SwipeContext;
	characterDescription: string;
	userDescription: string;
	characterProfiles: string;
	relationships: string;
	recentMessages: string;
	worldinfo?: string;
}

/**
 * Generate shakeup suggestions from the LLM.
 *
 * @returns Array of suggestions, or null on failure
 */
export async function generateShakeup(
	params: GenerateShakeupParams,
): Promise<{ suggestions: ShakeupSuggestion[] } | null> {
	try {
		// Build scene state from projection
		const sceneState = formatStateForInjection(
			params.projection,
			params.store,
			params.swipeContext,
			{
				includeTime: true,
				includeLocation: true,
				includeClimate: true,
				includeCharacters: true,
				includeRelationships: true,
				includeScene: true,
				includeChapters: false,
				includeEvents: true,
				maxEvents: 5,
			},
		);

		// Build the user prompt
		const userPrompt = buildShakeupUserPrompt({
			characterDescription: params.characterDescription,
			userDescription: params.userDescription,
			characterProfiles: params.characterProfiles,
			relationships: params.relationships,
			sceneState,
			recentMessages: params.recentMessages,
			worldinfo: params.worldinfo,
		});

		// Build the full prompt
		const prompt = buildPrompt(SHAKEUP_SYSTEM_PROMPT, userPrompt, 'shakeup');

		debugLog('Generating shakeup suggestions...');

		// Call the LLM
		const response = await params.generator.generate(prompt, {
			maxTokens: 2048,
			temperature: 0.9,
		});

		// Parse the response
		const result = parseShakeupResponse(response);

		if (result) {
			debugLog(`Generated ${result.suggestions.length} shakeup suggestions`);
		} else {
			debugWarn('Failed to parse shakeup response');
		}

		return result;
	} catch (error) {
		debugWarn('Failed to generate shakeup:', error);
		return null;
	}
}
