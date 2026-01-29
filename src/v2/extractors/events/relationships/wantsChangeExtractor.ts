/**
 * Relationship Wants Change Event Extractor
 *
 * Detects when a character's desires/wants toward another character change.
 * This is a per-pair extractor that runs once for each present character pair.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	RelationshipWantAddedEvent,
	RelationshipWantRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedWantsChange } from '../../../types/extraction';
import type {
	PerPairExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../../types';
import { wantsChangePrompt } from '../../../prompts/events/wantsChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapWantsChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterWantsToAdd,
	filterWantsToRemove,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';

/**
 * Wants change per-pair event extractor.
 *
 * Analyzes messages to detect changes in what one character wants
 * from or regarding another character.
 * Returns RelationshipWantAddedEvent and RelationshipWantRemovedEvent events.
 */
export const wantsChangeExtractor: PerPairExtractor<ExtractedWantsChange> = {
	name: 'wantsChange',
	displayName: 'wants',
	category: 'relationships',
	defaultTemperature: 0.6,
	prompt: wantsChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 4 } as MessageStrategy,
	runStrategy: { strategy: 'everyNMessages', n: 4 } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Run if relationships tracking is enabled AND the run strategy permits
		return (
			context.settings.track.relationships &&
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
		pair: [string, string],
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

		// Calculate message range based on strategy
		const messageCount = 3; // fixedNumber: 3
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build prompt with relationship pair context
		const builtPrompt = buildExtractorPrompt(
			wantsChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ relationshipPair: pair },
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'relationships',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse(
			generator,
			wantsChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			console.warn(
				`[BlazeTracker] wantsChange extraction failed for ${pair[0]} -> ${pair[1]}`,
			);
			return [];
		}

		const extraction = result.data;

		// Validate and deduplicate each direction against prior state
		const validatedChanges = extraction.changes
			.map(change => {
				const validatedAdded = filterWantsToAdd(
					change.added,
					priorProjection,
					change.fromCharacter,
					change.towardCharacter,
				);
				const validatedRemoved = filterWantsToRemove(
					change.removed,
					priorProjection,
					change.fromCharacter,
					change.towardCharacter,
				);

				return {
					fromCharacter: change.fromCharacter,
					towardCharacter: change.towardCharacter,
					added: validatedAdded,
					removed: validatedRemoved,
				};
			})
			.filter(change => change.added.length > 0 || change.removed.length > 0);

		// If no valid changes after validation, return empty array
		if (validatedChanges.length === 0) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedWantsChange = {
			reasoning: extraction.reasoning,
			changes: validatedChanges,
		};

		const events: (RelationshipWantAddedEvent | RelationshipWantRemovedEvent)[] =
			mapWantsChange(validatedExtraction, currentMessage);

		return events;
	},
};
