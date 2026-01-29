/**
 * Initial Tension Extractor
 *
 * Extracts the initial tension level, type, and direction from the opening messages of a roleplay.
 * Requires topic/tone to be extracted first (partialSnapshot.scene must exist).
 */

import type { Generator } from '../../generator';
import type { Snapshot } from '../../types';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import { initialTensionPrompt } from '../../prompts/initial/tensionPrompt';
import {
	formatMessages,
	getCharacterDescription,
	generateAndParse,
	getExtractorTemperature,
} from '../utils';
import { buildPrompt } from '../../prompts';
import { debugWarn } from '../../../utils/debug';

/**
 * Initial tension extractor.
 *
 * Extracts tension level, type, and direction from the opening messages.
 * Must run after topic/tone extraction since it requires partialSnapshot.scene.
 */
export const tensionExtractor: InitialExtractor = {
	name: 'initialTension',
	displayName: 'tension',
	category: 'scene',
	defaultTemperature: 0.6,
	prompt: initialTensionPrompt,

	/**
	 * Check if this extractor should run.
	 * Requires scene tracking enabled, at least one message, and topic/tone already extracted.
	 */
	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		// Must have scene tracking enabled
		if (!settings.track.scene) {
			return false;
		}

		// Must have at least one message
		if (context.chat.length === 0) {
			return false;
		}

		// Note: We cannot check partialSnapshot.scene here because shouldRun
		// doesn't receive partialSnapshot. The run() method will check this.
		return true;
	},

	/**
	 * Run the extraction.
	 */
	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Must have topic/tone already extracted
		if (!partialSnapshot.scene) {
			return {};
		}

		// Build placeholder values
		const messages = formatMessages(context, 0, context.chat.length - 1);
		const characterDescription = getCharacterDescription(context);

		const placeholderValues: Record<string, string> = {
			messages,
			characterName: context.name2,
			characterDescription,
		};

		// Build the prompt
		const builtPrompt = buildPrompt(
			initialTensionPrompt,
			placeholderValues,
			settings.customPrompts,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'scene',
			this.defaultTemperature,
		);

		// Generate and parse
		const result = await generateAndParse(
			generator,
			initialTensionPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parse failure
		if (!result.success || !result.data) {
			debugWarn('initialTension extraction failed');
			return {};
		}

		const { level, type } = result.data;

		// Return partial snapshot with updated scene tension
		// Direction is always 'stable' for initial extraction (no previous state to compare)
		return {
			scene: {
				...partialSnapshot.scene,
				tension: {
					level,
					type,
					direction: 'stable',
				},
			},
		};
	},
};
