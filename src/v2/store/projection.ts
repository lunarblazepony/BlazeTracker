/**
 * V2 Projection Helpers
 *
 * Utilities for working with projections.
 */

import type moment from 'moment';
import type {
	Event,
	NarrativeDescriptionEvent,
	RelationshipSubjectEvent,
	RelationshipEvent,
} from '../types/event';
import {
	isNarrativeDescriptionEvent,
	isRelationshipSubjectEvent,
	isRelationshipEvent,
	getRelationshipPair,
} from '../types/event';
import type { Subject } from '../types/subject';
import { isMilestoneWorthy } from '../types/subject';

/**
 * Map of subject to human-readable milestone display name.
 */
export const MILESTONE_DISPLAY_NAMES: Record<Subject, string> = {
	// Conversation & Social (not milestone-worthy, but included for completeness)
	conversation: 'Conversation',
	confession: 'Confession',
	argument: 'First Argument',
	negotiation: 'Negotiation',
	// Discovery & Information
	discovery: 'Discovery',
	secret_shared: 'Secret Shared',
	secret_revealed: 'Secret Revealed',
	// Emotional
	emotional: 'Emotional Moment',
	emotionally_intimate: 'Emotional Intimacy',
	supportive: 'First Support',
	rejection: 'Rejection',
	comfort: 'First Comfort',
	apology: 'Apology',
	forgiveness: 'Reconciliation',
	// Bonding & Connection
	laugh: 'First Laugh',
	gift: 'First Gift',
	compliment: 'First Compliment',
	tease: 'First Tease',
	flirt: 'First Flirt',
	date: 'First Date',
	i_love_you: 'First "I Love You"',
	sleepover: 'First Sleepover',
	shared_meal: 'First Shared Meal',
	shared_activity: 'First Shared Activity',
	// Intimacy Levels
	intimate_touch: 'First Touch',
	intimate_kiss: 'First Kiss',
	intimate_embrace: 'First Embrace',
	intimate_heated: 'First Heated Moment',
	// Sexual Activity
	intimate_foreplay: 'First Foreplay',
	intimate_oral: 'First Oral',
	intimate_manual: 'First Manual',
	intimate_penetrative: 'First Time',
	intimate_climax: 'First Climax',
	// Action & Physical
	action: 'Action',
	combat: 'First Conflict',
	danger: 'Danger',
	// Decisions & Commitments
	decision: 'Decision',
	promise: 'Promise Made',
	betrayal: 'Betrayal',
	lied: 'Lied',
	// Life Events
	exclusivity: 'Promised Exclusivity',
	marriage: 'Marriage',
	pregnancy: 'Pregnancy',
	childbirth: 'Had Child',
	// Social & Achievement
	social: 'Social',
	achievement: 'Achievement',
	// Support & Protection
	helped: 'First Help',
	common_interest: 'Common Interest',
	outing: 'First Outing',
	defended: 'Defended',
	crisis_together: 'Crisis Together',
	vulnerability: 'Vulnerability',
	shared_vulnerability: 'Shared Vulnerability',
	entrusted: 'Entrusted',
};

/**
 * Get the display name for a milestone subject.
 */
export function getMilestoneDisplayName(subject: Subject): string {
	return MILESTONE_DISPLAY_NAMES[subject] || subject.replace(/_/g, ' ');
}
import type {
	Projection,
	Snapshot,
	NarrativeEvent,
	NarrativeEventSubject,
} from '../types/snapshot';
import { createProjectionFromSnapshot } from '../types/snapshot';
import type { MessageAndSwipe, TensionLevel, TensionType } from '../types/common';
import { deserializeMoment } from '../types/common';
import { applyEventToProjection } from './eventApplication';
import { computeClimate } from './climateComputation';

/**
 * Context for determining canonical swipes.
 * In SillyTavern, each message can have multiple swipes (alternative responses).
 * Only the currently selected swipe is "canonical" and should be included in projections.
 */
export interface SwipeContext {
	/**
	 * Get the canonical swipe ID for a message.
	 * Returns the currently selected swipe index.
	 */
	getCanonicalSwipeId(messageId: number): number;
}

/**
 * Filter events to only include those from canonical swipes.
 *
 * @param events - All events
 * @param context - Swipe context for determining canonical swipes
 * @returns Events from canonical swipes only
 */
