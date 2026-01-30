/**
 * Milestone Description Event Extractor
 *
 * Generates milestone descriptions for first-time relationship subjects.
 * This extractor MODIFIES existing subject events rather than creating new ones.
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
	RelationshipSubjectEvent,
	ExtractedMilestoneDescription,
} from '../../types';
import { isRelationshipSubjectEvent } from '../../types';
import { milestoneDescriptionPrompt } from '../../prompts/events/milestoneDescriptionPrompt';
import {
	generateAndParse,
	evaluateRunStrategy,
	formatMessages,
	projectWithTurnEvents,
	formatLocation,
	formatRelationshipProfiles,
	buildSwipeContextFromExtraction,
} from '../utils';
import type { EventStore } from '../../store';
import type { Projection } from '../../types';
import { buildPrompt as fillPrompt, type BuiltPrompt } from '../../prompts';
import { getMilestonesForPair, normalizePair } from '../../store/projection';
import { debugWarn } from '../../../utils/debug';

/**
 * Get time of day from projection.
 */
function getTimeOfDay(projection: Projection): string {
	if (!projection.time) return 'unknown';
	const hour = projection.time.hour();
	if (hour >= 5 && hour < 12) return 'morning';
	if (hour >= 12 && hour < 17) return 'afternoon';
	if (hour >= 17 && hour < 21) return 'evening';
	return 'night';
}

/**
 * Format characters for the milestone pair.
 */
function formatCharactersForPair(projection: Projection, pair: [string, string]): string {
	const lines: string[] = [];
	for (const name of pair) {
		const char = projection.characters[name];
		if (!char) {
			lines.push(`${name}: (not present)`);
			continue;
		}
		const parts: string[] = [];
		if (char.position) parts.push(`Position: ${char.position}`);
		if (char.activity) parts.push(`Activity: ${char.activity}`);
		if (char.mood.length > 0) parts.push(`Mood: ${char.mood.join(', ')}`);
		// Format outfit
		const outfitParts: string[] = [];
		for (const [slot, item] of Object.entries(char.outfit)) {
			if (item) outfitParts.push(`${slot}: ${item}`);
		}
		if (outfitParts.length > 0) parts.push(`Wearing: ${outfitParts.join(', ')}`);
		lines.push(`${name}: ${parts.join(' | ')}`);
	}
	return lines.join('\n');
}

/**
 * Format relationship state for prompt (simplified for milestone context).
 */
function formatRelationshipForMilestone(projection: Projection, pair: [string, string]): string {
	const key = pair.join('|');
	const rel = projection.relationships[key];
	if (!rel) return `${pair[0]} & ${pair[1]} (new relationship)`;

	const parts: string[] = [`${pair[0]} & ${pair[1]} (${rel.status})`];

	const aFeelings = rel.aToB.feelings.length > 0 ? rel.aToB.feelings.join(', ') : 'unknown';
	const bFeelings = rel.bToA.feelings.length > 0 ? rel.bToA.feelings.join(', ') : 'unknown';

	parts.push(`${pair[0]} feels: ${aFeelings}`);
	parts.push(`${pair[1]} feels: ${bFeelings}`);

	return parts.join(' | ');
}

/**
 * Build placeholder values for milestone description prompt.
 */
function buildMilestonePlaceholderValues(
	event: RelationshipSubjectEvent,
	context: ExtractionContext,
	projection: Projection,
	messageId: number,
): Record<string, string> {
	const pair = event.pair as [string, string];
	return {
		messages: formatMessages(context, messageId - 1, messageId),
		milestoneType: event.subject,
		characterPair: `${pair[0]} and ${pair[1]}`,
		timeOfDay: getTimeOfDay(projection),
		location: formatLocation(projection),
		props: projection.location?.props.join(', ') || 'none',
		characters: formatCharactersForPair(projection, pair),
		relationship: formatRelationshipForMilestone(projection, pair),
		relationshipProfiles: formatRelationshipProfiles(projection, pair),
		eventDetail: `${event.subject.replace(/_/g, ' ')} between ${pair[0]} and ${pair[1]}`,
	};
}

