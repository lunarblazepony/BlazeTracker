/**
 * V2 EventStore
 *
 * Core event storage and projection logic.
 * Single source of truth for all state - projections are computed from events.
 */

import type { Event, RelationshipEvent } from '../types/event';
import { isRelationshipEvent, getRelationshipPair } from '../types/event';
import type { Snapshot, Projection } from '../types/snapshot';
import { cloneSnapshot, createSnapshotFromProjection } from '../types/snapshot';
import type { MessageAndSwipe } from '../types/common';
import {
	type SwipeContext,
	NoSwipeFiltering,
	filterCanonicalEvents,
	filterEventsUpToMessage,
	filterActiveEvents,
	sortEvents,
	projectFromSnapshot,
	normalizePair,
} from './projection';
import {
	serializeEventStore,
	deserializeEventStore,
	type SerializedEventStore,
} from './serialization';

/**
 * EventStore - The core event sourcing container.
 *
 * All state is derived from events. Snapshots are optimization checkpoints.
 */
export class EventStore {
	private _snapshots: Snapshot[] = [];
	private _events: Event[] = [];

	/**
	 * Get all snapshots (read-only).
	 */
	get snapshots(): readonly Snapshot[] {
		return this._snapshots;
	}

	/**
	 * Get all events (read-only).
	 */
	get events(): readonly Event[] {
		return this._events;
	}

	/**
	 * Get the initial snapshot (first extraction).
	 */
	get initialSnapshot(): Snapshot | null {
		const initial = this._snapshots.find(s => s.type === 'initial');
		return initial || null;
	}

	/**
	 * Check if the store has an initial snapshot.
	 */
	get hasInitialSnapshot(): boolean {
		return this.initialSnapshot !== null;
	}

	/**
	 * Get the message ID where the initial snapshot was created.
	 * Returns -1 if no initial snapshot exists.
	 */
	get initialSnapshotMessageId(): number {
		return this.initialSnapshot?.source.messageId ?? -1;
	}

	/**
	 * Get all chapter snapshots.
	 */
	get chapterSnapshots(): Snapshot[] {
		return this._snapshots.filter(s => s.type === 'chapter');
	}

	// ============================================
	// Cloning
	// ============================================

	/**
	 * Create a deep clone of this store.
	 * Mutations to the clone do not affect the original.
	 */
	getDeepClone(): EventStore {
		const clone = new EventStore();
		clone._snapshots = this._snapshots.map(s => cloneSnapshot(s));
		clone._events = this._events.map(e => ({
			...e,
			source: { ...e.source },
			// Clone arrays in events
			...('witnesses' in e && Array.isArray(e.witnesses)
				? { witnesses: [...e.witnesses] }
				: {}),
			...('pair' in e && Array.isArray(e.pair) ? { pair: [...e.pair] } : {}),
		})) as Event[];
		return clone;
	}

	// ============================================
	// Event Management
	// ============================================

	/**
	 * Append events to the store.
	 * Events are sorted by messageId and timestamp after insertion.
	 */
	appendEvents(events: Event[]): void {
		this._events.push(...events);
		this._events = sortEvents(this._events);
	}

	/**
	 * Soft-delete events at a specific message/swipe.
	 * Used for re-extraction.
	 */
	deleteEventsAtMessage(message: MessageAndSwipe): void {
		for (const event of this._events) {
			if (
				event.source.messageId === message.messageId &&
				event.source.swipeId === message.swipeId
			) {
				event.deleted = true;
			}
		}
	}

	/**
	 * Soft-delete ALL events for a message (all swipes).
	 * Used when a message is deleted.
	 */
	deleteAllEventsForMessage(messageId: number): void {
		for (const event of this._events) {
			if (event.source.messageId === messageId) {
				event.deleted = true;
			}
		}
	}

	/**
	 * Reindex swipeIds after a swipe is deleted.
	 * When swipe N is deleted, swipes N+1, N+2, etc. become N, N+1, etc.
	 * This method decrements swipeId for all events at the message with swipeId > deletedSwipeId.
	 */
	reindexSwipesAfterDeletion(messageId: number, deletedSwipeId: number): void {
		// Reindex events
		for (const event of this._events) {
			if (
				event.source.messageId === messageId &&
				event.source.swipeId > deletedSwipeId
			) {
				event.source.swipeId--;
			}
		}

		// Reindex snapshots
		for (const snapshot of this._snapshots) {
			if (
				snapshot.source.messageId === messageId &&
				snapshot.source.swipeId > deletedSwipeId
			) {
				snapshot.source.swipeId--;
			}
			// Also update swipeId field if it exists
			if (
				snapshot.source.messageId === messageId &&
				snapshot.swipeId > deletedSwipeId
			) {
				snapshot.swipeId--;
			}
		}
	}

