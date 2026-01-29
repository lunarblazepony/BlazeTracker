/**
 * Character Position Change Event Extractor
 *
 * Detects changes to a character's physical position within the scene.
 * This is a per-character extractor that runs once for each present character.
 */

import type { Generator } from '../../../generator';
import type { Event, CharacterPositionChangedEvent, MessageAndSwipe } from '../../../types';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategy,
	RunStrategyContext,
	MessageStrategy,
} from '../../types';
import { positionChangePrompt } from '../../../prompts/events/positionChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	mapPositionChange,
	projectWithTurnEvents,
	getExtractorTemperature,
} from '../../utils';
import type { EventStore } from '../../../store';

/**
 * Character position change event extractor.
 * Detects when a character moves to a new position within the scene.
 */
export const positionChangeExtractor: PerCharacterExtractor = {
	name: 'positionChange',
	displayName: 'position',
	category: 'characters',
	defaultTemperature: 0.5,
	prompt: positionChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 1 } as MessageStrategy,

	runStrategy: { strategy: 'everyMessage' } as RunStrategy,

	shouldRun(ctx: RunStrategyContext): boolean {
		// Check if character tracking is enabled
		if (!ctx.settings.track.characters) {
			return false;
		}

		// Evaluate the run strategy
		return evaluateRunStrategy(this.runStrategy, ctx);
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
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get the character's current state from projection
		const characterState = projection.characters[targetCharacter];
		if (!characterState) {
			console.warn(
				`[BlazeTracker] positionChange: Character "${targetCharacter}" not found in projection`,
			);
			return [];
		}

		// Build the prompt with targetCharacter and their current position
		const messageStart = currentMessage.messageId;
		const messageEnd = currentMessage.messageId;

		const builtPrompt = buildExtractorPrompt(
			positionChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ targetCharacter },
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
			positionChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parse failure
		if (!result.success || !result.data) {
			console.warn(
				'[BlazeTracker] positionChange extraction failed, returning empty',
			);
			return [];
		}

		// If no change detected, return empty
		if (!result.data.changed) {
			return [];
		}

		// Use mapPositionChange to convert the extraction to events
		const events: CharacterPositionChangedEvent[] = mapPositionChange(
			result.data,
			currentMessage,
		);

		// Add previousValue from current state if available
		for (const event of events) {
			if (characterState.position) {
				event.previousValue = characterState.position;
			}
		}

		return events;
	},
};
