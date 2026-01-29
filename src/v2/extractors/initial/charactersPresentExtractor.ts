/**
 * Initial Characters Present Extractor
 *
 * Extracts which characters are present in the opening messages of a roleplay,
 * including their positions and activities.
 */

import type { Generator } from '../../generator';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot, Projection, ExtractedCharactersPresent, CharacterState } from '../../types';
import {
	createEmptySnapshot,
	createProjectionFromSnapshot,
	createEmptyCharacterState,
} from '../../types';
import { initialCharactersPresentPrompt } from '../../prompts/initial/charactersPresentPrompt';
import { buildExtractorPrompt, generateAndParse, getExtractorTemperature } from '../utils';

/**
 * Initial characters present extractor.
 * Extracts which characters are present, their positions, and activities.
 */
export const initialCharactersPresentExtractor: InitialExtractor<ExtractedCharactersPresent> = {
	name: 'initialCharactersPresent',
	displayName: 'characters',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: initialCharactersPresentPrompt,

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		// Run if character tracking is enabled and there's at least one message
		return settings.track.characters && context.chat.length > 0;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Create an empty projection for prompt building
		// We use message 0 as the source since this is initial extraction
		const emptySnapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		const projection: Projection = createProjectionFromSnapshot(
			{ ...emptySnapshot, ...partialSnapshot },
			{ messageId: 0, swipeId: 0 },
		);

		// Build the prompt with placeholders filled in
		const builtPrompt = buildExtractorPrompt(
			initialCharactersPresentPrompt,
			context,
			projection,
			settings,
			0, // Start from message 0
			context.chat.length - 1, // Include all messages
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			initialCharactersPresentPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty object
		if (!result.success || !result.data) {
			console.warn(
				'[BlazeTracker] initialCharactersPresent extraction failed:',
				result.error,
			);
			return {};
		}

		// Convert extracted characters to CharacterState objects
		const characters: Record<string, CharacterState> = {};

		for (const extracted of result.data.characters) {
			// Create empty character state and update with extracted data
			const charState = createEmptyCharacterState(extracted.name);
			charState.position = extracted.position;
			charState.activity = extracted.activity;
			charState.mood = extracted.mood ?? [];
			charState.physicalState = extracted.physicalState ?? [];
			// outfit is handled by separate initialCharacterOutfitsExtractor

			characters[extracted.name] = charState;
		}

		return {
			characters,
		};
	},
};
