/**
 * Chapter Invalidation Handler
 *
 * Handles chapter snapshot invalidation due to swipe changes and manual recalculation.
 * When a chapter's trigger message swipe changes, the chapter needs to be re-evaluated.
 */

import type { Generator } from '../generator';
import type { EventStore } from '../store';
import type { ExtractionContext, ExtractionSettings } from '../extractors/types';
import type { MessageAndSwipe } from '../types/common';
import type { SwipeContext } from '../store/projection';
import { createSnapshotFromProjection } from '../types/snapshot';
import {
	buildSwipeContextFromExtraction,
	buildExtractorPrompt,
	generateAndParse,
	mapChapterDescription,
	getExtractorTemperature,
	formatMessages,
} from '../extractors/utils';
import { chapterDescriptionPrompt } from '../prompts/events/chapterDescriptionPrompt';
import { chapterEndedExtractor } from '../extractors/events/chapterEndedExtractor';
import type { ChapterEndedEvent, ChapterDescribedEvent } from '../types/event';
import { isChapterEndedEvent } from '../types/event';
import { computeNarrativeEvents, computeChapters } from '../narrative/computeNarrativeEvents';
import type { NarrativeEvent } from '../types/snapshot';
import { debugLog, debugWarn } from '../../utils/debug';

/**
 * Milestone info for chapter milestones.
 */
interface MilestoneInfo {
	pair: [string, string];
	subject: string;
	description?: string;
}

/**
 * Handle chapter invalidation due to swipe changes.
 *
 * If the trigger message swipe changed:
 * 1. Re-run chapterEndedExtractor to check if chapter still ends
 * 2. If chapter no longer ends: remove snapshot and all chapter events
 * 3. If chapter still ends: regenerate description and rebuild snapshot
 *
 * @param generator - LLM generator
 * @param store - Event store (will be modified)
 * @param context - Extraction context
 * @param settings - Extraction settings
 * @param chapterIndex - Chapter index to handle
 * @param swipeContext - Swipe context for filtering
 * @param setStatus - Optional status callback
 */
export async function handleChapterInvalidation(
	generator: Generator,
	store: EventStore,
	context: ExtractionContext,
	settings: ExtractionSettings,
	chapterIndex: number,
	swipeContext: SwipeContext,
	setStatus?: (status: string) => void,
	abortSignal?: AbortSignal,
): Promise<void> {
	const snapshot = store.getChapterSnapshotOnCanonicalPath(chapterIndex, swipeContext);
	if (!snapshot?.chapterTriggerMessage) {
		debugWarn(
			`Chapter ${chapterIndex} has no trigger message on canonical path, skipping invalidation`,
		);
		return;
	}

	const triggerMessage = snapshot.chapterTriggerMessage;
	debugLog(
		`Handling invalidation for chapter ${chapterIndex} (trigger: ${triggerMessage.messageId})`,
	);

	setStatus?.(`Re-evaluating chapter ${chapterIndex + 1}...`);

	// Get the new canonical swipe for the trigger message
	const newSwipeId = swipeContext.getCanonicalSwipeId(triggerMessage.messageId);
	const newTriggerMessage: MessageAndSwipe = {
		messageId: triggerMessage.messageId,
		swipeId: newSwipeId,
	};

	// Delete old chapter events for this chapter
	deleteChapterEvents(store, chapterIndex, swipeContext);

	// Remove the old chapter snapshot (use old trigger message's swipe since that's where it was created)
	store.removeChapterSnapshotAtMessage(triggerMessage.messageId, triggerMessage.swipeId);

	// Get events that led up to the trigger message (excluding old chapter events)
	const eventsUpToTrigger = store
		.getActiveEvents()
		.filter(e => e.source.messageId <= triggerMessage.messageId);

	// Re-run chapter ended extractor to check if chapter still ends
	const chapterEndedEvents = await chapterEndedExtractor.run(
		generator,
		context,
		settings,
		store,
		newTriggerMessage,
		eventsUpToTrigger,
		abortSignal,
	);

	// Check if we got a ChapterEndedEvent
	const newChapterEndedEvent = chapterEndedEvents.find(isChapterEndedEvent) as
		| ChapterEndedEvent
		| undefined;

	if (!newChapterEndedEvent) {
		// Chapter no longer ends at this message - we're done
		debugLog(
			`Chapter ${chapterIndex} no longer ends at message ${triggerMessage.messageId}`,
		);
		return;
	}

	// Chapter still ends - add the new chapter ended event
	store.appendEvents(chapterEndedEvents);

	// Now regenerate the description
	setStatus?.(`Regenerating chapter ${chapterIndex + 1} description...`);
	await regenerateChapterDescription(
		generator,
		store,
		context,
		settings,
		chapterIndex,
		newTriggerMessage,
		abortSignal,
	);

	// Rebuild chapter snapshot from projection
	setStatus?.(`Rebuilding chapter ${chapterIndex + 1} snapshot...`);
	const projection = store.projectStateAtMessage(newTriggerMessage.messageId, swipeContext);
	const newSnapshot = createSnapshotFromProjection(projection, chapterIndex);
	newSnapshot.chapterTriggerMessage = { ...newTriggerMessage };
	store.addChapterSnapshot(newSnapshot);

	debugLog(`Chapter ${chapterIndex} invalidation complete`);
}

