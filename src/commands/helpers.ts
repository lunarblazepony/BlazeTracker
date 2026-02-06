// ============================================
// Slash Command Helper Functions (Pure/Testable)
// ============================================

import type { STContext } from '../types/st';
import type { TrackedState } from '../types/state';
import { getMessageState } from '../utils/messageState';
import type { EventStore } from '../v2/store/EventStore';
import type { SwipeContext } from '../v2/store/projection';

/**
 * Get the most recent message ID from the chat.
 */
export function getMostRecentMessageId(context: STContext): number {
	return context.chat.length - 1;
}

/**
 * Get stored state for a message by ID.
 */
export function getStateForMessage(context: STContext, messageId: number): TrackedState | null {
	const message = context.chat[messageId];
	if (!message) return null;
	const stateData = getMessageState(message);
	return stateData?.state ?? null;
}

/**
 * Count messages that have extracted state.
 */
export function countExtractedMessages(context: STContext): { extracted: number; total: number } {
	let extracted = 0;
	const total = context.chat.length;

	for (let i = 0; i < total; i++) {
		const message = context.chat[i];
		if (getMessageState(message)) {
			extracted++;
		}
	}

	return { extracted, total };
}

/**
 * Find the ID of the last message that has extracted state.
 * Returns -1 if no messages have state.
 */
export function getLastExtractedMessageId(context: STContext): number {
	for (let i = context.chat.length - 1; i >= 0; i--) {
		const message = context.chat[i];
		if (getMessageState(message)) {
			return i;
		}
	}
	return -1;
}

/**
 * Find the first message ID on the canonical swipe path that has no snapshot
 * and no active events. Walks messages from 1 to totalMessages-1.
 *
 * Returns totalMessages if all messages are covered.
 */
export function findFirstUnextractedMessageId(
	store: EventStore,
	swipeContext: SwipeContext,
	totalMessages: number,
): number {
	// Build set of message IDs that have snapshots on the canonical path
	const coveredMessageIds = new Set<number>();
	for (const snapshot of store.snapshots) {
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(
			snapshot.source.messageId,
		);
		if (snapshot.swipeId === canonicalSwipeId) {
			coveredMessageIds.add(snapshot.source.messageId);
		}
	}

	// Add message IDs that have canonical active events
	for (const event of store.getActiveEvents()) {
		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId === canonicalSwipeId) {
			coveredMessageIds.add(event.source.messageId);
		}
	}

	// Walk forward from message 1 to find the first uncovered message
	for (let i = 1; i < totalMessages; i++) {
		if (!coveredMessageIds.has(i)) {
			return i;
		}
	}

	return totalMessages;
}
