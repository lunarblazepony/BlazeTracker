/**
 * Topic/Tone Change Event Extractor
 *
 * Detects when the topic or tone of a scene has changed from the previous state.
 */

import type { Generator } from '../../generator';
import type { Event, TopicToneEvent, MessageAndSwipe } from '../../types';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../types';
import { getMessageCount } from '../types';
import type { EventStore } from '../../store';
import { topicToneChangePrompt } from '../../prompts/events/topicToneChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapTopicToneChange,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';
import { debugWarn } from '../../../utils/debug';

/**
 * Topic/Tone change event extractor.
 *
 * Monitors messages for changes in the scene's topic (what it's about) and
 * tone (emotional atmosphere). Runs every message to catch shifts in the
 * narrative direction.
 */
export const topicToneChangeExtractor: EventExtractor = {
	name: 'topicToneChange',
	displayName: 'topic & tone',
	category: 'scene',
	defaultTemperature: 0.5,
	prompt: topicToneChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 } as MessageStrategy,
	runStrategy: { strategy: 'everyMessage' } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Run if scene tracking is enabled AND the run strategy allows it
		return (
			context.settings.track.scene &&
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
	): Promise<TopicToneEvent[]> {
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get message range based on strategy
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Get previous topic/tone from projection for context
		const previousTopic = projection.scene?.topic;
		const previousTone = projection.scene?.tone;

		// Build the prompt with current topic/tone context
		const builtPrompt = buildExtractorPrompt(
			topicToneChangePrompt,
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
			'scene',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse(
			generator,
			topicToneChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure or no change
		if (!result.success || !result.data) {
			debugWarn('topicToneChange extraction failed');
			return [];
		}

		// If extraction indicates no change, return empty array
		if (!result.data.changed) {
			return [];
		}

		// Map extraction to events
		const events = mapTopicToneChange(
			result.data,
			currentMessage,
			previousTopic,
			previousTone,
		);

		return events;
	},
};