/**
 * Manually recalculate chapter description and snapshot.
 * Used by the manual recalculate button in the UI.
 *
 * This does NOT re-run chapter ended detection - only regenerates
 * the description and rebuilds the snapshot from current state.
 *
 * @param generator - LLM generator
 * @param store - Event store (will be modified)
 * @param context - Extraction context
 * @param settings - Extraction settings
 * @param chapterIndex - Chapter index to recalculate
 * @param setStatus - Optional status callback
 */
export async function recalculateChapterDescription(
	generator: Generator,
	store: EventStore,
	context: ExtractionContext,
	settings: ExtractionSettings,
	chapterIndex: number,
	setStatus?: (status: string) => void,
	abortSignal?: AbortSignal,
): Promise<void> {
	const swipeContext = buildSwipeContextFromExtraction(context);

	// Try to get the trigger message from existing snapshot first
	const existingSnapshot = store.getChapterSnapshotOnCanonicalPath(
		chapterIndex,
		swipeContext,
	);
	let triggerMessage: MessageAndSwipe | null =
		existingSnapshot?.chapterTriggerMessage ?? null;

	// If no snapshot, try to find the ChapterEndedEvent to get the trigger message
	if (!triggerMessage) {
		const events = store.getActiveEvents();
		for (const event of events) {
			const canonicalSwipeId = swipeContext.getCanonicalSwipeId(
				event.source.messageId,
			);
			if (event.source.swipeId !== canonicalSwipeId) continue;

			if (
				event.kind === 'chapter' &&
				'subkind' in event &&
				event.subkind === 'ended' &&
				(event as ChapterEndedEvent).chapterIndex === chapterIndex
			) {
				triggerMessage = event.source;
				break;
			}
		}
	}

	if (!triggerMessage) {
		debugWarn(
			`Chapter ${chapterIndex} has no snapshot or ChapterEndedEvent on canonical path, cannot recalculate`,
		);
		return;
	}

	debugLog(`Manual recalculation for chapter ${chapterIndex}`);

	setStatus?.(`Recalculating chapter ${chapterIndex + 1} description...`);

	// Delete only the ChapterDescribedEvent (preserve ChapterEndedEvent)
	deleteChapterDescribedEvent(store, chapterIndex, swipeContext);

	// Regenerate the description
	await regenerateChapterDescription(
		generator,
		store,
		context,
		settings,
		chapterIndex,
		triggerMessage,
		abortSignal,
	);

	// Rebuild chapter snapshot from projection
	setStatus?.(`Rebuilding chapter ${chapterIndex + 1} snapshot...`);

	// IMPORTANT: Remove old snapshot BEFORE projecting (if it exists), so projection uses
	// initial snapshot + events instead of the old chapter snapshot.
	// Use swipe-aware removal to only remove the snapshot at this specific message/swipe.
	if (existingSnapshot) {
		store.removeChapterSnapshotAtMessage(
			triggerMessage.messageId,
			triggerMessage.swipeId,
		);
	}

	const projection = store.projectStateAtMessage(triggerMessage.messageId, swipeContext);
	const newSnapshot = createSnapshotFromProjection(projection, chapterIndex);
	newSnapshot.chapterTriggerMessage = { ...triggerMessage };

	store.addChapterSnapshot(newSnapshot);

	debugLog(`Chapter ${chapterIndex} manual recalculation complete`);
}

