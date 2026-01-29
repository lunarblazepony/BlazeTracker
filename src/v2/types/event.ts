/**
 * V2 Event Types
 *
 * All events in the system with their kinds and subkinds.
 * Events are the single source of truth - state is projected from events.
 *
 * Note: Time is stored as ISO string for serialization, use deserializeMoment() to get moment.
 */

import type {
	MessageAndSwipe,
	TimeDelta,
	OutfitSlot,
	TensionLevel,
	TensionType,
	TensionDirection,
	RelationshipStatus,
	LocationType,
} from './common';
import type { LocationForecast } from '../../weather/types';
import type { Subject } from './subject';

/**
 * Event kinds - the major categories of events.
 */
export type EventKind =
	| 'time'
	| 'location'
	| 'forecast_generated'
	| 'character'
	| 'relationship'
	| 'topic_tone'
	| 'tension'
	| 'narrative_description'
	| 'chapter';

/**
 * Time event subkinds.
 */
export type TimeSubkind = 'initial' | 'delta';

/**
 * Location event subkinds.
 */
export type LocationSubkind = 'moved' | 'prop_added' | 'prop_removed';

/**
 * Character event subkinds.
 */
export type CharacterSubkind =
	| 'appeared'
	| 'departed'
	| 'profile_set'
	| 'position_changed'
	| 'activity_changed'
	| 'mood_added'
	| 'mood_removed'
	| 'outfit_changed'
	| 'physical_added'
	| 'physical_removed';

/**
 * Relationship event subkinds.
 */
export type RelationshipSubkind =
	| 'feeling_added'
	| 'feeling_removed'
	| 'secret_added'
	| 'secret_removed'
	| 'want_added'
	| 'want_removed'
	| 'status_changed'
	| 'subject';

/**
 * Chapter event subkinds.
 */
export type ChapterSubkind = 'ended' | 'described';

/**
 * Base interface for all events.
 */
export interface BaseEvent {
	/** UUID for this event */
	id: string;
	/** Message and swipe that generated this event */
	source: MessageAndSwipe;
	/** Real-world timestamp when event was created */
	timestamp: number;
	/** Soft delete flag - deleted events are excluded from projection */
	deleted?: boolean;
}

// ============================================
// Time Events
// ============================================

/**
 * Initial time event - sets the absolute starting time.
 */
export interface TimeInitialEvent extends BaseEvent {
	kind: 'time';
	subkind: 'initial';
	/** Absolute narrative time as ISO string (use deserializeMoment to parse) */
	time: string;
}

/**
 * Time delta event - represents time passing.
 */
export interface TimeDeltaEvent extends BaseEvent {
	kind: 'time';
	subkind: 'delta';
	/** Time delta from previous state (days, hours, minutes, seconds) */
	delta: TimeDelta;
}

export type TimeEvent = TimeInitialEvent | TimeDeltaEvent;

// ============================================
// Location Events
// ============================================

/**
 * Location moved event - character(s) moved to a new location.
 */
export interface LocationMovedEvent extends BaseEvent {
	kind: 'location';
	subkind: 'moved';
	newArea: string;
	newPlace: string;
	newPosition: string;
	/** New location type if indoor/outdoor status changed */
	newLocationType?: LocationType;
	previousArea?: string;
	previousPlace?: string;
	previousPosition?: string;
}

/**
 * Location prop added event.
 */
export interface LocationPropAddedEvent extends BaseEvent {
	kind: 'location';
	subkind: 'prop_added';
	prop: string;
}

/**
 * Location prop removed event.
 */
export interface LocationPropRemovedEvent extends BaseEvent {
	kind: 'location';
	subkind: 'prop_removed';
	prop: string;
}

export type LocationEvent = LocationMovedEvent | LocationPropAddedEvent | LocationPropRemovedEvent;

// ============================================
// Forecast Generated Events
// ============================================

/**
 * Forecast generated event.
 * Generated when entering a new area or when time exceeds the forecast range.
 * Forecasts are 28-day weather forecasts used to derive climate deterministically.
 */
export interface ForecastGeneratedEvent extends BaseEvent {
	kind: 'forecast_generated';
	/** Area name this forecast is for */
	areaName: string;
	/** Start date of the forecast (YYYY-MM-DD) */
	startDate: string;
	/** The 28-day forecast data */
	forecast: LocationForecast;
}

// ============================================
// Character Events
// ============================================