	/**
	 * Soft-delete all events for messages beyond a given messageId.
	 * Used when branching to clean up events that don't exist in the branch.
	 */
	deleteEventsAfterMessage(lastValidMessageId: number): void {
		for (const event of this._events) {
			if (event.source.messageId > lastValidMessageId) {
				event.deleted = true;
			}
		}
	}

	/**
	 * Get all active (non-deleted) events.
	 */
	getActiveEvents(): Event[] {
		return filterActiveEvents(this._events);
	}

	/**
	 * Get active events up to a specific message.
	 */
	getActiveEventsUpToMessage(messageId: number): Event[] {
		return filterEventsUpToMessage(this.getActiveEvents(), messageId);
	}

	// ============================================
	// Snapshot Management
	// ============================================

	/**
	 * Replace the initial snapshot.
	 * Used when first extraction occurs.
	 */
	replaceInitialSnapshot(snapshot: Snapshot): void {
		// Remove any existing initial snapshot
		this._snapshots = this._snapshots.filter(s => s.type !== 'initial');
		// Add the new one
		this._snapshots.unshift(cloneSnapshot(snapshot));
	}

	/**
	 * Add a chapter snapshot.
	 */
	addChapterSnapshot(snapshot: Snapshot): void {
		this._snapshots.push(cloneSnapshot(snapshot));
		// Sort snapshots by messageId
		this._snapshots.sort((a, b) => a.source.messageId - b.source.messageId);
	}

	/**
	 * Get the best snapshot to use for projecting state at a message.
	 * Returns the most recent snapshot at or before the message.
	 *
	 * @param messageId - Target message
	 * @param context - Swipe context for invalidation checking
	 * @returns The best snapshot, or null if none available
	 */
	getLatestSnapshot(
		messageId: number,
		context: SwipeContext = NoSwipeFiltering,
	): Snapshot | null {
		let best: Snapshot | null = null;

		for (const snapshot of this._snapshots) {
			// Skip snapshots after target message
			if (snapshot.source.messageId > messageId) continue;

			// Check if snapshot is invalidated by swipe change
			const canonicalSwipe = context.getCanonicalSwipeId(
				snapshot.source.messageId,
			);
			if (snapshot.swipeId !== canonicalSwipe) continue;

			// This snapshot is valid - check if it's better than current best
			if (!best || snapshot.source.messageId > best.source.messageId) {
				best = snapshot;
			}
		}

		return best;
	}

	/**
	 * Remove snapshots that are invalidated after a message edit.
	 * Call this when events at a message are modified.
	 */
	rebuildSnapshotsAfterMessage(message: MessageAndSwipe): void {
		// Remove chapter snapshots at or after the edited message
		this._snapshots = this._snapshots.filter(s => {
			if (s.type === 'initial') return true; // Always keep initial
			return s.source.messageId < message.messageId;
		});
	}

	// ============================================
	// Projection
	// ============================================

	/**
	 * Project state at a specific message.
	 *
	 * @param messageId - The message to project state at
	 * @param context - Swipe context for canonical swipe filtering
	 * @param useSnapshots - Whether to use snapshots for optimization (default true)
	 * @returns The projected state
	 * @throws Error if no initial snapshot exists
	 */
	projectStateAtMessage(
		messageId: number,
		context: SwipeContext = NoSwipeFiltering,
		useSnapshots: boolean = true,
	): Projection {
		// Get the best snapshot
		const snapshot = useSnapshots
			? this.getLatestSnapshot(messageId, context)
			: this.initialSnapshot;

		if (!snapshot) {
			throw new Error(
				'No snapshot available for projection. Initial extraction required.',
			);
		}

		// Get events to apply
		const allEvents = this.getActiveEvents();
		const canonicalEvents = filterCanonicalEvents(allEvents, context);

		// Filter to events after the snapshot and up to target
		const eventsToApply = canonicalEvents.filter(
			e =>
				e.source.messageId > snapshot.source.messageId &&
				e.source.messageId <= messageId,
		);

		// Project
		const source: MessageAndSwipe = {
			messageId,
			swipeId: context.getCanonicalSwipeId(messageId),
		};

		return projectFromSnapshot(snapshot, eventsToApply, source);
	}

	/**
	 * Create a chapter snapshot at the current projection state.
	 *
	 * @param projection - Current projection
	 * @param chapterIndex - Chapter that just ended
	 */
	createChapterSnapshot(projection: Projection, chapterIndex: number): void {
		const snapshot = createSnapshotFromProjection(projection, chapterIndex);
		this.addChapterSnapshot(snapshot);
	}

	// ============================================
	// Serialization
	// ============================================

	/**
	 * Serialize the store for JSON storage.
	 */
	serialize(): SerializedEventStore {
		return serializeEventStore(this._snapshots, this._events);
	}

