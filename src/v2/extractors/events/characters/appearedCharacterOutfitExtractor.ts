/**
 * Appeared Character Outfit Extractor
 *
 * Extracts the initial outfit for characters who just appeared in the scene.
 * This runs after presenceChangeExtractor to ensure newly appeared characters
 * have their outfits extracted (so they don't walk around naked forever).
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	CharacterOutfitChangedEvent,
	MessageAndSwipe,
	OutfitSlot,
} from '../../../types';
import { isCharacterAppearedEvent } from '../../../types';
import type { ExtractedCharacterOutfits } from '../../../types/extraction';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	MessageStrategy,
	RunStrategy,
	RunStrategyContext,
} from '../../types';
import { appearedCharacterOutfitPrompt } from '../../../prompts/events/appearedCharacterOutfitPrompt';
import {
	formatMessages,
	getCharacterDescription,
	generateAndParse,
	getExtractorTemperature,
} from '../../utils';
import { buildPrompt } from '../../../prompts';
import { generateEventId } from '../../../store/serialization';
import { debugLog, debugWarn } from '../../../../utils/debug';

const OUTFIT_SLOTS: OutfitSlot[] = [
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

/**
 * Appeared Character Outfit Extractor
 *
 * Extracts initial outfits for characters who just appeared in the scene.
 * Only runs when turnEvents contains CharacterAppearedEvents.
 */
export const appearedCharacterOutfitExtractor: EventExtractor<ExtractedCharacterOutfits> = {
	name: 'appearedCharacterOutfit',
	displayName: 'new character outfits',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: appearedCharacterOutfitPrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 3 } as MessageStrategy,
	runStrategy: { strategy: 'custom', check: () => true } as RunStrategy, // We check turnEvents in shouldRun

	shouldRun(context: RunStrategyContext): boolean {
		// Must have character tracking enabled
		if (!context.settings.track.characters) {
			return false;
		}

		// Only run if there are CharacterAppearedEvents in turnEvents
		const hasAppearedEvents = context.turnEvents.some(isCharacterAppearedEvent);
		return hasAppearedEvents;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get the names of characters who just appeared
		const appearedCharacters = turnEvents
			.filter(isCharacterAppearedEvent)
			.map(e => e.character);

		if (appearedCharacters.length === 0) {
			return [];
		}

		// Build placeholder values for messages
		const messageStart = Math.max(0, currentMessage.messageId - 2);
		const messageEnd = currentMessage.messageId;
		const messages = formatMessages(context, messageStart, messageEnd);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		const allEvents: CharacterOutfitChangedEvent[] = [];

		// Process each appeared character separately for better focus
		for (const appearedCharacter of appearedCharacters) {
			const placeholders: Record<string, string> = {
				messages,
				characterName: context.name2,
				characterDescription: getCharacterDescription(context),
				appearedCharacter,
			};

			// Build the prompt
			const builtPrompt = buildPrompt(
				appearedCharacterOutfitPrompt,
				placeholders,
				settings.customPrompts,
			);

			// Generate and parse
			const result = await generateAndParse<ExtractedCharacterOutfits>(
				generator,
				appearedCharacterOutfitPrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			if (!result.success || !result.data) {
				debugWarn(
					`appearedCharacterOutfit extraction failed for ${appearedCharacter}:`,
					result.error,
				);
				continue;
			}

			const extracted = result.data;

			// Convert extracted outfits to CharacterOutfitChangedEvents
			for (const entry of extracted.outfits) {
				const characterName = entry.character;

				// Verify it's the character we asked for (case-insensitive)
				if (
					characterName.toLowerCase() !==
					appearedCharacter.toLowerCase()
				) {
					// Skip if the model returned a different character
					continue;
				}

				// Create outfit change events for each slot
				if (entry.outfit) {
					for (const slot of OUTFIT_SLOTS) {
						const value = entry.outfit[slot];
						// Only create event if the value was extracted (not undefined)
						// null means explicitly no item, which is a valid value
						if (value !== undefined) {
							allEvents.push({
								id: generateEventId(),
								source: currentMessage,
								timestamp: Date.now(),
								kind: 'character',
								subkind: 'outfit_changed',
								character: appearedCharacter,
								slot,
								newValue: value,
							});
						}
					}
				}
			}
		}

		if (allEvents.length > 0) {
			debugLog(
				`Extracted initial outfits for ${appearedCharacters.length} newly appeared character(s)`,
			);
		}

		return allEvents;
	},
};
