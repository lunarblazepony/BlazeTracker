/**
 * V2 Extraction Types
 *
 * LLM extraction response shapes - designed to be easy for the LLM to produce.
 * These are then mapped to Event format which is good for projections.
 *
 * Key principle: LLM returns what's natural to describe, we transform to events.
 *
 * Time handling:
 * - LLM returns ExtractedDateTime (year, month, day, hour, minute, second, dayOfWeek)
 * - This is converted to ISO string for storage in events/snapshots
 * - Projections use moment.Moment for manipulation
 */

import type {
	TimeDelta,
	OutfitSlot,
	TensionLevel,
	TensionType,
	RelationshipStatus,
	LocationType,
} from './common';
import type { Subject } from './subject';

// ============================================
// Extracted Time Format (what LLM returns)
// ============================================

/**
 * Time format that the LLM returns.
 * This is converted to ISO string when creating events.
 */
export interface ExtractedDateTime {
	year: number;
	month: number; // 1-12 (human-readable, not 0-indexed)
	day: number;
	hour: number;
	minute: number;
	second: number;
	dayOfWeek: string;
}

// ============================================
// Initial Extraction Responses
// ============================================

/**
 * LLM response for initial time extraction.
 */
export interface ExtractedInitialTime {
	reasoning: string;
	time: ExtractedDateTime;
}

/**
 * LLM response for initial location extraction.
 */
export interface ExtractedInitialLocation {
	reasoning: string;
	area: string;
	place: string;
	position: string;
	locationType: LocationType;
}

/**
 * LLM response for initial props extraction.
 */
export interface ExtractedInitialProps {
	reasoning: string;
	props: string[];
}

/**
 * LLM response for initial climate extraction.
 */
export interface ExtractedInitialClimate {
	reasoning: string;
	temperature: number;
	conditions: string;
	isIndoors: boolean;
}

/**
 * LLM response for characters present extraction.
 */
export interface ExtractedCharactersPresent {
	reasoning: string;
	characters: Array<{
		name: string;
		position: string;
		activity: string | null;
		mood: string[];
		physicalState: string[];
	}>;
}

/**
 * LLM response for character outfits extraction.
 */
export interface ExtractedCharacterOutfits {
	reasoning: string;
	outfits: Array<{
		character: string;
		outfit: Partial<Record<OutfitSlot, string | null>>;
	}>;
}

/**
 * LLM response for character profile extraction.
 * Used for both initial extraction and appeared characters.
 */
export interface ExtractedCharacterProfile {
	reasoning: string;
	character: string;
	profile: {
		sex: 'M' | 'F' | 'O';
		species: string;
		age: number;
		appearance: string[];
		personality: string[];
	};
}

/**
 * LLM response for initial relationships extraction.
 */
export interface ExtractedInitialRelationships {
	reasoning: string;
	relationships: Array<{
		pair: [string, string];
		status: RelationshipStatus;
		aToB: {
			feelings: string[];
			secrets: string[];
			wants: string[];
		};
		bToA: {
			feelings: string[];
			secrets: string[];
			wants: string[];
		};
	}>;
}

/**
 * LLM response for initial topic/tone extraction.
 */
export interface ExtractedInitialTopicTone {
	reasoning: string;
	topic: string;
	tone: string;
}

/**
 * LLM response for initial tension extraction.
 * Note: direction is calculated programmatically based on level change, not extracted.
 */
export interface ExtractedInitialTension {
	reasoning: string;
	level: TensionLevel;
	type: TensionType;
}

// ============================================
// Event Extraction Responses
// ============================================

/**
 * LLM response for time change extraction.
 */
export interface ExtractedTimeChange {
	reasoning: string;
	changed: boolean;
	delta?: TimeDelta;
}

/**
 * LLM response for location change extraction.
 */
export interface ExtractedLocationChange {
	reasoning: string;
	changed: boolean;
	newArea?: string;
	newPlace?: string;
	newPosition?: string;
	/** New location type if indoor/outdoor status changed */
	newLocationType?: LocationType;
}

/**
 * LLM response for props change extraction.
 */
export interface ExtractedPropsChange {
	reasoning: string;
	added: string[];
	removed: string[];
}

/**
 * LLM response for props confirmation.
 */