/**
 * Character appeared event.
 */
export interface CharacterAppearedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'appeared';
	character: string;
	initialPosition?: string;
	initialActivity?: string;
	initialMood?: string[];
	initialPhysicalState?: string[];
}

/**
 * Character departed event.
 */
export interface CharacterDepartedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'departed';
	character: string;
}

/**
 * Character profile set event.
 * Sets the condensed profile for a character (typically when they first appear).
 */
export interface CharacterProfileSetEvent extends BaseEvent {
	kind: 'character';
	subkind: 'profile_set';
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
 * Character position changed event.
 */
export interface CharacterPositionChangedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'position_changed';
	character: string;
	newValue: string;
	previousValue?: string;
}

/**
 * Character activity changed event.
 */
export interface CharacterActivityChangedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'activity_changed';
	character: string;
	newValue: string | null;
	previousValue?: string | null;
}

/**
 * Character mood added event.
 */
export interface CharacterMoodAddedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'mood_added';
	character: string;
	mood: string;
}

/**
 * Character mood removed event.
 */
export interface CharacterMoodRemovedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'mood_removed';
	character: string;
	mood: string;
}

/**
 * Character outfit changed event.
 */
export interface CharacterOutfitChangedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'outfit_changed';
	character: string;
	slot: OutfitSlot;
	newValue: string | null;
	previousValue?: string | null;
}

/**
 * Character physical state added event.
 */
export interface CharacterPhysicalAddedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'physical_added';
	character: string;
	physicalState: string;
}

/**
 * Character physical state removed event.
 */
export interface CharacterPhysicalRemovedEvent extends BaseEvent {
	kind: 'character';
	subkind: 'physical_removed';
	character: string;
	physicalState: string;
}

export type CharacterEvent =
	| CharacterAppearedEvent
	| CharacterDepartedEvent
	| CharacterProfileSetEvent
	| CharacterPositionChangedEvent
	| CharacterActivityChangedEvent
	| CharacterMoodAddedEvent
	| CharacterMoodRemovedEvent
	| CharacterOutfitChangedEvent
	| CharacterPhysicalAddedEvent
	| CharacterPhysicalRemovedEvent;

// ============================================
// Relationship Events
// ============================================

/**
 * Relationship feeling added event.
 */
export interface RelationshipFeelingAddedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'feeling_added';
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

/**
 * Relationship feeling removed event.
 */
export interface RelationshipFeelingRemovedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'feeling_removed';
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

/**
 * Relationship secret added event.
 */
export interface RelationshipSecretAddedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'secret_added';
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

/**
 * Relationship secret removed event.
 */
export interface RelationshipSecretRemovedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'secret_removed';
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

/**
 * Relationship want added event.
 */
export interface RelationshipWantAddedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'want_added';
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

/**
 * Relationship want removed event.
 */
export interface RelationshipWantRemovedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'want_removed';
	fromCharacter: string;
	towardCharacter: string;
	value: string;
}

/**
 * Relationship status changed event.
 */
export interface RelationshipStatusChangedEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'status_changed';
	/** Character pair (alphabetically sorted) */
	pair: [string, string];
	newStatus: RelationshipStatus;
	previousStatus?: RelationshipStatus;
}

/**
 * Relationship subject event - interaction type that occurred.
 * When this is the first occurrence of this subject for this pair
 * AND it has a milestoneDescription, it's considered a milestone.
 */
export interface RelationshipSubjectEvent extends BaseEvent {
	kind: 'relationship';
	subkind: 'subject';
	/** Character pair (alphabetically sorted) */
	pair: [string, string];
	/** The subject/interaction type */
	subject: Subject;
	/** Milestone description (if generated) - makes this a milestone */
	milestoneDescription?: string;
}

export type RelationshipEvent =
	| RelationshipFeelingAddedEvent
	| RelationshipFeelingRemovedEvent
	| RelationshipSecretAddedEvent
	| RelationshipSecretRemovedEvent
	| RelationshipWantAddedEvent
	| RelationshipWantRemovedEvent
	| RelationshipStatusChangedEvent
	| RelationshipSubjectEvent;

// ============================================
// Topic/Tone Events
// ============================================

/**
 * Topic and tone change event.
 */
export interface TopicToneEvent extends BaseEvent {
	kind: 'topic_tone';
	topic: string;
	tone: string;
	previousTopic?: string;
	previousTone?: string;
}

