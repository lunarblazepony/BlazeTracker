/**
 * Relationship Status Change Event Extractor
 *
 * Detects when the overall relationship status between two characters changes.
 * This is a per-pair extractor that runs once for each present character pair.
 *
 * Applies gating rules to prevent over-escalation:
 * - "friendly" requires certain bonding milestones
 * - "close" requires emotional intimacy milestones
 * - "intimate" requires romantic/physical milestones
 */

import type { Generator } from '../../../generator';
import type { EventStore } from '../../../store';
import type { Event, RelationshipStatusChangedEvent, MessageAndSwipe } from '../../../types';
import type { ExtractedStatusChange } from '../../../types/extraction';
import type { Subject } from '../../../types/subject';
import type { RelationshipStatus } from '../../../types/common';
import type {
	PerPairExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
	MessageStrategy,
	RunStrategy,
} from '../../types';
import { statusChangePrompt } from '../../../prompts/events/statusChangePrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	evaluateRunStrategy,
	projectWithTurnEvents,
	baseEvent,
	getExtractorTemperature,
} from '../../utils';
import { applyStatusGating } from '../../utils/statusGating';
import { sortPair } from '../../../../state/relationships';
import { getRelationshipKey } from '../../../types/snapshot';
import { getMilestonesForPair, createSwipeContext } from '../../../store/projection';
import { debugLog } from '../../../../utils/debug';

/**
 * Status change per-pair event extractor.
 *
 * Analyzes messages to detect changes in the fundamental relationship status
 * between two specific characters.
 * Returns RelationshipStatusChangedEvent events.
 */
export const statusChangeExtractor: PerPairExtractor<ExtractedStatusChange> = {
	name: 'statusChange',
	displayName: 'status',
	category: 'relationships',
	defaultTemperature: 0.5,
	prompt: statusChangePrompt,

	messageStrategy: { strategy: 'fixedNumber', n: 8 } as MessageStrategy,
	runStrategy: {
		strategy: 'nSinceLastEventOfKind',
		n: 8,
		kinds: [{ kind: 'relationship', subkind: 'status_changed' }],
	} as RunStrategy,

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

		// Calculate message range based on strategy
		const messageCount = 4; // fixedNumber: 4
		const messageStart = Math.max(0, currentMessage.messageId - messageCount + 1);
		const messageEnd = currentMessage.messageId;

		// Build prompt with relationship pair context
		const builtPrompt = buildExtractorPrompt(
			statusChangePrompt,
			context,
			projection,
			settings,
			messageStart,
			messageEnd,
			{ relationshipPair: pair },
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'relationships',
			this.defaultTemperature,
		);

		// Generate and parse response
		const result = await generateAndParse(
			generator,
			statusChangePrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// Handle parsing failure
		if (!result.success || !result.data) {
			console.warn(
				`[BlazeTracker] statusChange extraction failed for pair ${pair[0]} and ${pair[1]}`,
			);
			return [];
		}

		const extraction = result.data;

		// If status hasn't changed, return empty array
		if (!extraction.changed || !extraction.newStatus) {
			return [];
		}

		// Get sorted pair for consistent lookups
		const sortedPair = sortPair(pair[0], pair[1]);

		// Get milestone subjects for this pair from the event store
		const swipeContext = createSwipeContext(
			context.chat.map(m => ({ swipe_id: m.swipe_id ?? 0 })),
		);
		const milestones = getMilestonesForPair(
			store.events,
			sortedPair[0],
			sortedPair[1],
			swipeContext,
			currentMessage.messageId,
		);
		const milestoneSubjects = new Set<Subject>(milestones.map(m => m.subject));

		// Get current relationship state
		const relationshipKey = getRelationshipKey(sortedPair);
		const currentRelationship = projection.relationships[relationshipKey];
		const currentStatus: RelationshipStatus =
			currentRelationship?.status ?? 'strangers';

		// Apply gating rules to constrain the proposed status
		const proposedStatus = extraction.newStatus as RelationshipStatus;
		const gatedStatus = applyStatusGating(
			proposedStatus,
			currentStatus,
			milestoneSubjects,
		);

		// If gated status equals current status, no change needed
		if (gatedStatus === currentStatus) {
			debugLog(
				`Status gating: ${proposedStatus} -> ${gatedStatus} (no change from ${currentStatus}) for ${pair[0]} and ${pair[1]}`,
			);
			return [];
		}

		// Log if gating constrained the status
		if (gatedStatus !== proposedStatus) {
			debugLog(
				`Status gating: ${proposedStatus} -> ${gatedStatus} for ${pair[0]} and ${pair[1]} (milestones: ${[...milestoneSubjects].join(', ') || 'none'})`,
			);
		}

		// Create the event with the gated status
		const event: RelationshipStatusChangedEvent = {
			...baseEvent(currentMessage),
			kind: 'relationship',
			subkind: 'status_changed',
			pair: sortedPair,
			newStatus: gatedStatus,
		};

		return [event];
	},
};
