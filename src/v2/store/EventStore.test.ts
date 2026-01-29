import { describe, it, expect, beforeEach } from 'vitest';
import moment from 'moment';
import { EventStore, createEventStore } from './EventStore';
import type { SwipeContext } from './projection';
import type { TimeInitialEvent, TimeDeltaEvent, CharacterAppearedEvent } from '../types/event';
import type { Snapshot } from '../types/snapshot';
import { createEmptySnapshot } from '../types/snapshot';
import { serializeMoment } from '../types/common';

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
			const snapshot = store.getLatestSnapshot(7);
			expect(snapshot?.source.messageId).toBe(5);

			// At message 3, should use initial snapshot
			const initial = store.getLatestSnapshot(3);
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

			const projection = store.projectStateAtMessage(2);

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
			const projection = store.projectStateAtMessage(6);

			// Should be 15 + 1 = 16, not 10 + 2 + 3 + 1 = 16 (same result but different path)
			expect(projection.time?.hour()).toBe(16);
		});

		it('throws error when no snapshot available', () => {
			expect(() => store.projectStateAtMessage(1)).toThrow(
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
});
