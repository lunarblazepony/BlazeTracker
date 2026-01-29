// ============================================
// Relationship Utility Functions
// ============================================

import type {
	Relationship,
	DerivedRelationship,
	ProjectedRelationship,
	RelationshipAttitude,
	RelationshipStatus,
	RelationshipVersion,
	MilestoneEvent,
	MilestoneType,
	NarrativeDateTime,
} from '../types/state';
import { isLegacyRelationship } from '../types/state';

/** Union type for legacy, derived, and projected relationships */
export type AnyRelationship = Relationship | DerivedRelationship | ProjectedRelationship;

// ============================================
// Pair Management
// ============================================

/**
 * Sort a pair of character names alphabetically.
 * Returns a tuple with the names in alphabetical order.
 */
export function sortPair(char1: string, char2: string): [string, string] {
	return char1.localeCompare(char2) <= 0 ? [char1, char2] : [char2, char1];
}

/**
 * Derive a sorted pair from fromCharacter and towardCharacter.
 * Returns null if either character is missing or empty.
 * Used for directional relationship events where pair should be derived
 * from the character names rather than stored explicitly.
 */
export function derivePair(
	fromCharacter: string | undefined,
	towardCharacter: string | undefined,
): [string, string] | null {
	if (!fromCharacter || !towardCharacter) return null;
	return sortPair(fromCharacter, towardCharacter);
}

/**
 * Generate a deterministic key for a character pair.
 * The key is the same regardless of argument order.
 * Always lowercased for case-insensitive comparison.
 */
export function pairKey(char1: string, char2: string): string {
	const [a, b] = sortPair(char1, char2);
	return `${a}|${b}`.toLowerCase();
}

/**
 * Check if a relationship has a specific milestone type.
 */
export function hasMilestone(relationship: Relationship, type: MilestoneType): boolean {
	return (relationship.milestones ?? []).some(m => m.type === type);
}

/**
 * Find all character pairs that don't have an established relationship.
 * Returns pairs as sorted tuples.
 */
export function findUnestablishedPairs(
	characters: string[],
	relationships: AnyRelationship[],
): [string, string][] {
	if (characters.length < 2) {
		return [];
	}

	const existingKeys = new Set(relationships.map(r => pairKey(r.pair[0], r.pair[1])));
	const unestablished: [string, string][] = [];

	for (let i = 0; i < characters.length; i++) {
		for (let j = i + 1; j < characters.length; j++) {
			const key = pairKey(characters[i], characters[j]);
			if (!existingKeys.has(key)) {
				unestablished.push(sortPair(characters[i], characters[j]));
			}
		}
	}

	return unestablished;
}

// ============================================
// Formatting
// ============================================

/**
 * Format relationships for inclusion in prompts.
 * @param relationships All relationships
 * @param presentCharacters Characters currently in the scene (filters to relevant relationships)
 * @param includeSecrets Whether to include secret knowledge (for dramatic irony)
 */
export function formatRelationshipsForPrompt(
	relationships: AnyRelationship[],
	presentCharacters?: string[],
	includeSecrets: boolean = true,
): string {
	if (relationships.length === 0) {
		return 'No established relationships.';
	}

	// Filter to relationships where BOTH characters are present
	let relevantRelationships = relationships;
	if (presentCharacters && presentCharacters.length > 0) {
		const presentSet = new Set(presentCharacters.map(c => c.toLowerCase()));
		relevantRelationships = relationships.filter(
			r =>
				presentSet.has(r.pair[0].toLowerCase()) &&
				presentSet.has(r.pair[1].toLowerCase()),
		);
	}

	if (relevantRelationships.length === 0) {
		return 'No established relationships between present characters.';
	}

	return relevantRelationships.map(r => formatRelationship(r, includeSecrets)).join('\n\n');
}

/**
 * Format a single relationship for display.
 */
export function formatRelationship(
	relationship: AnyRelationship,
	includeSecrets: boolean = true,
): string {
	const [charA, charB] = relationship.pair;
	const lines: string[] = [];

	lines.push(`## ${charA} & ${charB} (${relationship.status})`);

	// A's feelings toward B
	lines.push(`${charA} → ${charB}:`);
	lines.push(`  Feelings: ${relationship.aToB.feelings.join(', ') || 'neutral'}`);
	if (relationship.aToB.wants.length > 0) {
		lines.push(`  Wants: ${relationship.aToB.wants.join(', ')}`);
	}
	if (includeSecrets && relationship.aToB.secrets.length > 0) {
		lines.push(
			`  Secrets (${charB} doesn't know): ${relationship.aToB.secrets.join(', ')}`,
		);
	}

	// B's feelings toward A
	lines.push(`${charB} → ${charA}:`);
	lines.push(`  Feelings: ${relationship.bToA.feelings.join(', ') || 'neutral'}`);
	if (relationship.bToA.wants.length > 0) {
		lines.push(`  Wants: ${relationship.bToA.wants.join(', ')}`);
	}
	if (includeSecrets && relationship.bToA.secrets.length > 0) {
		lines.push(
			`  Secrets (${charA} doesn't know): ${relationship.bToA.secrets.join(', ')}`,
		);
	}

	// Milestones (only for legacy relationships)
	if (
		isLegacyRelationship(relationship) &&
		relationship.milestones &&
		relationship.milestones.length > 0
	) {
		lines.push(
			`Milestones: ${relationship.milestones.map((m: MilestoneEvent) => m.type.replace(/_/g, ' ')).join(', ')}`,
		);
	}

	return lines.join('\n');
}

