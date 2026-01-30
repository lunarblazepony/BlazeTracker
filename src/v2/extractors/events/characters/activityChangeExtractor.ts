/**
 * Character Activity Change Event Extractor
 *
 * Per-character extractor that detects when a character's current activity changes.
 * Runs once for EACH present character in the scene.
 */

import type { Generator } from '../../../generator';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import type { Event, MessageAndSwipe, ExtractedActivityChange } from '../../../types';
import { activityChangePrompt } from '../../../prompts/events/activityChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapActivityChange,
	evaluateRunStrategy,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';
import type { EventStore } from '../../../store';
import { debugWarn } from '../../../../utils/debug';

/**
 * Activity change per-character extractor.
 * Detects when a character's current activity changes and produces CharacterActivityChangedEvent events.
 */
export const activityChangeExtractor: PerCharacterExtractor<ExtractedActivityChange> = {
	name: 'activityChange',
	displayName: 'activity',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: activityChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 1 },
	runStrategy: { strategy: 'everyMessage' },

	shouldRun(context: RunStrategyContext): boolean {
		// Run if character tracking is enabled AND run strategy allows it
		return (
			context.settings.track.characters &&
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
		targetCharacter: string,
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get current state by projecting including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get the character's current state from the projection
		const characterState = projection.characters[targetCharacter];
		const currentActivity = characterState?.activity ?? null;

		// Build the prompt with target character context
		const builtPrompt = buildExtractorPrompt(
			activityChangePrompt,
			context,
			projection,
			settings,
			currentMessage.messageId, // Start at current message
			currentMessage.messageId, // End at current message (look at last 1 message)
			{
				targetCharacter,
			},
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'characters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			activityChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			debugWarn('activityChange extraction failed:', result.error);
			return [];
		}

		// If extraction indicates no change, return empty array
		if (!result.data.changed) {
			return [];
		}

		// Map the extraction to events
		const events = mapActivityChange(result.data, currentMessage);

		// Add previous value to events for context
		for (const event of events) {
			if (event.kind === 'character' && event.subkind === 'activity_changed') {
				event.previousValue = currentActivity;
			}
		}

		return events;
	},
};