// ============================================
// Helper Functions
// ============================================

/**
 * Delete all chapter events (ChapterEndedEvent and ChapterDescribedEvent) for a chapter.
 */
function deleteChapterEvents(
	store: EventStore,
	chapterIndex: number,
	swipeContext: SwipeContext,
): void {
	const events = store.events;
	for (const event of events) {
		if (event.deleted) continue;

		// Check if canonical
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (event.kind === 'chapter' && 'subkind' in event) {
			if (
				(event.subkind === 'ended' &&
					(event as ChapterEndedEvent).chapterIndex ===
						chapterIndex) ||
				(event.subkind === 'described' &&
					(event as ChapterDescribedEvent).chapterIndex ===
						chapterIndex)
			) {
				event.deleted = true;
			}
		}
	}
}

/**
 * Delete only the ChapterDescribedEvent for a chapter.
 */
function deleteChapterDescribedEvent(
	store: EventStore,
	chapterIndex: number,
	swipeContext: SwipeContext,
): void {
	const events = store.events;
	for (const event of events) {
		if (event.deleted) continue;

		// Check if canonical
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (
			event.kind === 'chapter' &&
			'subkind' in event &&
			event.subkind === 'described' &&
			(event as ChapterDescribedEvent).chapterIndex === chapterIndex
		) {
			event.deleted = true;
		}
	}
}

/**
 * Regenerate chapter description for a specific chapter.
 * Adds new ChapterDescribedEvent to the store.
 */
async function regenerateChapterDescription(
	generator: Generator,
	store: EventStore,
	context: ExtractionContext,
	settings: ExtractionSettings,
	chapterIndex: number,
	currentMessage: MessageAndSwipe,
	abortSignal?: AbortSignal,
): Promise<void> {
	const swipeContext = buildSwipeContextFromExtraction(context);

	// Get chapter start message (previous chapter snapshot + 1, or 0) - swipe-aware
	const chapterStartMsg = getChapterStartMessage(store, chapterIndex, swipeContext);

	// Get ALL messages for this chapter
	const allChapterMessages = formatMessages(
		context,
		chapterStartMsg,
		currentMessage.messageId,
	);

	// Get ALL narrative events for this chapter
	const chapterNarrativeEvents = computeNarrativeEvents(store, swipeContext, chapterIndex);

	// Compute milestones for this chapter
	const chapterMilestones = computeChapterMilestones(store, chapterIndex, swipeContext);

	// Get current state projection
	const projection = store.projectStateAtMessage(currentMessage.messageId, swipeContext);

	// Build additional placeholder values
	const additionalValues: Record<string, string> = {
		allChapterMessages,
		chapterNarrativeEvents: formatNarrativeEvents(chapterNarrativeEvents),
		chapterMilestones: formatMilestones(chapterMilestones),
		chapterTimeRange: formatTimeRange(chapterNarrativeEvents),
		chapterSummaries: formatChapterSummaries(store, swipeContext, chapterIndex),
	};

	// Build the prompt
	const builtPrompt = buildExtractorPrompt(
		chapterDescriptionPrompt,
		context,
		projection,
		settings,
		chapterStartMsg,
		currentMessage.messageId,
		{ additionalValues },
	);

	// Get temperature
	const temperature = getExtractorTemperature(
		settings,
		chapterDescriptionPrompt.name,
		'chapters',
		0.7,
	);

	// Generate and parse the response
	const result = await generateAndParse(
		generator,
		chapterDescriptionPrompt,
		builtPrompt,
		temperature,
		{ abortSignal },
	);

	if (!result.success || !result.data) {
		debugWarn('Chapter description regeneration failed:', result.error);
		return;
	}

	// Map to events and add to store
	const events = mapChapterDescription(result.data, currentMessage, chapterIndex);
	store.appendEvents(events);
}