/**
 * Milestone description event extractor.
 * Generates concise, grounded descriptions for first-time relationship subjects.
 */
export const milestoneDescriptionExtractor: EventExtractor<ExtractedMilestoneDescription> = {
	name: 'milestoneDescription',
	displayName: 'milestone',
	category: 'narrative',
	defaultTemperature: 0.5,
	prompt: milestoneDescriptionPrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 2 },
	runStrategy: {
		strategy: 'newEventsOfKind',
		kinds: [{ kind: 'relationship', subkind: 'subject' }],
	},

	shouldRun(context: RunStrategyContext): boolean {
		// Run if narrative tracking is enabled AND run strategy allows it
		return (
			context.settings.track.narrative &&
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
		// Build swipe context for canonical path filtering
		const swipeContext = buildSwipeContextFromExtraction(context);

		// Get subject events from turnEvents that are potential milestones
		const subjectEvents = turnEvents.filter(
			isRelationshipSubjectEvent,
		) as RelationshipSubjectEvent[];

		if (subjectEvents.length === 0) {
			return [];
		}

		// Collect unique pairs from subject events
		const pairs = new Set<string>();
		for (const se of subjectEvents) {
			const pair = normalizePair(se.pair[0], se.pair[1]);
			pairs.add(pair.join('|'));
		}

		// Clone store and append turn events for the "after" comparison
		const workingStore = store.getDeepClone();
		workingStore.appendEvents(turnEvents);

		// For each pair, diff milestones to find new ones
		const milestoneCandidates: RelationshipSubjectEvent[] = [];

		for (const pairKey of pairs) {
			const [name1, name2] = pairKey.split('|');

			// Milestones before this turn (on canonical path, up to previous message)
			const beforeMilestones = getMilestonesForPair(
				store.getActiveEvents(),
				name1,
				name2,
				swipeContext,
				currentMessage.messageId - 1,
			);
			const beforeSubjects = new Set(beforeMilestones.map(m => m.subject));

			// Milestones after this turn (including turn events, up to current message)
			const afterMilestones = getMilestonesForPair(
				workingStore.getActiveEvents(),
				name1,
				name2,
				swipeContext,
				currentMessage.messageId,
			);

			// Find NEW milestones (in after but not in before)
			for (const milestone of afterMilestones) {
				if (!beforeSubjects.has(milestone.subject)) {
					// Find the corresponding subject event from turnEvents
					const subjectEvent = subjectEvents.find(
						se =>
							se.subject === milestone.subject &&
							normalizePair(se.pair[0], se.pair[1]).join(
								'|',
							) === pairKey,
					);
					if (subjectEvent) {
						milestoneCandidates.push(subjectEvent);
					}
				}
			}
		}

		if (milestoneCandidates.length === 0) {
			return [];
		}

		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Get the temperature (use custom if set, otherwise default)
		const temperature = settings.temperatures.narrative ?? this.defaultTemperature;

		// Process each milestone candidate
		for (const event of milestoneCandidates) {
			// Build the placeholder values for this specific milestone
			const values = buildMilestonePlaceholderValues(
				event,
				context,
				projection,
				currentMessage.messageId,
			);

			// Build the prompt with milestone-specific values
			const builtPrompt: BuiltPrompt = fillPrompt(
				milestoneDescriptionPrompt,
				values,
				settings.customPrompts,
			);

			// Generate and parse the response
			const result = await generateAndParse(
				generator,
				milestoneDescriptionPrompt,
				builtPrompt,
				temperature,
				{ abortSignal },
			);

			// If parsing succeeded, set the milestone description on the event
			if (result.success && result.data) {
				event.milestoneDescription = result.data.description;
			} else {
				debugWarn(
					`milestoneDescription extraction failed for ${event.subject}:`,
					result.error,
				);
			}
		}

		// Return empty array - this extractor modifies existing events
		return [];
	},
};
