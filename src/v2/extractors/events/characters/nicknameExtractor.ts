/**
 * Nickname Extractor
 *
 * Periodically extracts pet names, nicknames, shortened names, titles used as names,
 * and aliases from recent messages. Runs every 8 messages as a global character extractor.
 *
 * This catches in-RP names that develop over the course of the story,
 * complementing the AKA computation done at initial extraction and character appearance.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type { Event, MessageAndSwipe } from '../../../types';
import type { ExtractedNicknames } from '../../../types/extraction';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import { nicknameExtractionPrompt } from '../../../prompts/events/nicknameExtractionPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
	findMatchingCharacterKey,
	limitMessageRange,
	getMaxMessages,
} from '../../utils';
import { generateEventId } from '../../../store/serialization';
import { debugLog, debugWarn } from '../../../../utils/debug';
import { getWorldinfoForPrompt } from '../../../utils/worldinfo';

/**
 * Nickname extractor - periodic global character extractor.
 *
 * Runs every 8 messages to extract pet names, nicknames, and aliases
 * from recent messages. Emits CharacterAkasAddEvent for new AKAs.
 */
export const nicknameExtractor: EventExtractor<ExtractedNicknames> = {
	name: 'nicknameExtraction',
	displayName: 'nicknames',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: nicknameExtractionPrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 8 },
	runStrategy: { strategy: 'everyNMessages', n: 8 },

	shouldRun(context: RunStrategyContext): boolean {
		return (
			context.settings.track.characters &&
			evaluateRunStrategy(this.runStrategy, context)
		);
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
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Calculate message range (last 8 messages)
		const messageCount = 8;
		let messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		let messageEnd = currentMessage.messageId;

		// Apply message limiting
		const maxMessages = getMaxMessages(settings, this.name);
		({ messageStart, messageEnd } = limitMessageRange(
			messageStart,
			messageEnd,
			maxMessages,
		));

		// Fetch worldinfo if enabled
		let worldinfo = '';
		if (settings.includeWorldinfo) {
			const messagesForWorldinfo: string[] = [];
			for (
				let i = messageStart;
				i <= messageEnd && i < context.chat.length;
				i++
			) {
				const msg = context.chat[i];
				if (!msg.is_system) {
					messagesForWorldinfo.push(msg.mes);
				}
			}
			worldinfo = await getWorldinfoForPrompt(messagesForWorldinfo);
		}

		// Build the prompt
		const builtPrompt = buildExtractorPrompt(
			nicknameExtractionPrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ worldinfo: worldinfo || 'No worldinfo available' },
		);

		// Get temperature
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse<ExtractedNicknames>(
			generator,
			nicknameExtractionPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		if (!result.success || !result.data) {
			debugWarn('nicknameExtraction failed:', result.error);
			return [];
		}

		const extracted = result.data;
		const events: Event[] = [];

		// Get all character names from projection for resolution
		const characterNames = Object.keys(projection.characters);

		for (const entry of extracted.nicknames) {
			// Resolve character name against projection
			const resolvedName = findMatchingCharacterKey(
				entry.character,
				characterNames,
			);

			if (!resolvedName) {
				debugWarn(
					`nicknameExtraction: could not resolve character "${entry.character}"`,
				);
				continue;
			}

			// Get existing AKAs from projection
			const characterState = projection.characters[resolvedName];
			const existingAkas = new Set(
				(characterState?.akas ?? []).map(a => a.toLowerCase()),
			);

			// Filter out duplicates (case-insensitive) and canonical names
			const canonicalLower = resolvedName.toLowerCase();
			const newAkas = entry.names.filter(name => {
				const lower = name.trim().toLowerCase();
				return (
					lower.length > 0 &&
					lower !== canonicalLower &&
					!existingAkas.has(lower)
				);
			});

			if (newAkas.length > 0) {
				events.push({
					id: generateEventId(),
					source: currentMessage,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'akas_add',
					character: resolvedName,
					akas: newAkas,
				});
			}
		}

		if (events.length > 0) {
			debugLog(
				`Extracted nicknames: ${events.length} character(s) with new AKAs`,
			);
		}

		return events;
	},
};
