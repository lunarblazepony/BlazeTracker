// ============================================
// Event Store - Central Event Management
// ============================================

// ============================================
// Deep Clone Helper
// ============================================

/**
 * Deep clone a UnifiedEventStore.
 * Used for temporary editing - edits are made to the clone,
 * and only committed to the real store on save.
 */
export function deepCloneEventStore(store: UnifiedEventStore): UnifiedEventStore {
	return JSON.parse(JSON.stringify(store));
}

import type {
	EventStore,
	NarrativeEvent,
	MilestoneType,
	EventType,
	DerivedRelationship,
	RelationshipStatus,
	UnifiedEventStore,
	StateEvent,
	ProjectedState,
	ProjectedCharacter,
	ProjectedRelationship,
	NarrativeDateTime,
	LocationState,
	CharacterOutfit,
	InitialTimeEvent,
	ForecastGeneratedEvent,
	TrackedState,
	Character,
	RelationshipAttitude,
	LocationPropEvent,
	CharacterEvent,
	RelationshipEvent,
	DirectionalRelationshipEvent,
	StatusChangedEvent,
	OutfitSlot,
} from '../types/state';
import { DAYS_OF_WEEK } from '../ui/constants';
import {
	EVENT_TYPE_TO_MILESTONE,
	isInitialTimeEvent,
	isTimeEvent,
	isLocationMovedEvent,
	isCharacterEvent,
	isLocationPropEvent,
	isForecastGeneratedEvent,
	isRelationshipEvent,
	isDirectionalRelationshipEvent,
	isStatusChangedEvent,
	isUnifiedEventStore,
} from '../types/state';
import type { LocationForecast } from '../weather/types';
import { sortPair, derivePair } from './relationships';

// ============================================
// Unified Event Store Access
// ============================================

/**
 * Type alias for either legacy EventStore or UnifiedEventStore.
 * Use this for functions that work with both store types.
 */
export type AnyEventStore = EventStore | UnifiedEventStore;

/**
 * Get the narrative events array from either store type.
 * - Legacy EventStore uses `events`
 * - UnifiedEventStore uses `narrativeEvents`
 */
export function getNarrativeEventsArray(store: AnyEventStore): NarrativeEvent[] {
	if (isUnifiedEventStore(store)) {
		return store.narrativeEvents;
	}
	return store.events;
}

// ============================================
// UUID Generation
// ============================================

/**
 * Generate a UUID v4 for event IDs.
 */
export function generateUUID(): string {
	// Use crypto.randomUUID if available, otherwise fallback
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	// Fallback for older environments
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

// ============================================
// Event Store Factory
// ============================================

/**
 * Create a new empty event store.
 */
export function createEventStore(): EventStore {
	return {
		events: [],
		version: 1,
	};
}

// ============================================
// Query Functions
// ============================================

/**
 * Get an event by its ID.
 * Returns null if not found or if deleted.
 */
export function getEvent(store: AnyEventStore, id: string): NarrativeEvent | null {
	const events = getNarrativeEventsArray(store);
	const event = events.find(e => e.id === id);
	if (!event || event.deleted) {
		return null;
	}
	return event;
}

/**
 * Get all active (non-deleted) events.
 */
export function getActiveEvents(store: AnyEventStore): NarrativeEvent[] {
	return getNarrativeEventsArray(store).filter(e => !e.deleted);
}

/**
 * Get events for a specific message and swipe.
 */
export function getEventsForMessage(
	store: AnyEventStore,
	messageId: number,
	swipeId: number,
): NarrativeEvent[] {
	return getNarrativeEventsArray(store).filter(
		e => !e.deleted && e.messageId === messageId && e.swipeId === swipeId,
	);
}

/**
 * Get events involving a specific character pair.
 * Handles pair order normalization.
 */
export function getEventsForPair(store: AnyEventStore, pair: [string, string]): NarrativeEvent[] {
	const sortedPair = sortPair(pair[0], pair[1]);
	const pairKey = sortedPair.join('|').toLowerCase();

	return getNarrativeEventsArray(store).filter(e => {
		if (e.deleted) return false;
		return e.affectedPairs.some(ap => {
			const apKey = sortPair(ap.pair[0], ap.pair[1]).join('|').toLowerCase();
			return apKey === pairKey;
		});
	});
}

/**
 * Get events for a specific chapter.
 */
export function getEventsForChapter(store: AnyEventStore, chapterIndex: number): NarrativeEvent[] {
	return getNarrativeEventsArray(store).filter(
		e => !e.deleted && e.chapterIndex === chapterIndex,
	);
}

/**
 * Get events that are not yet assigned to a chapter (current chapter events).
 */
export function getCurrentChapterEvents(store: AnyEventStore): NarrativeEvent[] {
	return getNarrativeEventsArray(store).filter(
		e => !e.deleted && e.chapterIndex === undefined,
	);
}

/**
 * Get events up to a specific message ID (for state projection).
 */
export function getEventsUpToMessage(store: AnyEventStore, messageId: number): NarrativeEvent[] {
	return getNarrativeEventsArray(store).filter(e => !e.deleted && e.messageId <= messageId);
}

// ============================================
// Mutation Functions
// ============================================

/**
 * Add a new event to the store.
 * Returns the generated event ID.
 */
export function addEvent(store: AnyEventStore, event: Omit<NarrativeEvent, 'id'>): string {
	const id = generateUUID();
	const newEvent: NarrativeEvent = {
		...event,
		id,
	};

	// Push to the appropriate array based on store type
	const events = getNarrativeEventsArray(store);
	events.push(newEvent);

	// Keep events sorted by messageId for consistent ordering
	events.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);

	return id;
}

/**
 * Update an existing event in the store.
 */
export function updateEvent(
	store: AnyEventStore,
	id: string,
	updates: Partial<Omit<NarrativeEvent, 'id'>>,
): boolean {
	const events = getNarrativeEventsArray(store);
	const event = events.find(e => e.id === id);
	if (!event) {
		return false;
	}

	Object.assign(event, updates);
	return true;
}

/**
 * Soft delete an event (sets deleted flag).
 */
export function deleteEvent(store: AnyEventStore, id: string): boolean {
	const events = getNarrativeEventsArray(store);
	const event = events.find(e => e.id === id);
	if (!event) {
		return false;
	}

	event.deleted = true;
	return true;
}

/**
 * Replace all events for a specific message and swipe.
 * Used during re-extraction.
 */
export function replaceEventsForMessage(
	store: AnyEventStore,
	messageId: number,
	swipeId: number,
	newEvents: Omit<NarrativeEvent, 'id'>[],
): string[] {
	// Soft delete existing events for this message+swipe
	const events = getNarrativeEventsArray(store);
	for (const event of events) {
		if (event.messageId === messageId && event.swipeId === swipeId && !event.deleted) {
			event.deleted = true;
		}
	}

	// Add new events
	const newIds: string[] = [];
	for (const event of newEvents) {
		const id = addEvent(store, event);
		newIds.push(id);
	}

	return newIds;
}

/**
 * Assign events to a chapter when the chapter closes.
 */
export function assignEventsToChapter(
	store: AnyEventStore,
	eventIds: string[],
	chapterIndex: number,
): void {
	const events = getNarrativeEventsArray(store);
	for (const id of eventIds) {
		const event = events.find(e => e.id === id);
		if (event && !event.deleted) {
			event.chapterIndex = chapterIndex;
		}
	}
}

// ============================================
// Milestone Management
// ============================================

/**
 * Create a normalized pair key for comparison.
 */
export function pairKey(pair: [string, string]): string {
	return sortPair(pair[0], pair[1]).join('|').toLowerCase();
}

/**
 * Recompute firstFor designations for all events from a starting message.
 * Call this after adding or deleting events.
 *
 * @param store The event store
 * @param fromMessageId Start recomputing from this message (0 for full recompute)
 * @param affectedPairs Set of pair keys to recompute (empty for all pairs)
 */
