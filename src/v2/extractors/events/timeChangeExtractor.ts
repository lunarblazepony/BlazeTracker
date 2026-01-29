/**
 * Time Change Event Extractor
 *
 * Detects whether time has passed and extracts the delta as events.
 */

import type { Generator } from '../../generator';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../types';
import type { Event, MessageAndSwipe, ExtractedTimeChange } from '../../types';
import { timeChangePrompt } from '../../prompts/events/timeChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapTimeChange,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';
import type { EventStore } from '../../store';
import { debugLog, debugWarn } from '../../../utils/debug';

/**
 * Time change event extractor.
 * Detects time passage and produces TimeDeltaEvent events.
 */
export const timeChangeExtractor: EventExtractor<ExtractedTimeChange> = {
	name: 'timeChange',
	displayName: 'time',
	category: 'time',
	defaultTemperature: 0.3,
	prompt: timeChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 1 },
	runStrategy: { strategy: 'everyMessage' },

	shouldRun(context: RunStrategyContext): boolean {
		// Run if time tracking is enabled AND run strategy allows it
		return (
			context.settings.track.time &&
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

		// Build the prompt with current time context
		const builtPrompt = buildExtractorPrompt(
			timeChangePrompt,
			context,
			projection,
			settings,
			currentMessage.messageId, // Start at current message
			currentMessage.messageId, // End at current message (look at last 1 message)
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'time',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			timeChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			debugWarn('timeChange extraction failed:', result.error);
			return [];
		}

		// Log the reasoning for debugging
		debugLog(`time_change reasoning: ${result.data.reasoning}`);

		// Map the extraction to events
		const events = mapTimeChange(result.data, currentMessage);

		return events;
	},
};