// ============================================
// Creation Helpers
// ============================================

/**
 * Create an empty relationship attitude.
 */
export function createEmptyAttitude(): RelationshipAttitude {
	return {
		feelings: [],
		secrets: [],
		wants: [],
	};
}

/**
 * Create a new relationship between two characters.
 */
export function createRelationship(
	char1: string,
	char2: string,
	status: RelationshipStatus = 'strangers',
	messageId?: number,
): Relationship {
	const pair = sortPair(char1, char2);
	const aToB = createEmptyAttitude();
	const bToA = createEmptyAttitude();

	const relationship: Relationship = {
		pair,
		status,
		aToB,
		bToA,
		milestones: [],
		history: [],
		versions: [],
	};

	// If messageId provided, create the initial version
	if (messageId !== undefined) {
		addRelationshipVersion(relationship, messageId);
	}

	return relationship;
}

/**
 * Add a milestone to a relationship (avoids duplicates).
 */
export function addMilestone(relationship: Relationship, milestone: MilestoneEvent): void {
	// Ensure milestones array exists
	if (!relationship.milestones) {
		relationship.milestones = [];
	}
	// Check if we already have this milestone type
	if (!hasMilestone(relationship, milestone.type)) {
		relationship.milestones.push(milestone);
	}
}

/**
 * Get the attitude direction for a character in a relationship.
 * Returns 'aToB' if the character is the first in the pair, 'bToA' otherwise.
 */
export function getAttitudeDirection(
	relationship: Relationship,
	fromCharacter: string,
): 'aToB' | 'bToA' {
	return relationship.pair[0].toLowerCase() === fromCharacter.toLowerCase() ? 'aToB' : 'bToA';
}

/**
 * Update a specific character's attitude in a relationship.
 */
export function updateAttitude(
	relationship: Relationship,
	fromCharacter: string,
	updates: Partial<RelationshipAttitude>,
): void {
	const direction = getAttitudeDirection(relationship, fromCharacter);
	const attitude = relationship[direction];

	if (updates.feelings !== undefined) {
		attitude.feelings = updates.feelings;
	}
	if (updates.secrets !== undefined) {
		attitude.secrets = updates.secrets;
	}
	if (updates.wants !== undefined) {
		attitude.wants = updates.wants;
	}
}

// ============================================
// Time Comparison
// ============================================

/**
 * Convert NarrativeDateTime to a comparable number (timestamp-like).
 * Returns a number that can be compared with > < >= <= operators.
 */
export function narrativeDateTimeToNumber(dt: NarrativeDateTime): number {
	// YYYYMMDDHHMMSS format as a number for easy comparison
	return (
		dt.year * 10000000000 +
		dt.month * 100000000 +
		dt.day * 1000000 +
		dt.hour * 10000 +
		dt.minute * 100 +
		dt.second
	);
}

/**
 * Compare two NarrativeDateTime values.
 * Returns:
 *   - negative if a < b
 *   - 0 if a === b
 *   - positive if a > b
 */
export function compareNarrativeDateTime(a: NarrativeDateTime, b: NarrativeDateTime): number {
	return narrativeDateTimeToNumber(a) - narrativeDateTimeToNumber(b);
}

/**
 * Check if a NarrativeDateTime is >= a reference time.
 */
export function isDateTimeOnOrAfter(dt: NarrativeDateTime, reference: NarrativeDateTime): boolean {
	return compareNarrativeDateTime(dt, reference) >= 0;
}

// ============================================
// Milestone Cleanup
// ============================================

/**
 * Remove milestones from a relationship that occurred on or after a given time.
 * Returns the number of milestones removed.
 */
export function clearMilestonesSince(
	relationship: Relationship,
	sinceTime: NarrativeDateTime,
): number {
	if (!relationship.milestones) {
		return 0;
	}
	const originalCount = relationship.milestones.length;
	relationship.milestones = relationship.milestones.filter(
		m => !isDateTimeOnOrAfter(m.timestamp, sinceTime),
	);
	return originalCount - relationship.milestones.length;
}

/**
 * Remove milestones from all relationships that occurred on or after a given time.
 * Returns the total number of milestones removed.
 */
export function clearAllMilestonesSince(
	relationships: Relationship[],
	sinceTime: NarrativeDateTime,
): number {
	let totalRemoved = 0;
	for (const rel of relationships) {
		totalRemoved += clearMilestonesSince(rel, sinceTime);
	}
	return totalRemoved;
}

