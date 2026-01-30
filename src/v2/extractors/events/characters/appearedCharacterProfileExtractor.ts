/**
 * Appeared Character Profile Extractor
 *
 * Extracts the condensed profile (sex, species, age, appearance, personality)
 * for characters who just appeared in the scene.
 * This runs after presenceChangeExtractor when CharacterAppearedEvents are generated.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type { Event, CharacterProfileSetEvent, MessageAndSwipe } from '../../../types';
import { isCharacterAppearedEvent } from '../../../types';
import type { ExtractedCharacterProfile } from '../../../types/extraction';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	MessageStrategy,
	RunStrategy,
	RunStrategyContext,
} from '../../types';
import { appearedCharacterProfilePrompt } from '../../../prompts/events/appearedCharacterProfilePrompt';
import { formatMessages, generateAndParse, getExtractorTemperature } from '../../utils';
import { buildPrompt } from '../../../prompts';
import { generateEventId } from '../../../store/serialization';
import { debugLog, debugWarn } from '../../../../utils/debug';

/**
 * Appeared Character Profile Extractor
 *
 * Extracts profiles for characters who just appeared in the scene.
 * Only runs when turnEvents contains CharacterAppearedEvents.
 */
export const appearedCharacterProfileExtractor: EventExtractor<ExtractedCharacterProfile> = {
	name: 'appearedCharacterProfile',
	displayName: 'new character profiles',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: appearedCharacterProfilePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 6 } as MessageStrategy, // More context for profile extraction
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

		// Build placeholder values for messages (last 6 messages for more context)
		const messageStart = Math.max(0, currentMessage.messageId - 5);
		const messageEnd = currentMessage.messageId;
		const messages = formatMessages(context, messageStart, messageEnd);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		const allEvents: CharacterProfileSetEvent[] = [];

		// Process each appeared character separately
		for (const appearedCharacter of appearedCharacters) {
			const placeholders: Record<string, string> = {
				messages,
				characterName: context.name2,
				appearedCharacter,
			};

			// Build the prompt
			const builtPrompt = buildPrompt(
				appearedCharacterProfilePrompt,
				placeholders,
				settings.customPrompts,
			);

			// Generate and parse
			const result = await generateAndParse<ExtractedCharacterProfile>(
				generator,
				appearedCharacterProfilePrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			if (!result.success || !result.data) {
				debugWarn(
					`appearedCharacterProfile extraction failed for ${appearedCharacter}:`,
					result.error,
				);
				continue;
			}

			const extracted = result.data;

			// Verify it's the character we asked for (case-insensitive)
			if (extracted.character.toLowerCase() !== appearedCharacter.toLowerCase()) {
				debugWarn(
					`Profile extraction returned wrong character: expected "${appearedCharacter}", got "${extracted.character}"`,
				);
				continue;
			}

			// Create the profile set event
			allEvents.push({
				id: generateEventId(),
				source: currentMessage,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'profile_set',
				character: appearedCharacter,
				profile: {
					sex: extracted.profile.sex,
					species: extracted.profile.species,
					age: extracted.profile.age,
					appearance: [...extracted.profile.appearance],
					personality: [...extracted.profile.personality],
				},
			});
		}

		if (allEvents.length > 0) {
			debugLog(
				`Extracted profiles for ${allEvents.length} newly appeared character(s)`,
			);
		}

		return allEvents;
	},
};
