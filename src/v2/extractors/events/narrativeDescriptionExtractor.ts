/**
 * Narrative Description Event Extractor
 *
 * Generates narrative descriptions on every assistant message.
 * Summarizes messages since last narrative description.
 * Witnesses and location are derived from projection state, not extracted.
 */

import type { Generator } from '../../generator';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../types';
import { getMessageCount } from '../types';
import type { Event, MessageAndSwipe, ExtractedNarrativeDescription } from '../../types';
import { narrativeDescriptionPrompt } from '../../prompts/events/narrativeDescriptionPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapNarrativeDescription,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';
import type { EventStore } from '../../store';
import { debugLog, debugWarn } from '../../../utils/debug';

/**
 * Narrative description event extractor.
 * Runs on every assistant message and summarizes messages since last narrative.
 * Produces NarrativeDescriptionEvent events (description only - witnesses/location derived at projection).
 */
export const narrativeDescriptionExtractor: EventExtractor<ExtractedNarrativeDescription> = {
	name: 'narrativeDescription',
	displayName: 'narrative',
	category: 'narrative',
	defaultTemperature: 0.5,
	prompt: narrativeDescriptionPrompt,

	// Send last 4 messages
	messageStrategy: { strategy: 'fixedNumber', n: 4 },
	// Run every 4 messages
	runStrategy: { strategy: 'everyNMessages', n: 4 },

	shouldRun(context: RunStrategyContext): boolean {
		// Run if narrative tracking is enabled AND run strategy allows it
		return (
			context.settings.track.narrative &&
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

		// Calculate message range based on strategy (since last narrative description)
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const endMessageId = currentMessage.messageId;
		const startMessageId = Math.max(0, endMessageId - messageCount + 1);

		// Build the prompt with current context
		const builtPrompt = buildExtractorPrompt(
			narrativeDescriptionPrompt,
			context,
			projection,
			settings,
			startMessageId,
			endMessageId,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'narrative',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			narrativeDescriptionPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			debugWarn('narrativeDescription extraction failed:', result.error);
			return [];
		}

		// Log reasoning for debugging
		debugLog(`narrative_description reasoning: ${result.data.reasoning}`);

		// Map the extraction to events (just description - witnesses/location derived at projection)
		const events = mapNarrativeDescription(result.data, currentMessage);

		return events;
	},
};