// ============================================
// Tension Events
// ============================================

/**
 * Tension change event.
 */
export interface TensionEvent extends BaseEvent {
	kind: 'tension';
	level: TensionLevel;
	type: TensionType;
	direction: TensionDirection;
	previousLevel?: TensionLevel;
	previousType?: TensionType;
	previousDirection?: TensionDirection;
}

// ============================================
// Narrative Description Events
// ============================================

/**
 * Narrative description event - summary of what happened.
 * These are projected into NarrativeEvents for display.
 * Witnesses and location are derived from projection state at projection time.
 */
export interface NarrativeDescriptionEvent extends BaseEvent {
	kind: 'narrative_description';
	/** Brief summary of what happened */
	description: string;
}

// ============================================
// Chapter Events
// ============================================

/**
 * Chapter ended event - marks a chapter boundary.
 */
export interface ChapterEndedEvent extends BaseEvent {
	kind: 'chapter';
	subkind: 'ended';
	/** The chapter index that ended (0-based) */
	chapterIndex: number;
	/** Why the chapter ended */
	reason: 'location_change' | 'time_jump' | 'both' | 'manual';
}

/**
 * Chapter described event - adds title and summary to a chapter.
 */
export interface ChapterDescribedEvent extends BaseEvent {
	kind: 'chapter';
	subkind: 'described';
	/** The chapter index being described */
	chapterIndex: number;
	/** Chapter title */
	title: string;
	/** Chapter summary */
	summary: string;
}

export type ChapterEvent = ChapterEndedEvent | ChapterDescribedEvent;

// ============================================
// Union Types
// ============================================

/**
 * All event types in the system.
 */
export type Event =
	| TimeEvent
	| LocationEvent
	| ForecastGeneratedEvent
	| CharacterEvent
	| RelationshipEvent
	| TopicToneEvent
	| TensionEvent
	| NarrativeDescriptionEvent
	| ChapterEvent;

/**
 * Event kind and subkind pair for filtering/matching.
 */
export interface KindAndSubkind {
	kind: EventKind;
	subkind?: string;
}

// ============================================
// Type Guards
// ============================================

export function isTimeEvent(event: Event): event is TimeEvent {
	return event.kind === 'time';
}

export function isTimeInitialEvent(event: Event): event is TimeInitialEvent {
	return event.kind === 'time' && (event as TimeEvent).subkind === 'initial';
}

export function isTimeDeltaEvent(event: Event): event is TimeDeltaEvent {
	return event.kind === 'time' && (event as TimeEvent).subkind === 'delta';
}

export function isLocationEvent(event: Event): event is LocationEvent {
	return event.kind === 'location';
}

export function isLocationMovedEvent(event: Event): event is LocationMovedEvent {
	return event.kind === 'location' && (event as LocationEvent).subkind === 'moved';
}

export function isLocationPropAddedEvent(event: Event): event is LocationPropAddedEvent {
	return event.kind === 'location' && (event as LocationEvent).subkind === 'prop_added';
}

export function isLocationPropRemovedEvent(event: Event): event is LocationPropRemovedEvent {
	return event.kind === 'location' && (event as LocationEvent).subkind === 'prop_removed';
}

export function isForecastGeneratedEvent(event: Event): event is ForecastGeneratedEvent {
	return event.kind === 'forecast_generated';
}

export function isCharacterEvent(event: Event): event is CharacterEvent {
	return event.kind === 'character';
}

export function isCharacterAppearedEvent(event: Event): event is CharacterAppearedEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'appeared';
}

export function isCharacterDepartedEvent(event: Event): event is CharacterDepartedEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'departed';
}

export function isCharacterProfileSetEvent(event: Event): event is CharacterProfileSetEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'profile_set';
}

export function isCharacterPositionChangedEvent(
	event: Event,
): event is CharacterPositionChangedEvent {
	return (
		event.kind === 'character' &&
		(event as CharacterEvent).subkind === 'position_changed'
	);
}

export function isCharacterActivityChangedEvent(
	event: Event,
): event is CharacterActivityChangedEvent {
	return (
		event.kind === 'character' &&
		(event as CharacterEvent).subkind === 'activity_changed'
	);
}

export function isCharacterMoodAddedEvent(event: Event): event is CharacterMoodAddedEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'mood_added';
}

export function isCharacterMoodRemovedEvent(event: Event): event is CharacterMoodRemovedEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'mood_removed';
}

