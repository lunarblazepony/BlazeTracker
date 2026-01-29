/**
 * Name Matching Utilities
 *
 * Shared utilities for matching extracted character names to known character names.
 * Handles case insensitivity, title stripping, initials, and fuzzy matching.
 */

/**
 * Common titles to strip from names for matching.
 */
const TITLES_TO_STRIP = [
	'dr.',
	'dr',
	'mr.',
	'mr',
	'mrs.',
	'mrs',
	'ms.',
	'ms',
	'miss',
	'sir',
	'lady',
	'lord',
	'professor',
	'prof.',
	'prof',
];

/**
 * Normalize a name for comparison.
 * - Lowercase
 * - Trim whitespace
 * - Strip common titles
 * - Collapse multiple spaces
 */
export function normalizeName(name: string): string {
	let normalized = name.toLowerCase().trim();

	// Strip titles from the beginning
	for (const title of TITLES_TO_STRIP) {
		if (normalized.startsWith(title + ' ')) {
			normalized = normalized.slice(title.length + 1).trim();
			break; // Only strip one title
		}
	}

	// Collapse multiple spaces
	normalized = normalized.replace(/\s+/g, ' ');

	return normalized;
}

/**
 * Split a name into words, filtering out empty strings.
 */
function nameWords(name: string): string[] {
	return name.split(' ').filter(w => w.length > 0);
}

/**
 * Check if a word matches another, including initial matching.
 * "j" or "j." matches "john"
 */
function wordMatches(word1: string, word2: string): boolean {
	if (word1 === word2) return true;

	// Initial matching: "j" or "j." matches "john"
	const w1 = word1.replace(/\.$/, ''); // Remove trailing period
	const w2 = word2.replace(/\.$/, '');

	// Single letter initial
	if (w1.length === 1 && w2.startsWith(w1)) return true;
	if (w2.length === 1 && w1.startsWith(w2)) return true;

	return false;
}

/**
 * Fuzzy name matching for comparing extracted names with card names.
 * Handles cases where extraction uses first name only vs full name.
 *
 * Matching strategies (in order):
 * 1. Exact match (after normalization)
 * 2. First name prefix match ("john smith" matches "john")
 * 3. All words of shorter name appear in longer name
 * 4. Initial matching ("j. smith" matches "john smith")
 */
export function namesMatch(cardName: string, extractedName: string): boolean {
	const card = normalizeName(cardName);
	const extracted = normalizeName(extractedName);

	// Exact match
	if (card === extracted) return true;

	// First name match (card is full name, extracted is first name)
	if (card.startsWith(extracted + ' ')) return true;

	// Extracted is full name, card is first name
	if (extracted.startsWith(card + ' ')) return true;

	// Word-based matching
	const cardWords = nameWords(card);
	const extractedWords = nameWords(extracted);

	// All words of shorter name appear in longer name (allows for middle names, etc.)
	const [shorter, longer] =
		cardWords.length <= extractedWords.length
			? [cardWords, extractedWords]
			: [extractedWords, cardWords];

	// Check if all words in shorter match words in longer (with initial support)
	const allShorterWordsMatch = shorter.every(shortWord =>
		longer.some(longWord => wordMatches(shortWord, longWord)),
	);

	if (allShorterWordsMatch && shorter.length > 0) {
		return true;
	}

	return false;
}

/**
 * Find a character key in a list that matches the given name.
 * Returns the matching key (preserving original casing) or null.
 *
 * @param extractedName - The name to find (from extraction or card)
 * @param availableNames - List of character names to match against
 * @returns The matching name from availableNames, or null if no match
 */
export function findMatchingCharacterKey(
	extractedName: string,
	availableNames: string[],
): string | null {
	// Try exact match first (case-insensitive)
	const exactMatch = availableNames.find(
		name => name.toLowerCase() === extractedName.toLowerCase(),
	);
	if (exactMatch) return exactMatch;

	// Try fuzzy match
	return availableNames.find(name => namesMatch(name, extractedName)) ?? null;
}

/**
 * Build a name lookup map for faster matching.
 * Maps lowercase names to their original casing.
 *
 * @param names - List of character names
 * @returns Map from lowercase name to original casing
 */
export function buildNameLookup(names: string[]): Map<string, string> {
	const lookup = new Map<string, string>();
	for (const name of names) {
		lookup.set(name.toLowerCase(), name);
	}
	return lookup;
}

/**
 * Find matching name using lookup map with fuzzy fallback.
 *
 * @param extractedName - The name to find
 * @param lookup - Pre-built lowercase to original name map
 * @param allNames - Full list of names for fuzzy fallback
 * @returns The matching name, or null if no match
 */
export function findNameInLookup(
	extractedName: string,
	lookup: Map<string, string>,
	allNames: string[],
): string | null {
	// Try exact match first
	const exact = lookup.get(extractedName.toLowerCase());
	if (exact) return exact;

	// Try fuzzy match
	return findMatchingCharacterKey(extractedName, allNames);
}