export function recomputeFirstFor(
	store: AnyEventStore,
	fromMessageId: number = 0,
	affectedPairs?: Set<string>,
): void {
	// Get all active events sorted by messageId
	const events = getActiveEvents(store).sort(
		(a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp,
	);

	// Track seen milestones per pair
	// Start by collecting milestones from events before fromMessageId
	const seenMilestones = new Map<string, Set<MilestoneType>>();

	for (const event of events) {
		if (event.messageId < fromMessageId) {
			// Collect existing milestones before the starting point
			for (const ap of event.affectedPairs) {
				const key = pairKey(ap.pair);
				if (affectedPairs && !affectedPairs.has(key)) continue;

				if (!seenMilestones.has(key)) {
					seenMilestones.set(key, new Set());
				}
				const seen = seenMilestones.get(key)!;

				// Record existing firstFor entries
				if (ap.firstFor) {
					for (const mt of ap.firstFor) {
						seen.add(mt);
					}
				}
			}
		} else {
			// Recompute firstFor for events from fromMessageId onward
			for (const ap of event.affectedPairs) {
				const key = pairKey(ap.pair);
				if (affectedPairs && !affectedPairs.has(key)) continue;

				if (!seenMilestones.has(key)) {
					seenMilestones.set(key, new Set());
				}
				const seen = seenMilestones.get(key)!;

				// Clear existing firstFor and recompute
				ap.firstFor = [];

				// Track which descriptions to keep
				const newDescriptions: Partial<Record<MilestoneType, string>> = {};

				// Check each event type for milestone potential
				for (const eventType of event.eventTypes) {
					const milestoneType = EVENT_TYPE_TO_MILESTONE[eventType];
					if (milestoneType && !seen.has(milestoneType)) {
						ap.firstFor.push(milestoneType);
						seen.add(milestoneType);
						// Preserve existing description if available
						if (ap.milestoneDescriptions?.[milestoneType]) {
							newDescriptions[milestoneType] =
								ap.milestoneDescriptions[
									milestoneType
								];
						}
					}
				}

				// Replace descriptions with filtered set (only keep descriptions for active milestones)
				if (Object.keys(newDescriptions).length > 0) {
					ap.milestoneDescriptions = newDescriptions;
				} else {
					delete ap.milestoneDescriptions;
				}

				// Remove empty firstFor arrays
				if (ap.firstFor.length === 0) {
					delete ap.firstFor;
				}
			}
		}
	}
}

/**
 * Promote the next eligible event to have a milestone designation.
 * Call this when an event with a milestone is deleted.
 */
export function promoteNextEventForMilestone(
	store: AnyEventStore,
	pair: [string, string],
	milestoneType: MilestoneType,
): boolean {
	const key = pairKey(pair);

	// Find the event type that triggers this milestone
	let triggeringEventType: EventType | null = null;
	for (const [et, mt] of Object.entries(EVENT_TYPE_TO_MILESTONE)) {
		if (mt === milestoneType) {
			triggeringEventType = et as EventType;
			break;
		}
	}

	if (!triggeringEventType) {
		return false;
	}

	// Find the next event that has this event type for this pair
	const events = getActiveEvents(store).sort(
		(a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp,
	);

	for (const event of events) {
		// Check if event has the triggering type
		if (!event.eventTypes.includes(triggeringEventType)) continue;

		// Check if this pair is in affectedPairs
		const ap = event.affectedPairs.find(p => pairKey(p.pair) === key);
		if (!ap) continue;

		// Check if this pair already has this milestone
		if (ap.firstFor?.includes(milestoneType)) continue;

		// Promote this event
		if (!ap.firstFor) {
			ap.firstFor = [];
		}
		ap.firstFor.push(milestoneType);
		return true;
	}

	return false;
}

// ============================================
// Relationship Projection
// ============================================

/**
 * Project a relationship from events for a specific pair.
 * This computes the current relationship state from the event history.
 */
export function projectRelationship(
	store: AnyEventStore,
	pair: [string, string],
): DerivedRelationship {
	const sortedPair = sortPair(pair[0], pair[1]);
	const key = pairKey(sortedPair);

	// Get all events for this pair
	const events = getEventsForPair(store, sortedPair);

	// Initialize empty relationship
	const relationship: DerivedRelationship = {
		pair: sortedPair,
		status: 'strangers',
		aToB: { feelings: [], secrets: [], wants: [] },
		bToA: { feelings: [], secrets: [], wants: [] },
		milestoneEventIds: [],
		history: [],
	};

	if (events.length === 0) {
		return relationship;
	}

	// Update status to acquaintances if there are any events
	relationship.status = 'acquaintances';

	// Collect milestone event IDs and aggregate changes
	const allAToB: string[] = [];
	const allBToA: string[] = [];

	for (const event of events) {
		const ap = event.affectedPairs.find(p => pairKey(p.pair) === key);
		if (!ap) continue;

		// Track milestone events
		if (ap.firstFor && ap.firstFor.length > 0) {
			relationship.milestoneEventIds.push(event.id);
		}

		// Aggregate changes
		if (ap.changes) {
			for (const change of ap.changes) {
				const fromLower = change.from.toLowerCase();
				const aLower = sortedPair[0].toLowerCase();

				if (fromLower === aLower) {
					if (!allAToB.includes(change.feeling)) {
						allAToB.push(change.feeling);
					}
				} else {
					if (!allBToA.includes(change.feeling)) {
						allBToA.push(change.feeling);
					}
				}
			}
		}
	}

	// Set feelings from aggregated changes
	relationship.aToB.feelings = allAToB;
	relationship.bToA.feelings = allBToA;

	// Compute status from milestones
	relationship.status = computeStatusFromMilestones(store, sortedPair);

	return relationship;
}

/**
 * Compute relationship status from milestone history.
 */
function computeStatusFromMilestones(
	store: AnyEventStore,
	pair: [string, string],
): RelationshipStatus {
	const events = getEventsForPair(store, pair);
	const key = pairKey(pair);

	// Collect all milestones
	const milestones = new Set<MilestoneType>();
	for (const event of events) {
		const ap = event.affectedPairs.find(p => pairKey(p.pair) === key);
		if (ap?.firstFor) {
			for (const mt of ap.firstFor) {
				milestones.add(mt);
			}
		}
	}

	// Determine status based on milestones
	// This is a simplified heuristic - could be made more sophisticated

	// Check for intimate-level milestones
	const intimateMilestones: MilestoneType[] = [
		'first_penetrative',
		'first_oral',
		'first_climax',
		'marriage',
		'promised_exclusivity',
	];
	if (intimateMilestones.some(m => milestones.has(m))) {
		return 'intimate';
	}

	// Check for close-level milestones
	const closeMilestones: MilestoneType[] = [
		'first_heated',
		'first_kiss',
		'emotional_intimacy',
		'first_vulnerability',
		'confession',
		'first_i_love_you',
	];
	if (closeMilestones.some(m => milestones.has(m))) {
		return 'close';
	}

	// Check for friendly-level milestones
	const friendlyMilestones: MilestoneType[] = [
		'first_laugh',
		'first_gift',
		'first_shared_meal',
		'first_shared_activity',
		'first_helped',
		'first_outing',
		'first_embrace',
		'first_touch',
	];
	if (friendlyMilestones.some(m => milestones.has(m))) {
		return 'friendly';
	}

	// Check for negative milestones
	if (milestones.has('betrayal') || milestones.has('promise_broken')) {
		return milestones.has('reconciliation') ? 'strained' : 'hostile';
	}

	if (milestones.has('first_conflict') || milestones.has('major_argument')) {
		return milestones.has('reconciliation') ? 'strained' : 'strained';
	}

	// Default progression
	if (milestones.has('first_meeting')) {
		return 'acquaintances';
	}

	return 'strangers';
}

/**
 * Compute all milestones for a pair from events.
 */
export function computeMilestonesForPair(
	store: AnyEventStore,
	pair: [string, string],
): Array<{ type: MilestoneType; eventId: string; description?: string }> {
	const events = getEventsForPair(store, pair);
	const key = pairKey(pair);

	const milestones: Array<{ type: MilestoneType; eventId: string; description?: string }> =
		[];

	for (const event of events) {
		const ap = event.affectedPairs.find(p => pairKey(p.pair) === key);
		if (!ap?.firstFor) continue;

		for (const mt of ap.firstFor) {
			milestones.push({
				type: mt,
				eventId: event.id,
				description: ap.milestoneDescriptions?.[mt],
			});
		}
	}

	return milestones;
}

/**
 * Compute all milestones for a specific event (by messageId).
 * Returns milestones from all affected pairs in that event.
 */
export function computeMilestonesForEvent(
	store: AnyEventStore,
	messageId: number,
): Array<{ type: MilestoneType; pair: [string, string]; description?: string }> {
	const events = getNarrativeEventsArray(store);
	const event = events.find(e => e.messageId === messageId && !e.deleted);

	if (!event) {
		return [];
	}

	const milestones: Array<{
		type: MilestoneType;
		pair: [string, string];
		description?: string;
	}> = [];

	for (const ap of event.affectedPairs) {
		if (!ap.firstFor) continue;

		for (const mt of ap.firstFor) {
			milestones.push({
				type: mt,
				pair: ap.pair,
				description: ap.milestoneDescriptions?.[mt],
			});
		}
	}

	return milestones;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get all unique character pairs from events.
 */
export function getAllPairsFromEvents(store: AnyEventStore): [string, string][] {
	const pairs = new Map<string, [string, string]>();

	for (const event of getActiveEvents(store)) {
		for (const ap of event.affectedPairs) {
			const sorted = sortPair(ap.pair[0], ap.pair[1]);
			const key = pairKey(sorted);
			if (!pairs.has(key)) {
				pairs.set(key, sorted);
			}
		}
	}

	return Array.from(pairs.values());
}

/**
 * Get event IDs for the current chapter (unassigned to any chapter).
 */
export function getCurrentChapterEventIds(store: AnyEventStore): string[] {
	return getCurrentChapterEvents(store).map(e => e.id);
}

/**
 * Check if the store has events.
 */
export function hasEvents(store: AnyEventStore): boolean {
	return getActiveEvents(store).length > 0;
}

/**
 * Get the count of active events.
 */
export function getEventCount(store: AnyEventStore): number {
	return getActiveEvents(store).length;
}

/**
 * Find the last messageId that has any event (state or narrative) in the store.
 * This is used to determine how far back to read messages for extraction context.
 * @param store The event store
 * @param beforeMessageId Optional: only consider events strictly before this messageId
 * @returns -1 if no events exist
 */
export function getLastMessageWithEvents(store: AnyEventStore, beforeMessageId?: number): number {
	let lastMessageId = -1;

	// Check narrative events
	const narrativeEvents = getActiveEvents(store);
	for (const event of narrativeEvents) {
		// Skip events at or after beforeMessageId if specified
		if (beforeMessageId !== undefined && event.messageId >= beforeMessageId) {
			continue;
		}
		if (event.messageId > lastMessageId) {
			lastMessageId = event.messageId;
		}
	}

	// Check state events if unified store
	if (isUnifiedEventStore(store)) {
		const stateEvents = getActiveStateEvents(store);
		for (const event of stateEvents) {
			// Skip events at or after beforeMessageId if specified
			if (beforeMessageId !== undefined && event.messageId >= beforeMessageId) {
				continue;
			}
			if (event.messageId > lastMessageId) {
				lastMessageId = event.messageId;
			}
		}
	}

	return lastMessageId;
}

// ============================================
// Phase 2: Unified Event Store
// ============================================

/**
 * Create a new unified event store (Phase 2).
 */
export function createUnifiedEventStore(): UnifiedEventStore {
	return {
		narrativeEvents: [],
		stateEvents: [],
		version: 2,
	};
}

/**
 * Convert a legacy EventStore to UnifiedEventStore.
 */
export function convertToUnifiedStore(legacy: EventStore): UnifiedEventStore {
	return {
		narrativeEvents: [...legacy.events],
		stateEvents: [],
		version: 2,
	};
}

// ============================================
// State Event CRUD
// ============================================

/**
 * Add a state event to the unified store.
 */
export function addStateEvent(store: UnifiedEventStore, event: Omit<StateEvent, 'id'>): string {
	const id = generateUUID();
	const newEvent = { ...event, id } as StateEvent;
	store.stateEvents.push(newEvent);

	// Keep sorted by messageId for consistent ordering
	store.stateEvents.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);

	return id;
}

/**
 * Get active state events (non-deleted).
 */
export function getActiveStateEvents(store: UnifiedEventStore): StateEvent[] {
	return store.stateEvents.filter(e => !e.deleted);
}

/**
 * Get state events for a specific message.
 */
export function getStateEventsForMessage(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
): StateEvent[] {
	return store.stateEvents.filter(
		e => !e.deleted && e.messageId === messageId && e.swipeId === swipeId,
	);
}

/** Minimal chat message type for swipe filtering */
export interface ChatMessageSwipeInfo {
	swipe_id?: number;
}

/**
 * Get state events up to (and including) a specific message.
 *
 * Events from previous messages are filtered to only include those matching each
 * message's canonical swipe_id from `chat`. This ensures we follow the "canonical
 * timeline" rather than merging all swipes. If a message is not in chat, swipeId 0
 * is used as the default.
 */
export function getStateEventsUpToMessage(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
	chat: ChatMessageSwipeInfo[],
): StateEvent[] {
	return store.stateEvents.filter(e => {
		if (e.deleted) return false;

		if (e.messageId === messageId) {
			// For the target message, use the provided swipeId
			return e.swipeId === swipeId;
		}

		if (e.messageId < messageId) {
			// For previous messages, filter by canonical swipe (defaults to 0 if not in chat)
			const canonicalSwipeId = chat[e.messageId]?.swipe_id ?? 0;
			return e.swipeId === canonicalSwipeId;
		}

		return false;
	});
}

/**
 * Delete state event (soft delete).
 */
export function deleteStateEvent(store: UnifiedEventStore, id: string): boolean {
	const event = store.stateEvents.find(e => e.id === id);
	if (!event) return false;
	event.deleted = true;
	return true;
}

/**
 * Get relationship events for a specific character pair.
 * Handles both directional events (pair derived from fromCharacter/towardCharacter)
 * and status events (explicit pair).
 */
export function getRelationshipEventsForPair(
	store: UnifiedEventStore,
	pair: [string, string],
): RelationshipEvent[] {
	const key = pairKey(pair);
	return store.stateEvents.filter((e): e is RelationshipEvent => {
		if (e.deleted || !isRelationshipEvent(e)) return false;

		// For status events, use explicit pair
		if (isStatusChangedEvent(e)) {
			return pairKey(e.pair) === key;
		}

		// For directional events, derive pair from characters
		if (isDirectionalRelationshipEvent(e)) {
			const derived = derivePair(e.fromCharacter, e.towardCharacter);
			return derived ? pairKey(derived) === key : false;
		}

		return false;
	});
}

/**
 * Update a relationship state event.
 */
export function updateRelationshipEvent(
	store: UnifiedEventStore,
	eventId: string,
	updates: Partial<RelationshipEvent>,
): boolean {
	const event = store.stateEvents.find(e => e.id === eventId);
	if (!event || !isRelationshipEvent(event)) return false;
	Object.assign(event, updates);
	return true;
}

/**
 * Project state before a specific message (i.e., the accumulated state from all previous messages).
 * This is used to determine if an event would actually change the state.
 *
 * @param store - The unified event store
 * @param messageId - The message we're projecting "before"
 * @param _swipeId - Unused (kept for API consistency)
 * @param chat - Optional chat array for canonical swipe filtering
 */
function projectStateBeforeMessage(
	store: UnifiedEventStore,
	messageId: number,
	_swipeId: number,
	chat: ChatMessageSwipeInfo[],
): ProjectedState {
	if (messageId <= 0) {
		// For message 0, there's no "before" state - use initial projection or empty
		return getInitialProjection(store) ?? createEmptyProjectedState();
	}

	// Get all events from messages strictly before this one
	const events = store.stateEvents.filter(e => {
		if (e.deleted) return false;
		if (e.messageId >= messageId) return false;

		// Filter by canonical swipe (defaults to 0 if not in chat)
		const canonicalSwipeId = chat[e.messageId]?.swipe_id ?? 0;
		return e.swipeId === canonicalSwipeId;
	});

	// Start from initial projection if available, otherwise empty state
	const initial = getInitialProjection(store);
	let state = initial ?? createEmptyProjectedState();

	for (const event of events) {
		state = applyStateEvent(state, event);
	}

	return state;
}

/**
 * Check if an event would actually change the projection (deduplication).
 * Returns the event (possibly modified) if it should be saved, or null if it's redundant.
 */
function deduplicateEvent(
	event: Omit<StateEvent, 'id'>,
	projection: ProjectedState,
): Omit<StateEvent, 'id'> | null {
	// Handle location prop events
	if (isLocationPropEvent(event as StateEvent)) {
		const propEvent = event as Omit<LocationPropEvent, 'id'>;
		const currentProps = projection.location?.props ?? [];

		if (propEvent.subkind === 'prop_added') {
			// Skip if prop already exists
			if (currentProps.includes(propEvent.prop)) {
				return null;
			}
		} else if (propEvent.subkind === 'prop_removed') {
			// Skip if prop doesn't exist
			if (!currentProps.includes(propEvent.prop)) {
				return null;
			}
		}
		return event;
	}

	// Handle character events
	if (isCharacterEvent(event as StateEvent)) {
		const charEvent = event as Omit<CharacterEvent, 'id'>;
		const character = projection.characters.get(charEvent.character);

		switch (charEvent.subkind) {
			case 'mood_added': {
				// Skip if mood already exists
				if (character?.mood.includes(charEvent.mood ?? '')) {
					return null;
				}
				break;
			}
			case 'mood_removed': {
				// Skip if mood doesn't exist
				if (!character?.mood.includes(charEvent.mood ?? '')) {
					return null;
				}
				break;
			}
			case 'physical_state_added': {
				// Skip if physical state already exists
				if (
					character?.physicalState.includes(
						charEvent.physicalState ?? '',
					)
				) {
					return null;
				}
				break;
			}
			case 'physical_state_removed': {
				// Skip if physical state doesn't exist
				if (
					!character?.physicalState.includes(
						charEvent.physicalState ?? '',
					)
				) {
					return null;
				}
				break;
			}
			case 'outfit_changed': {
				// Special handling for outfit changes
				if (charEvent.slot) {
					const slot = charEvent.slot as OutfitSlot;
					const currentValue = character?.outfit[slot] ?? null;

					// Skip if new value matches current projection
					if (charEvent.newValue === currentValue) {
						return null;
					}

					// Update previousValue to match what's actually in the projection
					return {
						...charEvent,
						previousValue: currentValue,
					} as Omit<CharacterEvent, 'id'>;
				}
				break;
			}
			case 'position_changed': {
				// Skip if position matches current projection
				if (charEvent.newValue === character?.position) {
					return null;
				}
				break;
			}
			case 'activity_changed': {
				// Skip if activity matches current projection
				if (charEvent.newValue === character?.activity) {
					return null;
				}
				break;
			}
			// 'appeared' and 'departed' are generally not deduplicated
			// since they represent explicit narrative events
		}
		return event;
	}

	// Handle relationship events
	if (isRelationshipEvent(event as StateEvent)) {
		const relEvent = event as Omit<RelationshipEvent, 'id'>;

		// Get pair based on event type
		let sortedPair: [string, string] | null = null;
		if (relEvent.subkind === 'status_changed') {
			const statusEvent = relEvent as Omit<StatusChangedEvent, 'id'>;
			sortedPair = sortPair(statusEvent.pair[0], statusEvent.pair[1]);
		} else {
			const dirEvent = relEvent as Omit<DirectionalRelationshipEvent, 'id'>;
			sortedPair = derivePair(dirEvent.fromCharacter, dirEvent.towardCharacter);
		}

		if (!sortedPair) return null;

		const key = pairKey(sortedPair);
		const relationship = projection.relationships.get(key);

		// Determine which attitude to check based on direction (for directional events)
		const getAttitude = (): {
			feelings: string[];
			secrets: string[];
			wants: string[];
		} | null => {
			if (relEvent.subkind === 'status_changed') return null;
			const dirEvent = relEvent as Omit<DirectionalRelationshipEvent, 'id'>;
			if (!relationship) return null;
			const fromLower = dirEvent.fromCharacter.toLowerCase();
			const aLower = relationship.pair[0].toLowerCase();
			return fromLower === aLower ? relationship.aToB : relationship.bToA;
		};

		const attitude = getAttitude();

		switch (relEvent.subkind) {
			case 'feeling_added': {
				// Skip if feeling already exists
				const dirEvent = relEvent as Omit<
					DirectionalRelationshipEvent,
					'id'
				>;
				if (attitude?.feelings.includes(dirEvent.value)) {
					return null;
				}
				break;
			}
			case 'feeling_removed': {
				// Skip if feeling doesn't exist
				const dirEvent = relEvent as Omit<
					DirectionalRelationshipEvent,
					'id'
				>;
				if (!attitude?.feelings.includes(dirEvent.value)) {
					return null;
				}
				break;
			}
			case 'secret_added': {
				// Skip if secret already exists
				const dirEvent = relEvent as Omit<
					DirectionalRelationshipEvent,
					'id'
				>;
				if (attitude?.secrets.includes(dirEvent.value)) {
					return null;
				}
				break;
			}
			case 'secret_removed': {
				// Skip if secret doesn't exist
				const dirEvent = relEvent as Omit<
					DirectionalRelationshipEvent,
					'id'
				>;
				if (!attitude?.secrets.includes(dirEvent.value)) {
					return null;
				}
				break;
			}
			case 'want_added': {
				// Skip if want already exists
				const dirEvent = relEvent as Omit<
					DirectionalRelationshipEvent,
					'id'
				>;
				if (attitude?.wants.includes(dirEvent.value)) {
					return null;
				}
				break;
			}
			case 'want_removed': {
				// Skip if want doesn't exist
				const dirEvent = relEvent as Omit<
					DirectionalRelationshipEvent,
					'id'
				>;
				if (!attitude?.wants.includes(dirEvent.value)) {
					return null;
				}
				break;
			}
			case 'status_changed': {
				// Skip if status matches current projection
				const statusEvent = relEvent as Omit<StatusChangedEvent, 'id'>;
				if (statusEvent.newStatus === relationship?.status) {
					return null;
				}
				break;
			}
		}
		return event;
	}

	// For other event types (time, location moved, etc.), don't deduplicate
	return event;
}

/**
 * Deduplicate a list of events against the current projection.
 * Returns only events that would actually change the state.
 *
 * @param store - The unified event store
 * @param messageId - Message ID for the events
 * @param swipeId - Swipe ID for the events
 * @param events - Events to deduplicate
 * @param chat - Optional chat array for canonical swipe filtering
 */
export function deduplicateEvents(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
	events: Omit<StateEvent, 'id'>[],
	chat: ChatMessageSwipeInfo[],
): Omit<StateEvent, 'id'>[] {
	// Project state before this message
	const projection = projectStateBeforeMessage(store, messageId, swipeId, chat);

	// Filter and transform events
	const dedupedEvents: Omit<StateEvent, 'id'>[] = [];

	for (const event of events) {
		const result = deduplicateEvent(event, projection);
		if (result !== null) {
			dedupedEvents.push(result);
		}
	}

	return dedupedEvents;
}

/**
 * Replace state events for a message during re-extraction.
 * Automatically deduplicates events that wouldn't change the state.
 */
export function replaceStateEventsForMessage(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
	newEvents: Omit<StateEvent, 'id'>[],
	chat: ChatMessageSwipeInfo[],
): string[] {
	// Soft delete existing events
	for (const event of store.stateEvents) {
		if (event.messageId === messageId && event.swipeId === swipeId && !event.deleted) {
			event.deleted = true;
		}
	}

	// Deduplicate events before adding
	const dedupedEvents = deduplicateEvents(store, messageId, swipeId, newEvents, chat);

	// Add deduplicated events
	return dedupedEvents.map(e => addStateEvent(store, e));
}

// ============================================
// State Projection
// ============================================

/**
 * Create an empty projected state.
 */
function createEmptyProjectedState(): ProjectedState {
	return {
		time: null,
		location: null,
		characters: new Map(),
		relationships: new Map(),
	};
}

/**
 * Create an empty character outfit.
 */
function createEmptyOutfit(): CharacterOutfit {
	return {
		head: null,
		neck: null,
		jacket: null,
		back: null,
		torso: null,
		legs: null,
		footwear: null,
		socks: null,
		underwear: null,
	};
}

/**
 * Get or create a projected character.
 */
function getOrCreateCharacter(state: ProjectedState, name: string): ProjectedCharacter {
	if (!state.characters.has(name)) {
		state.characters.set(name, {
			name,
			position: 'unknown',
			mood: [],
			physicalState: [],
			outfit: createEmptyOutfit(),
		});
	}
	return state.characters.get(name)!;
}

/**
 * Create an empty relationship attitude.
 */
function createEmptyAttitude(): RelationshipAttitude {
	return {
		feelings: [],
		secrets: [],
		wants: [],
	};
}

/**
 * Get or create a projected relationship.
 */
function getOrCreateRelationship(
	state: ProjectedState,
	pair: [string, string],
): ProjectedRelationship {
	const sortedPair = sortPair(pair[0], pair[1]);
	const key = pairKey(sortedPair);

	if (!state.relationships.has(key)) {
		state.relationships.set(key, {
			pair: sortedPair,
			status: 'strangers',
			aToB: createEmptyAttitude(),
			bToA: createEmptyAttitude(),
		});
	}
	return state.relationships.get(key)!;
}

/**
 * Apply a time delta to a NarrativeDateTime.
 */
function applyTimeDelta(
	baseTime: NarrativeDateTime,
	delta: { days: number; hours: number; minutes: number },
): NarrativeDateTime {
	// Convert to Date for easy manipulation
	const date = new Date(
		baseTime.year,
		baseTime.month - 1,
		baseTime.day,
		baseTime.hour,
		baseTime.minute,
		baseTime.second,
	);

	// Apply delta
	date.setMinutes(date.getMinutes() + delta.minutes);
	date.setHours(date.getHours() + delta.hours);
	date.setDate(date.getDate() + delta.days);

	return {
		year: date.getFullYear(),
		month: date.getMonth() + 1,
		day: date.getDate(),
		hour: date.getHours(),
		minute: date.getMinutes(),
		second: date.getSeconds(),
		dayOfWeek: DAYS_OF_WEEK[date.getDay()],
	};
}

/**
 * Apply a single state event to projected state.
 */
function applyStateEvent(state: ProjectedState, event: StateEvent): ProjectedState {
	if (isInitialTimeEvent(event)) {
		// InitialTimeEvent sets the absolute starting time
		return {
			...state,
			time: event.initialTime,
		};
	}

	if (isTimeEvent(event)) {
		// TimeEvent only stores delta - compute new time from current time + delta
		// If no current time, this is likely an error, but use a default
		const baseTime = state.time ?? {
			year: 2024,
			month: 1,
			day: 1,
			hour: 0,
			minute: 0,
			second: 0,
			dayOfWeek: 'Monday',
		};
		const newTime = applyTimeDelta(baseTime, event.delta);
		return {
			...state,
			time: newTime,
		};
	}

	if (isLocationMovedEvent(event)) {
		// Location moved - update area/place/position, preserve props
		const currentProps = state.location?.props ?? [];
		return {
			...state,
			location: {
				area: event.newArea,
				place: event.newPlace,
				position: event.newPosition,
				props: currentProps,
			},
		};
	}

	if (isCharacterEvent(event)) {
		const existingChar = getOrCreateCharacter(state, event.character);

		// Create a deep copy of the character to avoid mutating the source
		// (initialProjection or chapter snapshot)
		const char: ProjectedCharacter = {
			name: existingChar.name,
			position: existingChar.position,
			activity: existingChar.activity,
			mood: [...existingChar.mood],
			physicalState: [...existingChar.physicalState],
			outfit: { ...existingChar.outfit },
		};

		// Put the copy in the map (replaces the reference)
		state.characters.set(event.character, char);

		switch (event.subkind) {
			case 'appeared':
				// Character is already created by getOrCreateCharacter
				break;

			case 'departed':
				state.characters.delete(event.character);
				break;

			case 'position_changed':
				if (event.newValue !== null && event.newValue !== undefined) {
					char.position = event.newValue;
				}
				break;

			case 'activity_changed':
				char.activity = event.newValue ?? undefined;
				break;

			case 'mood_added':
				if (event.mood && !char.mood.includes(event.mood)) {
					char.mood.push(event.mood);
				}
				break;

			case 'mood_removed':
				if (event.mood) {
					char.mood = char.mood.filter(m => m !== event.mood);
				}
				break;

			case 'physical_state_added':
				if (
					event.physicalState &&
					!char.physicalState.includes(event.physicalState)
				) {
					char.physicalState.push(event.physicalState);
				}
				break;

			case 'physical_state_removed':
				if (event.physicalState) {
					char.physicalState = char.physicalState.filter(
						p => p !== event.physicalState,
					);
				}
				break;

			case 'outfit_changed':
				if (event.slot) {
					if (
						event.newValue === null ||
						event.newValue === undefined
					) {
						delete char.outfit[event.slot];
					} else {
						char.outfit[event.slot] = event.newValue;
					}
				}
				break;
		}
	}

	if (isLocationPropEvent(event)) {
		// Handle location prop changes
		// Ensure location exists (create new object to avoid mutating initialProjection)
		if (!state.location) {
			state.location = {
				area: 'Unknown',
				place: 'Unknown',
				position: 'Unknown',
				props: [],
			};
		} else {
			// Create a new location object to avoid mutating the source
			state.location = {
				...state.location,
				props: [...state.location.props],
			};
		}

		switch (event.subkind) {
			case 'prop_added':
				if (!state.location.props.includes(event.prop)) {
					state.location.props.push(event.prop);
				}
				break;

			case 'prop_removed':
				state.location.props = state.location.props.filter(
					p => p !== event.prop,
				);
				break;
		}
	}

	if (isRelationshipEvent(event)) {
		// Get pair based on event type
		let eventPair: [string, string] | null = null;
		if (isStatusChangedEvent(event)) {
			eventPair = event.pair;
		} else if (isDirectionalRelationshipEvent(event)) {
			eventPair = derivePair(event.fromCharacter, event.towardCharacter);
		}

		if (!eventPair) return state;

		const existingRel = getOrCreateRelationship(state, eventPair);

		// Create a deep copy of the relationship to avoid mutating the source
		// (initialProjection or chapter snapshot)
		const rel: ProjectedRelationship = {
			pair: existingRel.pair,
			status: existingRel.status,
			aToB: {
				feelings: [...existingRel.aToB.feelings],
				secrets: [...existingRel.aToB.secrets],
				wants: [...existingRel.aToB.wants],
			},
			bToA: {
				feelings: [...existingRel.bToA.feelings],
				secrets: [...existingRel.bToA.secrets],
				wants: [...existingRel.bToA.wants],
			},
		};

		// Put the copy in the map (replaces the reference)
		const key = pairKey(rel.pair);
		state.relationships.set(key, rel);

		// Determine which attitude to modify based on direction (for directional events)
		const getAttitude = (): RelationshipAttitude | null => {
			if (!isDirectionalRelationshipEvent(event)) return null;
			const fromLower = event.fromCharacter.toLowerCase();
			const aLower = rel.pair[0].toLowerCase();
			return fromLower === aLower ? rel.aToB : rel.bToA;
		};

		switch (event.subkind) {
			case 'feeling_added': {
				const attitude = getAttitude();
				const dirEvent = event as DirectionalRelationshipEvent;
				if (attitude && !attitude.feelings.includes(dirEvent.value)) {
					attitude.feelings.push(dirEvent.value);
				}
				break;
			}

			case 'feeling_removed': {
				const attitude = getAttitude();
				const dirEvent = event as DirectionalRelationshipEvent;
				if (attitude) {
					attitude.feelings = attitude.feelings.filter(
						f => f !== dirEvent.value,
					);
				}
				break;
			}

			case 'secret_added': {
				const attitude = getAttitude();
				const dirEvent = event as DirectionalRelationshipEvent;
				if (attitude && !attitude.secrets.includes(dirEvent.value)) {
					attitude.secrets.push(dirEvent.value);
				}
				break;
			}

			case 'secret_removed': {
				const attitude = getAttitude();
				const dirEvent = event as DirectionalRelationshipEvent;
				if (attitude) {
					attitude.secrets = attitude.secrets.filter(
						s => s !== dirEvent.value,
					);
				}
				break;
			}

			case 'want_added': {
				const attitude = getAttitude();
				const dirEvent = event as DirectionalRelationshipEvent;
				if (attitude && !attitude.wants.includes(dirEvent.value)) {
					attitude.wants.push(dirEvent.value);
				}
				break;
			}

			case 'want_removed': {
				const attitude = getAttitude();
				const dirEvent = event as DirectionalRelationshipEvent;
				if (attitude) {
					attitude.wants = attitude.wants.filter(
						w => w !== dirEvent.value,
					);
				}
				break;
			}

			case 'status_changed': {
				const statusEvent = event as StatusChangedEvent;
				rel.status = statusEvent.newStatus;
				break;
			}
		}
	}

	return state;
}

/**
 * Project state at a specific message by folding events.
 * Uses initialProjection as the starting point if available.
 *
 * @param store - The unified event store
 * @param messageId - Target message ID
 * @param swipeId - Swipe ID for the target message
 * @param chat - Optional chat array for canonical swipe filtering of previous messages
 */
export function projectStateAtMessage(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
	chat: ChatMessageSwipeInfo[],
): ProjectedState {
	const events = getStateEventsUpToMessage(store, messageId, swipeId, chat);

	// Start from initial projection if available, otherwise empty state
	const initial = getInitialProjection(store);
	let state = initial ?? createEmptyProjectedState();

	for (const event of events) {
		state = applyStateEvent(state, event);
	}

	return state;
}

/**
 * Get the current projected state (latest message in the chat).
 *
 * @param store - The unified event store
 * @param chat - Chat array for canonical swipe filtering (required)
 */
export function projectCurrentState(
	store: UnifiedEventStore,
	chat: ChatMessageSwipeInfo[],
): ProjectedState {
	if (chat.length === 0) {
		return createEmptyProjectedState();
	}

	// Project at the last message using its canonical swipe
	const lastMessageId = chat.length - 1;
	const lastSwipeId = chat[lastMessageId]?.swipe_id ?? 0;

	return projectStateAtMessage(store, lastMessageId, lastSwipeId, chat);
}

// ============================================
// Projection to TrackedState Conversion
// ============================================

/**
 * Convert a ProjectedState to TrackedState format for display.
 * This is the bridge between the event-sourced projection system
 * and the existing display components that expect TrackedState.
 *
 * Note: This only converts time, location, and characters.
 * Climate is derived separately from time + location + forecasts.
 * Scene, currentChapter, currentEvents, and chapterEnded are
 * populated from other sources.
 */
export function convertProjectionToTrackedState(projection: ProjectedState): Partial<TrackedState> {
	const result: Partial<TrackedState> = {};

	// Convert time (null → undefined for TrackedState)
	if (projection.time) {
		result.time = projection.time;
	}

	// Convert location (null → undefined for TrackedState)
	if (projection.location) {
		result.location = projection.location;
	}

	// Convert characters Map to array
	if (projection.characters.size > 0) {
		result.characters = Array.from(projection.characters.values()).map(
			(pc: ProjectedCharacter): Character => ({
				name: pc.name,
				position: pc.position,
				activity: pc.activity,
				mood: pc.mood,
				physicalState:
					pc.physicalState.length > 0 ? pc.physicalState : undefined,
				outfit: pc.outfit,
			}),
		);
	}

	return result;
}

/**
 * Convert a TrackedState (or partial) to a ProjectedState.
 * Useful for initializing projections from existing extracted state.
 */
export function convertTrackedStateToProjection(tracked: Partial<TrackedState>): ProjectedState {
	const characters = new Map<string, ProjectedCharacter>();

	for (const char of tracked.characters ?? []) {
		characters.set(char.name, {
			name: char.name,
			position: char.position,
			activity: char.activity,
			mood: char.mood ?? [],
			physicalState: char.physicalState ?? [],
			outfit: char.outfit ?? createEmptyOutfit(),
		});
	}

	return {
		time: tracked.time ?? null,
		location: tracked.location ?? null,
		characters,
		relationships: new Map(),
	};
}

// ============================================
// State Event Generation (for extraction)
// ============================================

/** Input character for state diff generation */
interface DiffCharacter {
	name: string;
	position?: string;
	activity?: string;
	mood?: string[];
	physicalState?: string[];
	outfit?: Partial<CharacterOutfit>;
}

/**
 * Generate state events by diffing previous and current state.
 * Used during extraction to create fine-grained events.
 */
export function generateStateEventsFromDiff(
	messageId: number,
	swipeId: number,
	prev: ProjectedState | null,
	curr: {
		time?: NarrativeDateTime | null;
		location?: LocationState | null;
		characters?: DiffCharacter[];
	},
): StateEvent[] {
	const events: StateEvent[] = [];
	const timestamp = Date.now();

	// Time change
	if (curr.time && !timeEquals(prev?.time ?? null, curr.time)) {
		if (!prev?.time) {
			// Initial time - store absolute time
			events.push({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'time_initial',
				initialTime: curr.time,
			} as InitialTimeEvent);
		} else {
			// Subsequent time - only store delta
			const delta = computeTimeDelta(prev.time, curr.time);
			events.push({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'time',
				delta,
			});
		}
	}

	// Location move (area/place/position change - props are handled separately by extractLocationProps)
	if (
		curr.location &&
		(prev?.location?.area !== curr.location.area ||
			prev?.location?.place !== curr.location.place ||
			prev?.location?.position !== curr.location.position)
	) {
		events.push({
			id: generateUUID(),
			messageId,
			swipeId,
			timestamp,
			kind: 'location',
			subkind: 'moved',
			newArea: curr.location.area,
			newPlace: curr.location.place,
			newPosition: curr.location.position,
			previousArea: prev?.location?.area,
			previousPlace: prev?.location?.place,
			previousPosition: prev?.location?.position,
		});
	}

	// Character changes
	const prevChars = prev?.characters ?? new Map<string, ProjectedCharacter>();
	const currChars = new Map<string, DiffCharacter>();

	for (const char of curr.characters ?? []) {
		currChars.set(char.name, char);
	}

	// Process current characters
	for (const [name, char] of currChars) {
		const prevChar = prevChars.get(name);

		// New character appeared
		if (!prevChar) {
			events.push({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'character',
				subkind: 'appeared',
				character: name,
			});
		}

		// Position changed
		if (char.position && char.position !== prevChar?.position) {
			events.push({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'character',
				subkind: 'position_changed',
				character: name,
				newValue: char.position,
				previousValue: prevChar?.position,
			});
		}

		// Activity changed
		if (char.activity !== prevChar?.activity) {
			events.push({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'character',
				subkind: 'activity_changed',
				character: name,
				newValue: char.activity ?? null,
				previousValue: prevChar?.activity ?? null,
			});
		}

		// Mood changes
		const prevMoods = new Set(prevChar?.mood ?? []);
		const currMoods = new Set(char.mood ?? []);

		for (const mood of currMoods) {
			if (!prevMoods.has(mood)) {
				events.push({
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp,
					kind: 'character',
					subkind: 'mood_added',
					character: name,
					mood,
				});
			}
		}
		for (const mood of prevMoods) {
			if (!currMoods.has(mood)) {
				events.push({
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp,
					kind: 'character',
					subkind: 'mood_removed',
					character: name,
					mood,
				});
			}
		}

		// Physical state changes
		const prevPhysical = new Set(prevChar?.physicalState ?? []);
		const currPhysical = new Set(char.physicalState ?? []);

		for (const ps of currPhysical) {
			if (!prevPhysical.has(ps)) {
				events.push({
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp,
					kind: 'character',
					subkind: 'physical_state_added',
					character: name,
					physicalState: ps,
				});
			}
		}
		for (const ps of prevPhysical) {
			if (!currPhysical.has(ps)) {
				events.push({
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp,
					kind: 'character',
					subkind: 'physical_state_removed',
					character: name,
					physicalState: ps,
				});
			}
		}

		// Outfit changes
		const outfitSlots: Array<keyof CharacterOutfit> = [
			'head',
			'neck',
			'jacket',
			'back',
			'torso',
			'legs',
			'footwear',
			'socks',
			'underwear',
		];

		for (const slot of outfitSlots) {
			const prevItem = prevChar?.outfit?.[slot];
			const currItem = char.outfit?.[slot];

			if (prevItem !== currItem) {
				events.push({
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp,
					kind: 'character',
					subkind: 'outfit_changed',
					character: name,
					slot,
					newValue: currItem ?? null,
					previousValue: prevItem ?? null,
				});
			}
		}
	}

	// Characters who departed
	for (const [name] of prevChars) {
		if (!currChars.has(name)) {
			events.push({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'character',
				subkind: 'departed',
				character: name,
			});
		}
	}

	return events;
}

/**
 * Check if two times are equal.
 */
function timeEquals(a: NarrativeDateTime | null, b: NarrativeDateTime | null): boolean {
	if (a === null && b === null) return true;
	if (a === null || b === null) return false;
	return (
		a.year === b.year &&
		a.month === b.month &&
		a.day === b.day &&
		a.hour === b.hour &&
		a.minute === b.minute &&
		a.second === b.second
	);
}

/**
 * Check if two locations are equal.
 */
function _locationEquals(a: LocationState | null, b: LocationState | null): boolean {
	if (a === null && b === null) return true;
	if (a === null || b === null) return false;
	return (
		a.area === b.area &&
		a.place === b.place &&
		a.position === b.position &&
		JSON.stringify(a.props.sort()) === JSON.stringify(b.props.sort())
	);
}

/**
 * Compute time delta between two times.
 */
function computeTimeDelta(
	from: NarrativeDateTime,
	to: NarrativeDateTime,
): { days: number; hours: number; minutes: number } {
	// Simple calculation - treats each month as 30 days for simplicity
	const fromMinutes =
		from.year * 365 * 24 * 60 +
		from.month * 30 * 24 * 60 +
		from.day * 24 * 60 +
		from.hour * 60 +
		from.minute;

	const toMinutes =
		to.year * 365 * 24 * 60 +
		to.month * 30 * 24 * 60 +
		to.day * 24 * 60 +
		to.hour * 60 +
		to.minute;

	const diffMinutes = toMinutes - fromMinutes;

	const days = Math.floor(diffMinutes / (24 * 60));
	const hours = Math.floor((diffMinutes % (24 * 60)) / 60);
	const minutes = diffMinutes % 60;

	return { days, hours, minutes };
}

// ============================================
// Event Editing Helpers (for NarrativeModal)
// ============================================

/**
 * Update a narrative event in place.
 * Used for editing events from the NarrativeModal.
 */
export function updateNarrativeEvent(
	store: AnyEventStore,
	eventId: string,
	updates: Partial<Omit<NarrativeEvent, 'id'>>,
): boolean {
	const events = getNarrativeEventsArray(store);
	const idx = events.findIndex(e => e.id === eventId);
	if (idx === -1) {
		return false;
	}
	events[idx] = { ...events[idx], ...updates };
	return true;
}

/**
 * Re-project all relationships from events.
 * Call this after adding, updating, or deleting events to refresh relationships.
 *
 * NOTE: This only uses NarrativeEvents for milestone-based status computation.
 * It does NOT apply RelationshipEvents (StateEvents like feeling_added, status_changed).
 * Use projectRelationshipsFromCurrentState() for full projection including StateEvents.
 */
export function reProjectRelationshipsFromEvents(store: AnyEventStore): DerivedRelationship[] {
	const pairs = getAllPairsFromEvents(store);
	return pairs.map(pair => projectRelationship(store, pair));
}

/**
 * Project all relationships from current state including RelationshipEvents.
 * This uses projectCurrentState() which applies all StateEvents including
 * feeling_added, feeling_removed, status_changed, etc.
 *
 * Use this when editing relationship events to see accurate projections.
 *
 * @param store - The unified event store
 * @param chat - Chat array for canonical swipe filtering (required)
 */
export function projectRelationshipsFromCurrentState(
	store: UnifiedEventStore,
	chat: ChatMessageSwipeInfo[],
): ProjectedRelationship[] {
	const projectedState = projectCurrentState(store, chat);
	return Array.from(projectedState.relationships.values());
}

/**
 * Get narrative events for a specific chapter.
 * Alias for getEventsForChapter but returns events with narrative context.
 */
export function getNarrativeEventsForChapter(
	store: AnyEventStore,
	chapterIndex: number,
): NarrativeEvent[] {
	return getEventsForChapter(store, chapterIndex);
}

/**
 * Get narrative events for a specific character pair.
 * Alias for getEventsForPair but with clearer naming.
 */
export function getNarrativeEventsForPair(
	store: AnyEventStore,
	pair: [string, string],
): NarrativeEvent[] {
	return getEventsForPair(store, pair);
}

// ============================================
// Event-Sourced Projection System (Phase 4)
// ============================================

/**
 * Check if there are any earlier events or projections before the given messageId.
 * This is used to determine whether to show StateEditor (initial projection) or
 * EventEditor (subsequent messages).
 *
 * **IMPORTANT:** Cannot rely on messageId === 1 to identify initial projection.
 * Users may start state tracking mid-roleplay. Must check for actual earlier events.
 */
export function hasEarlierEventsOrProjections(
	store: UnifiedEventStore,
	messageId: number,
): boolean {
	// Check if there's an initial projection stored
	if (store.initialProjection) {
		return true;
	}

	// Check if any state events exist with messageId < current
	const hasEarlierStateEvents = store.stateEvents.some(
		e => !e.deleted && e.messageId < messageId,
	);
	if (hasEarlierStateEvents) {
		return true;
	}

	// Check if any narrative events exist with messageId < current
	const hasEarlierNarrativeEvents = store.narrativeEvents.some(
		e => !e.deleted && e.messageId < messageId,
	);

	return hasEarlierNarrativeEvents;
}

/**
 * Invalidate cached projections from a specific messageId onward.
 * Call this when events are edited/deleted/added.
 */
export function invalidateProjectionsFrom(store: UnifiedEventStore, messageId: number): void {
	// Mark the invalidation point
	if (store.projectionInvalidFrom === undefined || messageId < store.projectionInvalidFrom) {
		store.projectionInvalidFrom = messageId;
	}
}

/**
 * Check if projections for a messageId are potentially stale.
 */
export function isProjectionInvalidated(store: UnifiedEventStore, messageId: number): boolean {
	if (store.projectionInvalidFrom === undefined) {
		return false;
	}
	return messageId >= store.projectionInvalidFrom;
}

/**
 * Clear projection invalidation (after re-rendering).
 */
export function clearProjectionInvalidation(store: UnifiedEventStore): void {
	delete store.projectionInvalidFrom;
}

// ============================================
// Swipe Handling (Phase 5)
// ============================================

/**
 * Clear all events for a specific messageId (soft delete).
 * Used when swiping to a new response.
 *
 * @param store The unified event store
 * @param messageId The message ID to clear events for
 */
export function clearEventsForMessage(store: UnifiedEventStore, messageId: number): void {
	// Soft delete all state events for this messageId
	for (const event of store.stateEvents) {
		if (event.messageId === messageId && !event.deleted) {
			event.deleted = true;
		}
	}

	// Soft delete all narrative events for this messageId
	for (const event of store.narrativeEvents) {
		if (event.messageId === messageId && !event.deleted) {
			event.deleted = true;
		}
	}
}

/**
 * Invalidate chapter snapshots from a specific messageId onward.
 * Call this when events are edited/deleted/added or when swiping.
 *
 * @param store The unified event store
 * @param messageId The message ID from which to invalidate snapshots
 */
export function invalidateSnapshotsFrom(store: UnifiedEventStore, messageId: number): void {
	if (!store.chapterSnapshots || store.chapterSnapshots.length === 0) {
		return;
	}

	// Remove all snapshots where the boundary messageId is >= the invalidation point
	store.chapterSnapshots = store.chapterSnapshots.filter(s => s.messageId < messageId);
}

/**
 * Save initial projection (for first extraction with no prior events).
 */
export function setInitialProjection(store: UnifiedEventStore, projection: ProjectedState): void {
	// Normalize relationship keys to lowercase for consistent lookups
	const normalizedRelationships: Record<string, ProjectedRelationship> = {};
	for (const [key, rel] of projection.relationships) {
		const normalizedKey = key.toLowerCase();
		normalizedRelationships[normalizedKey] = rel;
	}

	store.initialProjection = {
		time: projection.time,
		location: projection.location,
		characters: Object.fromEntries(projection.characters),
		relationships: normalizedRelationships,
	};
}

/**
 * Get initial projection if set.
 */
export function getInitialProjection(store: UnifiedEventStore): ProjectedState | null {
	if (!store.initialProjection) {
		return null;
	}

	// Convert serializable form back to ProjectedState
	return {
		time: store.initialProjection.time,
		location: store.initialProjection.location,
		characters: new Map(Object.entries(store.initialProjection.characters)),
		relationships: new Map(Object.entries(store.initialProjection.relationships ?? {})),
	};
}

/**
 * Save a chapter snapshot for projection performance.
 */
export function saveChapterSnapshot(
	store: UnifiedEventStore,
	chapterIndex: number,
	messageId: number,
	swipeId: number,
	projection: ProjectedState,
): void {
	if (!store.chapterSnapshots) {
		store.chapterSnapshots = [];
	}

	// Remove any existing snapshot for this chapter
	store.chapterSnapshots = store.chapterSnapshots.filter(
		s => s.chapterIndex !== chapterIndex,
	);

	// Normalize relationship keys to lowercase for consistent lookups
	const normalizedRelationships: Record<string, ProjectedRelationship> = {};
	for (const [key, rel] of projection.relationships) {
		const normalizedKey = key.toLowerCase();
		normalizedRelationships[normalizedKey] = rel;
	}

	// Add new snapshot
	store.chapterSnapshots.push({
		chapterIndex,
		messageId,
		swipeId,
		projection: {
			time: projection.time,
			location: projection.location,
			characters: Object.fromEntries(projection.characters),
			relationships: normalizedRelationships,
		},
	});

	// Keep sorted by chapter index
	store.chapterSnapshots.sort((a, b) => a.chapterIndex - b.chapterIndex);
}

/**
 * Find the nearest chapter snapshot before a messageId.
 * Returns null if no applicable snapshot exists.
 */
export function findChapterSnapshotBefore(
	store: UnifiedEventStore,
	messageId: number,
): { snapshot: ProjectedState; messageId: number; swipeId: number } | null {
	if (!store.chapterSnapshots || store.chapterSnapshots.length === 0) {
		return null;
	}

	// Find the most recent snapshot that's before the target messageId
	let bestSnapshot = null;
	for (const snapshot of store.chapterSnapshots) {
		if (snapshot.messageId < messageId) {
			bestSnapshot = snapshot;
		}
	}

	if (!bestSnapshot) {
		return null;
	}

	return {
		snapshot: {
			time: bestSnapshot.projection.time,
			location: bestSnapshot.projection.location,
			characters: new Map(Object.entries(bestSnapshot.projection.characters)),
			relationships: new Map(
				Object.entries(bestSnapshot.projection.relationships ?? {}),
			),
		},
		messageId: bestSnapshot.messageId,
		swipeId: bestSnapshot.swipeId,
	};
}

/**
 * Optimized projection that uses chapter snapshots when available.
 * Falls back to full replay if no applicable snapshot exists.
 *
 * @param store - The unified event store
 * @param messageId - Target message ID
 * @param swipeId - Swipe ID for the target message
 * @param chat - Optional chat array for canonical swipe filtering of previous messages
 */
export function projectStateOptimized(
	store: UnifiedEventStore,
	messageId: number,
	swipeId: number,
	chat: ChatMessageSwipeInfo[],
): ProjectedState {
	// Check for initial projection if this is the first message
	const initial = getInitialProjection(store);
	if (initial && messageId === 0) {
		return initial;
	}

	// Try to find a chapter snapshot we can start from
	const snapshotInfo = findChapterSnapshotBefore(store, messageId);

	let startState: ProjectedState;
	let startMessageId: number;

	if (snapshotInfo) {
		// Start from the snapshot
		startState = snapshotInfo.snapshot;
		startMessageId = snapshotInfo.messageId + 1;
	} else if (initial) {
		// Start from initial projection
		startState = initial;
		startMessageId = 1;
	} else {
		// Full replay from scratch
		startState = createEmptyProjectedState();
		startMessageId = 0;
	}

	// Get events from the starting point
	const events = store.stateEvents.filter(e => {
		if (e.deleted) return false;
		if (e.messageId < startMessageId) return false;

		if (e.messageId === messageId) {
			// For the target message, use the provided swipeId
			return e.swipeId === swipeId;
		}

		if (e.messageId < messageId) {
			// For previous messages, check canonical swipe if chat is provided
			if (chat && chat[e.messageId]) {
				const canonicalSwipeId = chat[e.messageId].swipe_id ?? 0;
				return e.swipeId === canonicalSwipeId;
			}
			// Legacy behavior: include all swipes when chat not provided
			return true;
		}

		return false;
	});

	// Sort by messageId, then timestamp
	events.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);

	// Apply events
	let state = startState;
	for (const event of events) {
		state = applyStateEvent(state, event);
	}

	return state;
}

// ============================================
// Forecast Event Functions (Phase 3)
// ============================================

/**
 * Add a forecast event to the store.
 * Creates a ForecastGeneratedEvent when a new forecast is generated.
 */
export function addForecastEvent(
	store: UnifiedEventStore,
	areaName: string,
	forecast: LocationForecast,
	messageId: number,
	swipeId: number,
): string {
	const event: ForecastGeneratedEvent = {
		id: generateUUID(),
		messageId,
		swipeId,
		timestamp: Date.now(),
		kind: 'forecast_generated',
		areaName,
		forecast,
	};

	store.stateEvents.push(event);

	// Keep sorted by messageId
	store.stateEvents.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);

	return event.id;
}

