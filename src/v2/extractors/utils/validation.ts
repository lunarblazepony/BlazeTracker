/**
 * Extraction Validation Utilities
 *
 * Provides functions for:
 * - Building SwipeContext from ExtractionContext
 * - Getting prior projection for validation
 * - Deduplicating extraction results
 * - Validating extracted values against current state
 */

import type { ExtractionContext } from '../types';
import type { EventStore } from '../../store';
import type { SwipeContext } from '../../store/projection';
import type { Projection, CharacterState, RelationshipState } from '../../types/snapshot';
import type { MessageAndSwipe, OutfitSlot } from '../../types/common';
import type { Event } from '../../types/event';
import { sortPair } from '../../types/snapshot';

// ============================================
// SwipeContext Building
// ============================================

/**
 * Build a SwipeContext from ExtractionContext.
 * Uses chat message swipe_id values for canonical swipe lookup.
 */
export function buildSwipeContextFromExtraction(context: ExtractionContext): SwipeContext {
	return {
		getCanonicalSwipeId: (messageId: number): number => {
			const message = context.chat[messageId];
			return message?.swipe_id ?? 0;
		},
	};
}

/**
 * Project state including pending turn events.
 * Creates a deep clone of the store, appends turn events, then projects.
 * This allows extractors to see state changes from earlier extractors in the same turn.
 *
 * @param store - The event store (not mutated)
 * @param turnEvents - Events extracted so far this turn
 * @param messageId - Message to project state at
 * @param context - Extraction context for swipe filtering
 * @returns Projection including turn events
 */
export function projectWithTurnEvents(
	store: EventStore,
	turnEvents: Event[],
	messageId: number,
	context: ExtractionContext,
): Projection {
	const workingStore = store.getDeepClone();
	workingStore.appendEvents(turnEvents);
	const swipeContext = buildSwipeContextFromExtraction(context);
	return workingStore.projectStateAtMessage(messageId, swipeContext);
}

// ============================================
// Prior State Projection
// ============================================

/**
 * Get projection at messageId - 1 for validation.
 * Returns null if messageId is 0 or 1 (no prior state to compare).
 *
 * @param store - The event store
 * @param currentMessage - Current message being extracted
 * @param context - Extraction context (for swipe info)
 * @returns Projection at prior message, or null
 */
export function getPriorProjection(
	store: EventStore,
	currentMessage: MessageAndSwipe,
	context: ExtractionContext,
): Projection | null {
	// No prior state for first messages
	if (currentMessage.messageId <= 1) {
		return null;
	}

	// Must have initial snapshot
	if (!store.hasInitialSnapshot) {
		return null;
	}

	try {
		const swipeContext = buildSwipeContextFromExtraction(context);
		return store.projectStateAtMessage(currentMessage.messageId - 1, swipeContext);
	} catch {
		return null;
	}
}

// ============================================
// Deduplication
// ============================================

/**
 * Deduplicate an array of strings (case-insensitive).
 * Returns unique values, preserving first occurrence casing.
 */
export function dedupeStrings(arr: string[]): string[] {
	const seen = new Set<string>();
	const result: string[] = [];

	for (const item of arr) {
		const lower = item.toLowerCase().trim();
		if (lower && !seen.has(lower)) {
			seen.add(lower);
			result.push(item.trim());
		}
	}

	return result;
}

// ============================================
// Character State Validation
// ============================================

/**
 * Filter moods to add - removes moods that already exist in character state.
 */
export function filterMoodsToAdd(
	moods: string[],
	characterState: CharacterState | undefined,
): string[] {
	if (!characterState) return dedupeStrings(moods);

	const existingMoods = new Set(characterState.mood.map(m => m.toLowerCase()));
	return dedupeStrings(moods).filter(mood => !existingMoods.has(mood.toLowerCase()));
}

/**
 * Filter moods to remove - removes moods that don't exist in character state.
 */
export function filterMoodsToRemove(
	moods: string[],
	characterState: CharacterState | undefined,
): string[] {
	if (!characterState) return [];

	const existingMoods = new Set(characterState.mood.map(m => m.toLowerCase()));
	return dedupeStrings(moods).filter(mood => existingMoods.has(mood.toLowerCase()));
}

/**
 * Filter physical states to add - removes states that already exist.
 */
export function filterPhysicalToAdd(
	states: string[],
	characterState: CharacterState | undefined,
): string[] {
	if (!characterState) return dedupeStrings(states);

	const existingStates = new Set(characterState.physicalState.map(s => s.toLowerCase()));
	return dedupeStrings(states).filter(state => !existingStates.has(state.toLowerCase()));
}

/**
 * Filter physical states to remove - removes states that don't exist.
 */
export function filterPhysicalToRemove(
	states: string[],
	characterState: CharacterState | undefined,
): string[] {
	if (!characterState) return [];

	const existingStates = new Set(characterState.physicalState.map(s => s.toLowerCase()));
	return dedupeStrings(states).filter(state => existingStates.has(state.toLowerCase()));
}

/**
 * Filter outfit slots to remove - removes slots that are already empty (null).
 */
export function filterOutfitSlotsToRemove(
	slots: string[],
	characterState: CharacterState | undefined,
): OutfitSlot[] {
	if (!characterState) return [];

	const validSlots: OutfitSlot[] = [];
	for (const slot of slots) {
		const slotKey = slot as OutfitSlot;
		// Only include if the slot currently has something
		if (characterState.outfit[slotKey]) {
			validSlots.push(slotKey);
		}
	}

	return validSlots;
}

/**
 * Filter outfit slots to add - removes slots that already have the same value.
 */
