/**
 * Compute Chapters Module Tests
 *
 * Tests for chapter data computation from snapshots and events.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import moment from 'moment';
import type { EventStore } from '../store/EventStore';
import { createEventStore } from '../store/EventStore';
import { NoSwipeFiltering } from '../../test/testUtils';
import type { ChapterEndedEvent, ChapterDescribedEvent } from '../types/event';
import type { Snapshot } from '../types/snapshot';
import { createEmptySnapshot } from '../types/snapshot';
import { serializeMoment } from '../types/common';
import {
	computeChapterData,
	computeAllChapters,
	getCurrentChapterIndex,
	getMilestonesFromSnapshot,
	subtractMilestones,
	type MilestoneInfo,
} from './computeChapters';

const defaultSwipeContext = NoSwipeFiltering;

/**
 * Create a base event.
 */
function createBaseEvent(id: string, messageId: number, swipeId: number = 0) {
	return {
		id,
		source: { messageId, swipeId },
		timestamp: Date.now(),
	};
}

/**
 * Create a ChapterEndedEvent.
 */
function createChapterEndedEvent(
	id: string,
	messageId: number,
	chapterIndex: number,
	reason: 'location_change' | 'time_jump' | 'both' = 'location_change',
): ChapterEndedEvent {
	return {
		...createBaseEvent(id, messageId),
		kind: 'chapter',
		subkind: 'ended',
		chapterIndex,
		reason,
	};
}

/**
 * Create a ChapterDescribedEvent.
 */
function createChapterDescribedEvent(
	id: string,
	messageId: number,
	chapterIndex: number,
	title: string,
	summary: string,
): ChapterDescribedEvent {
	return {
		...createBaseEvent(id, messageId),
		kind: 'chapter',
		subkind: 'described',
		chapterIndex,
		title,
		summary,
	};
}

/**
 * Create an initial snapshot.
 */
function createInitialSnapshot(messageId: number = 0): Snapshot {
	const snapshot = createEmptySnapshot({ messageId, swipeId: 0 });
	const time = moment({ year: 2024, month: 0, date: 15, hour: 10, minute: 0, second: 0 });
	snapshot.time = serializeMoment(time);
	return snapshot;
}

/**
 * Create a chapter snapshot.
 */
function createChapterSnapshot(messageId: number, chapterIndex: number): Snapshot {
	const snapshot = createEmptySnapshot({ messageId, swipeId: 0 });
	const time = moment({ year: 2024, month: 0, date: 15, hour: 10, minute: 0, second: 0 });
	snapshot.time = serializeMoment(time);
	snapshot.type = 'chapter';
	snapshot.chapterIndex = chapterIndex;
	// Set chapterTriggerMessage for swipe-aware lookups
	snapshot.chapterTriggerMessage = { messageId, swipeId: 0 };
	return snapshot;
}

