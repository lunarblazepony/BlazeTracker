/**
 * Initial Character Outfits Extractor
 *
 * Extracts the initial outfit/clothing of characters present in the opening messages of a roleplay.
 */

import type { Generator } from '../../generator';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot, CharacterState } from '../../types/snapshot';
import type { ExtractedCharacterOutfits } from '../../types/extraction';
import type { OutfitSlot } from '../../types/common';
import { initialCharacterOutfitsPrompt } from '../../prompts/initial/characterOutfitsPrompt';
import {
	formatMessages,
	getCharacterDescription,
	getUserDescription,
	generateAndParse,
	findMatchingCharacterKey,
	getExtractorTemperature,
} from '../utils';
import { buildPrompt } from '../../prompts';

/**
 * Initial character outfits extractor.
 * Extracts the outfit information for characters present in the scene.
 */
export const initialCharacterOutfitsExtractor: InitialExtractor<ExtractedCharacterOutfits> = {
	name: 'initialCharacterOutfits',
	displayName: 'outfits',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: initialCharacterOutfitsPrompt,

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		// Must have character tracking enabled
		if (!settings.track.characters) {
			return false;
		}

		// Must have at least one message
		if (context.chat.length === 0) {
			return false;
		}

		return true;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Check if we have characters from partialSnapshot
		const characters = partialSnapshot.characters;
		if (!characters || Object.keys(characters).length === 0) {
			return {};
		}

		const characterNames = Object.keys(characters);

		// Build placeholder values
		const placeholders: Record<string, string> = {
			messages: formatMessages(context, 0, context.chat.length - 1),
			characterName: context.name2,
			characterDescription: getCharacterDescription(context),
			userName: context.name1,
			userDescription: getUserDescription(context),
			charactersPresent: characterNames.join(', '),
		};

		// Build the prompt
		const builtPrompt = buildPrompt(
			initialCharacterOutfitsPrompt,
			placeholders,
			settings.customPrompts,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse
		const result = await generateAndParse<ExtractedCharacterOutfits>(
			generator,
			initialCharacterOutfitsPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		if (!result.success || !result.data) {
			console.warn(
				'[BlazeTracker] initialCharacterOutfits extraction failed:',
				result.error,
			);
			return {};
		}

		const extracted = result.data;

		// Deep clone existing characters to avoid mutation
		const updatedCharacters: Record<string, CharacterState> = {};
		for (const [name, char] of Object.entries(characters)) {
			updatedCharacters[name] = {
				...char,
				mood: [...char.mood],
				physicalState: [...char.physicalState],
				outfit: { ...char.outfit },
			};
		}

		// Merge extracted outfits into character states
		for (const entry of extracted.outfits) {
			const characterName = entry.character;

			// Find matching character (case-insensitive with fuzzy fallback)
			const matchingKey = findMatchingCharacterKey(
				characterName,
				Object.keys(updatedCharacters),
			);

			if (!matchingKey) {
				// Character from extraction not found in our characters list
				console.warn(
					`[BlazeTracker] Character "${characterName}" from outfit extraction not found in present characters`,
				);
				continue;
			}

			const char = updatedCharacters[matchingKey];

			// Merge outfit slots
			if (entry.outfit) {
				const outfitSlots: OutfitSlot[] = [
					'head',
					'neck',
					'jacket',
					'back',
					'torso',
					'legs',
					'underwear',
					'socks',
					'footwear',
				];

				for (const slot of outfitSlots) {
					const value = entry.outfit[slot];
					// Only update if the extracted value is not undefined
					// null means explicitly no item, undefined means not extracted
					if (value !== undefined) {
						char.outfit[slot] = value;
					}
				}
			}
		}

		return { characters: updatedCharacters };
	},
};
