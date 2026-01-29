import type { EventStore } from '../store';
import type { NarrativeEvent, NarrativeEventSubject } from '../types/snapshot';
import type {
	Event,
	NarrativeDescriptionEvent,
	TensionEvent,
	RelationshipSubjectEvent,
} from '../types/event';
import {
	isNarrativeDescriptionEvent,
	isTensionEvent,
	isRelationshipSubjectEvent,
} from '../types/event';
import { deserializeMoment } from '../types/common';

/**
 * Swipe context for filtering events.
 */
export interface SwipeContext {
	getCanonicalSwipeId(messageId: number): number;
}

/**
 * Compute NarrativeEvents from stored events.
 * NarrativeEvents combine narrative descriptions, tension, and relationship subjects.
 *
 * @param store - The event store
 * @param swipeContext - Context for swipe filtering
 * @param chapterIndex - Optional chapter filter (null = all chapters)
 */
export function computeNarrativeEvents(
	store: EventStore,
	swipeContext: SwipeContext,
	chapterIndex?: number,
): NarrativeEvent[] {
	const events = store.getActiveEvents();
	const narrativeEvents: NarrativeEvent[] = [];

	// Group events by messageId
	const eventsByMessage = new Map<number, Event[]>();
	for (const event of events) {
		// Filter by swipe
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		const msgId = event.source.messageId;
		if (!eventsByMessage.has(msgId)) {
			eventsByMessage.set(msgId, []);
		}
		eventsByMessage.get(msgId)!.push(event);
	}

	// Process each message that has a narrative description
	for (const [messageId, msgEvents] of eventsByMessage) {
		// Find narrative description event
		const descEvent = msgEvents.find(isNarrativeDescriptionEvent) as
			| NarrativeDescriptionEvent
			| undefined;
		if (!descEvent) continue;

		// Find tension event (may not exist)
		const tensionEvent = msgEvents.find(isTensionEvent) as TensionEvent | undefined;

		// Find relationship subject events
		const subjectEvents = msgEvents.filter(
			isRelationshipSubjectEvent,
		) as RelationshipSubjectEvent[];

		// Determine chapter for this message
		const msgChapter = getCurrentChapterAtMessage(store, messageId, swipeContext);

		// Filter by chapter if specified
		if (chapterIndex !== undefined && msgChapter !== chapterIndex) continue;

		// Build subjects with milestone detection
		const subjects: NarrativeEventSubject[] = [];
		for (const subjectEvent of subjectEvents) {
			const isMilestone = isFirstOccurrence(store, subjectEvent, swipeContext);
			subjects.push({
				pair: subjectEvent.pair,
				subject: subjectEvent.subject,
				isMilestone,
				milestoneDescription: subjectEvent.milestoneDescription,
			});
		}

		// Get narrative time from time events
		const narrativeTime = getTimeAtMessage(store, messageId, swipeContext);

		// Get projection at this message to derive witnesses and location
		const projection = store.projectStateAtMessage(messageId, swipeContext);
		const witnesses = projection.charactersPresent;
		const location = projection.location?.place ?? '';

		// Build narrative event
		const narrativeEvent: NarrativeEvent = {
			source: descEvent.source,
			description: descEvent.description,
			witnesses,
			location,
			tension: tensionEvent
				? { level: tensionEvent.level, type: tensionEvent.type }
				: { level: 'relaxed', type: 'conversation' },
			subjects,
			chapterIndex: msgChapter,
			narrativeTime,
		};

		narrativeEvents.push(narrativeEvent);
	}

	// Sort by messageId
	narrativeEvents.sort((a, b) => a.source.messageId - b.source.messageId);

	return narrativeEvents;
}

/**
 * Get the current chapter at a specific message.
 */
function getCurrentChapterAtMessage(
	store: EventStore,
	messageId: number,
	swipeContext: SwipeContext,
): number {
	const events = store.getActiveEvents();
	let currentChapter = 0;

	for (const event of events) {
		// Only count events up to this message
		if (event.source.messageId > messageId) break;

		// Filter by swipe
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		// Check for chapter ended events
		if (event.kind === 'chapter' && 'subkind' in event && event.subkind === 'ended') {
			currentChapter = (event as any).chapterIndex + 1;
		}
	}

	return currentChapter;
}

/**
 * Check if a subject event is the first occurrence of that subject for that pair.
 */
function isFirstOccurrence(
	store: EventStore,
	targetEvent: RelationshipSubjectEvent,
	swipeContext: SwipeContext,
): boolean {
	const events = store.getActiveEvents();

	for (const event of events) {
		// Only check events before the target
		if (event.source.messageId >= targetEvent.source.messageId) break;

		// Filter by swipe
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		// Check for matching subject
		if (isRelationshipSubjectEvent(event)) {
			if (
				event.pair[0] === targetEvent.pair[0] &&
				event.pair[1] === targetEvent.pair[1] &&
				event.subject === targetEvent.subject
			) {
				return false; // Not the first occurrence
			}
		}
	}

	return true; // This is the first occurrence
}

/**
 * Get the narrative time at a specific message by applying time events.
 */
function getTimeAtMessage(
	store: EventStore,
	messageId: number,
	swipeContext: SwipeContext,
): moment.Moment | null {
	const events = store.getActiveEvents();
	let time: moment.Moment | null = null;

	for (const event of events) {
		// Only process events up to this message
		if (event.source.messageId > messageId) break;

		// Filter by swipe
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		// Handle time events
		if (event.kind === 'time') {
			if ('subkind' in event && event.subkind === 'initial') {
				time = deserializeMoment((event as any).time);
			} else if ('subkind' in event && event.subkind === 'delta') {
				if (time) {
					const delta = (event as any).delta;
					time = time
						.clone()
						.add(delta.days || 0, 'days')
						.add(delta.hours || 0, 'hours')
						.add(delta.minutes || 0, 'minutes')
						.add(delta.seconds || 0, 'seconds');
				}
			}
		}
	}

	return time;
}

/**
 * Compute chapters from events.
 */
export function computeChapters(
	store: EventStore,
	swipeContext: SwipeContext,
): Array<{
	index: number;
	title: string;
	summary: string;
	endReason: string | null;
	eventCount: number;
}> {
	const events = store.getActiveEvents();
	const chapters: Array<{
		index: number;
		title: string;
		summary: string;
		endReason: string | null;
		eventCount: number;
	}> = [];

	// Gather chapter events
	const chapterEndedEvents: any[] = [];
	const chapterDescribedEvents: any[] = [];

	for (const event of events) {
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (event.kind === 'chapter' && 'subkind' in event) {
			if (event.subkind === 'ended') {
				chapterEndedEvents.push(event);
			} else if (event.subkind === 'described') {
				chapterDescribedEvents.push(event);
			}
		}
	}

	// Build chapter list
	// Chapter 0 is always the current/first chapter
	const narrativeEvents = computeNarrativeEvents(store, swipeContext);
	const maxChapter = Math.max(0, ...chapterEndedEvents.map(e => e.chapterIndex + 1));

	for (let i = 0; i <= maxChapter; i++) {
		const endedEvent = chapterEndedEvents.find(e => e.chapterIndex === i);
		const describedEvent = chapterDescribedEvents.find(e => e.chapterIndex === i);
		const chapterNarratives = narrativeEvents.filter(e => e.chapterIndex === i);

		chapters.push({
			index: i,
			title: describedEvent?.title ?? `Chapter ${i + 1}`,
			summary: describedEvent?.summary ?? '',
			endReason: endedEvent?.reason ?? null,
			eventCount: chapterNarratives.length,
		});
	}

	return chapters;
}
