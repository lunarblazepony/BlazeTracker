/**
 * World Info Utility Module
 *
 * Provides functions to fetch and format worldinfo (lorebook) data
 * for use in BlazeTracker extractors.
 */

import { debugLog, debugWarn } from '../../utils/debug';
import type { WIScanEntry, WIGlobalScanData, WIActivated } from '../../types/world-info';

// ============================================
// Types
// ============================================

/**
 * Re-export WIScanEntry as WorldinfoEntry for clearer naming in BlazeTracker code.
 */
export type WorldinfoEntry = WIScanEntry;

/**
 * Result from fetching matched worldinfo.
 */
export interface WorldinfoResult {
	/** Array of activated entries */
	entries: WorldinfoEntry[];
	/** Formatted string for "before" position content */
	formattedBefore: string;
	/** Formatted string for "after" position content */
	formattedAfter: string;
}

// ============================================
// Main Functions
// ============================================

/**
 * Build global scan data from current SillyTavern context.
 * This includes character descriptions, persona, etc. that worldinfo can match against.
 */
function buildGlobalScanData(): WIGlobalScanData {
	try {
		const context = SillyTavern.getContext();
		const characterId = context.characterId;
		const character =
			characterId !== undefined ? context.characters[characterId] : null;

		return {
			trigger: 'blazetracker',
			personaDescription: context.persona || '',
			characterDescription: character?.description || '',
			characterPersonality: character?.personality || '',
			characterDepthPrompt: character?.depth_prompt_prompt || '',
			scenario: character?.scenario || '',
			creatorNotes: character?.creatorcomment || '',
		};
	} catch {
		return {
			trigger: 'blazetracker',
			personaDescription: '',
			characterDescription: '',
			characterPersonality: '',
			characterDepthPrompt: '',
			scenario: '',
			creatorNotes: '',
		};
	}
}

// Type for the checkWorldInfo function from SillyTavern
type CheckWorldInfoFn = (
	chat: string[],
	maxContext: number,
	isDryRun: boolean,
	globalScanData: WIGlobalScanData,
) => Promise<WIActivated>;

/**
 * Dynamically import the checkWorldInfo function from SillyTavern.
 * Returns null if not available.
 */
async function getCheckWorldInfo(): Promise<CheckWorldInfoFn | null> {
	try {
		// Use dynamic import with the correct path for ST extensions
		// Path is relative to dist/index.js -> scripts/world-info.js
		const worldInfoModule = await import('../../../../world-info.js');

		if (typeof worldInfoModule.checkWorldInfo === 'function') {
			return worldInfoModule.checkWorldInfo as CheckWorldInfoFn;
		}

		debugWarn('checkWorldInfo is not a function in world-info module');
		return null;
	} catch (error) {
		debugWarn('Failed to import world-info module:', error);
		return null;
	}
}

/**
 * Fetch worldinfo entries that match the given messages.
 *
 * Uses SillyTavern's checkWorldInfo API to find entries that would activate
 * based on the message content.
 *
 * @param messages - Array of message content strings to scan (most recent first)
 * @returns Promise resolving to WorldinfoResult with matched entries
 */
export async function getMatchedWorldinfo(messages: string[]): Promise<WorldinfoResult> {
	const emptyResult: WorldinfoResult = {
		entries: [],
		formattedBefore: '',
		formattedAfter: '',
	};

	try {
		const checkWorldInfo = await getCheckWorldInfo();
		if (!checkWorldInfo) {
			return emptyResult;
		}

		// Build global scan data from current context
		const globalScanData = buildGlobalScanData();

		// Run ST's matching against our messages
		// Use a large maxContext to get all matches (we'll format them ourselves)
		const result = await checkWorldInfo(
			messages,
			Infinity, // maxContext - we want all matches
			true, // isDryRun - don't emit events
			globalScanData,
		);

		// Convert Set to Array
		const entries = Array.from(result.allActivatedEntries || []);

		debugLog(`Worldinfo: Found ${entries.length} activated entries`);

		return {
			entries,
			formattedBefore: result.worldInfoBefore || '',
			formattedAfter: result.worldInfoAfter || '',
		};
	} catch (error) {
		debugWarn('Failed to fetch worldinfo:', error);
		return emptyResult;
	}
}

/**
 * Filter worldinfo entries to those relevant to a specific character.
 *
 * Matches entries where the character name appears in primary or secondary keywords.
 *
 * @param entries - Array of worldinfo entries to filter
 * @param characterName - Name of the character to filter for
 * @returns Filtered array of entries relevant to the character
 */
