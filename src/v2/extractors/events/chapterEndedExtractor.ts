/**
 * Chapter Ended Event Extractor
 *
 * Detects chapter boundaries based on significant location or time changes.
 * Only runs when triggered by location moved or significant time delta events.
 */

import type { Generator } from '../../generator';
import type { EventStore } from '../../store';
import type { Event, MessageAndSwipe, TimeDeltaEvent } from '../../types';
import type { ExtractedChapterEnded } from '../../types/extraction';
import { chapterEndedPrompt } from '../../prompts/events/chapterEndedPrompt';
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
	mapChapterEnded,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../utils';
import { debugWarn } from '../../../utils/debug';

/**
 * Check if there's a location moved event in turn events.
 */
function hasLocationMovedEvent(turnEvents: Event[]): boolean {
	return turnEvents.some(
		e => e.kind === 'location' && 'subkind' in e && e.subkind === 'moved',
	);
}

/**
 * Check if there's a significant time jump in turn events.
 * Significant means: delta.hours >= 6 OR delta.days >= 1
 */
function hasSignificantTimeJump(turnEvents: Event[]): boolean {
	return turnEvents.some(e => {
		if (e.kind !== 'time' || !('subkind' in e) || e.subkind !== 'delta') {
			return false;
		}
		const timeDelta = e as TimeDeltaEvent;
		const { delta } = timeDelta;
		return (delta.hours ?? 0) >= 6 || (delta.days ?? 0) >= 1;
	});
}

/**
 * Custom run strategy check for chapter ended extractor.
 * Returns true if there's a location moved event OR significant time jump in turn events.
 */
function customCheck(context: RunStrategyContext): boolean {
	return (
		hasLocationMovedEvent(context.turnEvents) ||
		hasSignificantTimeJump(context.turnEvents)
	);
}

/**
 * Chapter Ended Extractor
 *
 * Detects natural chapter breaks based on major location changes or significant time jumps.
 */
export const chapterEndedExtractor: EventExtractor<ExtractedChapterEnded> = {
	name: 'chapterEnded',
	displayName: 'chapter end',
	category: 'chapters',
	defaultTemperature: 0.3,
	prompt: chapterEndedPrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 3 } as MessageStrategy,
	runStrategy: { strategy: 'custom', check: customCheck } as RunStrategy,

	shouldRun(context: RunStrategyContext): boolean {
		// Check if chapter tracking is enabled
		if (!context.settings.track.chapters) {
			return false;
		}
		// Evaluate the run strategy (custom check for location/time events)
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
		let projection;
		try {
			projection = projectWithTurnEvents(
				store,
				turnEvents,
				currentMessage.messageId,
				context,
			);
		} catch {
			// No initial snapshot yet - can't detect chapter boundaries
			return [];
		}

		// Get the current chapter index
		const chapterIndex = projection.currentChapter;

		// Determine message range
		const messageCount = getMessageCount(this.messageStrategy, store, currentMessage);
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build the prompt with current location and time context
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
			'chapters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse<ExtractedChapterEnded>(
			generator,
			this.prompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty
		if (!result.success || !result.data) {
			debugWarn('chapterEnded extraction failed:', result.error);
			return [];
		}

		const extraction = result.data;

		// If chapter should not end, return empty
		if (!extraction.shouldEnd) {
			return [];
		}

		// Map extraction to events
		const events = mapChapterEnded(extraction, currentMessage, chapterIndex);

		return events;
	},
};
