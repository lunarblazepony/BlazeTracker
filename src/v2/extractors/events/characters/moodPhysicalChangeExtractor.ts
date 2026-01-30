/**
 * Combined Mood and Physical State Change Event Extractor
 *
 * Extracts both mood and physical state changes in a single LLM call for efficiency.
 * This is a per-character extractor that runs once for each present character.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	CharacterPhysicalAddedEvent,
	CharacterPhysicalRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedMoodPhysicalChange } from '../../../types/extraction';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import { getMessageCount } from '../../types';
import { moodPhysicalChangePrompt } from '../../../prompts/events/moodPhysicalChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	getPriorProjection,
	filterMoodsToAdd,
	filterMoodsToRemove,
	filterPhysicalToAdd,
	filterPhysicalToRemove,
	mapMoodPhysicalChange,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';

/**
 * Combined mood and physical state change per-character event extractor.
 *
 * Analyzes messages to detect changes in a specific character's emotional
 * and physical state, extracting both in a single LLM call for efficiency.
 */
export const moodPhysicalChangeExtractor: PerCharacterExtractor<ExtractedMoodPhysicalChange> = {
	name: 'moodPhysicalChange',
	displayName: 'mood & physical',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: moodPhysicalChangePrompt,

	// Messages since last mood/physical event
	messageStrategy: {
		strategy: 'sinceLastEventOfKind',
		kinds: [
			{ kind: 'character', subkind: 'mood_added' },
			{ kind: 'character', subkind: 'mood_removed' },
			{ kind: 'character', subkind: 'physical_added' },
			{ kind: 'character', subkind: 'physical_removed' },
		],
	},
	// Every 2 messages, offset=0 (default) fires on messageId 1, 3, 5... (user messages in normal chat)
	runStrategy: { strategy: 'everyNMessages', n: 2 },

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

		// Calculate message range based on strategy (since last mood/physical event)
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build prompt with target character context
		const builtPrompt = buildExtractorPrompt(
			moodPhysicalChangePrompt,
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
			moodPhysicalChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			console.warn(
				`[BlazeTracker] moodPhysicalChange extraction failed for ${targetCharacter}`,
			);
			return [];
		}

		const extraction = result.data;

		// Validate and deduplicate against prior state
		const validatedMoodAdded = filterMoodsToAdd(
			extraction.moodAdded,
			priorCharacterState,
		);
		const validatedMoodRemoved = filterMoodsToRemove(
			extraction.moodRemoved,
			priorCharacterState,
		);
		const validatedPhysicalAdded = filterPhysicalToAdd(
			extraction.physicalAdded,
			priorCharacterState,
		);
		const validatedPhysicalRemoved = filterPhysicalToRemove(
			extraction.physicalRemoved,
			priorCharacterState,
		);

		// If no valid changes, return empty array
		if (
			validatedMoodAdded.length === 0 &&
			validatedMoodRemoved.length === 0 &&
			validatedPhysicalAdded.length === 0 &&
			validatedPhysicalRemoved.length === 0
		) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedMoodPhysicalChange = {
			...extraction,
			moodAdded: validatedMoodAdded,
			moodRemoved: validatedMoodRemoved,
			physicalAdded: validatedPhysicalAdded,
			physicalRemoved: validatedPhysicalRemoved,
		};

		const events: (
			| CharacterMoodAddedEvent
			| CharacterMoodRemovedEvent
			| CharacterPhysicalAddedEvent
			| CharacterPhysicalRemovedEvent
		)[] = mapMoodPhysicalChange(validatedExtraction, currentMessage);

		return events;
	},
};
