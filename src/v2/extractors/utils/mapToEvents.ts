/**
 * Map extraction responses to events.
 *
 * Converts LLM-friendly extraction format to projection-friendly events.
 */

import { generateEventId } from '../../store/serialization';
import type { MessageAndSwipe } from '../../types';
import type {
	TimeDeltaEvent,
	LocationMovedEvent,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
	CharacterAppearedEvent,
	CharacterDepartedEvent,
	CharacterPositionChangedEvent,
	CharacterActivityChangedEvent,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	CharacterOutfitChangedEvent,
	CharacterPhysicalAddedEvent,
	CharacterPhysicalRemovedEvent,
	RelationshipFeelingAddedEvent,
	RelationshipFeelingRemovedEvent,
	RelationshipSecretAddedEvent,
	RelationshipSecretRemovedEvent,
	RelationshipWantAddedEvent,
	RelationshipWantRemovedEvent,
	RelationshipStatusChangedEvent,
	RelationshipSubjectEvent,
	TopicToneEvent,
	TensionEvent,
	NarrativeDescriptionEvent,
	ChapterEndedEvent,
	ChapterDescribedEvent,
} from '../../types';
import type {
	ExtractedTimeChange,
	ExtractedLocationChange,
	ExtractedPropsChange,
	ExtractedCharacterPresenceChange,
	ExtractedOutfitChange,
	ExtractedMoodChange,
	ExtractedPositionChange,
	ExtractedActivityChange,
	ExtractedPhysicalChange,
	ExtractedPositionActivityChange,
	ExtractedMoodPhysicalChange,
	ExtractedFeelingsChange,
	ExtractedSecretsChange,
	ExtractedWantsChange,
	ExtractedStatusChange,
	ExtractedSubjects,
	ExtractedTopicToneChange,
	ExtractedTensionChange,
	ExtractedNarrativeDescription,
	ExtractedChapterEnded,
	ExtractedChapterDescription,
} from '../../types/extraction';
import { sortPair } from '../../types';
import type {
	OutfitSlot,
	RelationshipStatus,
	TensionLevel,
	TensionType,
	TensionDirection,
} from '../../types';
import type { Subject } from '../../types';

/**
 * Create base event fields.
 */
export function baseEvent(source: MessageAndSwipe): {
	id: string;
	source: MessageAndSwipe;
	timestamp: number;
} {
	return {
		id: generateEventId(),
		source,
		timestamp: Date.now(),
	};
}

// ============================================
// Time Events
// ============================================

export function mapTimeChange(
	extraction: ExtractedTimeChange,
	source: MessageAndSwipe,
): TimeDeltaEvent[] {
	// Delta is now always present (v1-style always-estimate approach)
	if (!extraction.delta) return [];

	return [
		{
			...baseEvent(source),
			kind: 'time',
			subkind: 'delta',
			delta: extraction.delta,
		},
	];
}

// ============================================
// Location Events
// ============================================

export function mapLocationChange(
	extraction: ExtractedLocationChange,
	source: MessageAndSwipe,
): LocationMovedEvent[] {
	if (!extraction.changed) return [];

	const event: LocationMovedEvent = {
		...baseEvent(source),
		kind: 'location',
		subkind: 'moved',
		newArea: extraction.newArea ?? '',
		newPlace: extraction.newPlace ?? '',
		newPosition: extraction.newPosition ?? '',
	};

	// Include newLocationType if it was extracted
	if (extraction.newLocationType) {
		event.newLocationType = extraction.newLocationType;
	}

	return [event];
}

export function mapPropsChange(
	extraction: ExtractedPropsChange,
	source: MessageAndSwipe,
): (LocationPropAddedEvent | LocationPropRemovedEvent)[] {
	const events: (LocationPropAddedEvent | LocationPropRemovedEvent)[] = [];

	for (const prop of extraction.added) {
		events.push({
			...baseEvent(source),
			kind: 'location',
			subkind: 'prop_added',
			prop,
		});
	}

	for (const prop of extraction.removed) {
		events.push({
			...baseEvent(source),
			kind: 'location',
			subkind: 'prop_removed',
			prop,
		});
	}

	return events;
}

