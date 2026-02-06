// ============================================
// findFirstUnextractedMessageId Tests
// ============================================

import { describe, it, expect } from 'vitest';
import { findFirstUnextractedMessageId } from './helpers';
import { EventStore } from '../v2/store/EventStore';
import { createEmptySnapshot } from '../v2/types/snapshot';
import type { SwipeContext } from '../v2/store/projection';
import type { Event } from '../v2/types/event';

// ============================================
// Test Helpers
// ============================================

/** Create a SwipeContext where all messages are on swipe 0 unless overridden. */
function createSwipeContext(overrides: Record<number, number> = {}): SwipeContext {
	return {
		getCanonicalSwipeId: (messageId: number) => overrides[messageId] ?? 0,
	};
}

/** Create a minimal event at a given message/swipe. */
function createEvent(
	messageId: number,
	swipeId: number = 0,
	opts: { deleted?: boolean } = {},
): Event {
	return {
		id: `event-${messageId}-${swipeId}-${Math.random()}`,
		kind: 'location',
		subkind: 'moved',
		source: { messageId, swipeId },
		timestamp: Date.now(),
		deleted: opts.deleted,
		newArea: 'test',
		newPlace: 'test',
		newPosition: 'test',
	} as Event;
}

// ============================================
// Tests
// ============================================