export function filterCanonicalEvents(events: readonly Event[], context: SwipeContext): Event[] {
	return events.filter(event => {
		const canonicalSwipeId = context.getCanonicalSwipeId(event.source.messageId);
		return event.source.swipeId === canonicalSwipeId;
	});
}

/**
 * Filter events up to and including a specific message.
 *
 * @param events - All events (should be sorted by messageId, timestamp)
 * @param upToMessage - Include events up to this message (inclusive)
 * @returns Filtered events
 */
export function filterEventsUpToMessage(events: readonly Event[], upToMessage: number): Event[] {
	return events.filter(event => event.source.messageId <= upToMessage);
}

/**
 * Filter events for a specific message.
 *
 * @param events - All events
 * @param messageId - The message ID to filter for
 * @returns Events for that message only
 */
export function filterEventsForMessage(events: readonly Event[], messageId: number): Event[] {
	return events.filter(event => event.source.messageId === messageId);
}

/**
 * Filter out deleted events.
 */
export function filterActiveEvents(events: readonly Event[]): Event[] {
	return events.filter(event => !event.deleted);
}

/**
 * State snapshot for a message, used for computing narrative events.
 */
interface MessageStateSnapshot {
	time: moment.Moment | null;
	charactersPresent: string[];
	location: string;
	tensionType: TensionType;
	tensionLevel: TensionLevel;
}

/**
 * Compute narrative events from a list of events.
 * Groups events by message and builds NarrativeEvent objects from
 * NarrativeDescriptionEvent, TensionEvent, and RelationshipSubjectEvent.
 * Witnesses and location are derived from the state at each message.
 */
function computeNarrativeEventsFromEvents(
	events: readonly Event[],
	currentChapter: number,
	getStateAtMessage: (messageId: number) => MessageStateSnapshot,
): NarrativeEvent[] {
	// Group events by messageId
	const eventsByMessage = new Map<number, Event[]>();
	for (const event of events) {
		const msgId = event.source.messageId;
		if (!eventsByMessage.has(msgId)) {
			eventsByMessage.set(msgId, []);
		}
		eventsByMessage.get(msgId)!.push(event);
	}

	const narrativeEvents: NarrativeEvent[] = [];

	// Process each message
	for (const [messageId, msgEvents] of eventsByMessage) {
		// Find narrative description event
		const descEvent = msgEvents.find(isNarrativeDescriptionEvent) as
			| NarrativeDescriptionEvent
			| undefined;
		if (!descEvent) continue;

		// Find relationship subject events
		const subjectEvents = msgEvents.filter(
			isRelationshipSubjectEvent,
		) as RelationshipSubjectEvent[];

		// Build subjects array
		const subjects: NarrativeEventSubject[] = subjectEvents.map(se => ({
			pair: se.pair,
			subject: se.subject,
			isMilestone: !!se.milestoneDescription,
			milestoneDescription: se.milestoneDescription,
		}));

		// Get state at this message to derive witnesses and location
		const stateSnapshot = getStateAtMessage(messageId);

		narrativeEvents.push({
			source: descEvent.source,
			description: descEvent.description,
			witnesses: stateSnapshot.charactersPresent,
			location: stateSnapshot.location,
			tension: {
				level: stateSnapshot.tensionLevel ?? 'relaxed',
				type: stateSnapshot.tensionType ?? 'conversation',
			},
			subjects,
			chapterIndex: currentChapter,
			narrativeTime: stateSnapshot.time,
		});
	}

	return narrativeEvents;
}

/**
 * Project state at a specific message by applying events to a snapshot.
 *
 * Climate is computed deterministically from forecasts + time + location,
 * not stored as an event. It's computed after all events are applied.
 *
 * @param snapshot - Starting snapshot
 * @param events - Events to apply (should be pre-filtered for canonical swipes and sorted)
 * @param source - The message/swipe we're projecting to
 * @returns The projected state
 */
