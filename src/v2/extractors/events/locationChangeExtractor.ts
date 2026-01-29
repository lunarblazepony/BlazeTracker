/**
 * Location Change Event Extractor
 *
 * Detects location changes between messages and emits LocationMovedEvent.
 */

import type { Generator } from '../../generator';
import type { EventStore } from '../../store';
import type { Event, LocationMovedEvent, MessageAndSwipe, Projection } from '../../types';
import type { ExtractedLocationChange } from '../../types/extraction';
import { locationChangePrompt } from '../../prompts/events/locationChangePrompt';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	MessageStrategy,
	RunStrategy,
	RunStrategyContext,
} from '../types';
import { getMessageCount } from '../types';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapLocationChange,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';

/**
 * Location Change Extractor
 *
 * Detects when characters move to a new location.
 */
export const locationChangeExtractor: EventExtractor<ExtractedLocationChange> = {
	name: 'locationChange',
	displayName: 'location',
	category: 'location',
	defaultTemperature: 0.5,
	prompt: locationChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 } as MessageStrategy,
	runStrategy: { strategy: 'everyMessage' } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Check if location tracking is enabled
		if (!context.settings.track.location) {
			return false;
		}
		// Evaluate the run strategy
		return evaluateRunStrategy(this.runStrategy, context);
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
		let projection: Projection;
		try {
			projection = projectWithTurnEvents(
				store,
				turnEvents,
				currentMessage.messageId,
				context,
			);
		} catch {
			// No initial snapshot yet - can't detect location changes
			return [];
		}

		// Determine message range
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build the prompt with current location context
		const builtPrompt = buildExtractorPrompt(
			this.prompt,
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

		// Generate and parse the response
		const result = await generateAndParse<ExtractedLocationChange>(
			generator,
			this.prompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed or no change detected, return empty
		if (!result.success || !result.data) {
			return [];
		}

		const extraction = result.data;

		// If no change, return empty
		if (!extraction.changed) {
			return [];
		}

		// Map extraction to events
		const events: LocationMovedEvent[] = mapLocationChange(extraction, currentMessage);

		return events;
	},
};
