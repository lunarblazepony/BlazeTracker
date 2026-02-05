/**
 * Context Budget Calculator
 *
 * Computes the optimal context for injection based on available token budget.
 * Uses an iterative algorithm to fit chapters, events, and messages into context.
 */

import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import type { TokenCounter } from '../utils/tokenCount';
import { getDefaultTokenCounter } from '../utils/tokenCount';
import { formatPastChapter } from './chapters';
import { formatEventForInjection, getOutOfContextEvents } from './events';
import {
	computeAllChapters,
	type ComputedChapter,
	getCurrentChapterIndex,
} from '../narrative/computeChapters';
import type { NarrativeEvent } from '../types/snapshot';

/**
 * Result of optimal context computation.
 */
export interface ContextPlan {
	/** Index of first message that fits in context (0-indexed) */
	firstMessageInContext: number;
	/** Past chapters to include (completed chapters before current) */
	pastChapters: ComputedChapter[];
	/** Events from current chapter whose messages are out of context */
	currentChapterEvents: NarrativeEvent[];
	/** The effective current chapter index based on first message in context */
	effectiveCurrentChapter: number;
	/** Total estimated tokens for the planned injection */
	totalTokens: number;
	/** Token breakdown for debugging */
	breakdown: {
		pastChaptersTokens: number;
		currentChapterEventsTokens: number;
		stateTokens: number;
	};
}

/**
 * Options for computing optimal context.
 */
export interface ContextBudgetOptions {
	/** Total available token budget for BlazeTracker injection + messages */
	budget: number;
	/** Tokens used by the state injection (time, location, climate, characters, relationships) */
	stateTokens: number;
	/** Token counts for each message, indexed by message ID */
	messageTokens: Map<number, number>;
	/** The event store */
	store: EventStore;
	/** Swipe context for filtering */
	swipeContext: SwipeContext;
	/** Maximum past chapters to include */
	maxPastChapters: number;
	/** Maximum out-of-context events to include */
	maxEvents: number;
	/** Total number of messages in the chat */
	totalMessages: number;
	/** Token counter to use (defaults to ST counter) */
	tokenCounter?: TokenCounter;
}

/**
 * Get the chapter index for a given message ID.
 * A message belongs to chapter N if it's at or before the message where chapter N ends.
 *
 * @param messageId - The message ID to check
 * @param chapters - All computed chapters
 * @returns The chapter index the message belongs to
 */
export function getChapterAtMessage(messageId: number, chapters: ComputedChapter[]): number {
	// Find the chapter this message belongs to
	for (const chapter of chapters) {
		// If chapter has ended, check if message is at or before end
		if (chapter.endedAtMessage !== null) {
			if (messageId <= chapter.endedAtMessage.messageId) {
				return chapter.index;
			}
		} else {
			// Current chapter (hasn't ended) - message is in this chapter
			return chapter.index;
		}
	}
	// Fallback: return last chapter index
	return chapters.length > 0 ? chapters[chapters.length - 1].index : 0;
}

/**
 * Calculate token cost for a chapter.
 */
async function getChapterTokenCost(
	chapter: ComputedChapter,
	tokenCounter: TokenCounter,
): Promise<number> {
	const formatted = formatPastChapter(chapter);
	return tokenCounter.countTokens(formatted);
}

/**
 * Calculate token cost for an event.
 */
async function getEventTokenCost(
	event: NarrativeEvent,
	tokenCounter: TokenCounter,
): Promise<number> {
	const formatted = formatEventForInjection(event, true);
	return tokenCounter.countTokens(formatted);
}

/**
 * Compute the optimal context plan given a token budget.
 *
 * Algorithm:
 * 1. Start with all messages in context
 * 2. Iteratively push out oldest messages until we fit in budget
 * 3. When messages are pushed out, we may need to add chapter summaries/events
 * 4. Repeat until stable
 *
 * @param options - Configuration options
 * @returns The optimal context plan
 */
