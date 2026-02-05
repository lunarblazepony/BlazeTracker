/**
 * Event Formatting for Injection
 *
 * Formats out-of-context events from the current chapter
 * for injection into the "Recent Events" section.
 */

import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { getMilestoneDisplayName } from '../store/projection';
import { computeNarrativeEvents } from '../narrative';
import type { NarrativeEvent, NarrativeEventSubject } from '../types/snapshot';

/**
 * Format a milestone subject for an event.
 * Uses the full LLM-generated description if available.
 *
 * @param subject - The narrative event subject
 * @returns Formatted milestone string, or empty if not a milestone
 */
export function formatMilestoneSubject(subject: NarrativeEventSubject): string {
	if (!subject.isMilestone) {
		return '';
	}

	const pairStr = `${subject.pair[0]} & ${subject.pair[1]}`;
	const displayName = getMilestoneDisplayName(subject.subject);

	// Use full description if available, otherwise just the display name
	if (subject.milestoneDescription) {
		return `${pairStr} - ${displayName}: ${subject.milestoneDescription}`;
	}

	return `${pairStr}: ${displayName}`;
}

/**
 * Format a single narrative event for injection.
 * Includes full milestone descriptions for current chapter events.
 *
 * @param event - The narrative event
 * @param includeFullMilestones - Whether to include full milestone descriptions
 * @returns Formatted event string
 */
export function formatEventForInjection(
	event: NarrativeEvent,
	includeFullMilestones: boolean = true,
): string {
	const parts: string[] = [`- ${event.description}`];

	// Add milestone details if any
	if (includeFullMilestones) {
		const milestones = event.subjects
			.filter(s => s.isMilestone)
			.map(formatMilestoneSubject)
			.filter(Boolean);

		if (milestones.length > 0) {
			for (const milestone of milestones) {
				parts.push(`  [Milestone: ${milestone}]`);
			}
		}
	}

	return parts.join('\n');
}

/**
 * Get out-of-context events from the current chapter.
 * These are events whose messages are before the firstMessageInContext.
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @param currentChapter - The current chapter index
 * @param firstMessageInContext - The first message ID that's in context
 * @returns Array of events that are out of context
 */
export function getOutOfContextEvents(
	store: EventStore,
	swipeContext: SwipeContext,
	currentChapter: number,
	firstMessageInContext: number,
): NarrativeEvent[] {
	// Get all events for the current chapter
	const allEvents = computeNarrativeEvents(store, swipeContext, currentChapter);

	// Filter to events whose messages are before firstMessageInContext
	return allEvents.filter(event => event.source.messageId < firstMessageInContext);
}

/**
 * Format out-of-context events for injection.
 *
 * @param events - The events to format
 * @param maxEvents - Maximum number of events to include
 * @returns Formatted events string, or empty string if no events
 */
export function formatOutOfContextEvents(events: NarrativeEvent[], maxEvents: number): string {
	if (events.length === 0) {
		return '';
	}

	// Take the most recent events (closest to context)
	const recentEvents = events.slice(-maxEvents);

	// Format each event with full milestone descriptions
	const formattedEvents = recentEvents.map(e => formatEventForInjection(e, true));

	return formattedEvents.join('\n');
}

/**
 * Format out-of-context events with wrapper tags for injection.
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @param currentChapter - The current chapter index
 * @param firstMessageInContext - The first message ID that's in context
 * @param maxEvents - Maximum number of events to include
 * @returns Formatted events with [Recent Events] tags, or empty string if none
 */
export function formatOutOfContextEventsWithTags(
	store: EventStore,
	swipeContext: SwipeContext,
	currentChapter: number,
	firstMessageInContext: number,
	maxEvents: number,
): string {
	const events = getOutOfContextEvents(
		store,
		swipeContext,
		currentChapter,
		firstMessageInContext,
	);

	const content = formatOutOfContextEvents(events, maxEvents);
	if (!content) {
		return '';
	}

	return `[Recent Events]\n${content}\n[/Recent Events]`;
}

/**
 * Get all narrative events for the current chapter.
 * Useful when all events are in context (no need to filter).
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @param currentChapter - The current chapter index
 * @returns Array of all narrative events in the current chapter
 */
export function getAllCurrentChapterEvents(
	store: EventStore,
	swipeContext: SwipeContext,
	currentChapter: number,
): NarrativeEvent[] {
	return computeNarrativeEvents(store, swipeContext, currentChapter);
}
