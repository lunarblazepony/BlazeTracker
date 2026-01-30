/**
 * Compute Chapter Data from Snapshots + Events
 *
 * Chapters are computed, not stored. This module provides functions to:
 * - Compute chapter data from snapshots and events
 * - Extract milestones per chapter (diff between snapshots)
 * - Get chapter start/end message ranges
 */

import type moment from 'moment';
import type { EventStore } from '../store';
import type { SwipeContext } from '../store/projection';
import type { Snapshot, NarrativeEvent } from '../types/snapshot';
import type { MessageAndSwipe } from '../types/common';
import { deserializeMoment } from '../types/common';
import type { ChapterEndedEvent, ChapterDescribedEvent } from '../types/event';
import type { Subject } from '../types/subject';
import { computeNarrativeEvents } from './computeNarrativeEvents';

/**
 * Milestone info extracted from a chapter.
 */
export interface MilestoneInfo {
	pair: [string, string];
	subject: Subject;
	description?: string;
}

/**
 * Computed chapter data from snapshots + events.
 */
export interface ComputedChapter {
	/** Chapter index (0-based) */
	index: number;
	/** Chapter title (from ChapterDescribedEvent or default) */
	title: string;
	/** Chapter summary (from ChapterDescribedEvent or empty) */
	summary: string;
	/** Why the chapter ended (from ChapterEndedEvent or null for current chapter) */
	endReason: 'location_change' | 'time_jump' | 'both' | 'manual' | null;
	/** Message/swipe where chapter ended (null for current chapter) */
	endedAtMessage: MessageAndSwipe | null;
	/** Chapter start message ID (computed: prevSnapshot.source.messageId + 1 or 0) */
	startMessageId: number;
	/** Number of narrative events in this chapter */
	eventCount: number;
	/** Relationship milestones that occurred in this chapter */
	milestones: MilestoneInfo[];
	/** All narrative events for this chapter */
	narrativeEvents: NarrativeEvent[];
	/** Time at start of chapter (from projection at startMessageId) */
	startTime: moment.Moment | null;
	/** Time at end of chapter (from projection at endedAtMessage or latest message) */
	endTime: moment.Moment | null;
}

/**
 * Get milestones from a snapshot's narrative events.
 */
export function getMilestonesFromSnapshot(snapshot: Snapshot): MilestoneInfo[] {
	if (!snapshot.narrativeEvents) return [];

	const milestones: MilestoneInfo[] = [];
	for (const event of snapshot.narrativeEvents) {
		for (const subject of event.subjects) {
			if (subject.isMilestone) {
				milestones.push({
					pair: subject.pair,
					subject: subject.subject,
					description: subject.milestoneDescription,
				});
			}
		}
	}
	return milestones;
}

/**
 * Subtract milestones - returns milestones in current that aren't in previous.
 */
export function subtractMilestones(
	current: MilestoneInfo[],
	previous: MilestoneInfo[],
): MilestoneInfo[] {
	return current.filter(
		c =>
			!previous.some(
				p =>
					p.pair[0] === c.pair[0] &&
					p.pair[1] === c.pair[1] &&
					p.subject === c.subject,
			),
	);
}

/**
 * Compute chapter data from snapshots and events.
 *
 * @param store - The event store
 * @param chapterIndex - Chapter index to compute
 * @param swipeContext - Swipe context for filtering
 * @returns Computed chapter data
 */