export function projectFromSnapshot(
	snapshot: Snapshot,
	events: readonly Event[],
	source: MessageAndSwipe,
): Projection {
	const projection = createProjectionFromSnapshot(snapshot, source);

	// Track state at each message for narrative events (time, witnesses, location)
	const stateAtMessage = new Map<number, MessageStateSnapshot>();
	stateAtMessage.set(snapshot.source.messageId, {
		time: snapshot.time ? deserializeMoment(snapshot.time) : null,
		charactersPresent: Object.keys(snapshot.characters),
		location: [snapshot.location?.position, snapshot.location?.place]
			.filter(Boolean)
			.join(' · '),
		tensionType: snapshot.scene?.tension.type ?? 'conversation',
		tensionLevel: snapshot.scene?.tension.level ?? 'relaxed',
	});

	for (const event of events) {
		applyEventToProjection(projection, event);
		// Track state after each event application
		stateAtMessage.set(event.source.messageId, {
			time: projection.time ? projection.time.clone() : null,
			charactersPresent: [...projection.charactersPresent],
			location: [projection.location?.position, projection.location?.place]
				.filter(Boolean)
				.join(' · '),
			tensionType: projection.scene?.tension.type ?? 'conversation',
			tensionLevel: projection.scene?.tension.level ?? 'relaxed',
		});
	}

	// Compute climate from forecasts + time + location
	// Climate is a derived value, not stored as an event
	// If computeClimate returns null (no forecasts), preserve the snapshot's climate
	const computedClimate = computeClimate(
		projection.forecasts,
		projection.time,
		projection.location,
	);
	if (computedClimate) {
		projection.climate = computedClimate;
	}
	// If computedClimate is null, projection.climate keeps its value from the snapshot

	// Compute narrative events from the applied events and add to projection
	const newNarrativeEvents = computeNarrativeEventsFromEvents(
		events,
		projection.currentChapter,
		msgId =>
			stateAtMessage.get(msgId) ?? {
				time: null,
				charactersPresent: [],
				location: '',
				tensionType: 'conversation',
				tensionLevel: 'relaxed',
			},
	);
	projection.narrativeEvents = [...projection.narrativeEvents, ...newNarrativeEvents];

	return projection;
}

/**
 * Sort events by messageId and timestamp.
 * Events are sorted by:
 * 1. messageId (ascending)
 * 2. timestamp (ascending)
 */
export function sortEvents(events: Event[]): Event[] {
	return [...events].sort((a, b) => {
		if (a.source.messageId !== b.source.messageId) {
			return a.source.messageId - b.source.messageId;
		}
		return a.timestamp - b.timestamp;
	});
}

/**
 * Get the latest messageId from a list of events.
 */
export function getLatestMessageId(events: readonly Event[]): number | null {
	if (events.length === 0) return null;
	return Math.max(...events.map(e => e.source.messageId));
}

/**
 * Get the earliest messageId from a list of events.
 */
export function getEarliestMessageId(events: readonly Event[]): number | null {
	if (events.length === 0) return null;
	return Math.min(...events.map(e => e.source.messageId));
}

/**
 * Group events by messageId.
 */
export function groupEventsByMessage(events: readonly Event[]): Map<number, Event[]> {
	const groups = new Map<number, Event[]>();
	for (const event of events) {
		const messageId = event.source.messageId;
		if (!groups.has(messageId)) {
			groups.set(messageId, []);
		}
		groups.get(messageId)!.push(event);
	}
	return groups;
}

/**
 * A milestone for a relationship pair.
 */
export interface MilestoneInfo {
	/** Character pair (alphabetically sorted) */
	pair: [string, string];
	/** The subject/interaction type */
	subject: Subject;
	/** Description of the milestone (if generated) */
	description: string | undefined;
	/** Message ID where this milestone occurred */
	messageId: number;
}

/**
 * Normalize a character pair to alphabetical order.
 */
export function normalizePair(name1: string, name2: string): [string, string] {
	return name1 < name2 ? [name1, name2] : [name2, name1];
}

/**
 * Get all milestones for a relationship pair up to a specific message.
 *
 * A milestone is the first occurrence of each subject type for the pair
 * on the canonical path. If the event has a milestoneDescription, that's included.
 *
 * @param events - All events (should be active/non-deleted)
 * @param name1 - First character name
 * @param name2 - Second character name
 * @param context - Swipe context for canonical path filtering
 * @param upToMessage - Only consider events up to this message (inclusive)
 * @returns Array of milestones in chronological order
 */