/**
 * Get the chapter start message ID (swipe-aware).
 */
function getChapterStartMessage(
	store: EventStore,
	chapterIndex: number,
	swipeContext: SwipeContext,
): number {
	if (chapterIndex === 0) return 0;

	const prevChapterSnapshot = store.getChapterSnapshotOnCanonicalPath(
		chapterIndex - 1,
		swipeContext,
	);

	if (prevChapterSnapshot) {
		return prevChapterSnapshot.source.messageId + 1;
	}

	return 0;
}

/**
 * Compute milestones for a specific chapter.
 */
function computeChapterMilestones(
	store: EventStore,
	chapterIndex: number,
	swipeContext: SwipeContext,
): MilestoneInfo[] {
	const narrativeEvents = computeNarrativeEvents(store, swipeContext);

	const milestones: MilestoneInfo[] = [];
	for (const event of narrativeEvents) {
		if (event.chapterIndex !== chapterIndex) continue;
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
 * Format narrative events for prompt.
 */
function formatNarrativeEvents(events: NarrativeEvent[]): string {
	if (events.length === 0) return '(No narrative events)';
	return events.map(e => `- ${e.description}`).join('\n');
}

/**
 * Format milestones for prompt.
 */
function formatMilestones(milestones: MilestoneInfo[]): string {
	if (milestones.length === 0) return '(No milestones)';
	return milestones
		.map(m => {
			const pairStr = m.pair.join(' & ');
			const desc = m.description ? ` - ${m.description}` : '';
			return `- ${m.subject}: ${pairStr}${desc}`;
		})
		.join('\n');
}

/**
 * Format time range for chapter.
 */
function formatTimeRange(narrativeEvents: NarrativeEvent[]): string {
	if (narrativeEvents.length === 0) return 'Unknown';

	const eventsWithTime = narrativeEvents.filter(e => e.narrativeTime !== null);
	if (eventsWithTime.length === 0) return 'Unknown';

	const firstTime = eventsWithTime[0].narrativeTime;
	const lastTime = eventsWithTime[eventsWithTime.length - 1].narrativeTime;

	if (!firstTime || !lastTime) return 'Unknown';

	if (firstTime.isSame(lastTime, 'day')) {
		return `${firstTime.format('dddd')}, ${firstTime.format('h:mm A')} to ${lastTime.format('h:mm A')}`;
	}

	return `${firstTime.format('dddd h:mm A')} to ${lastTime.format('dddd h:mm A')}`;
}

/**
 * Format chapter summaries for prompt.
 */
function formatChapterSummaries(
	store: EventStore,
	swipeContext: SwipeContext,
	upToChapter: number,
): string {
	const chapters = computeChapters(store, swipeContext);

	const summaries: string[] = [];
	for (const chapter of chapters) {
		if (chapter.index >= upToChapter) break;
		if (chapter.summary) {
			const firstPara = chapter.summary.split('\n\n')[0];
			summaries.push(
				`Chapter ${chapter.index + 1} (${chapter.title}): ${firstPara}`,
			);
		} else {
			summaries.push(
				`Chapter ${chapter.index + 1} (${chapter.title}): No summary available`,
			);
		}
	}

	return summaries.length > 0 ? summaries.join('\n\n') : '(First chapter - no previous)';
}