/**
 * Get the latest forecast for a specific area from event store.
 * Returns null if no forecast exists for this area.
 */
export function getLatestForecastForArea(
	store: UnifiedEventStore,
	areaName: string,
): LocationForecast | null {
	// Find most recent ForecastGeneratedEvent for this area
	const areaLower = areaName.toLowerCase();

	const forecastEvents = store.stateEvents.filter(
		(e): e is ForecastGeneratedEvent =>
			!e.deleted &&
			isForecastGeneratedEvent(e) &&
			e.areaName.toLowerCase() === areaLower,
	);

	if (forecastEvents.length === 0) {
		return null;
	}

	// Sort by messageId descending to get most recent
	forecastEvents.sort((a, b) => b.messageId - a.messageId || b.timestamp - a.timestamp);

	return forecastEvents[0].forecast;
}

/**
 * Get all forecast events from the store.
 * Returns array of area names with their most recent forecasts.
 */
export function getAllForecastsFromEvents(
	store: UnifiedEventStore,
): Array<{ areaName: string; forecast: LocationForecast; messageId: number }> {
	// Group by area name, keeping only the most recent for each
	const forecastMap = new Map<
		string,
		{ areaName: string; forecast: LocationForecast; messageId: number }
	>();

	for (const event of store.stateEvents) {
		if (event.deleted || !isForecastGeneratedEvent(event)) continue;

		const areaLower = event.areaName.toLowerCase();
		const existing = forecastMap.get(areaLower);

		// Keep the most recent (highest messageId)
		if (!existing || event.messageId > existing.messageId) {
			forecastMap.set(areaLower, {
				areaName: event.areaName,
				forecast: event.forecast,
				messageId: event.messageId,
			});
		}
	}

	return Array.from(forecastMap.values());
}