describe('computeChapters', () => {
	let store: EventStore;

	beforeEach(() => {
		store = createEventStore();
	});

	describe('getCurrentChapterIndex', () => {
		it('returns 0 when no chapter ended events exist', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());

			const result = getCurrentChapterIndex(store, defaultSwipeContext);
			expect(result).toBe(0);
		});

		it('returns 1 after first chapter ends', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([createChapterEndedEvent('1', 5, 0, 'location_change')]);

			const result = getCurrentChapterIndex(store, defaultSwipeContext);
			expect(result).toBe(1);
		});

		it('returns 2 after two chapters end', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([
				createChapterEndedEvent('1', 5, 0, 'location_change'),
				createChapterEndedEvent('2', 10, 1, 'time_jump'),
			]);

			const result = getCurrentChapterIndex(store, defaultSwipeContext);
			expect(result).toBe(2);
		});
	});

	describe('computeChapterData', () => {
		it('returns default title when no ChapterDescribedEvent exists', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([createChapterEndedEvent('1', 5, 0, 'location_change')]);

			const chapter = computeChapterData(store, 0, defaultSwipeContext);

			expect(chapter.title).toBe('Chapter 1');
			expect(chapter.summary).toBe('');
		});

		it('returns title and summary from ChapterDescribedEvent', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([
				createChapterEndedEvent('1', 5, 0, 'location_change'),
				createChapterDescribedEvent(
					'2',
					5,
					0,
					'Test Title',
					'Test summary.',
				),
			]);

			const chapter = computeChapterData(store, 0, defaultSwipeContext);

			expect(chapter.title).toBe('Test Title');
			expect(chapter.summary).toBe('Test summary.');
		});

		it('returns endReason from ChapterEndedEvent', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([createChapterEndedEvent('1', 5, 0, 'time_jump')]);

			const chapter = computeChapterData(store, 0, defaultSwipeContext);

			expect(chapter.endReason).toBe('time_jump');
		});

		it('computes startMessageId as 0 for first chapter', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([createChapterEndedEvent('1', 5, 0, 'location_change')]);

			const chapter = computeChapterData(store, 0, defaultSwipeContext);

			expect(chapter.startMessageId).toBe(0);
		});

		it('computes startMessageId from previous chapter snapshot', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.addChapterSnapshot(createChapterSnapshot(5, 0));
			store.appendEvents([
				createChapterEndedEvent('1', 5, 0, 'location_change'),
				createChapterEndedEvent('2', 10, 1, 'time_jump'),
			]);

			const chapter = computeChapterData(store, 1, defaultSwipeContext);

			expect(chapter.startMessageId).toBe(6); // Previous chapter ended at 5, so start at 6
		});

		it('returns null endReason for current chapter', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			// No chapter ended events yet - still in chapter 0

			const chapter = computeChapterData(store, 0, defaultSwipeContext);

			expect(chapter.endReason).toBeNull();
		});
	});

	describe('computeAllChapters', () => {
		it('returns single chapter when no chapter ended events', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());

			const chapters = computeAllChapters(store, defaultSwipeContext);

			expect(chapters).toHaveLength(1);
			expect(chapters[0].index).toBe(0);
		});

		it('returns multiple chapters when chapter ended events exist', () => {
			store.replaceInitialSnapshot(createInitialSnapshot());
			store.appendEvents([
				createChapterEndedEvent('1', 5, 0, 'location_change'),
				createChapterDescribedEvent(
					'2',
					5,
					0,
					'First Chapter',
					'Summary 1',
				),
				createChapterEndedEvent('3', 10, 1, 'time_jump'),
				createChapterDescribedEvent(
					'4',
					10,
					1,
					'Second Chapter',
					'Summary 2',
				),
			]);

			const chapters = computeAllChapters(store, defaultSwipeContext);

			expect(chapters).toHaveLength(3); // Chapters 0, 1, and current chapter 2
			expect(chapters[0].title).toBe('First Chapter');
			expect(chapters[1].title).toBe('Second Chapter');
			expect(chapters[2].title).toBe('Chapter 3'); // Default title for current
		});
	});

	describe('getMilestonesFromSnapshot', () => {
		it('returns empty array when snapshot has no narrative events', () => {
			const snapshot = createInitialSnapshot();
			snapshot.narrativeEvents = [];

			const milestones = getMilestonesFromSnapshot(snapshot);

			expect(milestones).toHaveLength(0);
		});

		it('extracts milestones from narrative events', () => {
			const snapshot = createInitialSnapshot();
			snapshot.narrativeEvents = [
				{
					description: 'Test event',
					chapterIndex: 0,
					narrativeTime: null,
					source: { messageId: 1, swipeId: 0 },
					subjects: [
						{
							pair: ['Alice', 'Bob'] as [string, string],
							subject: 'intimate_kiss',
							isMilestone: true,
							milestoneDescription: 'First kiss',
						},
					],
					witnesses: [],
					location: '',
					tension: { level: 'guarded', type: 'intimate' },
				},
			];

			const milestones = getMilestonesFromSnapshot(snapshot);

			expect(milestones).toHaveLength(1);
			expect(milestones[0].subject).toBe('intimate_kiss');
			expect(milestones[0].description).toBe('First kiss');
		});

		it('filters out non-milestone subjects', () => {
			const snapshot = createInitialSnapshot();
			snapshot.narrativeEvents = [
				{
					description: 'Test event',
					chapterIndex: 0,
					narrativeTime: null,
					source: { messageId: 1, swipeId: 0 },
					location: '',
					tension: { level: 'guarded', type: 'intimate' },
					subjects: [
						{
							pair: ['Alice', 'Bob'] as [string, string],
							subject: 'conversation',
							isMilestone: false,
						},
						{
							pair: ['Alice', 'Bob'] as [string, string],
							subject: 'intimate_kiss',
							isMilestone: true,
							milestoneDescription: 'First kiss',
						},
					],
					witnesses: [],
				},
			];

			const milestones = getMilestonesFromSnapshot(snapshot);

			expect(milestones).toHaveLength(1);
			expect(milestones[0].subject).toBe('intimate_kiss');
		});
	});

	describe('subtractMilestones', () => {
		it('returns empty array when current is empty', () => {
			const result = subtractMilestones([], []);
			expect(result).toHaveLength(0);
		});

		it('returns all current milestones when previous is empty', () => {
			const current: MilestoneInfo[] = [
				{ pair: ['Alice', 'Bob'], subject: 'intimate_kiss' },
			];
			const result = subtractMilestones(current, []);
			expect(result).toHaveLength(1);
		});

		it('filters out milestones that exist in previous', () => {
			const current: MilestoneInfo[] = [
				{ pair: ['Alice', 'Bob'], subject: 'intimate_kiss' },
				{ pair: ['Alice', 'Bob'], subject: 'flirt' },
			];
			const previous: MilestoneInfo[] = [
				{ pair: ['Alice', 'Bob'], subject: 'flirt' },
			];

			const result = subtractMilestones(current, previous);

			expect(result).toHaveLength(1);
			expect(result[0].subject).toBe('intimate_kiss');
		});

		it('considers pair order when matching', () => {
			const current: MilestoneInfo[] = [
				{ pair: ['Alice', 'Bob'], subject: 'intimate_kiss' },
			];
			const previous: MilestoneInfo[] = [
				{ pair: ['Bob', 'Alice'], subject: 'intimate_kiss' }, // Different order
			];

			// Pairs should be normalized before comparison in actual usage,
			// but the raw subtraction is order-sensitive
			const result = subtractMilestones(current, previous);
			expect(result).toHaveLength(1); // Not matched due to different order
		});
	});
});
