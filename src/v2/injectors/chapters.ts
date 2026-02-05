/**
 * Chapter Formatting for Injection
 *
 * Formats past chapters with programmatic milestone summaries
 * for injection into the "Story So Far" section.
 */

import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { getMilestoneDisplayName } from '../store/projection';
import { computeAllChapters, type ComputedChapter } from '../narrative/computeChapters';

/**
 * Format a character pair for display.
 */
function formatPair(pair: [string, string]): string {
	return `${pair[0]} & ${pair[1]}`;
}

/**
 * Format milestones for a chapter using MILESTONE_DISPLAY_NAMES.
 * Groups milestones by pair for cleaner output.
 *
 * @param milestones - Milestones to format
 * @returns Formatted milestone string (e.g., "Jane & John: First Kiss, Confession; Bob & Alice: First Date")
 */
export function formatMilestones(milestones: ComputedChapter['milestones']): string {
	if (milestones.length === 0) return '';

	// Group milestones by pair
	const byPair = new Map<string, string[]>();
	for (const milestone of milestones) {
		const pairKey = `${milestone.pair[0]}|${milestone.pair[1]}`;
		const displayName = getMilestoneDisplayName(milestone.subject);

		if (!byPair.has(pairKey)) {
			byPair.set(pairKey, []);
		}
		byPair.get(pairKey)!.push(displayName);
	}

	// Format each pair's milestones
	const parts: string[] = [];
	for (const [pairKey, names] of byPair) {
		const [a, b] = pairKey.split('|');
		parts.push(`${formatPair([a, b])}: ${names.join(', ')}`);
	}

	return parts.join('; ');
}

/**
 * Format a single past chapter for injection.
 *
 * @param chapter - The computed chapter data
 * @returns Formatted chapter string
 */
export function formatPastChapter(chapter: ComputedChapter): string {
	const lines: string[] = [];

	// Chapter header with title
	lines.push(`Chapter ${chapter.index + 1}: ${chapter.title}`);

	// Summary if available
	if (chapter.summary) {
		lines.push(`  ${chapter.summary}`);
	}

	// Milestones if available
	const milestonesStr = formatMilestones(chapter.milestones);
	if (milestonesStr) {
		lines.push(`  Milestones: ${milestonesStr}`);
	}

	return lines.join('\n');
}

/**
 * Format pre-computed chapters for injection.
 * Use this when you already have the chapters from computeOptimalContext.
 *
 * @param chapters - Array of pre-computed chapters
 * @returns Formatted chapters string, or empty string if no chapters
 */
export function formatPrecomputedChapters(chapters: ComputedChapter[]): string {
	if (chapters.length === 0) {
		return '';
	}

	// Format each chapter
	const formattedChapters = chapters.map(formatPastChapter);
	return formattedChapters.join('\n');
}

/**
 * Format past chapters for injection into "Story So Far".
 * Only includes completed chapters (those with endReason).
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @param maxChapters - Maximum number of past chapters to include
 * @returns Formatted chapters string, or empty string if no completed chapters
 */
export function formatPastChapters(
	store: EventStore,
	swipeContext: SwipeContext,
	maxChapters: number,
): string {
	const allChapters = computeAllChapters(store, swipeContext);

	// Filter to completed chapters only (those with end reason)
	const completedChapters = allChapters.filter(ch => ch.endReason !== null);

	if (completedChapters.length === 0) {
		return '';
	}

	// Take the most recent chapters
	const recentChapters = completedChapters.slice(-maxChapters);

	// Format each chapter
	const formattedChapters = recentChapters.map(formatPastChapter);

	return formattedChapters.join('\n');
}

/**
 * Format past chapters with wrapper tags for injection.
 *
 * @param store - The event store
 * @param swipeContext - Swipe context for filtering
 * @param maxChapters - Maximum number of past chapters to include
 * @returns Formatted chapters with [Story So Far] tags, or empty string if none
 */
export function formatPastChaptersWithTags(
	store: EventStore,
	swipeContext: SwipeContext,
	maxChapters: number,
): string {
	const content = formatPastChapters(store, swipeContext, maxChapters);
	if (!content) {
		return '';
	}
	return `[Story So Far]\n${content}\n[/Story So Far]`;
}