export interface ExtractedPropsConfirmation {
	reasoning: string;
	/** Props that are confirmed still present */
	confirmed: string[];
	/** Props that are no longer present */
	removed: string[];
}

/**
 * LLM response for climate change extraction.
 */
export interface ExtractedClimateChange {
	reasoning: string;
	changed: boolean;
	temperature?: number;
	conditions?: string;
}

/**
 * LLM response for character presence change extraction.
 */
export interface ExtractedCharacterPresenceChange {
	reasoning: string;
	appeared: Array<{
		name: string;
		position: string;
		activity: string | null;
		mood: string[];
		physicalState: string[];
	}>;
	departed: string[];
}

/**
 * LLM response for character outfit change extraction.
 * LLM-friendly format: removed slots + added items.
 */
export interface ExtractedOutfitChange {
	reasoning: string;
	character: string;
	/** Slots where items were removed */
	removed: OutfitSlot[];
	/** Slots where new items were added/changed */
	added: Partial<Record<OutfitSlot, string>>;
}

/**
 * LLM response for character mood change extraction.
 */
export interface ExtractedMoodChange {
	reasoning: string;
	character: string;
	added: string[];
	removed: string[];
}

/**
 * LLM response for character position change extraction.
 */
export interface ExtractedPositionChange {
	reasoning: string;
	character: string;
	changed: boolean;
	newPosition?: string;
}

/**
 * LLM response for character activity change extraction.
 */
export interface ExtractedActivityChange {
	reasoning: string;
	character: string;
	changed: boolean;
	newActivity?: string | null;
}

/**
 * LLM response for character physical state change extraction.
 */
export interface ExtractedPhysicalChange {
	reasoning: string;
	character: string;
	added: string[];
	removed: string[];
}

/**
 * LLM response for combined position and activity change extraction.
 * Merges position and activity extraction into a single LLM call for efficiency.
 */
export interface ExtractedPositionActivityChange {
	reasoning: string;
	character: string;
	positionChanged: boolean;
	newPosition?: string;
	activityChanged: boolean;
	newActivity?: string | null;
}

/**
 * LLM response for combined mood and physical state change extraction.
 * Merges mood and physical state extraction into a single LLM call for efficiency.
 */
export interface ExtractedMoodPhysicalChange {
	reasoning: string;
	character: string;
	moodAdded: string[];
	moodRemoved: string[];
	physicalAdded: string[];
	physicalRemoved: string[];
}

/**
 * LLM response for character state consolidation.
 * Returns consolidated mood and physical state lists (2-5 items, no synonyms).
 */
export interface ExtractedStateConsolidation {
	reasoning: string;
	consolidatedMoods: string[];
	consolidatedPhysical: string[];
}

/**
 * Single direction of relationship attribute change.
 */
export interface DirectionalAttributeChange {
	fromCharacter: string;
	towardCharacter: string;
	added: string[];
	removed: string[];
}

/**
 * LLM response for relationship wants change extraction.
 * Contains changes for both directions (A→B and B→A).
 */
export interface ExtractedWantsChange {
	reasoning: string;
	changes: DirectionalAttributeChange[];
}

/**
 * LLM response for relationship feelings change extraction.
 * Contains changes for both directions (A→B and B→A).
 */
export interface ExtractedFeelingsChange {
	reasoning: string;
	changes: DirectionalAttributeChange[];
}

/**
 * LLM response for relationship secrets change extraction.
 * Contains changes for both directions (A→B and B→A).
 */
export interface ExtractedSecretsChange {
	reasoning: string;
	changes: DirectionalAttributeChange[];
}

/**
 * LLM response for relationship status change extraction.
 */
export interface ExtractedStatusChange {
	reasoning: string;
	pair: [string, string];
	changed: boolean;
	newStatus?: RelationshipStatus;
}

/**
 * LLM response for relationship subjects extraction.
 */
export interface ExtractedSubjects {
	reasoning: string;
	subjects: Array<{
		pair: [string, string];
		subject: Subject;
	}>;
}

/**
 * LLM response for subjects confirmation.
 * Returns a single result for one candidate subject.
 */
export interface ExtractedSubjectsConfirmation {
	/** The classification result */
	result: 'accept' | 'wrong_subject' | 'reject';
	/** Reasoning for the classification */
	reasoning: string;
	/** The correct subject type if result is 'wrong_subject' */
	correct_subject?: Subject;
}