export function filterEntriesByCharacter(
	entries: WorldinfoEntry[],
	characterName: string,
): WorldinfoEntry[] {
	if (!characterName || entries.length === 0) {
		return [];
	}

	const nameLower = characterName.toLowerCase();

	return entries.filter(entry => {
		// Check primary keys
		const primaryMatch = entry.key?.some(key => key.toLowerCase().includes(nameLower));
		if (primaryMatch) return true;

		// Check secondary keys
		const secondaryMatch = entry.keysecondary?.some(key =>
			key.toLowerCase().includes(nameLower),
		);
		if (secondaryMatch) return true;

		// Check if comment/name mentions the character
		const commentMatch = entry.comment?.toLowerCase().includes(nameLower);
		if (commentMatch) return true;

		return false;
	});
}

/**
 * Filter worldinfo entries to those relevant to a relationship pair.
 *
 * Matches entries where either character name appears in keywords.
 *
 * @param entries - Array of worldinfo entries to filter
 * @param pair - Tuple of two character names
 * @returns Filtered array of entries relevant to the relationship
 */
export function filterEntriesByRelationship(
	entries: WorldinfoEntry[],
	pair: [string, string],
): WorldinfoEntry[] {
	if (entries.length === 0) {
		return [];
	}

	const [charA, charB] = pair;
	const charALower = charA.toLowerCase();
	const charBLower = charB.toLowerCase();

	return entries.filter(entry => {
		const allKeys = [...(entry.key || []), ...(entry.keysecondary || [])];
		const keysLower = allKeys.map(k => k.toLowerCase());

		// Entry is relevant if it mentions either character
		const mentionsA =
			keysLower.some(k => k.includes(charALower)) ||
			entry.comment?.toLowerCase().includes(charALower);
		const mentionsB =
			keysLower.some(k => k.includes(charBLower)) ||
			entry.comment?.toLowerCase().includes(charBLower);

		// Prioritize entries that mention both (more relevant to relationship)
		// but include entries that mention at least one
		return mentionsA || mentionsB;
	});
}

/**
 * Format worldinfo entries as readable text for inclusion in LLM prompts.
 *
 * @param entries - Array of worldinfo entries to format
 * @param maxEntries - Maximum number of entries to include (default: 10)
 * @returns Formatted string with entry contents
 */
export function formatEntriesForPrompt(entries: WorldinfoEntry[], maxEntries: number = 10): string {
	if (entries.length === 0) {
		return '';
	}

	// Sort by order (higher priority first) and take top entries
	const sortedEntries = [...entries].sort((a, b) => (b.order || 0) - (a.order || 0));
	const topEntries = sortedEntries.slice(0, maxEntries);

	// Format each entry
	const formattedEntries = topEntries
		.map(entry => {
			const content = entry.content?.trim();
			if (!content) return null;

			// Include comment as context if available
			const label = entry.comment ? `[${entry.comment}]` : `[Lore Entry]`;
			return `${label}\n${content}`;
		})
		.filter(Boolean);

	if (formattedEntries.length === 0) {
		return '';
	}

	return formattedEntries.join('\n\n');
}

/**
 * Get worldinfo formatted for a character-focused extractor.
 *
 * Fetches matched worldinfo and filters/formats for the specified character.
 *
 * @param messages - Message content to scan
 * @param characterName - Character to focus on (optional, includes all if not specified)
 * @returns Formatted worldinfo string for prompt inclusion
 */
export async function getWorldinfoForCharacter(
	messages: string[],
	characterName?: string,
): Promise<string> {
	const result = await getMatchedWorldinfo(messages);

	let entries = result.entries;

	// Filter to character-relevant entries if specified
	if (characterName) {
		entries = filterEntriesByCharacter(entries, characterName);
	}

	return formatEntriesForPrompt(entries);
}

/**
 * Get worldinfo formatted for a relationship-focused extractor.
 *
 * Fetches matched worldinfo and filters/formats for the specified character pair.
 *
 * @param messages - Message content to scan
 * @param pair - Character pair to focus on
 * @returns Formatted worldinfo string for prompt inclusion
 */
export async function getWorldinfoForRelationship(
	messages: string[],
	pair: [string, string],
): Promise<string> {
	const result = await getMatchedWorldinfo(messages);
	const entries = filterEntriesByRelationship(result.entries, pair);
	return formatEntriesForPrompt(entries);
}

/**
 * Get all matched worldinfo formatted for prompt inclusion.
 *
 * Uses the pre-formatted content from SillyTavern when available,
 * falling back to manual formatting.
 *
 * @param messages - Message content to scan
 * @returns Formatted worldinfo string for prompt inclusion
 */
export async function getWorldinfoForPrompt(messages: string[]): Promise<string> {
	const result = await getMatchedWorldinfo(messages);

	// Prefer ST's formatted output if available
	const stFormatted = [result.formattedBefore, result.formattedAfter]
		.filter(Boolean)
		.join('\n\n')
		.trim();

	if (stFormatted) {
		return stFormatted;
	}

	// Fall back to manual formatting
	return formatEntriesForPrompt(result.entries);
}