export function getMilestonesForPair(
	events: readonly Event[],
	name1: string,
	name2: string,
	context: SwipeContext,
	upToMessage?: number,
): MilestoneInfo[] {
	const pair = normalizePair(name1, name2);

	// Filter to canonical events on the path
	const canonicalEvents = filterCanonicalEvents(events, context);

	// Filter to events up to the message (if specified)
	const filteredEvents =
		upToMessage !== undefined
			? filterEventsUpToMessage(canonicalEvents, upToMessage)
			: canonicalEvents;

	// Find RelationshipSubjectEvents for this pair that are milestone-worthy
	const subjectEvents = filteredEvents.filter(event => {
		if (!isRelationshipSubjectEvent(event)) return false;
		const se = event as RelationshipSubjectEvent;
		// Only include milestone-worthy subjects
		if (!isMilestoneWorthy(se.subject)) return false;
		return se.pair[0] === pair[0] && se.pair[1] === pair[1];
	}) as RelationshipSubjectEvent[];

	// Sort by messageId and timestamp to get chronological order
	subjectEvents.sort((a, b) => {
		if (a.source.messageId !== b.source.messageId) {
			return a.source.messageId - b.source.messageId;
		}
		return a.timestamp - b.timestamp;
	});

	// Find first occurrence of each subject
	const seenSubjects = new Set<Subject>();
	const milestones: MilestoneInfo[] = [];

	for (const event of subjectEvents) {
		if (!seenSubjects.has(event.subject)) {
			seenSubjects.add(event.subject);
			milestones.push({
				pair,
				subject: event.subject,
				description: event.milestoneDescription,
				messageId: event.source.messageId,
			});
		}
	}

	return milestones;
}

/**
 * Get all canonical, non-deleted relationship events for a specific character pair.
 *
 * CRITICAL: Filters to canonical swipe path first, then to active (non-deleted) events,
 * then to relationship events for the specified pair.
 *
 * @param events - All events in the store
 * @param pair - Character pair [name1, name2] (will be normalized)
 * @param context - Swipe context for canonical path filtering
 * @returns Array of relationship events for the pair
 */
export function getEventsForRelationshipPair(
	events: readonly Event[],
	pair: [string, string],
	context: SwipeContext,
): RelationshipEvent[] {
	const normalizedPair = normalizePair(pair[0], pair[1]);
	const pairKey = `${normalizedPair[0]}|${normalizedPair[1]}`;

	// 1. Filter to canonical swipe path first
	const canonicalEvents = filterCanonicalEvents(events, context);

	// 2. Filter to active (non-deleted) events
	const activeEvents = filterActiveEvents(canonicalEvents);

	// 3. Filter to relationship events for this pair
	return activeEvents.filter((event): event is RelationshipEvent => {
		if (!isRelationshipEvent(event)) return false;

		const eventPair = getRelationshipPair(event);
		const eventKey = `${eventPair[0]}|${eventPair[1]}`;
		return eventKey === pairKey;
	});
}

/**
 * Group relationship events by messageId, sorted by messageId descending (newest first).
 *
 * @param events - Relationship events (should already be filtered to canonical path)
 * @returns Array of groups with messageId, swipeId, and events
 */
export interface EventsByMessage {
	messageId: number;
	swipeId: number;
	events: RelationshipEvent[];
}

export function groupRelationshipEventsByMessage(events: RelationshipEvent[]): EventsByMessage[] {
	const groups = new Map<number, RelationshipEvent[]>();

	for (const event of events) {
		const msgId = event.source.messageId;
		if (!groups.has(msgId)) groups.set(msgId, []);
		groups.get(msgId)!.push(event);
	}

	return Array.from(groups.entries())
		.sort((a, b) => b[0] - a[0]) // Newest first
		.map(([messageId, evts]) => ({
			messageId,
			swipeId: evts[0]?.source.swipeId ?? 0,
			events: evts,
		}));
}

/**
 * Create a SwipeContext from a SillyTavern chat array.
 * Each message has a swipe_id property indicating the currently selected swipe.
 *
 * @param chat - Array of messages with swipe_id property
 * @returns SwipeContext for filtering events
 */
export function createSwipeContext(chat: { swipe_id: number }[]): SwipeContext {
	return {
		getCanonicalSwipeId: (messageId: number) => chat[messageId]?.swipe_id ?? 0,
	};
}
