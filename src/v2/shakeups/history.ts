/**
 * Shakeup History Management
 *
 * Tracks when shakeups were triggered and computes distance
 * to the last shakeup along the canonical swipe path.
 */

import type { MessageAndSwipe } from '../types/common';
import type { SwipeContext } from '../store/projection';
import type { ShakeupHistory } from './types';

/**
 * Get the number of messages since the last shakeup on the canonical swipe path.
 *
 * Filters history to only include triggers on the canonical path,
 * then computes distance from the most recent one.
 *
 * @param history - The shakeup history
 * @param currentMessageId - Current message ID
 * @param swipeContext - Context for canonical swipe resolution
 * @returns Number of messages since last canonical shakeup, or currentMessageId if none
 */
export function getMessagesSinceLastShakeup(
	history: ShakeupHistory,
	currentMessageId: number,
	swipeContext: SwipeContext,
): number {
	// Filter triggers to canonical swipe path
	const canonicalTriggers = history.triggers.filter(
		trigger => swipeContext.getCanonicalSwipeId(trigger.messageId) === trigger.swipeId,
	);

	if (canonicalTriggers.length === 0) {
		return currentMessageId;
	}

	// Find the most recent trigger
	const lastTrigger = canonicalTriggers.reduce((latest, trigger) =>
		trigger.messageId > latest.messageId ? trigger : latest,
	);

	return currentMessageId - lastTrigger.messageId;
}

/**
 * Add a shakeup trigger to the history.
 */
export function addShakeupTrigger(history: ShakeupHistory, trigger: MessageAndSwipe): void {
	history.triggers.push(trigger);
}
