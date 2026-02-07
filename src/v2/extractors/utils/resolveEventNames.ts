/**
 * Event Name Resolution
 *
 * Resolves alternate character names in extracted events to their canonical names.
 * Uses AKA lookup tables built from CharacterState.akas fields.
 */

import type { Event } from '../../types/event';
import {
	isCharacterEvent,
	isCharacterAkasAddEvent,
	isDirectionalRelationshipEvent,
	isRelationshipStatusChangedEvent,
	isRelationshipSubjectEvent,
} from '../../types/event';
import type { CharacterState } from '../../types/snapshot';
import { sortPair } from '../../types/snapshot';
import { normalizeName, namesMatch } from './nameMatching';

/**
 * Mapping from an unresolved name to its resolved canonical name (or null if skipped).
 */
export interface UnresolvedNameMapping {
	unresolvedName: string;
	resolvedTo: string | null;
}

/**
 * Build an AKA lookup map from character states.
 * Maps each AKA (lowercased) to its canonical character name.
 * Also maps canonical names (lowercased) to themselves.
 */
export function buildAkaLookup(characters: Record<string, CharacterState>): Map<string, string> {
	const lookup = new Map<string, string>();

	for (const [name, char] of Object.entries(characters)) {
		// Map canonical name to itself
		lookup.set(name.toLowerCase(), name);

		// Map each AKA to the canonical name
		for (const aka of char.akas ?? []) {
			lookup.set(aka.toLowerCase(), name);
		}
	}

	return lookup;
}

/**
 * Resolve a character name to its canonical form.
 *
 * Resolution order:
 * 1. Direct AKA lookup (lowercased)
 * 2. Normalized lookup (title-stripped)
 * 3. Fuzzy match against canonical names
 * 4. Fuzzy match against all AKA keys
 *
 * @returns The canonical name, or null if unresolvable
 */
export function resolveCharacterName(
	name: string,
	akaLookup: Map<string, string>,
	allCanonicalNames: string[],
): string | null {
	// 1. Direct AKA lookup
	const direct = akaLookup.get(name.toLowerCase());
	if (direct) return direct;

	// 2. Normalized lookup (title-stripped)
	const normalized = normalizeName(name);
	const normalizedMatch = akaLookup.get(normalized);
	if (normalizedMatch) return normalizedMatch;

	// 3. Fuzzy match against canonical names
	for (const canonical of allCanonicalNames) {
		if (namesMatch(canonical, name)) {
			return canonical;
		}
	}

	// 4. Fuzzy match against all AKA keys
	for (const [akaKey, canonical] of akaLookup.entries()) {
		if (namesMatch(akaKey, name)) {
			return canonical;
		}
	}

	return null;
}

/**
 * Result of resolving names in a list of events.
 */
export interface ResolveNamesResult {
	/** The events with names resolved (mutated in place) */
	resolvedEvents: Event[];
	/** Names that could not be resolved */
	unresolvedNames: string[];
}

/**
 * Resolve character names in events to their canonical forms.
 * Mutates events in place for efficiency.
 *
 * Rewrites:
 * - `character` field on all CharacterEvent subtypes (except akas_add)
 * - `fromCharacter`/`towardCharacter` on directional relationship events
 * - `pair` on pair-based relationship events (re-sorted after resolution)
 *
 * @returns The resolved events and any unresolved names
 */
export function resolveNamesInEvents(
	events: Event[],
	akaLookup: Map<string, string>,
	allCanonicalNames: string[],
): ResolveNamesResult {
	const unresolvedSet = new Set<string>();

	for (const event of events) {
		// Skip akas_set events - they define mappings, not reference characters by alternate names
		if (isCharacterAkasAddEvent(event)) {
			continue;
		}

		// Character events: rewrite `character` field
		if (isCharacterEvent(event)) {
			const resolved = resolveCharacterName(
				event.character,
				akaLookup,
				allCanonicalNames,
			);
			if (resolved) {
				(event as { character: string }).character = resolved;
			} else {
				unresolvedSet.add(event.character);
			}
			continue;
		}

		// Directional relationship events: rewrite fromCharacter/towardCharacter
		if (isDirectionalRelationshipEvent(event)) {
			const resolvedFrom = resolveCharacterName(
				event.fromCharacter,
				akaLookup,
				allCanonicalNames,
			);
			if (resolvedFrom) {
				(event as { fromCharacter: string }).fromCharacter = resolvedFrom;
			} else {
				unresolvedSet.add(event.fromCharacter);
			}

			const resolvedToward = resolveCharacterName(
				event.towardCharacter,
				akaLookup,
				allCanonicalNames,
			);
			if (resolvedToward) {
				(event as { towardCharacter: string }).towardCharacter =
					resolvedToward;
			} else {
				unresolvedSet.add(event.towardCharacter);
			}
			continue;
		}

		// Pair-based relationship events: rewrite pair and re-sort
		if (isRelationshipStatusChangedEvent(event) || isRelationshipSubjectEvent(event)) {
			const resolvedA = resolveCharacterName(
				event.pair[0],
				akaLookup,
				allCanonicalNames,
			);
			const resolvedB = resolveCharacterName(
				event.pair[1],
				akaLookup,
				allCanonicalNames,
			);

			if (resolvedA) {
				event.pair[0] = resolvedA;
			} else {
				unresolvedSet.add(event.pair[0]);
			}

			if (resolvedB) {
				event.pair[1] = resolvedB;
			} else {
				unresolvedSet.add(event.pair[1]);
			}

			// Re-sort the pair
			event.pair = sortPair(event.pair[0], event.pair[1]);
		}
	}

	return {
		resolvedEvents: events,
		unresolvedNames: [...unresolvedSet],
	};
}

/**
 * Apply user-provided mappings to resolve remaining unresolved names in events.
 * Mutates events in place.
 */
export function applyUserMappings(events: Event[], mappings: UnresolvedNameMapping[]): void {
	// Build a quick lookup from unresolved name to resolved name
	const mappingLookup = new Map<string, string>();
	for (const mapping of mappings) {
		if (mapping.resolvedTo) {
			mappingLookup.set(mapping.unresolvedName.toLowerCase(), mapping.resolvedTo);
		}
	}

	if (mappingLookup.size === 0) return;

	for (const event of events) {
		if (isCharacterAkasAddEvent(event)) continue;

		if (isCharacterEvent(event)) {
			const resolved = mappingLookup.get(event.character.toLowerCase());
			if (resolved) {
				(event as { character: string }).character = resolved;
			}
			continue;
		}

		if (isDirectionalRelationshipEvent(event)) {
			const resolvedFrom = mappingLookup.get(event.fromCharacter.toLowerCase());
			if (resolvedFrom) {
				(event as { fromCharacter: string }).fromCharacter = resolvedFrom;
			}
			const resolvedToward = mappingLookup.get(
				event.towardCharacter.toLowerCase(),
			);
			if (resolvedToward) {
				(event as { towardCharacter: string }).towardCharacter =
					resolvedToward;
			}
			continue;
		}

		if (isRelationshipStatusChangedEvent(event) || isRelationshipSubjectEvent(event)) {
			const resolvedA = mappingLookup.get(event.pair[0].toLowerCase());
			if (resolvedA) {
				event.pair[0] = resolvedA;
			}
			const resolvedB = mappingLookup.get(event.pair[1].toLowerCase());
			if (resolvedB) {
				event.pair[1] = resolvedB;
			}
			// Re-sort the pair
			event.pair = sortPair(event.pair[0], event.pair[1]);
		}
	}
}