export function computeChapterData(
	store: EventStore,
	chapterIndex: number,
	swipeContext: SwipeContext,
): ComputedChapter {
	// Get previous chapter snapshot for start message calculation (swipe-aware)
	const prevSnapshot =
		chapterIndex > 0
			? store.getChapterSnapshotOnCanonicalPath(chapterIndex - 1, swipeContext)
			: null;

	// Start message: prevSnapshot.source.messageId + 1, or 0 for first chapter
	const startMessageId = prevSnapshot ? prevSnapshot.source.messageId + 1 : 0;

	// Find chapter events
	const events = store.getActiveEvents();
	let endedEvent: ChapterEndedEvent | undefined;
	let describedEvent: ChapterDescribedEvent | undefined;

	for (const event of events) {
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (event.kind === 'chapter' && 'subkind' in event) {
			if (
				event.subkind === 'ended' &&
				(event as ChapterEndedEvent).chapterIndex === chapterIndex
			) {
				endedEvent = event as ChapterEndedEvent;
			} else if (
				event.subkind === 'described' &&
				(event as ChapterDescribedEvent).chapterIndex === chapterIndex
			) {
				describedEvent = event as ChapterDescribedEvent;
			}
		}
	}

	// Narrative events for this chapter
	const allNarrativeEvents = computeNarrativeEvents(store, swipeContext);
	const narrativeEvents = allNarrativeEvents.filter(e => e.chapterIndex === chapterIndex);

	// Compute milestones (diff between snapshots)
	// We get milestones from narrative events in this chapter
	const milestones: MilestoneInfo[] = [];
	for (const event of narrativeEvents) {
		for (const subject of event.subjects) {
			if (subject.isMilestone) {
				milestones.push({
					pair: subject.pair,
					subject: subject.subject,
					description: subject.milestoneDescription,
				});
			}
		}
	}

	// Compute start/end times from projections
	let startTime: moment.Moment | null = null;
	let endTime: moment.Moment | null = null;

	try {
		// Get time at start of chapter
		if (chapterIndex === 0) {
			// For first chapter, use initial snapshot's time
			const initialSnapshot = store.initialSnapshot;
			if (initialSnapshot?.time) {
				startTime = deserializeMoment(initialSnapshot.time);
			}
		} else if (startMessageId >= store.initialSnapshotMessageId) {
			// For subsequent chapters, use projection at start message
			const startProjection = store.projectStateAtMessage(
				startMessageId,
				swipeContext,
			);
			startTime = startProjection.time ? startProjection.time.clone() : null;
		}

		// Get time at end message (or last message of chapter if current)
		const endMessageId = endedEvent?.source.messageId ?? null;
		if (endMessageId !== null && endMessageId >= store.initialSnapshotMessageId) {
			const endProjection = store.projectStateAtMessage(
				endMessageId,
				swipeContext,
			);
			endTime = endProjection.time ? endProjection.time.clone() : null;
		}
	} catch {
		// Projection failed - times remain null
	}

	return {
		index: chapterIndex,
		title: describedEvent?.title ?? `Chapter ${chapterIndex + 1}`,
		summary: describedEvent?.summary ?? '',
		endReason: (endedEvent?.reason as ComputedChapter['endReason']) ?? null,
		endedAtMessage: endedEvent?.source ?? null,
		startMessageId,
		eventCount: narrativeEvents.length,
		milestones,
		narrativeEvents,
		startTime,
		endTime,
	};
}

/**
 * Compute all chapter data from snapshots and events.
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @returns Array of computed chapters
 */
export function computeAllChapters(
	store: EventStore,
	swipeContext: SwipeContext,
): ComputedChapter[] {
	const events = store.getActiveEvents();
	const chapters: ComputedChapter[] = [];

	// Find max chapter index from chapter ended events
	let maxChapter = 0;
	for (const event of events) {
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (event.kind === 'chapter' && 'subkind' in event && event.subkind === 'ended') {
			const chapterEndedEvent = event as ChapterEndedEvent;
			// The current chapter is ended chapter + 1
			maxChapter = Math.max(maxChapter, chapterEndedEvent.chapterIndex + 1);
		}
	}

	// Compute each chapter
	for (let i = 0; i <= maxChapter; i++) {
		chapters.push(computeChapterData(store, i, swipeContext));
	}

	return chapters;
}

/**
 * Get the current chapter index based on events.
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @returns Current chapter index
 */
export function getCurrentChapterIndex(store: EventStore, swipeContext: SwipeContext): number {
	const events = store.getActiveEvents();
	let currentChapter = 0;

	for (const event of events) {
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (event.kind === 'chapter' && 'subkind' in event && event.subkind === 'ended') {
			const chapterEndedEvent = event as ChapterEndedEvent;
			currentChapter = Math.max(
				currentChapter,
				chapterEndedEvent.chapterIndex + 1,
			);
		}
	}

	return currentChapter;
}