export function isCharacterOutfitChangedEvent(event: Event): event is CharacterOutfitChangedEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'outfit_changed';
}

export function isCharacterPhysicalAddedEvent(event: Event): event is CharacterPhysicalAddedEvent {
	return event.kind === 'character' && (event as CharacterEvent).subkind === 'physical_added';
}

export function isCharacterPhysicalRemovedEvent(
	event: Event,
): event is CharacterPhysicalRemovedEvent {
	return (
		event.kind === 'character' &&
		(event as CharacterEvent).subkind === 'physical_removed'
	);
}

export function isRelationshipEvent(event: Event): event is RelationshipEvent {
	return event.kind === 'relationship';
}

export function isRelationshipFeelingAddedEvent(
	event: Event,
): event is RelationshipFeelingAddedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'feeling_added'
	);
}

export function isRelationshipFeelingRemovedEvent(
	event: Event,
): event is RelationshipFeelingRemovedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'feeling_removed'
	);
}

export function isRelationshipSecretAddedEvent(
	event: Event,
): event is RelationshipSecretAddedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'secret_added'
	);
}

export function isRelationshipSecretRemovedEvent(
	event: Event,
): event is RelationshipSecretRemovedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'secret_removed'
	);
}

export function isRelationshipWantAddedEvent(event: Event): event is RelationshipWantAddedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'want_added'
	);
}

export function isRelationshipWantRemovedEvent(
	event: Event,
): event is RelationshipWantRemovedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'want_removed'
	);
}

export function isRelationshipStatusChangedEvent(
	event: Event,
): event is RelationshipStatusChangedEvent {
	return (
		event.kind === 'relationship' &&
		(event as RelationshipEvent).subkind === 'status_changed'
	);
}

export function isRelationshipSubjectEvent(event: Event): event is RelationshipSubjectEvent {
	return event.kind === 'relationship' && (event as RelationshipEvent).subkind === 'subject';
}

export function isTopicToneEvent(event: Event): event is TopicToneEvent {
	return event.kind === 'topic_tone';
}

export function isTensionEvent(event: Event): event is TensionEvent {
	return event.kind === 'tension';
}

export function isNarrativeDescriptionEvent(event: Event): event is NarrativeDescriptionEvent {
	return event.kind === 'narrative_description';
}

export function isChapterEvent(event: Event): event is ChapterEvent {
	return event.kind === 'chapter';
}

export function isChapterEndedEvent(event: Event): event is ChapterEndedEvent {
	return event.kind === 'chapter' && (event as ChapterEvent).subkind === 'ended';
}

export function isChapterDescribedEvent(event: Event): event is ChapterDescribedEvent {
	return event.kind === 'chapter' && (event as ChapterEvent).subkind === 'described';
}

/**
 * Check if an event is a directional relationship event (has fromCharacter/towardCharacter).
 */
export function isDirectionalRelationshipEvent(
	event: Event,
): event is
	| RelationshipFeelingAddedEvent
	| RelationshipFeelingRemovedEvent
	| RelationshipSecretAddedEvent
	| RelationshipSecretRemovedEvent
	| RelationshipWantAddedEvent
	| RelationshipWantRemovedEvent {
	if (event.kind !== 'relationship') return false;
	const subkind = (event as RelationshipEvent).subkind;
	return (
		subkind === 'feeling_added' ||
		subkind === 'feeling_removed' ||
		subkind === 'secret_added' ||
		subkind === 'secret_removed' ||
		subkind === 'want_added' ||
		subkind === 'want_removed'
	);
}

/**
 * Get the character pair from any relationship event.
 * For directional events, derives pair from fromCharacter/towardCharacter (alphabetically sorted).
 * For status/subject events, returns the explicit pair.
 */
export function getRelationshipPair(event: RelationshipEvent): [string, string] {
	if (isRelationshipStatusChangedEvent(event) || isRelationshipSubjectEvent(event)) {
		return event.pair;
	}
	// Directional event - derive pair
	const a = event.fromCharacter;
	const b = event.towardCharacter;
	return a < b ? [a, b] : [b, a];
}

/**
 * Match an event against a kind/subkind filter.
 */
export function matchesKindAndSubkind(event: Event, filter: KindAndSubkind): boolean {
	if (event.kind !== filter.kind) return false;
	if (filter.subkind === undefined) return true;
	return 'subkind' in event && (event as { subkind: string }).subkind === filter.subkind;
}