export function filterOutfitSlotsToAdd(
	added: Record<string, string>,
	characterState: CharacterState | undefined,
): Record<string, string> {
	if (!characterState) return added;

	const result: Record<string, string> = {};
	for (const [slot, value] of Object.entries(added)) {
		const slotKey = slot as OutfitSlot;
		const currentValue = characterState.outfit[slotKey];
		// Only include if the value is different
		if (currentValue?.toLowerCase() !== value.toLowerCase()) {
			result[slot] = value;
		}
	}

	return result;
}

// ============================================
// Relationship State Validation
// ============================================

/**
 * Get relationship state for a pair from projection.
 */
export function getRelationshipState(
	projection: Projection | null,
	char1: string,
	char2: string,
): RelationshipState | undefined {
	if (!projection) return undefined;

	const [a, b] = sortPair(char1, char2);
	const key = `${a}|${b}`;
	return projection.relationships[key];
}

/**
 * Get directed relationship data (A's feelings toward B).
 */
export function getDirectedRelationship(
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): { feelings: string[]; wants: string[]; secrets: string[] } | undefined {
	const relState = getRelationshipState(projection, fromChar, towardChar);
	if (!relState) return undefined;

	const [a] = sortPair(fromChar, towardChar);
	// If fromChar is the first in sorted pair, use aToB, otherwise bToA
	if (fromChar === a) {
		return relState.aToB;
	} else {
		return relState.bToA;
	}
}

/**
 * Filter feelings to add - removes feelings that already exist.
 */
export function filterFeelingsToAdd(
	feelings: string[],
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): string[] {
	const directed = getDirectedRelationship(projection, fromChar, towardChar);
	if (!directed) return dedupeStrings(feelings);

	const existingFeelings = new Set(directed.feelings.map(f => f.toLowerCase()));
	return dedupeStrings(feelings).filter(f => !existingFeelings.has(f.toLowerCase()));
}

/**
 * Filter feelings to remove - removes feelings that don't exist.
 */
export function filterFeelingsToRemove(
	feelings: string[],
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): string[] {
	const directed = getDirectedRelationship(projection, fromChar, towardChar);
	if (!directed) return [];

	const existingFeelings = new Set(directed.feelings.map(f => f.toLowerCase()));
	return dedupeStrings(feelings).filter(f => existingFeelings.has(f.toLowerCase()));
}

/**
 * Filter wants to add - removes wants that already exist.
 */
export function filterWantsToAdd(
	wants: string[],
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): string[] {
	const directed = getDirectedRelationship(projection, fromChar, towardChar);
	if (!directed) return dedupeStrings(wants);

	const existingWants = new Set(directed.wants.map(w => w.toLowerCase()));
	return dedupeStrings(wants).filter(w => !existingWants.has(w.toLowerCase()));
}

/**
 * Filter wants to remove - removes wants that don't exist.
 */
export function filterWantsToRemove(
	wants: string[],
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): string[] {
	const directed = getDirectedRelationship(projection, fromChar, towardChar);
	if (!directed) return [];

	const existingWants = new Set(directed.wants.map(w => w.toLowerCase()));
	return dedupeStrings(wants).filter(w => existingWants.has(w.toLowerCase()));
}

/**
 * Filter secrets to add - removes secrets that already exist.
 */
export function filterSecretsToAdd(
	secrets: string[],
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): string[] {
	const directed = getDirectedRelationship(projection, fromChar, towardChar);
	if (!directed) return dedupeStrings(secrets);

	const existingSecrets = new Set(directed.secrets.map(s => s.toLowerCase()));
	return dedupeStrings(secrets).filter(s => !existingSecrets.has(s.toLowerCase()));
}

/**
 * Filter secrets to remove - removes secrets that don't exist.
 */
export function filterSecretsToRemove(
	secrets: string[],
	projection: Projection | null,
	fromChar: string,
	towardChar: string,
): string[] {
	const directed = getDirectedRelationship(projection, fromChar, towardChar);
	if (!directed) return [];

	const existingSecrets = new Set(directed.secrets.map(s => s.toLowerCase()));
	return dedupeStrings(secrets).filter(s => existingSecrets.has(s.toLowerCase()));
}

// ============================================
// Location Props Validation
// ============================================

/**
 * Filter props to add - removes props that already exist.
 */
export function filterPropsToAdd(props: string[], projection: Projection | null): string[] {
	if (!projection?.location) return dedupeStrings(props);

	const existingProps = new Set(projection.location.props.map(p => p.toLowerCase()));
	return dedupeStrings(props).filter(p => !existingProps.has(p.toLowerCase()));
}

/**
 * Filter props to remove - removes props that don't exist.
 */
export function filterPropsToRemove(props: string[], projection: Projection | null): string[] {
	if (!projection?.location) return [];

	const existingProps = new Set(projection.location.props.map(p => p.toLowerCase()));
	return dedupeStrings(props).filter(p => existingProps.has(p.toLowerCase()));
}

// ============================================
// Character Presence Validation
// ============================================

/**
 * Filter characters that appeared - removes characters already present.
 */
export function filterCharactersAppeared<
	T extends { name: string; position?: string; activity?: string | null },
>(appeared: T[], projection: Projection | null): T[] {
	if (!projection) return appeared;

	const presentChars = new Set(projection.charactersPresent.map(c => c.toLowerCase()));
	return appeared.filter(char => !presentChars.has(char.name.toLowerCase()));
}

/**
 * Filter characters that departed - removes characters not currently present.
 */
export function filterCharactersDeparted(
	departed: string[],
	projection: Projection | null,
): string[] {
	if (!projection) return [];

	const presentChars = new Set(projection.charactersPresent.map(c => c.toLowerCase()));
	return dedupeStrings(departed).filter(name => presentChars.has(name.toLowerCase()));
}