/**
 * LLM response for relationship attitude consolidation (single direction).
 * Returns consolidated feelings and wants for one direction (2-5 items, no synonyms).
 */
export interface ExtractedAttitudeConsolidation {
	reasoning: string;
	consolidatedFeelings: string[];
	consolidatedWants: string[];
}

/**
 * LLM response for topic/tone change extraction.
 */
export interface ExtractedTopicToneChange {
	reasoning: string;
	changed: boolean;
	newTopic?: string;
	newTone?: string;
}

/**
 * LLM response for tension change extraction.
 * Note: direction is calculated programmatically based on level change, not extracted.
 */
export interface ExtractedTensionChange {
	reasoning: string;
	changed: boolean;
	newLevel?: TensionLevel;
	newType?: TensionType;
}

/**
 * LLM response for narrative description extraction.
 * Always returns a description summarizing the last 2 messages.
 * Witnesses and location are derived from projection state, not extracted.
 */
export interface ExtractedNarrativeDescription {
	reasoning: string;
	description: string;
}

/**
 * LLM response for milestone description generation.
 */
export interface ExtractedMilestoneDescription {
	reasoning: string;
	description: string;
}

/**
 * LLM response for chapter ended check.
 */
export interface ExtractedChapterEnded {
	reasoning: string;
	shouldEnd: boolean;
	reason?: 'location_change' | 'time_jump' | 'both';
}

/**
 * LLM response for chapter description generation.
 */
export interface ExtractedChapterDescription {
	reasoning: string;
	title: string;
	summary: string;
}

// ============================================
// Batch Extraction Responses (for efficiency)
// ============================================

/**
 * Batch extraction for all character changes for a single character.
 */
export interface ExtractedCharacterChanges {
	reasoning: string;
	character: string;
	position?: ExtractedPositionChange;
	activity?: ExtractedActivityChange;
	mood?: ExtractedMoodChange;
	outfit?: ExtractedOutfitChange;
	physical?: ExtractedPhysicalChange;
}

/**
 * Batch extraction for all relationship attitude changes for a directed pair.
 */
export interface ExtractedAttitudeChanges {
	reasoning: string;
	fromCharacter: string;
	towardCharacter: string;
	feelings?: ExtractedFeelingsChange;
	secrets?: ExtractedSecretsChange;
	wants?: ExtractedWantsChange;
}

// ============================================
// Type Guards
// ============================================

/**
 * Check if an extraction has the reasoning field.
 */
export function hasReasoning(obj: unknown): obj is { reasoning: string } {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		'reasoning' in obj &&
		typeof (obj as { reasoning: unknown }).reasoning === 'string'
	);
}

/**
 * Check if an extracted change indicates something changed.
 */
export function extractionIndicatesChange(
	extraction:
		| ExtractedTimeChange
		| ExtractedLocationChange
		| ExtractedTopicToneChange
		| ExtractedTensionChange
		| ExtractedChapterEnded
		| ExtractedPositionChange
		| ExtractedActivityChange
		| ExtractedStatusChange,
): boolean {
	if ('changed' in extraction) {
		return extraction.changed;
	}
	if ('shouldEnd' in extraction) {
		return extraction.shouldEnd;
	}
	return false;
}

/**
 * Check if an extracted list change has any changes.
 * Handles both simple list changes (props, mood, physical) and
 * directional relationship changes (feelings, secrets, wants).
 */
export function extractionHasListChanges(
	extraction:
		| ExtractedPropsChange
		| ExtractedMoodChange
		| ExtractedPhysicalChange
		| ExtractedWantsChange
		| ExtractedFeelingsChange
		| ExtractedSecretsChange,
): boolean {
	// Check for directional change format (feelings, secrets, wants)
	if ('changes' in extraction) {
		return extraction.changes.some(
			(change: DirectionalAttributeChange) =>
				change.added.length > 0 || change.removed.length > 0,
		);
	}

	// Simple list change format (props, mood, physical)
	return extraction.added.length > 0 || extraction.removed.length > 0;
}

/**
 * Check if an extracted outfit change has any changes.
 */
export function extractionHasOutfitChanges(extraction: ExtractedOutfitChange): boolean {
	return extraction.removed.length > 0 || Object.keys(extraction.added).length > 0;
}
