import { EXTENSION_KEY } from '../constants';
import type { ChatMessage } from '../types/st';
import type { StoredStateData } from '../types/state';

type SwipeStateStorage = Record<number, StoredStateData>;

/**
 * Get the swipe ID for a message (defaults to 0 if not set).
 */
export function getSwipeId(message: ChatMessage): number {
	return message.swipe_id ?? 0;
}

export function getMessageState(message: ChatMessage): StoredStateData | null {
	const swipeId = message.swipe_id ?? 0;
	const storage = message.extra?.[EXTENSION_KEY] as SwipeStateStorage | undefined;
	return storage?.[swipeId] ?? null;
}

export function setMessageState(message: ChatMessage, stateData: StoredStateData) {
	const swipeId = message.swipe_id ?? 0;
	if (!message.extra) message.extra = {};
	if (!message.extra[EXTENSION_KEY]) message.extra[EXTENSION_KEY] = {};
	(message.extra[EXTENSION_KEY] as SwipeStateStorage)[swipeId] = stateData;
}