/**
 * Remove milestones from a relationship that were created by a specific message.
 * Returns the number of milestones removed.
 */
export function clearMilestonesForMessage(relationship: Relationship, messageId: number): number {
	if (!relationship.milestones) {
		return 0;
	}
	const originalCount = relationship.milestones.length;
	relationship.milestones = relationship.milestones.filter(m => m.messageId !== messageId);
	return originalCount - relationship.milestones.length;
}

/**
 * Remove milestones from all relationships that were created by a specific message.
 * Only affects legacy relationships (DerivedRelationships have milestones in event store).
 * Returns the total number of milestones removed.
 */
export function clearAllMilestonesForMessage(
	relationships: AnyRelationship[],
	messageId: number,
): number {
	let totalRemoved = 0;
	for (const rel of relationships) {
		// Only legacy relationships have milestones array
		if (isLegacyRelationship(rel)) {
			totalRemoved += clearMilestonesForMessage(rel, messageId);
		}
	}
	return totalRemoved;
}

// ============================================
// Version Management
// ============================================

/**
 * Add a new version snapshot to a relationship.
 * Call this when the relationship status changes.
 */
export function addRelationshipVersion(relationship: Relationship, messageId: number): void {
	// Initialize versions array if it doesn't exist (legacy relationships)
	if (!relationship.versions) {
		relationship.versions = [];
	}

	const version: RelationshipVersion = {
		messageId,
		status: relationship.status,
		aToB: {
			feelings: [...relationship.aToB.feelings],
			secrets: [...relationship.aToB.secrets],
			wants: [...relationship.aToB.wants],
		},
		bToA: {
			feelings: [...relationship.bToA.feelings],
			secrets: [...relationship.bToA.secrets],
			wants: [...relationship.bToA.wants],
		},
		milestones: [...(relationship.milestones ?? [])],
	};

	relationship.versions.push(version);
}

/**
 * Remove the latest version if it matches the given messageId.
 * Call this before re-extracting or on swipe to rollback.
 * Returns true if a version was removed.
 */
export function popVersionForMessage(relationship: Relationship, messageId: number): boolean {
	if (!relationship.versions || relationship.versions.length === 0) {
		return false;
	}

	const lastVersion = relationship.versions[relationship.versions.length - 1];
	if (lastVersion.messageId === messageId) {
		relationship.versions.pop();

		// Restore state from the new last version (if any)
		if (relationship.versions.length > 0) {
			const previousVersion =
				relationship.versions[relationship.versions.length - 1];
			relationship.status = previousVersion.status;
			relationship.aToB = {
				feelings: [...previousVersion.aToB.feelings],
				secrets: [...previousVersion.aToB.secrets],
				wants: [...previousVersion.aToB.wants],
			};
			relationship.bToA = {
				feelings: [...previousVersion.bToA.feelings],
				secrets: [...previousVersion.bToA.secrets],
				wants: [...previousVersion.bToA.wants],
			};
			relationship.milestones = [...(previousVersion.milestones ?? [])];
		}

		return true;
	}

	return false;
}

/**
 * Get the latest version's messageId for context window calculation.
 * Returns undefined if no versions exist.
 */
export function getLatestVersionMessageId(relationship: Relationship): number | undefined {
	if (!relationship.versions || relationship.versions.length === 0) {
		return undefined;
	}
	return relationship.versions[relationship.versions.length - 1].messageId;
}

/**
 * Get the relationship state as it was at or before a given messageId.
 * Returns the version data, or undefined if no version exists before that message.
 */
export function getRelationshipAtMessage(
	relationship: Relationship,
	messageId: number,
): RelationshipVersion | undefined {
	// Handle legacy relationships without versions array
	if (!relationship.versions || relationship.versions.length === 0) {
		return undefined;
	}

	// Find the latest version with messageId <= the given messageId
	for (let i = relationship.versions.length - 1; i >= 0; i--) {
		if (relationship.versions[i].messageId <= messageId) {
			return relationship.versions[i];
		}
	}
	return undefined;
}

/**
 * Get all relationships with their state as of a specific messageId.
 * For legacy relationships: returns with status/attitudes from the appropriate version.
 * For derived relationships: returns as-is (they are always current).
 * Legacy relationships without a version at or before the messageId are filtered out.
 */
export function getRelationshipsAtMessage(
	relationships: AnyRelationship[],
	messageId: number,
): AnyRelationship[] {
	const result: AnyRelationship[] = [];

	for (const rel of relationships) {
		if (isLegacyRelationship(rel)) {
			const version = getRelationshipAtMessage(rel, messageId);
			if (version) {
				// Return a relationship with the versioned state
				result.push({
					...rel,
					status: version.status,
					aToB: version.aToB,
					bToA: version.bToA,
					milestones: version.milestones,
				});
			}
			// No version found - skip this legacy relationship
		} else {
			// DerivedRelationships don't have versions, include as-is
			result.push(rel);
		}
	}

	return result;
}
