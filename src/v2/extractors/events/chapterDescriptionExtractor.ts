/**
 * Chapter Description Event Extractor
 *
 * Generates title and summary for a chapter that just ended.
 * Runs only when a ChapterEndedEvent exists in turnEvents.
 *
 * Sends ALL chapter messages, narrative events, and computed milestones to the prompt.
 */

import type { Generator } from '../../generator';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategyContext,
} from '../types';
import type {
	Event,
	MessageAndSwipe,
	ChapterEndedEvent,
	ExtractedChapterDescription,
} from '../../types';
import { isChapterEndedEvent } from '../../types';
import { chapterDescriptionPrompt } from '../../prompts/events/chapterDescriptionPrompt';
import {
	buildExtractorPrompt,
	generateAndParse,
	mapChapterDescription,
	buildSwipeContextFromExtraction,
	projectWithTurnEvents,
	getExtractorTemperature,
	formatMessages,
	limitMessageRange,
	getMaxMessages,
} from '../utils';
import type { EventStore } from '../../store';
import type { SwipeContext } from '../../store/projection';
import { computeNarrativeEvents, computeChapters } from '../../narrative/computeNarrativeEvents';
import type { NarrativeEvent } from '../../types/snapshot';
import { debugWarn } from '../../../utils/debug';
import { getWorldinfoForPrompt } from '../../utils/worldinfo';

/**
 * Get the chapter start message ID (swipe-aware).
 * Chapter N starts at previous chapter snapshot's messageId + 1, or 0 for first chapter.
 */
function getChapterStartMessage(
	store: EventStore,
	chapterIndex: number,
	swipeContext: SwipeContext,
): number {
	if (chapterIndex === 0) return 0;

	// Find the chapter snapshot for the previous chapter on canonical path
	const prevChapterSnapshot = store.getChapterSnapshotOnCanonicalPath(
		chapterIndex - 1,
		swipeContext,
	);

	if (prevChapterSnapshot) {
		return prevChapterSnapshot.source.messageId + 1;
	}

	// Fallback: no previous snapshot, start from 0
	return 0;
}

/**
 * Milestone info for a chapter.
 */
interface MilestoneInfo {
	pair: [string, string];
	subject: string;
	description?: string;
}

/**
 * Compute milestones that occurred in a specific chapter.
 * Returns milestones in this chapter - milestones in previous chapters.
 */