// ============================================
// Character Events
// ============================================

export function mapPresenceChange(
	extraction: ExtractedCharacterPresenceChange,
	source: MessageAndSwipe,
): (CharacterAppearedEvent | CharacterDepartedEvent)[] {
	const events: (CharacterAppearedEvent | CharacterDepartedEvent)[] = [];

	for (const char of extraction.appeared) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'appeared',
			character: char.name,
			initialPosition: char.position,
			initialActivity: char.activity ?? undefined,
			initialMood: char.mood?.length ? char.mood : undefined,
			initialPhysicalState: char.physicalState?.length
				? char.physicalState
				: undefined,
		});
	}

	for (const name of extraction.departed) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'departed',
			character: name,
		});
	}

	return events;
}

export function mapOutfitChange(
	extraction: ExtractedOutfitChange,
	source: MessageAndSwipe,
): CharacterOutfitChangedEvent[] {
	const events: CharacterOutfitChangedEvent[] = [];

	// Removed slots become null
	for (const slot of extraction.removed) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'outfit_changed',
			character: extraction.character,
			slot: slot as OutfitSlot,
			newValue: null,
		});
	}

	// Added slots get new values
	for (const [slot, value] of Object.entries(extraction.added)) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'outfit_changed',
			character: extraction.character,
			slot: slot as OutfitSlot,
			newValue: value,
		});
	}

	return events;
}

export function mapMoodChange(
	extraction: ExtractedMoodChange,
	source: MessageAndSwipe,
): (CharacterMoodAddedEvent | CharacterMoodRemovedEvent)[] {
	const events: (CharacterMoodAddedEvent | CharacterMoodRemovedEvent)[] = [];

	for (const mood of extraction.added) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'mood_added',
			character: extraction.character,
			mood,
		});
	}

	for (const mood of extraction.removed) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'mood_removed',
			character: extraction.character,
			mood,
		});
	}

	return events;
}

export function mapPositionChange(
	extraction: ExtractedPositionChange,
	source: MessageAndSwipe,
): CharacterPositionChangedEvent[] {
	if (!extraction.changed || !extraction.newPosition) return [];

	return [
		{
			...baseEvent(source),
			kind: 'character',
			subkind: 'position_changed',
			character: extraction.character,
			newValue: extraction.newPosition,
		},
	];
}

export function mapActivityChange(
	extraction: ExtractedActivityChange,
	source: MessageAndSwipe,
): CharacterActivityChangedEvent[] {
	if (!extraction.changed) return [];

	return [
		{
			...baseEvent(source),
			kind: 'character',
			subkind: 'activity_changed',
			character: extraction.character,
			newValue: extraction.newActivity ?? null,
		},
	];
}

export function mapPhysicalChange(
	extraction: ExtractedPhysicalChange,
	source: MessageAndSwipe,
): (CharacterPhysicalAddedEvent | CharacterPhysicalRemovedEvent)[] {
	const events: (CharacterPhysicalAddedEvent | CharacterPhysicalRemovedEvent)[] = [];

	for (const state of extraction.added) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'physical_added',
			character: extraction.character,
			physicalState: state,
		});
	}

	for (const state of extraction.removed) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'physical_removed',
			character: extraction.character,
			physicalState: state,
		});
	}

	return events;
}

/**
 * Map combined position and activity change extraction to events.
 * Returns both position and activity change events from a single extraction.
 */
export function mapPositionActivityChange(
	extraction: ExtractedPositionActivityChange,
	source: MessageAndSwipe,
): (CharacterPositionChangedEvent | CharacterActivityChangedEvent)[] {
	const events: (CharacterPositionChangedEvent | CharacterActivityChangedEvent)[] = [];

	// Handle position change
	if (extraction.positionChanged && extraction.newPosition) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'position_changed',
			character: extraction.character,
			newValue: extraction.newPosition,
		});
	}

	// Handle activity change
	if (extraction.activityChanged) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'activity_changed',
			character: extraction.character,
			newValue: extraction.newActivity ?? null,
		});
	}

	return events;
}

/**
 * Map combined mood and physical change extraction to events.
 * Returns mood and physical state events from a single extraction.
 */