	/**
	 * Load store data from serialized format.
	 * Returns false if deserialization fails.
	 */
	loadFromSerialized(data: unknown): boolean {
		const result = deserializeEventStore(data);
		if (!result) return false;

		this._snapshots = result.snapshots;
		this._events = sortEvents(result.events);
		return true;
	}

	/**
	 * Create an EventStore from serialized data.
	 */
	static fromSerialized(data: unknown): EventStore | null {
		const store = new EventStore();
		if (!store.loadFromSerialized(data)) {
			return null;
		}
		return store;
	}

	// ============================================
	// Utilities
	// ============================================

	/**
	 * Get all unique message IDs that have events.
	 */
	getMessageIdsWithEvents(): number[] {
		const ids = new Set<number>();
		for (const event of this.getActiveEvents()) {
			ids.add(event.source.messageId);
		}
		return Array.from(ids).sort((a, b) => a - b);
	}

	/**
	 * Check if a message has any events.
	 */
	hasEventsAtMessage(messageId: number): boolean {
		return this.getActiveEvents().some(e => e.source.messageId === messageId);
	}

	/**
	 * Get all active events at a specific message/swipe.
	 */
	getEventsAtMessage(message: MessageAndSwipe): Event[] {
		return this.getActiveEvents().filter(
			e =>
				e.source.messageId === message.messageId &&
				e.source.swipeId === message.swipeId,
		);
	}

	/**
	 * Replace all events at a message/swipe with new events.
	 * Soft-deletes existing events and appends new ones.
	 */
	replaceEventsAtMessage(message: MessageAndSwipe, newEvents: Event[]): void {
		this.deleteEventsAtMessage(message);
		this.appendEvents(newEvents);
		this.rebuildSnapshotsAfterMessage(message);
	}

	/**
	 * Get the count of active events.
	 */
	get activeEventCount(): number {
		return this.getActiveEvents().length;
	}

	/**
	 * Clear all data from the store.
	 */
	clear(): void {
		this._snapshots = [];
		this._events = [];
	}

	// ============================================
	// Relationship Event Helpers
	// ============================================

	/**
	 * Get all canonical, active relationship events for a specific character pair.
	 *
	 * @param pair - Character pair [name1, name2] (will be normalized)
	 * @param context - Swipe context for canonical path filtering
	 * @returns Array of relationship events for the pair
	 */
	getRelationshipEventsForPair(
		pair: [string, string],
		context: SwipeContext = NoSwipeFiltering,
	): RelationshipEvent[] {
		const normalizedPair = normalizePair(pair[0], pair[1]);
		const pairKey = `${normalizedPair[0]}|${normalizedPair[1]}`;

		// Filter to canonical, active events
		const canonicalEvents = filterCanonicalEvents(this._events, context);
		const activeEvents = filterActiveEvents(canonicalEvents);

		// Filter to relationship events for this pair
		return activeEvents.filter((event): event is RelationshipEvent => {
			if (!isRelationshipEvent(event)) return false;

			const eventPair = getRelationshipPair(event);
			const eventKey = `${eventPair[0]}|${eventPair[1]}`;
			return eventKey === pairKey;
		});
	}

	/**
	 * Soft-delete all relationship events for a specific character pair.
	 * Does not require swipe context - deletes across all swipes.
	 *
	 * @param pair - Character pair [name1, name2] (will be normalized)
	 */
	deleteRelationshipEventsForPair(pair: [string, string]): void {
		const normalizedPair = normalizePair(pair[0], pair[1]);
		const pairKey = `${normalizedPair[0]}|${normalizedPair[1]}`;

		for (const event of this._events) {
			if (!isRelationshipEvent(event)) continue;

			const eventPair = getRelationshipPair(event);
			const eventKey = `${eventPair[0]}|${eventPair[1]}`;
			if (eventKey === pairKey) {
				event.deleted = true;
			}
		}
	}

	/**
	 * Replace all relationship events for a specific character pair.
	 * Soft-deletes existing events for the pair and appends new ones.
	 *
	 * @param pair - Character pair [name1, name2] (will be normalized)
	 * @param newEvents - New relationship events to add
	 */
	replaceRelationshipEventsForPair(
		pair: [string, string],
		newEvents: RelationshipEvent[],
	): void {
		this.deleteRelationshipEventsForPair(pair);
		this.appendEvents(newEvents);

		// Find the earliest message ID from the new events to rebuild snapshots
		if (newEvents.length > 0) {
			const earliestMessageId = Math.min(
				...newEvents.map(e => e.source.messageId),
			);
			const earliestSwipeId =
				newEvents.find(e => e.source.messageId === earliestMessageId)
					?.source.swipeId ?? 0;
			this.rebuildSnapshotsAfterMessage({
				messageId: earliestMessageId,
				swipeId: earliestSwipeId,
			});
		}
	}
}

/**
 * Create a new empty EventStore.
 */
export function createEventStore(): EventStore {
	return new EventStore();
}
