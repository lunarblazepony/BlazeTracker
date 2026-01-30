import { describe, it, expect, beforeEach } from 'vitest';
import moment from 'moment';
import { EventStore, createEventStore } from './EventStore';
import type { SwipeContext } from './projection';
import { NoSwipeFiltering } from './projection';
import type { TimeInitialEvent, TimeDeltaEvent, CharacterAppearedEvent } from '../types/event';
import type { Snapshot } from '../types/snapshot';
import { createEmptySnapshot } from '../types/snapshot';
import { serializeMoment } from '../types/common';

/**
 * Default SwipeContext for tests - returns swipe 0 for all messages.
 */
const defaultSwipeContext: SwipeContext = NoSwipeFiltering;

function createBaseEvent(id: string, messageId: number, swipeId: number = 0) {
	return {
		id,
		source: { messageId, swipeId },
		timestamp: Date.now(),
	};
}

/**
 * Create a time initial event with time as ISO string.
 */
function createTimeInitialEvent(id: string, messageId: number): TimeInitialEvent {
	const time = moment({ year: 2024, month: 0, date: 15, hour: 10, minute: 0, second: 0 });
	return {
		...createBaseEvent(id, messageId),
		kind: 'time',
		subkind: 'initial',
		time: serializeMoment(time),
	};
}

function createTimeDeltaEvent(id: string, messageId: number, hours: number = 1): TimeDeltaEvent {
	return {
		...createBaseEvent(id, messageId),
		kind: 'time',
		subkind: 'delta',
		delta: { days: 0, hours, minutes: 0, seconds: 0 },
	};
}

function createCharacterAppearedEvent(
	id: string,
	messageId: number,
	character: string,
): CharacterAppearedEvent {
	return {
		...createBaseEvent(id, messageId),
		kind: 'character',
		subkind: 'appeared',
		character,
		initialPosition: 'standing',
	};
}

/**
 * Create an initial snapshot with time as ISO string.
 */
function createInitialSnapshot(messageId: number = 0): Snapshot {
	const snapshot = createEmptySnapshot({ messageId, swipeId: 0 });
	const time = moment({ year: 2024, month: 0, date: 15, hour: 10, minute: 0, second: 0 });
	snapshot.time = serializeMoment(time);
	return snapshot;
}

