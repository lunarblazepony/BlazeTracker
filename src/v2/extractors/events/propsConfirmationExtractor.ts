/**
 * Props Confirmation Event Extractor
 *
 * Confirms whether previously-tracked props are still present in the scene
 * when new props are added. This helps catch props that may have disappeared
 * without explicit mention.
 *
 * Runs AFTER outfit extractors to filter out worn clothing from props.
 */

import type { Generator } from '../../generator';
import type { Event, LocationPropRemovedEvent, MessageAndSwipe } from '../../types';
import type { ExtractedPropsConfirmation } from '../../types/extraction';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../types';
import { getMessageCount } from '../types';
import { propsConfirmationPrompt } from '../../prompts/events/propsConfirmationPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getAllOutfitItems,
	getExtractorTemperature,
} from '../utils';
import type { EventStore } from '../../store';
import { debugLog, debugWarn } from '../../../utils/debug';

/**
 * Props confirmation event extractor.
 *
 * Runs when new props are added to confirm which tracked props are still present.
 */
export const propsConfirmationExtractor: EventExtractor<ExtractedPropsConfirmation> = {
	name: 'propsConfirmation',
	displayName: 'props',
	category: 'props',
	defaultTemperature: 0.3,
	prompt: propsConfirmationPrompt,

	// Messages since last props event
	messageStrategy: {
		strategy: 'sinceLastEventOfKind',
		kinds: [
			{ kind: 'location', subkind: 'prop_added' },
			{ kind: 'location', subkind: 'prop_removed' },
		],
	},
	// Run if there's new props changes this turn
	runStrategy: {
		strategy: 'newEventsOfKind',
		kinds: [
			{ kind: 'location', subkind: 'prop_added' },
			{ kind: 'location', subkind: 'prop_removed' },
		],
	},

	/**
	 * Check if this extractor should run.
	 * Requires props tracking enabled and new prop_added events this turn.
	 */
	shouldRun(context: RunStrategyContext): boolean {
		// Must have props tracking enabled
		if (!context.settings.track.props) {
			return false;
		}

		// Check run strategy (new prop_added events this turn)
		return evaluateRunStrategy(this.runStrategy, context);
	},

	/**
	 * Run props confirmation extraction.
	 * Returns LocationPropRemovedEvent[] for any props that are no longer present.
	 */
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

		// If no props to confirm, return empty
		if (!projection.location?.props || projection.location.props.length === 0) {
			return [];
		}

		// Calculate message range for context
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build the prompt (all placeholders are now standard)
		const builtPrompt = buildExtractorPrompt(
			propsConfirmationPrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'location',
			this.defaultTemperature,
		);

		// Generate and parse
		const result = await generateAndParse(
			generator,
			propsConfirmationPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parse failure
		if (!result.success || !result.data) {
			debugWarn('Props confirmation extraction failed');
			return [];
		}

		const extraction = result.data;

		// Get outfit items to also filter confirmed props
		const outfitItems = getAllOutfitItems(projection);

		// Filter confirmed props - remove any that are now worn
		const propsMatchingOutfits = extraction.confirmed.filter(prop => {
			const propLower = prop.toLowerCase();
			return outfitItems.some(
				item => item.includes(propLower) || propLower.includes(item),
			);
		});

		// Add props that match outfits to the removed list
		const combinedRemoved = [...extraction.removed, ...propsMatchingOutfits];

		if (propsMatchingOutfits.length > 0) {
			debugLog(
				`Removing ${propsMatchingOutfits.length} props that match worn outfit items:`,
				propsMatchingOutfits,
			);
		}

		// Create LocationPropRemovedEvent for each removed prop
		const events: LocationPropRemovedEvent[] = [];

		for (const prop of combinedRemoved) {
			events.push({
				id: crypto.randomUUID(),
				source: currentMessage,
				timestamp: Date.now(),
				kind: 'location',
				subkind: 'prop_removed',
				prop,
			});
		}

		return events;
	},
};
