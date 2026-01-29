/**
 * Chapter Description Event Extractor
 *
 * Generates title and summary for a chapter that just ended.
 * Runs only when a ChapterEndedEvent exists in turnEvents.
 */

import type { Generator } from '../../generator';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../types';
import type {
	Event,
	MessageAndSwipe,
	ChapterEndedEvent,
	ExtractedChapterDescription,
} from '../../types';
import { isChapterEndedEvent } from '../../types';
import { chapterDescriptionPrompt } from '../../prompts/events/chapterDescriptionPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapChapterDescription,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';
import type { EventStore } from '../../store';
import { getMessageCount } from '../types';

/**
 * Chapter description event extractor.
 * Generates evocative chapter titles and concise summaries for completed chapters.
 */
export const chapterDescriptionExtractor: EventExtractor<ExtractedChapterDescription> = {
	name: 'chapterDescription',
	displayName: 'chapter',
	category: 'chapters',
	defaultTemperature: 0.7,
	prompt: chapterDescriptionPrompt,

	messageStrategy: {
		strategy: 'sinceLastEventOfKind',
		kinds: [{ kind: 'chapter', subkind: 'ended' }],
	},
	runStrategy: {
		strategy: 'newEventsOfKind',
		kinds: [{ kind: 'chapter', subkind: 'ended' }],
	},

	shouldRun(context: RunStrategyContext): boolean {
		// Run if chapters tracking is enabled AND there's a new chapter ended event
		return (
			context.settings.track.chapters &&
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
		// Get the chapter ended event from turnEvents
		const chapterEndedEvent = turnEvents.find(isChapterEndedEvent) as
			| ChapterEndedEvent
			| undefined;

		if (!chapterEndedEvent) {
			return [];
		}

		const chapterIndex = chapterEndedEvent.chapterIndex;

		// Get the number of messages to include based on message strategy
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const startMessage = Math.max(0, currentMessage.messageId - messageCount + 1);

		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Build the prompt with chapter context
		const builtPrompt = buildExtractorPrompt(
			chapterDescriptionPrompt,
			context,
			projection,
			settings,
			startMessage,
			currentMessage.messageId,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'chapters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			chapterDescriptionPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			console.warn(
				'[BlazeTracker] chapterDescription extraction failed:',
				result.error,
			);
			return [];
		}

		// Map the extraction to events
		const events = mapChapterDescription(result.data, currentMessage, chapterIndex);

		return events;
	},
};
