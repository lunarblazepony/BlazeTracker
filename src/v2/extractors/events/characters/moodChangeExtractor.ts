/**
 * Character Mood Change Event Extractor
 *
 * Detects when a character's emotional state/mood changes.
 * This is a per-character extractor that runs once for each present character.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedMoodChange } from '../../../types/extraction';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../../types';
import { moodChangePrompt } from '../../../prompts/events/moodChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapMoodChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterMoodsToAdd,
	filterMoodsToRemove,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';
import { debugWarn } from '../../../../utils/debug';

/**
 * Mood change per-character event extractor.
 *
 * Analyzes messages to detect changes in a specific character's emotional state.
 * Returns CharacterMoodAddedEvent and CharacterMoodRemovedEvent events.
 */
export const moodChangeExtractor: PerCharacterExtractor<ExtractedMoodChange> = {
	name: 'moodChange',
	displayName: 'mood',
	category: 'characters',
	defaultTemperature: 0.6,
	prompt: moodChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 3 } as MessageStrategy,
	runStrategy: { strategy: 'everyNMessages', n: 3 } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Run if characters tracking is enabled AND the run strategy permits
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
		targetCharacter: string,
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get prior projection for validation (state before this message)
		const priorProjection = getPriorProjection(store, currentMessage, context);
		const priorCharacterState = priorProjection?.characters[targetCharacter];

		// Calculate message range based on strategy
		const messageCount = 2; // fixedNumber: 2
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build prompt with target character context
		const builtPrompt = buildExtractorPrompt(
			moodChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ targetCharacter },
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse(
			generator,
			moodChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			debugWarn(`moodChange extraction failed for ${targetCharacter}`);
			return [];
		}

		const extraction = result.data;

		// Validate and deduplicate against prior state
		const validatedAdded = filterMoodsToAdd(extraction.added, priorCharacterState);
		const validatedRemoved = filterMoodsToRemove(
			extraction.removed,
			priorCharacterState,
		);

		// If no valid moods to add or remove, return empty array
		if (validatedAdded.length === 0 && validatedRemoved.length === 0) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedMoodChange = {
			...extraction,
			added: validatedAdded,
			removed: validatedRemoved,
		};

		const events: (CharacterMoodAddedEvent | CharacterMoodRemovedEvent)[] =
			mapMoodChange(validatedExtraction, currentMessage);

		return events;
	},
};