export async function computeOptimalContext(options: ContextBudgetOptions): Promise<ContextPlan> {
	const {
		budget,
		stateTokens,
		messageTokens,
		store,
		swipeContext,
		maxPastChapters,
		maxEvents,
		totalMessages,
		tokenCounter = getDefaultTokenCounter(),
	} = options;

	// Edge case: no messages
	if (totalMessages === 0) {
		return {
			firstMessageInContext: 0,
			pastChapters: [],
			currentChapterEvents: [],
			effectiveCurrentChapter: 0,
			totalTokens: stateTokens,
			breakdown: {
				pastChaptersTokens: 0,
				currentChapterEventsTokens: 0,
				stateTokens,
			},
		};
	}

	// Get all chapters
	const allChapters = computeAllChapters(store, swipeContext);
	const currentChapterIndex = getCurrentChapterIndex(store, swipeContext);

	// Pre-compute chapter token costs (we may need these multiple times)
	const chapterTokenCosts = new Map<number, number>();
	for (const chapter of allChapters) {
		if (chapter.endReason !== null) {
			// Only completed chapters
			const cost = await getChapterTokenCost(chapter, tokenCounter);
			chapterTokenCosts.set(chapter.index, cost);
		}
	}

	// Start with all messages in context
	let firstMessageInContext = 0;
	let previousFirstMessage = -1; // Track for convergence detection
	let iterations = 0;
	const maxIterations = totalMessages + 10; // Safety limit

	while (iterations < maxIterations) {
		iterations++;

		// Check for convergence
		if (firstMessageInContext === previousFirstMessage) {
			break;
		}
		previousFirstMessage = firstMessageInContext;

		// 1. Determine effective current chapter (chapter of first message in context)
		const effectiveCurrentChapter = getChapterAtMessage(
			firstMessageInContext,
			allChapters,
		);

		// 2. Calculate past chapters to include (chapters < effectiveCurrentChapter)
		const pastChapters = allChapters
			.filter(ch => ch.endReason !== null && ch.index < effectiveCurrentChapter)
			.slice(-maxPastChapters);

		// 3. Calculate out-of-context events from current chapter
		const outOfContextEvents = getOutOfContextEvents(
			store,
			swipeContext,
			effectiveCurrentChapter,
			firstMessageInContext,
		).slice(-maxEvents);

		// 4. Calculate token costs
		let pastChaptersTokens = 0;
		for (const ch of pastChapters) {
			pastChaptersTokens += chapterTokenCosts.get(ch.index) ?? 0;
		}

		let currentChapterEventsTokens = 0;
		for (const event of outOfContextEvents) {
			currentChapterEventsTokens += await getEventTokenCost(event, tokenCounter);
		}

		// Add section tags overhead
		if (pastChapters.length > 0) {
			// [Story So Far] ... [/Story So Far] tags
			pastChaptersTokens += await tokenCounter.countTokens(
				'[Story So Far]\n\n[/Story So Far]',
			);
		}
		if (outOfContextEvents.length > 0) {
			// [Recent Events] ... [/Recent Events] tags
			currentChapterEventsTokens += await tokenCounter.countTokens(
				'[Recent Events]\n\n[/Recent Events]',
			);
		}

		// 5. Calculate message token cost
		let messageTokensTotal = 0;
		for (let i = firstMessageInContext; i < totalMessages; i++) {
			messageTokensTotal += messageTokens.get(i) ?? 0;
		}

		// 6. Total cost
		const totalCost =
			stateTokens +
			pastChaptersTokens +
			currentChapterEventsTokens +
			messageTokensTotal;

		// 7. Check if we're within budget
		if (totalCost <= budget) {
			// We fit! Return this plan
			return {
				firstMessageInContext,
				pastChapters,
				currentChapterEvents: outOfContextEvents,
				effectiveCurrentChapter,
				totalTokens: totalCost,
				breakdown: {
					pastChaptersTokens,
					currentChapterEventsTokens,
					stateTokens,
				},
			};
		}

		// 8. Over budget - push out oldest message
		firstMessageInContext++;

		// Check if we've pushed out all messages
		if (firstMessageInContext >= totalMessages) {
			// Can't fit any messages - return minimal plan
			return {
				firstMessageInContext: totalMessages,
				pastChapters: [],
				currentChapterEvents: [],
				effectiveCurrentChapter: currentChapterIndex,
				totalTokens: stateTokens,
				breakdown: {
					pastChaptersTokens: 0,
					currentChapterEventsTokens: 0,
					stateTokens,
				},
			};
		}
	}

	// Convergence not reached within max iterations - return best effort
	// This shouldn't happen in practice, but we handle it gracefully
	return {
		firstMessageInContext,
		pastChapters: [],
		currentChapterEvents: [],
		effectiveCurrentChapter: currentChapterIndex,
		totalTokens: stateTokens,
		breakdown: {
			pastChaptersTokens: 0,
			currentChapterEventsTokens: 0,
			stateTokens,
		},
	};
}

/**
 * Simple context computation for cases where we don't need full optimization.
 * Just returns all chapters and events up to limits.
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @param maxPastChapters - Maximum past chapters
 * @param maxEvents - Maximum events
 * @returns Basic context plan without budget optimization
 */
export function computeSimpleContext(
	store: EventStore,
	swipeContext: SwipeContext,
	maxPastChapters: number,
): { pastChapters: ComputedChapter[]; currentChapterIndex: number } {
	const allChapters = computeAllChapters(store, swipeContext);
	const currentChapterIndex = getCurrentChapterIndex(store, swipeContext);

	// Get completed chapters
	const pastChapters = allChapters
		.filter(ch => ch.endReason !== null && ch.index < currentChapterIndex)
		.slice(-maxPastChapters);

	return {
		pastChapters,
		currentChapterIndex,
	};
}

/**
 * Estimate message token counts for a chat.
 * Uses pre-calculated counts if available, otherwise estimates.
 *
 * @param messages - Array of messages with optional token counts
 * @param tokenCounter - Token counter to use for estimation
 * @returns Map of message ID to token count
 */
export async function estimateMessageTokens(
	messages: Array<{ mes: string; extra?: { token_count?: number } }>,
	tokenCounter: TokenCounter = getDefaultTokenCounter(),
): Promise<Map<number, number>> {
	const tokenMap = new Map<number, number>();

	for (let i = 0; i < messages.length; i++) {
		const msg = messages[i];
		if (msg.extra?.token_count !== undefined) {
			// Use pre-calculated count
			tokenMap.set(i, msg.extra.token_count);
		} else {
			// Estimate
			const count = await tokenCounter.countTokens(msg.mes);
			tokenMap.set(i, count);
		}
	}

	return tokenMap;
}
