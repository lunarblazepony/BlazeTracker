/**
 * Subjects Event Extractor
 *
 * Detects relationship subjects/interaction types for ALL present character pairs.
 * Runs globally and returns events for all detected subjects.
 */

import type { Generator } from '../../../generator';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import type { Event, MessageAndSwipe, ExtractedSubjects } from '../../../types';
import { subjectsPrompt } from '../../../prompts/events/subjectsPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapSubjects,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';
import type { EventStore } from '../../../store';
import { debugWarn } from '../../../../utils/debug';

/**
 * Subjects event extractor.
 * Detects significant interaction subjects between character pairs.
 */
export const subjectsExtractor: EventExtractor<ExtractedSubjects> = {
	name: 'subjects',
	displayName: 'subjects',
	category: 'relationships',
	defaultTemperature: 0.5,
	prompt: subjectsPrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 },
	// Every 2 messages starting at 1 (assistant messages in normal chat)
	runStrategy: { strategy: 'everyNMessages', n: 2, offset: 1 },

	shouldRun(context: RunStrategyContext): boolean {
		// Run if relationships tracking is enabled AND run strategy allows it
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
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get list of present characters
		const presentCharacters = projection.charactersPresent;

		// Need at least 2 characters for any pair interaction
		if (presentCharacters.length < 2) {
			return [];
		}

		// Build the prompt with character pairs context
		const builtPrompt = buildExtractorPrompt(
			subjectsPrompt,
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
			'relationships',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			subjectsPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			debugWarn('subjects extraction failed:', result.error);
			return [];
		}

		// If no subjects detected, return empty array
		if (!result.data.subjects || result.data.subjects.length === 0) {
			return [];
		}

		// Map the extraction to events
		const events = mapSubjects(result.data, currentMessage);

		return events;
	},
};