export function mapMoodPhysicalChange(
	extraction: ExtractedMoodPhysicalChange,
	source: MessageAndSwipe,
): (
	| CharacterMoodAddedEvent
	| CharacterMoodRemovedEvent
	| CharacterPhysicalAddedEvent
	| CharacterPhysicalRemovedEvent
)[] {
	const events: (
		| CharacterMoodAddedEvent
		| CharacterMoodRemovedEvent
		| CharacterPhysicalAddedEvent
		| CharacterPhysicalRemovedEvent
	)[] = [];

	// Mood added
	for (const mood of extraction.moodAdded) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'mood_added',
			character: extraction.character,
			mood,
		});
	}

	// Mood removed
	for (const mood of extraction.moodRemoved) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'mood_removed',
			character: extraction.character,
			mood,
		});
	}

	// Physical added
	for (const state of extraction.physicalAdded) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'physical_added',
			character: extraction.character,
			physicalState: state,
		});
	}

	// Physical removed
	for (const state of extraction.physicalRemoved) {
		events.push({
			...baseEvent(source),
			kind: 'character',
			subkind: 'physical_removed',
			character: extraction.character,
			physicalState: state,
		});
	}

	return events;
}

// ============================================
// Relationship Events
// ============================================

export function mapFeelingsChange(
	extraction: ExtractedFeelingsChange,
	source: MessageAndSwipe,
): (RelationshipFeelingAddedEvent | RelationshipFeelingRemovedEvent)[] {
	const events: (RelationshipFeelingAddedEvent | RelationshipFeelingRemovedEvent)[] = [];

	// Iterate over all directional changes
	for (const change of extraction.changes) {
		for (const feeling of change.added) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: change.fromCharacter,
				towardCharacter: change.towardCharacter,
				value: feeling,
			});
		}

		for (const feeling of change.removed) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'feeling_removed',
				fromCharacter: change.fromCharacter,
				towardCharacter: change.towardCharacter,
				value: feeling,
			});
		}
	}

	return events;
}

export function mapSecretsChange(
	extraction: ExtractedSecretsChange,
	source: MessageAndSwipe,
): (RelationshipSecretAddedEvent | RelationshipSecretRemovedEvent)[] {
	const events: (RelationshipSecretAddedEvent | RelationshipSecretRemovedEvent)[] = [];

	// Iterate over all directional changes
	for (const change of extraction.changes) {
		for (const secret of change.added) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'secret_added',
				fromCharacter: change.fromCharacter,
				towardCharacter: change.towardCharacter,
				value: secret,
			});
		}

		for (const secret of change.removed) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'secret_removed',
				fromCharacter: change.fromCharacter,
				towardCharacter: change.towardCharacter,
				value: secret,
			});
		}
	}

	return events;
}

export function mapWantsChange(
	extraction: ExtractedWantsChange,
	source: MessageAndSwipe,
): (RelationshipWantAddedEvent | RelationshipWantRemovedEvent)[] {
	const events: (RelationshipWantAddedEvent | RelationshipWantRemovedEvent)[] = [];

	// Iterate over all directional changes
	for (const change of extraction.changes) {
		for (const want of change.added) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'want_added',
				fromCharacter: change.fromCharacter,
				towardCharacter: change.towardCharacter,
				value: want,
			});
		}

		for (const want of change.removed) {
			events.push({
				...baseEvent(source),
				kind: 'relationship',
				subkind: 'want_removed',
				fromCharacter: change.fromCharacter,
				towardCharacter: change.towardCharacter,
				value: want,
			});
		}
	}

	return events;
}

export function mapStatusChange(
	extraction: ExtractedStatusChange,
	source: MessageAndSwipe,
): RelationshipStatusChangedEvent[] {
	if (!extraction.changed || !extraction.newStatus) return [];

	const sortedPair = sortPair(extraction.pair[0], extraction.pair[1]);

	return [
		{
			...baseEvent(source),
			kind: 'relationship',
			subkind: 'status_changed',
			pair: sortedPair,
			newStatus: extraction.newStatus as RelationshipStatus,
		},
	];
}

