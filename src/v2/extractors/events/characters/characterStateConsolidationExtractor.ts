/**
 * Character State Consolidation Extractor
 *
 * Periodically consolidates mood and physical state lists when they grow too large,
 * removing synonyms and keeping only distinct states (2-5 items per list).
 *
 * Runs every 6 messages as a cleanup pass.
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	CharacterPhysicalAddedEvent,
	CharacterPhysicalRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedStateConsolidation } from '../../../types/extraction';
import type {
	PerCharacterExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import { characterStateConsolidationPrompt } from '../../../prompts/events/characterStateConsolidationPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	projectWithTurnEvents,
	baseEvent,
	getExtractorTemperature,
} from '../../utils';

/**
 * Map consolidation results to events by diffing old vs new lists.
 */
function mapStateConsolidation(
	oldMoods: string[],
	newMoods: string[],
	oldPhysical: string[],
	newPhysical: string[],
	character: string,
	source: MessageAndSwipe,
): (
	| CharacterMoodAddedEvent
	| CharacterMoodRemovedEvent
	| CharacterPhysicalAddedEvent
	| CharacterPhysicalRemovedEvent
)[] {
	const events: (
		| CharacterMoodAddedEvent
		| CharacterMoodRemovedEvent
		| CharacterPhysicalAddedEvent
		| CharacterPhysicalRemovedEvent
	)[] = [];

	// Normalize for comparison (lowercase, trim)
	const normalize = (s: string) => s.toLowerCase().trim();
	const oldMoodsNorm = new Set(oldMoods.map(normalize));
	const newMoodsNorm = new Set(newMoods.map(normalize));
	const oldPhysicalNorm = new Set(oldPhysical.map(normalize));
	const newPhysicalNorm = new Set(newPhysical.map(normalize));

	// Mood removals: in old but not in new
	for (const mood of oldMoods) {
		if (!newMoodsNorm.has(normalize(mood))) {
			events.push({
				...baseEvent(source),
				kind: 'character',
				subkind: 'mood_removed',
				character,
				mood,
			});
		}
	}

	// Mood additions: in new but not in old
	for (const mood of newMoods) {
		if (!oldMoodsNorm.has(normalize(mood))) {
			events.push({
				...baseEvent(source),
				kind: 'character',
				subkind: 'mood_added',
				character,
				mood,
			});
		}
	}

	// Physical removals: in old but not in new
	for (const state of oldPhysical) {
		if (!newPhysicalNorm.has(normalize(state))) {
			events.push({
				...baseEvent(source),
				kind: 'character',
				subkind: 'physical_removed',
				character,
				physicalState: state,
			});
		}
	}

	// Physical additions: in new but not in old
	for (const state of newPhysical) {
		if (!oldPhysicalNorm.has(normalize(state))) {
			events.push({
				...baseEvent(source),
				kind: 'character',
				subkind: 'physical_added',
				character,
				physicalState: state,
			});
		}
	}

	return events;
}

/**
 * Character state consolidation per-character event extractor.
 *
 * Runs every 6 messages to consolidate mood and physical state lists,
 * removing synonyms and keeping only distinct states.
 */
export const characterStateConsolidationExtractor: PerCharacterExtractor<ExtractedStateConsolidation> =
	{
		name: 'characterStateConsolidation',
		displayName: 'state consolidation',
		category: 'characters',
		defaultTemperature: 0.3,
		prompt: characterStateConsolidationPrompt,

		// Last 6 messages for context
		messageStrategy: { strategy: 'fixedNumber', n: 6 },
		// Run every 6 messages
		runStrategy: { strategy: 'everyNMessages', n: 6 },

		shouldRun(context: RunStrategyContext): boolean {
			// Run if characters tracking is enabled AND the run strategy permits
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
			// Get current state projection including turn events
			const projection = projectWithTurnEvents(
				store,
				turnEvents,
				currentMessage.messageId,
				context,
			);

			// Get character's current state
			const characterState = projection.characters[targetCharacter];
			if (!characterState) {
				console.warn(
					`[BlazeTracker] characterStateConsolidation: character ${targetCharacter} not found in projection`,
				);
				return [];
			}

			const oldMoods = [...characterState.mood];
			const oldPhysical = [...characterState.physicalState];

			// Calculate message range
			const messageCount = 6;
			const messageStart = Math.max(
				0,
				currentMessage.messageId - messageCount + 1,
			);
			const messageEnd = currentMessage.messageId;

			// Build prompt with target character context
			const builtPrompt = buildExtractorPrompt(
				characterStateConsolidationPrompt,
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

			// Generate and parse response
			const result = await generateAndParse(
				generator,
				characterStateConsolidationPrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			// Handle parsing failure
			if (!result.success || !result.data) {
				console.warn(
					`[BlazeTracker] characterStateConsolidation extraction failed for ${targetCharacter}`,
				);
				return [];
			}

			const extraction = result.data;

			// Map consolidation to events by diffing old vs new
			const events = mapStateConsolidation(
				oldMoods,
				extraction.consolidatedMoods,
				oldPhysical,
				extraction.consolidatedPhysical,
				targetCharacter,
				currentMessage,
			);

			return events;
		},
	};
