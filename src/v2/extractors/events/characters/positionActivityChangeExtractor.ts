/**
 * Combined Position and Activity Change Event Extractor
 *
 * Extracts both position and activity changes in a single LLM call for efficiency.
 * This is a per-character extractor that runs once for each present character.
 */

import type { Generator } from '../../../generator';
import type {
	Event,
	CharacterPositionChangedEvent,
	CharacterActivityChangedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedPositionActivityChange } from '../../../types/extraction';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import { getMessageCount } from '../../types';
import { positionActivityChangePrompt } from '../../../prompts/events/positionActivityChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	projectWithTurnEvents,
	mapPositionActivityChange,
	getExtractorTemperature,
} from '../../utils';
import type { EventStore } from '../../../store';

/**
 * Combined position and activity change per-character extractor.
 *
 * Detects when a character's position and/or activity changes,
 * extracting both in a single LLM call for better performance.
 */
export const positionActivityChangeExtractor: PerCharacterExtractor<ExtractedPositionActivityChange> =
	{
		name: 'positionActivityChange',
		displayName: 'position & activity',
		category: 'characters',
		defaultTemperature: 0.5,
		prompt: positionActivityChangePrompt,

		// Messages since last position/activity event
		messageStrategy: {
			strategy: 'sinceLastEventOfKind',
			kinds: [
				{ kind: 'character', subkind: 'position_changed' },
				{ kind: 'character', subkind: 'activity_changed' },
			],
		},
		// Every 2 messages starting at 1 (assistant messages in normal chat)
		runStrategy: { strategy: 'everyNMessages', n: 2, offset: 1 },

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
			if (!characterState) {
				console.warn(
					`[BlazeTracker] positionActivityChange: Character "${targetCharacter}" not found in projection`,
				);
				return [];
			}

			// Calculate message range based on strategy (since last position/activity event)
			const messageCount = getMessageCount(
				this.messageStrategy,
				store,
				currentMessage,
			);
			const messageStart = Math.max(
				0,
				currentMessage.messageId - messageCount + 1,
			);
			const messageEnd = currentMessage.messageId;

			// Build the prompt with target character context
			const builtPrompt = buildExtractorPrompt(
				positionActivityChangePrompt,
				context,
				projection,
				settings,
				messageStart,
				messageEnd,
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
				positionActivityChangePrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			// If parsing failed, return empty array
			if (!result.success || !result.data) {
				console.warn(
					'[BlazeTracker] positionActivityChange extraction failed:',
					result.error,
				);
				return [];
			}

			// If no changes detected, return empty
			if (!result.data.positionChanged && !result.data.activityChanged) {
				return [];
			}

			// Map the extraction to events
			const events = mapPositionActivityChange(result.data, currentMessage);

			// Add previous values to events for context
			for (const event of events) {
				if (
					event.kind === 'character' &&
					event.subkind === 'position_changed' &&
					characterState.position
				) {
					(event as CharacterPositionChangedEvent).previousValue =
						characterState.position;
				}
				if (
					event.kind === 'character' &&
					event.subkind === 'activity_changed' &&
					characterState.activity
				) {
					(event as CharacterActivityChangedEvent).previousValue =
						characterState.activity;
				}
			}

			return events;
		},
	};