describe('EventStore', () => {
	let store: EventStore;

	beforeEach(() => {
		store = createEventStore();
	});

	describe('basic properties', () => {
		it('starts with empty events and snapshots', () => {
			expect(store.events).toHaveLength(0);
			expect(store.snapshots).toHaveLength(0);
			expect(store.initialSnapshot).toBeNull();
			expect(store.hasInitialSnapshot).toBe(false);
		});
	});

	describe('appendEvents', () => {
		it('adds events to the store', () => {
			const event = createTimeInitialEvent('1', 1);
			store.appendEvents([event]);

			expect(store.events).toHaveLength(1);
			expect(store.events[0].id).toBe('1');
		});

		it('sorts events by messageId and timestamp', () => {
			const event3 = createTimeDeltaEvent('3', 3);
			const event1 = createTimeInitialEvent('1', 1);
			const event2 = createTimeDeltaEvent('2', 2);

			store.appendEvents([event3, event1, event2]);

			expect(store.events.map(e => e.source.messageId)).toEqual([1, 2, 3]);
		});

		it('maintains sort order on multiple appends', () => {
			store.appendEvents([createTimeDeltaEvent('2', 2)]);
			store.appendEvents([createTimeInitialEvent('1', 1)]);
			store.appendEvents([createTimeDeltaEvent('3', 3)]);

			expect(store.events.map(e => e.source.messageId)).toEqual([1, 2, 3]);
		});
	});

	describe('deleteEventsAtMessage', () => {
		it('soft-deletes events at a message/swipe', () => {
			const event1 = createTimeInitialEvent('1', 1);
			const event2 = createTimeDeltaEvent('2', 1); // Same message
			const event3 = createTimeDeltaEvent('3', 2); // Different message

			store.appendEvents([event1, event2, event3]);
			store.deleteEventsAtMessage({ messageId: 1, swipeId: 0 });

			expect(store.events).toHaveLength(3); // Still there
			expect(store.getActiveEvents()).toHaveLength(1);
			expect(store.getActiveEvents()[0].id).toBe('3');
		});

		it('only deletes matching swipe', () => {
			const event1 = {
				...createTimeInitialEvent('1', 1),
				source: { messageId: 1, swipeId: 0 },
			};
			const event2 = {
				...createTimeDeltaEvent('2', 1),
				source: { messageId: 1, swipeId: 1 },
			};

			store.appendEvents([event1, event2]);
			store.deleteEventsAtMessage({ messageId: 1, swipeId: 0 });

			expect(store.getActiveEvents()).toHaveLength(1);
			expect(store.getActiveEvents()[0].source.swipeId).toBe(1);
		});
	});

	describe('getActiveEvents', () => {
		it('filters out deleted events', () => {
			const event1 = createTimeInitialEvent('1', 1);
			const event2 = createTimeDeltaEvent('2', 2);

			store.appendEvents([event1, event2]);
			store.deleteEventsAtMessage({ messageId: 1, swipeId: 0 });

			const active = store.getActiveEvents();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe('2');
		});
	});

	describe('getActiveEventsUpToMessage', () => {
		it('filters by message ID', () => {
			store.appendEvents([
				createTimeInitialEvent('1', 1),
				createTimeDeltaEvent('2', 2),
				createTimeDeltaEvent('3', 3),
				createTimeDeltaEvent('4', 4),
			]);

			const events = store.getActiveEventsUpToMessage(2);
			expect(events).toHaveLength(2);
			expect(events.map(e => e.id)).toEqual(['1', '2']);
		});
	});

	describe('snapshot management', () => {
		it('replaceInitialSnapshot sets the initial snapshot', () => {
			const snapshot = createInitialSnapshot();
			store.replaceInitialSnapshot(snapshot);

			expect(store.hasInitialSnapshot).toBe(true);
			expect(store.initialSnapshot).not.toBeNull();
		});

		it('replaceInitialSnapshot replaces existing initial', () => {
			const snapshot1 = createInitialSnapshot(0);
			const snapshot2 = createInitialSnapshot(1);

			store.replaceInitialSnapshot(snapshot1);
			store.replaceInitialSnapshot(snapshot2);

			expect(store.snapshots.filter(s => s.type === 'initial')).toHaveLength(1);
			expect(store.initialSnapshot?.source.messageId).toBe(1);
		});

		it('addChapterSnapshot adds chapter snapshots', () => {
			const chapterSnapshot: Snapshot = {
				...createInitialSnapshot(5),
				type: 'chapter',
				chapterIndex: 0,
			};

			store.addChapterSnapshot(chapterSnapshot);

			expect(store.chapterSnapshots).toHaveLength(1);
			expect(store.chapterSnapshots[0].chapterIndex).toBe(0);
		});

		it('getLatestSnapshot returns best snapshot', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.addChapterSnapshot({
				...createInitialSnapshot(5),
				type: 'chapter',
				chapterIndex: 0,
			});
			store.addChapterSnapshot({
				...createInitialSnapshot(10),
				type: 'chapter',
				chapterIndex: 1,
			});

			// At message 7, should use chapter 0 snapshot (at message 5)
			const snapshot = store.getLatestSnapshot(7, defaultSwipeContext);
			expect(snapshot?.source.messageId).toBe(5);

			// At message 3, should use initial snapshot
			const initial = store.getLatestSnapshot(3, defaultSwipeContext);
			expect(initial?.source.messageId).toBe(0);
		});

		it('getLatestSnapshot respects swipe invalidation', () => {
			const context: SwipeContext = {
				getCanonicalSwipeId: msgId => (msgId === 5 ? 1 : 0), // Swipe changed at msg 5
			};

			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.addChapterSnapshot({
				...createInitialSnapshot(5),
				type: 'chapter',
				swipeId: 0, // Old swipe
			});

			// Chapter snapshot at msg 5 is invalid (swipe 0 != canonical 1)
			const snapshot = store.getLatestSnapshot(7, context);
			expect(snapshot?.source.messageId).toBe(0); // Falls back to initial
		});

		it('rebuildSnapshotsAfterMessage removes chapter snapshots', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.addChapterSnapshot({
				...createInitialSnapshot(5),
				type: 'chapter',
				chapterIndex: 0,
			});
			store.addChapterSnapshot({
				...createInitialSnapshot(10),
				type: 'chapter',
				chapterIndex: 1,
			});

			store.rebuildSnapshotsAfterMessage({ messageId: 7, swipeId: 0 });

			// Initial kept, chapter at 5 kept, chapter at 10 removed
			expect(store.snapshots).toHaveLength(2);
			expect(store.chapterSnapshots).toHaveLength(1);
			expect(store.chapterSnapshots[0].source.messageId).toBe(5);
		});
	});

	describe('getDeepClone', () => {
		it('creates a true deep clone', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.appendEvents([createTimeInitialEvent('1', 1)]);

			const clone = store.getDeepClone();

			// Modify original
			store.appendEvents([createTimeDeltaEvent('2', 2)]);

			// Clone should be unaffected
			expect(clone.events).toHaveLength(1);
			expect(store.events).toHaveLength(2);
		});

		it('clones nested objects', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			const originalTime = store.initialSnapshot!.time;

			const clone = store.getDeepClone();

			// Modify original snapshot's time (it's a string, so we replace it)
			const newTime = moment({
				year: 2024,
				month: 0,
				date: 15,
				hour: 99,
				minute: 0,
				second: 0,
			});
			store.initialSnapshot!.time = serializeMoment(newTime);

			// Clone's snapshot should be unchanged (still the original string)
			expect(clone.initialSnapshot!.time).toBe(originalTime);
		});
	});

	describe('projectStateAtMessage', () => {
		it('projects state from initial snapshot', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.appendEvents([
				createTimeDeltaEvent('1', 1, 2), // +2 hours
				createCharacterAppearedEvent('2', 2, 'Alice'),
			]);

			const projection = store.projectStateAtMessage(2, defaultSwipeContext);

			expect(projection.time?.hour()).toBe(12); // 10 + 2
			expect(projection.charactersPresent).toContain('Alice');
		});

		it('uses chapter snapshot for efficiency', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.appendEvents([
				createTimeDeltaEvent('1', 1, 2),
				createTimeDeltaEvent('2', 2, 3),
				createTimeDeltaEvent('3', 6, 1),
			]);

			// Add chapter snapshot at message 5 with time at 15:00
			const chapterSnapshot: Snapshot = {
				...createInitialSnapshot(5),
				type: 'chapter',
				chapterIndex: 0,
			};
			const chapterTime = moment({
				year: 2024,
				month: 0,
				date: 15,
				hour: 15,
				minute: 0,
				second: 0,
			});
			chapterSnapshot.time = serializeMoment(chapterTime);
			store.addChapterSnapshot(chapterSnapshot);

			// Project at message 6 - should use chapter snapshot, not initial
			const projection = store.projectStateAtMessage(6, defaultSwipeContext);

			// Should be 15 + 1 = 16, not 10 + 2 + 3 + 1 = 16 (same result but different path)
			expect(projection.time?.hour()).toBe(16);
		});

		it('throws error when no snapshot available', () => {
			expect(() => store.projectStateAtMessage(1, defaultSwipeContext)).toThrow(
				'No snapshot available for projection',
			);
		});

		it('respects canonical swipe filtering', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));

			// Events at same message, different swipes
			const event1 = {
				...createTimeDeltaEvent('1', 1, 2),
				source: { messageId: 1, swipeId: 0 },
			};
			const event2 = {
				...createTimeDeltaEvent('2', 1, 5),
				source: { messageId: 1, swipeId: 1 },
			};

			store.appendEvents([event1, event2]);

			const context: SwipeContext = {
				// Initial snapshot is at msg 0 swipe 0, so return 0 for msg 0
				// For msg 1, canonical is swipe 1
				getCanonicalSwipeId: msgId => (msgId === 0 ? 0 : 1),
			};

			const projection = store.projectStateAtMessage(1, context);

			// Should only apply swipe 1's delta (+5)
			expect(projection.time?.hour()).toBe(15);
		});
	});

	describe('serialization', () => {
		it('serializes and deserializes correctly', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.appendEvents([
				createTimeInitialEvent('1', 1),
				createTimeDeltaEvent('2', 2),
			]);

			const serialized = store.serialize();
			const newStore = EventStore.fromSerialized(serialized);

			expect(newStore).not.toBeNull();
			expect(newStore!.events).toHaveLength(2);
			expect(newStore!.hasInitialSnapshot).toBe(true);
		});

		it('returns null for invalid data', () => {
			expect(EventStore.fromSerialized(null)).toBeNull();
			expect(EventStore.fromSerialized({})).toBeNull();
			expect(EventStore.fromSerialized({ version: 1 })).toBeNull();
		});
	});

	describe('reindexSwipesAfterDeletion', () => {
		it('decrements swipeIds for events after deleted swipe', () => {
			// Events at message 5 with swipes 0, 1, 2
			const event0 = {
				...createTimeInitialEvent('1', 5),
				source: { messageId: 5, swipeId: 0 },
			};
			const event1 = {
				...createTimeDeltaEvent('2', 5),
				source: { messageId: 5, swipeId: 1 },
			};
			const event2 = {
				...createTimeDeltaEvent('3', 5),
				source: { messageId: 5, swipeId: 2 },
			};

			store.appendEvents([event0, event1, event2]);

			// Delete swipe 0 and reindex
			store.deleteEventsAtMessage({ messageId: 5, swipeId: 0 });
			store.reindexSwipesAfterDeletion(5, 0);

			const active = store.getActiveEvents();
			expect(active).toHaveLength(2);
			// Swipe 1 should now be swipe 0
			expect(active[0].source.swipeId).toBe(0);
			// Swipe 2 should now be swipe 1
			expect(active[1].source.swipeId).toBe(1);
		});

		it('does not affect events at other messages', () => {
			const event1 = {
				...createTimeInitialEvent('1', 5),
				source: { messageId: 5, swipeId: 1 },
			};
			const event2 = {
				...createTimeDeltaEvent('2', 6),
				source: { messageId: 6, swipeId: 1 },
			};

			store.appendEvents([event1, event2]);

			// Delete swipe 0 at message 5 and reindex
			store.reindexSwipesAfterDeletion(5, 0);

			const active = store.getActiveEvents();
			// Event at message 5 should be reindexed
			expect(active.find(e => e.source.messageId === 5)?.source.swipeId).toBe(0);
			// Event at message 6 should be unchanged
			expect(active.find(e => e.source.messageId === 6)?.source.swipeId).toBe(1);
		});

		it('does not affect events with swipeId less than deleted', () => {
			const event0 = {
				...createTimeInitialEvent('1', 5),
				source: { messageId: 5, swipeId: 0 },
			};
			const event2 = {
				...createTimeDeltaEvent('2', 5),
				source: { messageId: 5, swipeId: 2 },
			};

			store.appendEvents([event0, event2]);

			// Delete swipe 1 (middle) and reindex
			store.reindexSwipesAfterDeletion(5, 1);

			const active = store.getActiveEvents();
			// Swipe 0 should be unchanged
			expect(active.find(e => e.id === '1')?.source.swipeId).toBe(0);
			// Swipe 2 should now be swipe 1
			expect(active.find(e => e.id === '2')?.source.swipeId).toBe(1);
		});

		it('reindexes snapshots at the affected message', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));

			// Add chapter snapshot at message 5, swipe 1
			const chapterSnapshot: Snapshot = {
				...createInitialSnapshot(5),
				type: 'chapter',
				chapterIndex: 0,
				swipeId: 1,
			};
			chapterSnapshot.source.swipeId = 1;
			store.addChapterSnapshot(chapterSnapshot);

			// Delete swipe 0 at message 5 and reindex
			store.reindexSwipesAfterDeletion(5, 0);

			// Chapter snapshot should now be at swipe 0
			expect(store.chapterSnapshots[0].source.swipeId).toBe(0);
			expect(store.chapterSnapshots[0].swipeId).toBe(0);
		});

		it('handles the original bug scenario: delete swipe 0 after swiping back', () => {
			// Scenario: user creates swipe 1, swipes back to 0, deletes 0
			// Events at swipe 1 should become swipe 0

			const eventSwipe0 = {
				...createTimeInitialEvent('swipe0', 5),
				source: { messageId: 5, swipeId: 0 },
			};
			const eventSwipe1 = {
				...createTimeDeltaEvent('swipe1', 5),
				source: { messageId: 5, swipeId: 1 },
			};

			store.appendEvents([eventSwipe0, eventSwipe1]);

			// User deletes swipe 0
			store.deleteEventsAtMessage({ messageId: 5, swipeId: 0 });
			store.reindexSwipesAfterDeletion(5, 0);

			const active = store.getActiveEvents();
			expect(active).toHaveLength(1);
			expect(active[0].id).toBe('swipe1');
			// The event from old swipe 1 should now be swipe 0
			expect(active[0].source.swipeId).toBe(0);
		});
	});

	describe('utility methods', () => {
		it('getMessageIdsWithEvents returns sorted unique IDs', () => {
			store.appendEvents([
				createTimeInitialEvent('1', 3),
				createTimeDeltaEvent('2', 1),
				createTimeDeltaEvent('3', 3),
				createTimeDeltaEvent('4', 5),
			]);

			expect(store.getMessageIdsWithEvents()).toEqual([1, 3, 5]);
		});

		it('hasEventsAtMessage checks for events', () => {
			store.appendEvents([createTimeInitialEvent('1', 5)]);

			expect(store.hasEventsAtMessage(5)).toBe(true);
			expect(store.hasEventsAtMessage(3)).toBe(false);
		});

		it('activeEventCount returns count of non-deleted events', () => {
			store.appendEvents([
				createTimeInitialEvent('1', 1),
				createTimeDeltaEvent('2', 2),
			]);

			expect(store.activeEventCount).toBe(2);

			store.deleteEventsAtMessage({ messageId: 1, swipeId: 0 });

			expect(store.activeEventCount).toBe(1);
		});

		it('clear removes all data', () => {
			store.replaceInitialSnapshot(createInitialSnapshot(0));
			store.appendEvents([createTimeInitialEvent('1', 1)]);

			store.clear();

			expect(store.events).toHaveLength(0);
			expect(store.snapshots).toHaveLength(0);
		});
	});

	describe('initial snapshot never invalidated by swipe mismatch', () => {
		/**
		 * Helper to create a snapshot with specific swipeId.
		 */
		function createSnapshotWithSwipe(
			messageId: number,
			swipeId: number,
			type: 'initial' | 'chapter' = 'initial',
		): Snapshot {
			const snapshot = createInitialSnapshot(messageId);
			snapshot.type = type;
			snapshot.swipeId = swipeId;
			snapshot.source.swipeId = swipeId;
			if (type === 'chapter') {
				snapshot.chapterIndex = 0;
			}
			return snapshot;
		}

		it('finds initial snapshot even when canonical swipe differs', () => {
			// Initial snapshot created at message 1, swipe 4 (group chat scenario)
			store.replaceInitialSnapshot(createSnapshotWithSwipe(1, 4, 'initial'));

			// SwipeContext returns swipe 0 for message 1
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: () => 0,
			};

			// Should still find the initial snapshot - it's never invalidated
			const snapshot = store.getLatestSnapshot(2, swipeContext);
			expect(snapshot).not.toBeNull();
			expect(snapshot?.type).toBe('initial');
			expect(snapshot?.source.messageId).toBe(1);
		});

		it('allows projection when initial snapshot swipeId differs from canonical', () => {
			// This is the bug scenario: initial extraction at message 1, swipe 4
			// User does NOT switch swipes, attempts to project at message 2+
			store.replaceInitialSnapshot(createSnapshotWithSwipe(1, 4, 'initial'));

			// SwipeContext returns 0 for all messages (simulating missing swipe info)
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: () => 0,
			};

			// Should NOT throw - initial snapshots bypass swipe validation
			expect(() => {
				store.projectStateAtMessage(2, swipeContext);
			}).not.toThrow();

			const projection = store.projectStateAtMessage(2, swipeContext);
			expect(projection).toBeDefined();
			expect(projection.source.messageId).toBe(2);
		});

		it('invalidates chapter snapshots when swipe differs', () => {
			// Initial snapshot at message 1
			store.replaceInitialSnapshot(createSnapshotWithSwipe(1, 0, 'initial'));

			// Chapter snapshot at message 5, swipe 2
			store.addChapterSnapshot(createSnapshotWithSwipe(5, 2, 'chapter'));

			// SwipeContext returns swipe 0 for all messages
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: () => 0,
			};

			// Should fall back to initial snapshot (chapter snapshot invalidated)
			const snapshot = store.getLatestSnapshot(6, swipeContext);
			expect(snapshot).not.toBeNull();
			expect(snapshot?.type).toBe('initial');
			expect(snapshot?.source.messageId).toBe(1);
		});

		it('uses chapter snapshot when swipe matches', () => {
			// Initial snapshot at message 1
			store.replaceInitialSnapshot(createSnapshotWithSwipe(1, 0, 'initial'));

			// Chapter snapshot at message 5, swipe 0
			store.addChapterSnapshot(createSnapshotWithSwipe(5, 0, 'chapter'));

			// SwipeContext returns swipe 0 for all messages
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: () => 0,
			};

			// Should use chapter snapshot (swipe matches)
			const snapshot = store.getLatestSnapshot(6, swipeContext);
			expect(snapshot).not.toBeNull();
			expect(snapshot?.type).toBe('chapter');
			expect(snapshot?.source.messageId).toBe(5);
		});

		it('handles the exact group chat bug scenario', () => {
			// The exact bug scenario:
			// 1. Initial extraction happens on message 1, swipe 4
			// 2. User does NOT switch swipes
			// 3. Attempting to project state for message 2+ should NOT fail

			// Initial snapshot at message 1, swipe 4 (created during group chat initial extraction)
			const initialSnapshot = createSnapshotWithSwipe(1, 4, 'initial');
			store.replaceInitialSnapshot(initialSnapshot);

			// Simulating what happens when SwipeContext is built from chat where
			// later messages don't have swipe_id set (returns 0)
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: (msgId: number) => {
					// Message 1 had swipe 4, but we're looking at message 2
					// which doesn't exist yet in the chat
					if (msgId === 1) return 4; // Original swipe
					return 0; // Default for messages not in chat yet
				},
			};

			// Projection at message 2 should work
			const snapshot = store.getLatestSnapshot(2, swipeContext);
			expect(snapshot).not.toBeNull();
			expect(snapshot?.type).toBe('initial');

			// Projection should not throw
			expect(() => store.projectStateAtMessage(2, swipeContext)).not.toThrow();
		});

		it('invalidates initial snapshot when user swipes the same message', () => {
			// Scenario: user swipes message 1 after initial extraction
			// The initial snapshot should be invalidated because the content changed

			// Initial snapshot at message 1, swipe 0
			store.replaceInitialSnapshot(createSnapshotWithSwipe(1, 0, 'initial'));

			// User swipes to swipe 1 on message 1
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: (msgId: number) => {
					if (msgId === 1) return 1; // User swiped to swipe 1
					return 0;
				},
			};

			// When projecting at message 1 (same as snapshot), swipe validation applies
			const snapshot = store.getLatestSnapshot(1, swipeContext);
			expect(snapshot).toBeNull(); // Invalidated because swipe changed

			// Projection should throw because no valid snapshot
			expect(() => store.projectStateAtMessage(1, swipeContext)).toThrow(
				'No snapshot available for projection',
			);
		});

		it('still uses initial snapshot for later messages even when swipe differs', () => {
			// This is the key distinction: swipe validation only applies when
			// projecting at the SAME message as the snapshot

			// Initial snapshot at message 1, swipe 0
			store.replaceInitialSnapshot(createSnapshotWithSwipe(1, 0, 'initial'));

			// SwipeContext returns different swipe for message 1
			const swipeContext: SwipeContext = {
				getCanonicalSwipeId: (msgId: number) => {
					if (msgId === 1) return 1; // Different swipe
					return 0;
				},
			};

			// When projecting at message 1: snapshot is invalidated
			expect(store.getLatestSnapshot(1, swipeContext)).toBeNull();

			// But when projecting at message 2+: snapshot is still valid
			// (the swipe mismatch at message 1 doesn't matter for projecting later)
			const snapshot = store.getLatestSnapshot(2, swipeContext);
			expect(snapshot).not.toBeNull();
			expect(snapshot?.type).toBe('initial');

			// Projection at message 2 should work
			expect(() => store.projectStateAtMessage(2, swipeContext)).not.toThrow();
		});
	});
});
