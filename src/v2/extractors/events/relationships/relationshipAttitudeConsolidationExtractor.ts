/**
 * Relationship Attitude Consolidation Extractor
 *
 * Periodically consolidates feelings and wants lists when they grow too large,
 * removing synonyms and keeping only distinct items (2-5 items per list).
 *
 * Runs every 6 messages as a cleanup pass.
 * Makes 2 LLM calls per pair - one for each direction (A→B and B→A).
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type {
	Event,
	RelationshipFeelingAddedEvent,
	RelationshipFeelingRemovedEvent,
	RelationshipWantAddedEvent,
	RelationshipWantRemovedEvent,
	MessageAndSwipe,
} from '../../../types';
import type { ExtractedAttitudeConsolidation } from '../../../types/extraction';
import type {
	PerPairExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../../types';
import { relationshipAttitudeConsolidationPrompt } from '../../../prompts/events/relationshipAttitudeConsolidationPrompt';
import {
	generateAndParse,
	evaluateRunStrategy,
	projectWithTurnEvents,
	baseEvent,
	formatMessages,
	formatRelationshipProfiles,
	getExtractorTemperature,
} from '../../utils';
import { buildPrompt } from '../../../prompts';
import { debugWarn } from '../../../../utils/debug';

/**
 * Map consolidation results to events by diffing old vs new lists for one direction.
 */
function mapAttitudeConsolidation(
	oldFeelings: string[],
	newFeelings: string[],
	oldWants: string[],
	newWants: string[],
	fromCharacter: string,
	towardCharacter: string,
	source: MessageAndSwipe,
): (
	| RelationshipFeelingAddedEvent
	| RelationshipFeelingRemovedEvent
	| RelationshipWantAddedEvent
	| RelationshipWantRemovedEvent
)[] {
	const events: (
		| RelationshipFeelingAddedEvent
		| RelationshipFeelingRemovedEvent
		| RelationshipWantAddedEvent
		| RelationshipWantRemovedEvent
	)[] = [];

	// Normalize for comparison (lowercase, trim)
	const normalize = (s: string) => s.toLowerCase().trim();
	const oldFeelingsNorm = new Set(oldFeelings.map(normalize));
	const newFeelingsNorm = new Set(newFeelings.map(normalize));
	const oldWantsNorm = new Set(oldWants.map(normalize));
	const newWantsNorm = new Set(newWants.map(normalize));

	// Feeling removals: in old but not in new
	for (const feeling of oldFeelings) {
		if (!newFeelingsNorm.has(normalize(feeling))) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'feeling_removed',
				fromCharacter,
				towardCharacter,
				value: feeling,
			});
		}
	}

	// Feeling additions: in new but not in old
	for (const feeling of newFeelings) {
		if (!oldFeelingsNorm.has(normalize(feeling))) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter,
				towardCharacter,
				value: feeling,
			});
		}
	}

	// Want removals: in old but not in new
	for (const want of oldWants) {
		if (!newWantsNorm.has(normalize(want))) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'want_removed',
				fromCharacter,
				towardCharacter,
				value: want,
			});
		}
	}

	// Want additions: in new but not in old
	for (const want of newWants) {
		if (!oldWantsNorm.has(normalize(want))) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'want_added',
				fromCharacter,
				towardCharacter,
				value: want,
			});
		}
	}

	return events;
}

/**
 * Consolidate one direction of a relationship.
 */