export function mapSubjects(
	extraction: ExtractedSubjects,
	source: MessageAndSwipe,
): RelationshipSubjectEvent[] {
	const events: RelationshipSubjectEvent[] = [];

	for (const subj of extraction.subjects) {
		const sortedPair = sortPair(subj.pair[0], subj.pair[1]);
		events.push({
			...baseEvent(source),
			kind: 'relationship',
			subkind: 'subject',
			pair: sortedPair,
			subject: subj.subject as Subject,
		});
	}

	return events;
}

// ============================================
// Scene Events
// ============================================

export function mapTopicToneChange(
	extraction: ExtractedTopicToneChange,
	source: MessageAndSwipe,
	previousTopic?: string,
	previousTone?: string,
): TopicToneEvent[] {
	if (!extraction.changed) return [];

	return [
		{
			...baseEvent(source),
			kind: 'topic_tone',
			topic: extraction.newTopic ?? previousTopic ?? 'unknown',
			tone: extraction.newTone ?? previousTone ?? 'unknown',
		},
	];
}

/**
 * Calculate tension direction based on level change.
 * Ordered from lowest to highest tension.
 */
const TENSION_LEVEL_ORDER: TensionLevel[] = [
	'relaxed',
	'aware',
	'guarded',
	'tense',
	'charged',
	'volatile',
	'explosive',
];

function calculateTensionDirection(
	previousLevel: TensionLevel | undefined,
	newLevel: TensionLevel | undefined,
): TensionDirection {
	// If no new level extracted, direction is stable
	if (!newLevel) return 'stable';

	// If no previous level, direction is stable (initial state)
	if (!previousLevel) return 'stable';

	// Same level means stable
	if (previousLevel === newLevel) return 'stable';

	const prevIndex = TENSION_LEVEL_ORDER.indexOf(previousLevel);
	const newIndex = TENSION_LEVEL_ORDER.indexOf(newLevel);

	// Handle unknown levels
	if (prevIndex === -1 || newIndex === -1) return 'stable';

	// Compare indices to determine direction
	if (newIndex > prevIndex) return 'escalating';
	if (newIndex < prevIndex) return 'decreasing';
	return 'stable';
}

export function mapTensionChange(
	extraction: ExtractedTensionChange,
	source: MessageAndSwipe,
	previousLevel?: TensionLevel,
	previousType?: TensionType,
): TensionEvent[] {
	if (!extraction.changed) return [];

	const newLevel = (extraction.newLevel ?? previousLevel ?? 'relaxed') as TensionLevel;

	// Calculate direction programmatically based on level change
	const direction = calculateTensionDirection(
		previousLevel,
		extraction.newLevel as TensionLevel,
	);

	return [
		{
			...baseEvent(source),
			kind: 'tension',
			level: newLevel,
			type: (extraction.newType ?? previousType ?? 'conversation') as TensionType,
			direction,
		},
	];
}

// ============================================
// Narrative Events
// ============================================

export function mapNarrativeDescription(
	extraction: ExtractedNarrativeDescription,
	source: MessageAndSwipe,
): NarrativeDescriptionEvent[] {
	if (!extraction.description) return [];

	return [
		{
			...baseEvent(source),
			kind: 'narrative_description',
			description: extraction.description,
		},
	];
}

// ============================================
// Chapter Events
// ============================================

export function mapChapterEnded(
	extraction: ExtractedChapterEnded,
	source: MessageAndSwipe,
	chapterIndex: number,
): ChapterEndedEvent[] {
	if (!extraction.shouldEnd) return [];

	return [
		{
			...baseEvent(source),
			kind: 'chapter',
			subkind: 'ended',
			chapterIndex,
			reason: extraction.reason ?? 'location_change',
		},
	];
}

export function mapChapterDescription(
	extraction: ExtractedChapterDescription,
	source: MessageAndSwipe,
	chapterIndex: number,
): ChapterDescribedEvent[] {
	return [
		{
			...baseEvent(source),
			kind: 'chapter',
			subkind: 'described',
			chapterIndex,
			title: extraction.title,
			summary: extraction.summary,
		},
	];
}