describe('findFirstUnextractedMessageId', () => {
	describe('with no snapshots or events', () => {
		it('returns 1 for an empty store', () => {
			const store = new EventStore();
			const swipeContext = createSwipeContext();

			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(1);
		});
	});

	describe('snapshot coverage', () => {
		it('skips message with initial snapshot', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);
			const swipeContext = createSwipeContext();

			// Messages: 0 (system), 1 (snapshot), 2, 3, 4
			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(2);
		});

		it('skips message with chapter snapshot on canonical path', () => {
			const store = new EventStore();
			const initialSnapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(initialSnapshot);

			// Add events for messages 2 and 3
			store.appendEvents([createEvent(2), createEvent(3)]);

			// Add chapter snapshot at message 3
			const chapterSnapshot = {
				...createEmptySnapshot({ messageId: 3, swipeId: 0 }),
				type: 'chapter' as const,
				chapterIndex: 1,
				chapterTriggerMessage: { messageId: 3, swipeId: 0 },
			};
			store.addChapterSnapshot(chapterSnapshot);

			const swipeContext = createSwipeContext();

			// Messages 1 (snapshot), 2 (events), 3 (events + chapter snapshot) covered
			expect(findFirstUnextractedMessageId(store, swipeContext, 6)).toBe(4);
		});

		it('does not count snapshot on non-canonical swipe', () => {
			const store = new EventStore();
			// Snapshot created on swipe 1
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 1 });
			store.replaceInitialSnapshot(snapshot);

			// But canonical swipe for message 1 is 0
			const swipeContext = createSwipeContext({ 1: 0 });

			// Snapshot is not on canonical path, so message 1 is uncovered
			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(1);
		});

		it('counts snapshot when swipe matches canonical path', () => {
			const store = new EventStore();
			// Snapshot created on swipe 2
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 2 });
			store.replaceInitialSnapshot(snapshot);

			// Canonical swipe for message 1 is also 2
			const swipeContext = createSwipeContext({ 1: 2 });

			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(2);
		});
	});

	describe('event coverage', () => {
		it('skips messages with canonical events', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			store.appendEvents([createEvent(2, 0), createEvent(3, 0)]);
			const swipeContext = createSwipeContext();

			// Messages 1 (snapshot), 2 (events), 3 (events) are covered
			expect(findFirstUnextractedMessageId(store, swipeContext, 6)).toBe(4);
		});

		it('does not count events on non-canonical swipe', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			// Event on swipe 1, but canonical swipe for message 2 is 0
			store.appendEvents([createEvent(2, 1)]);
			const swipeContext = createSwipeContext({ 2: 0 });

			// Message 1 covered by snapshot, message 2 has events on wrong swipe
			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(2);
		});

		it('counts events when swipe matches canonical path', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			// Event on swipe 3, canonical swipe for message 2 is 3
			store.appendEvents([createEvent(2, 3)]);
			const swipeContext = createSwipeContext({ 2: 3 });

			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(3);
		});
	});

	describe('deleted events', () => {
		it('does not count deleted events', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			// Add a deleted event at message 2
			store.appendEvents([createEvent(2, 0, { deleted: true })]);
			const swipeContext = createSwipeContext();

			// Message 2's event is deleted, so it's uncovered
			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(2);
		});

		it('does not count soft-deleted events via deleteEventsAtMessage', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			store.appendEvents([createEvent(2, 0), createEvent(3, 0)]);

			// Soft-delete events at message 2
			store.deleteEventsAtMessage({ messageId: 2, swipeId: 0 });

			const swipeContext = createSwipeContext();

			// Message 2 is now uncovered (events deleted), even though message 3 has events
			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(2);
		});

		it('counts non-deleted events alongside deleted ones', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			// Two events at message 2: one active, one deleted
			store.appendEvents([
				createEvent(2, 0),
				createEvent(2, 0, { deleted: true }),
			]);
			const swipeContext = createSwipeContext();

			// Message 2 still has an active event, so it's covered
			expect(findFirstUnextractedMessageId(store, swipeContext, 5)).toBe(3);
		});
	});

	describe('mixed canonical/non-canonical swipes', () => {
		it('only counts coverage on the correct canonical swipe per message', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			// Message 2: event on swipe 0, canonical is 0 (covered)
			// Message 3: event on swipe 0, canonical is 1 (NOT covered)
			// Message 4: event on swipe 2, canonical is 2 (covered)
			store.appendEvents([
				createEvent(2, 0),
				createEvent(3, 0),
				createEvent(4, 2),
			]);

			const swipeContext = createSwipeContext({ 3: 1, 4: 2 });

			// Message 3 is the first uncovered (event on wrong swipe)
			expect(findFirstUnextractedMessageId(store, swipeContext, 6)).toBe(3);
		});
	});

	describe('all messages covered', () => {
		it('returns totalMessages when everything is extracted', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			store.appendEvents([createEvent(2, 0), createEvent(3, 0)]);
			const swipeContext = createSwipeContext();

			// Messages 1-3 covered, totalMessages is 4
			expect(findFirstUnextractedMessageId(store, swipeContext, 4)).toBe(4);
		});

		it('returns totalMessages with gap filled by chapter snapshot', () => {
			const store = new EventStore();
			const initialSnapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(initialSnapshot);

			// Events at message 2, chapter snapshot at message 3 (no events at 3)
			store.appendEvents([createEvent(2, 0)]);
			const chapterSnapshot = {
				...createEmptySnapshot({ messageId: 3, swipeId: 0 }),
				type: 'chapter' as const,
				chapterIndex: 1,
				chapterTriggerMessage: { messageId: 3, swipeId: 0 },
			};
			store.addChapterSnapshot(chapterSnapshot);

			const swipeContext = createSwipeContext();

			// Messages 1 (snapshot), 2 (events), 3 (chapter snapshot) all covered
			expect(findFirstUnextractedMessageId(store, swipeContext, 4)).toBe(4);
		});
	});

	describe('gap detection', () => {
		it('finds gap in the middle of extracted messages', () => {
			const store = new EventStore();
			const snapshot = createEmptySnapshot({ messageId: 1, swipeId: 0 });
			store.replaceInitialSnapshot(snapshot);

			// Events at messages 2 and 4, but not 3
			store.appendEvents([createEvent(2, 0), createEvent(4, 0)]);
			const swipeContext = createSwipeContext();

			// Message 3 is the first uncovered
			expect(findFirstUnextractedMessageId(store, swipeContext, 6)).toBe(3);
		});
	});
});
