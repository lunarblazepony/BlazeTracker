/**
 * Scene Shakeup Types
 *
 * Types for the LLM-driven random event injection system.
 */

import type { MessageAndSwipe } from '../types/common';

/**
 * A single shakeup suggestion returned by the LLM.
 */
export interface ShakeupSuggestion {
	type: string;
	instruction: string;
	rationale: string;
}

/**
 * Per-chat shakeup history tracking when shakeups were triggered.
 */
export interface ShakeupHistory {
	triggers: MessageAndSwipe[];
}

/**
 * Create an empty shakeup history.
 */
export function createEmptyShakeupHistory(): ShakeupHistory {
	return { triggers: [] };
}
