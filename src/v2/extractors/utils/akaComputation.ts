/**
 * AKA (Also Known As) Computation
 *
 * Computes alternate names/nicknames for characters based on:
 * - LLM-extracted nicknames
 * - Full name vs canonical name differences
 * - Name parts (first name, last name)
 * - Title stripping
 *
 * Handles disambiguation when name parts are shared across characters.
 */

import { TITLES_TO_STRIP } from './nameMatching';

/**
 * Strip all leading titles from a name.
 * Returns the name with titles removed, lowercased.
 */
export function stripTitles(name: string): string {
	let normalized = name.toLowerCase().trim();

	// Strip titles iteratively (handles "Prof. Dr. John Smith")
	let stripped = true;
	while (stripped) {
		stripped = false;
		for (const title of TITLES_TO_STRIP) {
			if (normalized.startsWith(title + ' ')) {
				normalized = normalized.slice(title.length + 1).trim();
				stripped = true;
				break;
			}
		}
	}

	return normalized;
}

/**
 * Get the word parts of a name after title stripping.
 * Filters out empty strings.
 */
export function getNameParts(name: string): string[] {
	const stripped = stripTitles(name);
	return stripped.split(/\s+/).filter(part => part.length > 0);
}

/**
 * Check if a name part is ambiguous - i.e., it appears in the name parts
 * of more than one character.
 *
 * @param part - The name part to check (lowercased)
 * @param allCharacterNames - All canonical character names
 * @returns true if the part is shared by multiple characters
 */
export function isAmbiguousNamePart(part: string, allCharacterNames: string[]): boolean {
	const lowerPart = part.toLowerCase();
	let count = 0;

	for (const charName of allCharacterNames) {
		const parts = getNameParts(charName);
		if (parts.some(p => p === lowerPart)) {
			count++;
			if (count > 1) return true;
		}
	}

	return false;
}

/**
 * Compute AKAs (alternate names) for a character.
 *
 * @param canonicalName - The tracked name for this character
 * @param fullName - The full name if different from canonical (e.g., from card description), or null
 * @param extractedNicknames - LLM-extracted nicknames
 * @param allCharacterNames - All canonical character names (for disambiguation)
 * @returns Deduplicated list of AKAs (excluding canonicalName itself)
 */
export function computeAkas(
	canonicalName: string,
	fullName: string | null | undefined,
	extractedNicknames: string[],
	allCharacterNames: string[],
): string[] {
	const akas = new Set<string>();
	const canonicalLower = canonicalName.toLowerCase();

	// 1. Add LLM-extracted nicknames
	for (const nickname of extractedNicknames) {
		const trimmed = nickname.trim();
		if (trimmed && trimmed.toLowerCase() !== canonicalLower) {
			akas.add(trimmed);
		}
	}

	// 2. If fullName differs from canonicalName, add it
	if (fullName && fullName.trim()) {
		const trimmedFull = fullName.trim();
		if (trimmedFull.toLowerCase() !== canonicalLower) {
			akas.add(trimmedFull);
		}

		// 3. Strip titles from fullName, add if different
		const titleStripped = stripTitles(trimmedFull);
		if (
			titleStripped !== trimmedFull.toLowerCase() &&
			titleStripped !== canonicalLower &&
			titleStripped.length > 0
		) {
			// Reconstruct with original casing for the first match
			// Use the stripped version with proper casing
			const words = trimmedFull.split(/\s+/);
			const strippedWords = getNameParts(trimmedFull);
			// Find where the stripped name starts in the original
			const strippedName = words
				.slice(words.length - strippedWords.length)
				.join(' ');
			if (strippedName.toLowerCase() !== canonicalLower) {
				akas.add(strippedName);
			}
		}

		// 4. Extract name parts for AKAs
		const parts = getNameParts(trimmedFull);
		const canonicalParts = getNameParts(canonicalName);

		// Include the fullName in disambiguation to catch cross-name collisions
		// e.g., "John Smith" fullName + "Jane Smith" canonical → "Smith" is ambiguous
		const namesForDisambiguation = allCharacterNames.includes(trimmedFull)
			? allCharacterNames
			: [...allCharacterNames, trimmedFull];

		// Only add parts if the name has multiple words
		if (parts.length > 1) {
			for (const part of parts) {
				// Skip if it matches the canonical name
				if (part === canonicalLower) continue;

				// Skip if it matches any canonical name part (already the canonical)
				if (canonicalParts.some(cp => cp === part)) continue;

				// Skip titles
				if (TITLES_TO_STRIP.includes(part)) continue;

				// Skip ambiguous parts (shared by multiple characters)
				if (isAmbiguousNamePart(part, namesForDisambiguation)) continue;

				// Add with original casing from the full name
				const originalWord = trimmedFull
					.split(/\s+/)
					.find(w => w.toLowerCase() === part);
				if (originalWord) {
					akas.add(originalWord);
				}
			}
		}
	}

	// Deduplicate case-insensitively, keeping the first occurrence
	const seen = new Set<string>();
	const result: string[] = [];
	for (const aka of akas) {
		const lower = aka.toLowerCase();
		if (!seen.has(lower) && lower !== canonicalLower) {
			seen.add(lower);
			result.push(aka);
		}
	}

	return result;
}