function computeChapterMilestones(
	store: EventStore,
	chapterIndex: number,
	context: ExtractionContext,
): MilestoneInfo[] {
	const swipeContext = buildSwipeContextFromExtraction(context);
	const narrativeEvents = computeNarrativeEvents(store, swipeContext);

	// Get milestones that occurred specifically in this chapter
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
 * Format chapter summaries for prompt.
 */
function formatChapterSummaries(
	store: EventStore,
	context: ExtractionContext,
	upToChapter: number,
): string {
	const swipeContext = buildSwipeContextFromExtraction(context);
	const chapters = computeChapters(store, swipeContext);

	// Get summaries for chapters before the current one
	const summaries: string[] = [];
	for (const chapter of chapters) {
		if (chapter.index >= upToChapter) break;
		if (chapter.summary) {
			// Just take the first paragraph for brevity
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

	// If same day, format as "Day, Time1 to Time2"
	if (firstTime.isSame(lastTime, 'day')) {
		return `${firstTime.format('dddd')}, ${firstTime.format('h:mm A')} to ${lastTime.format('h:mm A')}`;
	}

	// Different days
	return `${firstTime.format('dddd h:mm A')} to ${lastTime.format('dddd h:mm A')}`;
}

/**
 * Chapter description event extractor.
 * Generates evocative chapter titles and comprehensive 3-4 paragraph summaries for completed chapters.
 */
export const chapterDescriptionExtractor: EventExtractor<ExtractedChapterDescription> = {
	name: 'chapterDescription',
	displayName: 'chapter',
	category: 'chapters',
	defaultTemperature: 0.7,
	prompt: chapterDescriptionPrompt,

	// Message strategy is now computed in run() - we need ALL chapter messages
	messageStrategy: {
		strategy: 'sinceLastEventOfKind',
		kinds: [{ kind: 'chapter', subkind: 'ended' }],
	},
	runStrategy: {
		strategy: 'newEventsOfKind',
		kinds: [{ kind: 'chapter', subkind: 'ended' }],
	},

	shouldRun(context: RunStrategyContext): boolean {
		// Only run if chapters tracking is enabled AND there's a ChapterEndedEvent in turnEvents
		if (!context.settings.track.chapters) return false;

		return context.turnEvents.some(
			e => e.kind === 'chapter' && 'subkind' in e && e.subkind === 'ended',
		);
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get the chapter ended event from turnEvents
		const chapterEndedEvent = turnEvents.find(isChapterEndedEvent) as
			| ChapterEndedEvent
			| undefined;

		if (!chapterEndedEvent) {
			return [];
		}

		const chapterIndex = chapterEndedEvent.chapterIndex;
		const swipeContext = buildSwipeContextFromExtraction(context);

		// Get chapter start message (previous chapter snapshot + 1, or 0) - swipe-aware
		let chapterStartMsg = getChapterStartMessage(store, chapterIndex, swipeContext);
		let chapterEndMsg = currentMessage.messageId;

		// Apply message limiting (uses maxChapterMessagesToSend)
		const maxMessages = getMaxMessages(settings, this.name);
		({ messageStart: chapterStartMsg, messageEnd: chapterEndMsg } = limitMessageRange(
			chapterStartMsg,
			chapterEndMsg,
			maxMessages,
		));

		// Get messages for this chapter (limited)
		const allChapterMessages = formatMessages(context, chapterStartMsg, chapterEndMsg);

		// Get ALL narrative events for this chapter
		// We need a working store with turn events to get the latest narrative events
		const workingStore = store.getDeepClone();
		workingStore.appendEvents(turnEvents);
		const chapterNarrativeEvents = computeNarrativeEvents(
			workingStore,
			swipeContext,
			chapterIndex,
		);

		// Compute milestones for this chapter
		const chapterMilestones = computeChapterMilestones(
			workingStore,
			chapterIndex,
			context,
		);

		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		// Fetch worldinfo if enabled
		let worldinfo = 'No worldinfo available';
		if (settings.includeWorldinfo) {
			const messagesForWorldinfo: string[] = [];
			for (
				let i = chapterStartMsg;
				i <= chapterEndMsg && i < context.chat.length;
				i++
			) {
				const msg = context.chat[i];
				if (!msg.is_system) {
					messagesForWorldinfo.push(msg.mes);
				}
			}
			worldinfo =
				(await getWorldinfoForPrompt(messagesForWorldinfo)) ||
				'No worldinfo available';
		}

		// Build additional placeholder values for chapter-specific context
		const additionalValues: Record<string, string> = {
			allChapterMessages,
			chapterNarrativeEvents: formatNarrativeEvents(chapterNarrativeEvents),
			chapterMilestones: formatMilestones(chapterMilestones),
			chapterTimeRange: formatTimeRange(chapterNarrativeEvents),
			chapterSummaries: formatChapterSummaries(store, context, chapterIndex),
			worldinfo,
		};

		// Build the prompt with chapter context
		const builtPrompt = buildExtractorPrompt(
			chapterDescriptionPrompt,
			context,
			projection,
			settings,
			chapterStartMsg, // Start from chapter start
			currentMessage.messageId,
			{ additionalValues },
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'chapters',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			chapterDescriptionPrompt,
			builtPrompt,
			temperature,
			{ abortSignal },
		);

		// If parsing failed, return empty array
		if (!result.success || !result.data) {
			debugWarn('chapterDescription extraction failed:', result.error);
			return [];
		}

		// Map the extraction to events
		const events = mapChapterDescription(result.data, currentMessage, chapterIndex);

		return events;
	},
};