async function consolidateDirection(
	generator: Generator,
	_context: ExtractionContext,
	settings: ExtractionSettings,
	messages: string,
	characterProfiles: string,
	fromCharacter: string,
	towardCharacter: string,
	currentFeelings: string[],
	currentWants: string[],
	currentMessage: MessageAndSwipe,
	temperature: number,
	abortSignal?: AbortSignal,
): Promise<Event[]> {
	// Build prompt with explicit directional values
	const builtPrompt = buildPrompt(
		relationshipAttitudeConsolidationPrompt,
		{
			messages,
			characterProfiles,
			fromCharacter,
			towardCharacter,
			currentFeelings:
				currentFeelings.length > 0 ? currentFeelings.join(', ') : '(none)',
			currentWants: currentWants.length > 0 ? currentWants.join(', ') : '(none)',
		},
		settings.customPrompts,
	);

	const result = await generateAndParse(
		generator,
		relationshipAttitudeConsolidationPrompt,
		builtPrompt,
		temperature,
		{ abortSignal },
	);

	if (!result.success || !result.data) {
		debugWarn(
			`relationshipAttitudeConsolidation extraction failed for ${fromCharacter} -> ${towardCharacter}`,
		);
		return [];
	}

	return mapAttitudeConsolidation(
		currentFeelings,
		result.data.consolidatedFeelings,
		currentWants,
		result.data.consolidatedWants,
		fromCharacter,
		towardCharacter,
		currentMessage,
	);
}

/**
 * Relationship attitude consolidation per-pair event extractor.
 *
 * Runs every 6 messages to consolidate feelings and wants lists,
 * removing synonyms and keeping only distinct items.
 * Makes 2 LLM calls per pair - one for each direction.
 */
export const relationshipAttitudeConsolidationExtractor: PerPairExtractor<ExtractedAttitudeConsolidation> =
	{
		name: 'relationshipAttitudeConsolidation',
		displayName: 'attitude consolidation',
		category: 'relationships',
		defaultTemperature: 0.3,
		prompt: relationshipAttitudeConsolidationPrompt,

		// Last 6 messages for context
		messageStrategy: { strategy: 'fixedNumber', n: 6 },
		// Run every 6 messages
		runStrategy: { strategy: 'everyNMessages', n: 6 },

		shouldRun(context: RunStrategyContext): boolean {
			// Run if relationships tracking is enabled AND the run strategy permits
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
			pair: [string, string],
			abortSignal?: AbortSignal,
		): Promise<Event[]> {
			// Get current state projection including turn events
			const projection = projectWithTurnEvents(
				store,
				turnEvents,
				currentMessage.messageId,
				context,
			);

			// Get relationship state
			const key = pair.join('|');
			const rel = projection.relationships[key];
			if (!rel) {
				debugWarn(
					`relationshipAttitudeConsolidation: relationship ${key} not found`,
				);
				return [];
			}

			// Calculate message range
			const messageCount = 6;
			const messageStart = Math.max(
				0,
				currentMessage.messageId - messageCount + 1,
			);
			const messageEnd = currentMessage.messageId;

			// Get temperature (prompt override → category → default)
			const temperature = getExtractorTemperature(
				settings,
				this.prompt.name,
				'relationships',
				this.defaultTemperature,
			);

			// Format common values
			const messages = formatMessages(context, messageStart, messageEnd);
			const characterProfiles = formatRelationshipProfiles(projection, pair);

			const allEvents: Event[] = [];

			// Direction 1: A → B (pair[0] toward pair[1])
			const eventsAtoB = await consolidateDirection(
				generator,
				context,
				settings,
				messages,
				characterProfiles,
				pair[0], // fromCharacter
				pair[1], // towardCharacter
				[...rel.aToB.feelings],
				[...rel.aToB.wants],
				currentMessage,
				temperature,
				abortSignal,
			);
			allEvents.push(...eventsAtoB);

			// Direction 2: B → A (pair[1] toward pair[0])
			const eventsBtoA = await consolidateDirection(
				generator,
				context,
				settings,
				messages,
				characterProfiles,
				pair[1], // fromCharacter
				pair[0], // towardCharacter
				[...rel.bToA.feelings],
				[...rel.bToA.wants],
				currentMessage,
				temperature,
				abortSignal,
			);
			allEvents.push(...eventsBtoA);

			return allEvents;
		},
	};
