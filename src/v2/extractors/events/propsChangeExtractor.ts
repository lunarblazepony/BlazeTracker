/**
 * Props Change Event Extractor
 *
 * Detects props appearing or disappearing from the scene during roleplay.
 * Runs AFTER outfit extractors to integrate clothing changes with scene props.
 */

import type { Generator } from '../../generator';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../types';
import { getMessageCount } from '../types';
import type { Event, MessageAndSwipe, ExtractedPropsChange } from '../../types';
import { propsChangePrompt } from '../../prompts/events/propsChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapPropsChange,
	evaluateRunStrategy,
	getPriorProjection,
	filterPropsToAdd,
	filterPropsToRemove,
	projectWithTurnEvents,
	formatOutfitChangesFromEvents,
	getAllOutfitItems,
	filterPropsAgainstOutfits,
	getExtractorTemperature,
} from '../utils';
import type { EventStore } from '../../store';
import { debugLog, debugWarn } from '../../../utils/debug';

/**
 * Props change event extractor.
 * Detects props being added or removed from the scene and produces
 * LocationPropAddedEvent and LocationPropRemovedEvent events.
 */
export const propsChangeExtractor: EventExtractor<ExtractedPropsChange> = {
	name: 'propsChange',
	displayName: 'props',
	category: 'props',
	defaultTemperature: 0.4,
	prompt: propsChangePrompt,

	// Messages since last props event (prop_added or prop_removed)
	messageStrategy: {
		strategy: 'sinceLastEventOfKind',
		kinds: [
			{ kind: 'location', subkind: 'prop_added' },
			{ kind: 'location', subkind: 'prop_removed' },
		],
	},
	// Every 4 messages OR if there's a location change
	runStrategy: {
		strategy: 'custom',
		check: (ctx: RunStrategyContext) => {
			// Check if there's a location change event this turn
			const hasLocationChange = ctx.turnEvents.some(
				e => e.kind === 'location' && e.subkind === 'moved',
			);
			if (hasLocationChange) return true;

			// Otherwise, every 4 messages since last produced
			const lastProduced =
				ctx.producedAtMessages[ctx.producedAtMessages.length - 1];
			if (!lastProduced) return true; // Never produced, run now
			return ctx.currentMessage.messageId - lastProduced.messageId >= 4;
		},
	},

	shouldRun(context: RunStrategyContext): boolean {
		// Run if props tracking is enabled AND run strategy allows it
		return (
			context.settings.track.props &&
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

		// Get prior projection for validation (state before this message)
		const priorProjection = getPriorProjection(store, currentMessage, context);

		// Calculate message range using strategy (since last props event)
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Compute outfit changes from turn events (extractor-specific value)
		const outfitChanges = formatOutfitChangesFromEvents(turnEvents);

		// Build the prompt with outfit changes passed through additionalValues
		const builtPrompt = buildExtractorPrompt(
			propsChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{
				additionalValues: {
					outfitChanges,
				},
			},
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'location',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			propsChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			debugWarn('propsChange extraction failed:', result.error);
			return [];
		}

		const extraction = result.data;

		// Get all current outfit items (worn clothing should not be props)
		const outfitItems = getAllOutfitItems(projection);

		// Filter out any props that are currently worn
		const filteredAdded = filterPropsAgainstOutfits(extraction.added, outfitItems);

		if (filteredAdded.length !== extraction.added.length) {
			debugLog(
				`Filtered ${extraction.added.length - filteredAdded.length} props that matched worn outfit items`,
			);
		}

		// Validate and deduplicate against prior state
		const validatedAdded = filterPropsToAdd(filteredAdded, priorProjection);
		const validatedRemoved = filterPropsToRemove(extraction.removed, priorProjection);

		// If no valid props to add or remove, return empty array
		if (validatedAdded.length === 0 && validatedRemoved.length === 0) {
			return [];
		}

		// Map validated extraction to events
		const validatedExtraction: ExtractedPropsChange = {
			...extraction,
			added: validatedAdded,
			removed: validatedRemoved,
		};

		const events = mapPropsChange(validatedExtraction, currentMessage);

		return events;
	},
};
