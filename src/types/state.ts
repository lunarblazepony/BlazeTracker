// ============================================
// Runtime State Types
// ============================================

export interface NarrativeDateTime {
	year: number;
	month: number; // 1-12
	day: number; // 1-31
	hour: number; // 0-23
	minute: number; // 0-59
	second: number; // 0-59
	dayOfWeek: string; // "Monday", "Tuesday", etc.
}

/**
 * TrackedState contains all extracted scene information.
 * All fields are optional - they will only be present if their
 * respective extraction module is enabled in settings.
 */
export interface TrackedState {
	time?: NarrativeDateTime;
	location?: LocationState;
	climate?: Climate | ProceduralClimate;
	scene?: Scene;
	characters?: Character[];
	/** Current chapter index (0-based) */
	currentChapter?: number;
	/** Events extracted from recent messages in the current chapter */
	currentEvents?: TimestampedEvent[];
	/** Summary of chapter that just ended (set on messages where chapter boundary was detected) */
	chapterEnded?: ChapterEndedSummary;
}

/** Summary shown when a chapter ends */
export interface ChapterEndedSummary {
	/** Chapter index that ended (0-based) */
	index: number;
	/** Chapter title */
	title: string;
	/** Brief summary of the chapter */
	summary: string;
	/** Number of events that were in the chapter */
	eventCount: number;
	/** Why the chapter ended */
	reason: 'location_change' | 'time_jump' | 'both' | 'manual';
}

export interface LocationState {
	area: string;
	place: string;
	position: string;
	props: string[];
}

/**
 * Legacy climate type - kept for backward compatibility
 */
export interface Climate {
	weather: 'sunny' | 'cloudy' | 'snowy' | 'rainy' | 'windy' | 'thunderstorm';
	temperature: number;
}

/**
 * Weather condition types for procedural weather
 */
export type WeatherCondition =
	| 'clear'
	| 'sunny'
	| 'partly_cloudy'
	| 'overcast'
	| 'foggy'
	| 'drizzle'
	| 'rain'
	| 'heavy_rain'
	| 'thunderstorm'
	| 'sleet'
	| 'snow'
	| 'heavy_snow'
	| 'blizzard'
	| 'windy'
	| 'hot'
	| 'cold'
	| 'humid';

export type DaylightPhase = 'dawn' | 'day' | 'dusk' | 'night';

export type BuildingType = 'modern' | 'heated' | 'unheated' | 'underground' | 'tent' | 'vehicle';

export type BaseClimateType =
	| 'temperate'
	| 'desert'
	| 'arctic'
	| 'tropical'
	| 'mediterranean'
	| 'continental'
	| 'oceanic';

/**
 * Extended climate type for procedural weather system
 */
export interface ProceduralClimate {
	temperature: number; // Effective temp (indoor if inside) °F
	outdoorTemperature: number; // Always outside temp °F
	indoorTemperature?: number; // Set when indoors °F
	feelsLike: number; // Wind chill / heat index °F
	humidity: number; // 0-100%
	precipitation: number; // inches
	cloudCover: number; // 0-100%
	windSpeed: number; // mph
	windDirection: string; // "NW", "SE", etc.
	conditions: string; // Human-readable description
	conditionType: WeatherCondition;
	uvIndex: number;
	daylight: DaylightPhase;
	isIndoors: boolean;
	buildingType?: BuildingType;
}

// Weather-related types are imported from weather module
// Import them for use in this file and re-export for convenience
import type {
	LocationMapping as WeatherLocationMapping,
	ForecastCacheEntry as WeatherForecastCacheEntry,
	LocationForecast as WeatherLocationForecast,
} from '../weather/types';

export type LocationMapping = WeatherLocationMapping;
export type ForecastCacheEntry = WeatherForecastCacheEntry;
export type LocationForecast = WeatherLocationForecast;

export interface Scene {
	topic: string;
	tone: string;
	tension: {
		level: TensionLevel;
		direction: TensionDirection;
		type: TensionType;
	};
	// Note: recentEvents removed in v1.0.0, replaced by currentEvents on TrackedState
}

export type TensionLevel =
	| 'relaxed'
	| 'aware'
	| 'guarded'
	| 'tense'
	| 'charged'
	| 'volatile'
	| 'explosive';
export type TensionDirection = 'escalating' | 'stable' | 'decreasing';
export type TensionType =
	| 'confrontation'
	| 'intimate'
	| 'vulnerable'
	| 'celebratory'
	| 'negotiation'
	| 'suspense'
	| 'conversation';

// ============================================
// Event Types
// ============================================

/**
 * Event type flags - multiple can apply to a single event.
 */
export type EventType =
	// Conversation & Social
	| 'conversation' // General dialogue, discussion
	| 'confession' // Admitting feelings, revealing truth
	| 'argument' // Verbal conflict, disagreement
	| 'negotiation' // Making deals, compromises

	// Discovery & Information
	| 'discovery' // Learning new information
	| 'secret_shared' // Sharing a secret with someone
	| 'secret_revealed' // Secret exposed (possibly unwillingly)

	// Emotional
	| 'emotional' // Emotional vulnerability, comfort
	| 'emotionally_intimate' // Deep emotional CONNECTION - heart-to-heart sharing, mutual vulnerability
	| 'supportive' // Providing emotional support
	| 'rejection' // Rejecting someone's advances/request
	| 'comfort' // Comforting someone in distress
	| 'apology' // Apologizing for something
	| 'forgiveness' // Forgiving someone

	// Bonding & Connection
	| 'laugh' // Sharing a laugh, humor, joy together
	| 'gift' // Giving or receiving a gift
	| 'compliment' // Giving sincere praise or compliment
	| 'tease' // Playful teasing, banter
	| 'flirt' // Flirtatious behavior
	| 'date' // Going on a date or romantic outing
	| 'i_love_you' // Saying "I love you" or equivalent declaration
	| 'sleepover' // Sleeping over together (non-sexual)
	| 'shared_meal' // Eating together
	| 'shared_activity' // Doing an activity together (games, hobbies, etc.)

	// Intimacy Levels (granular for romantic RP)
	| 'intimate_touch' // Hand-holding, caressing, non-sexual touch
	| 'intimate_kiss' // Kissing
	| 'intimate_embrace' // Hugging, cuddling, holding
	| 'intimate_heated' // Making out, heavy petting, grinding

	// Sexual Activity (activity-based granularity)
	| 'intimate_foreplay' // Teasing, undressing, leading up to sex
	| 'intimate_oral' // Oral sexual activity
	| 'intimate_manual' // Manual stimulation (hands, fingers)
	| 'intimate_penetrative' // Penetrative sex
	| 'intimate_climax' // Orgasm, completion

	// Action & Physical
	| 'action' // Physical activity, doing something
	| 'combat' // Fighting, violence
	| 'danger' // Threat, peril, risk

	// Decisions & Commitments
	| 'decision' // Making a choice
	| 'promise' // Making a commitment
	| 'betrayal' // Breaking trust
	| 'lied' // Told a lie or deceived someone

	// Life Events
	| 'exclusivity' // Committing to exclusivity
	| 'marriage' // Getting married
	| 'pregnancy' // Pregnancy-related event
	| 'childbirth' // Having a child

	// Social & Achievement
	| 'social' // Meeting people, social dynamics
	| 'achievement' // Accomplishment, success

	// Support & Protection (friendly/close gate milestones)
	| 'helped' // Helped with something significant
	| 'common_interest' // Discovered shared interest
	| 'outing' // Went somewhere together casually
	| 'defended' // Defended or stood up for them
	| 'crisis_together' // Went through danger together
	| 'vulnerability' // Showed weakness/vulnerability (general)
	| 'shared_vulnerability' // Showed emotional weakness TO someone in a trust-building moment
	| 'entrusted'; // Entrusted with something important

export const EVENT_TYPES: readonly EventType[] = [
	'conversation',
	'confession',
	'argument',
	'negotiation',
	'discovery',
	'secret_shared',
	'secret_revealed',
	'emotional',
	'emotionally_intimate',
	'supportive',
	'rejection',
	'comfort',
	'apology',
	'forgiveness',
	'laugh',
	'gift',
	'compliment',
	'tease',
	'flirt',
	'date',
	'i_love_you',
	'sleepover',
	'shared_meal',
	'shared_activity',
	'intimate_touch',
	'intimate_kiss',
	'intimate_embrace',
	'intimate_heated',
	'intimate_foreplay',
	'intimate_oral',
	'intimate_manual',
	'intimate_penetrative',
	'intimate_climax',
	'action',
	'combat',
	'danger',
	'decision',
	'promise',
	'betrayal',
	'lied',
	'exclusivity',
	'marriage',
	'pregnancy',
	'childbirth',
	'social',
	'achievement',
	'helped',
	'common_interest',
	'outing',
	'defended',
	'crisis_together',
	'vulnerability',
	'shared_vulnerability',
	'entrusted',
];

/**
 * Event type groups for UI display.
 */
export const EVENT_TYPE_GROUPS = {
	conversation: ['conversation', 'confession', 'argument', 'negotiation'],
	discovery: ['discovery', 'secret_shared', 'secret_revealed'],
	emotional: [
		'emotional',
		'emotionally_intimate',
		'supportive',
		'rejection',
		'comfort',
		'apology',
		'forgiveness',
	],
	bonding: [
		'laugh',
		'gift',
		'compliment',
		'tease',
		'flirt',
		'date',
		'i_love_you',
		'sleepover',
		'shared_meal',
		'shared_activity',
	],
	intimacy_romantic: [
		'intimate_touch',
		'intimate_kiss',
		'intimate_embrace',
		'intimate_heated',
	],
	intimacy_sexual: [
		'intimate_foreplay',
		'intimate_oral',
		'intimate_manual',
		'intimate_penetrative',
		'intimate_climax',
	],
	action: ['action', 'combat', 'danger'],
	commitment: ['decision', 'promise', 'betrayal', 'lied'],
	life_events: ['exclusivity', 'marriage', 'pregnancy', 'childbirth'],
	social: ['social', 'achievement'],
	support: [
		'helped',
		'common_interest',
		'outing',
		'defended',
		'crisis_together',
		'vulnerability',
		'shared_vulnerability',
		'entrusted',
	],
} as const;

/**
 * A significant event extracted from a message pair.
 */
export interface TimestampedEvent {
	/** Narrative timestamp when the event occurred */
	timestamp: NarrativeDateTime;
	/** Brief summary of what happened (1-2 sentences) */
	summary: string;
	/** Event type flags - multiple can apply */
	eventTypes: EventType[];
	/** Tension type at the moment of this event */
	tensionType: TensionType;
	/** Tension level at the moment of this event */
	tensionLevel: TensionLevel;
	/** Characters who witnessed/participated in this event */
	witnesses: string[];
	/** Location summary where event occurred */
	location: string;
	/** Optional relationship signal if this event affects relationships */
	relationshipSignal?: RelationshipSignal;
	/** Message ID that generated this event (for re-extraction cleanup) */
	messageId?: number;
}

/**
 * Signal indicating a relationship change detected in an event.
 */
export interface RelationshipSignal {
	/** The two characters involved (alphabetically sorted) */
	pair: [string, string];
	/** Directional attitude changes */
	changes?: DirectionalChange[];
	/** Milestone events if this represents significant relationship moments (multiple possible) */
	milestones?: MilestoneEvent[];
}

/**
 * A directional attitude change from one character toward another.
 */
export interface DirectionalChange {
	/** Character whose attitude is changing */
	from: string;
	/** Character they feel differently about */
	toward: string;
	/** New or changed feeling (e.g., "growing trust", "suspicion") */
	feeling: string;
}

/**
 * A milestone event in a relationship.
 */
export interface MilestoneEvent {
	type: MilestoneType;
	/** Flowery description of the milestone moment */
	description: string;
	/** Narrative timestamp when milestone occurred */
	timestamp: NarrativeDateTime;
	/** Location where milestone occurred (format: "place, area") */
	location: string;
	/** Message ID that created this milestone (for re-extraction cleanup) */
	messageId?: number;
}

/**
 * Result from the milestone confirmation prompt (4-way classification).
 */
export interface MilestoneConfirmResult {
	/** Validation result */
	result: 'accept' | 'wrong_event' | 'wrong_pair' | 'reject';
	/** Required if result is 'wrong_event'. The actual event type that occurred. */
	correctEvent?: EventType;
	/** Required if result is 'wrong_pair'. The actual character pair. */
	correctPair?: [string, string];
	/** For 'accept' and corrections: Brief description of what happened */
	description?: string;
	/** Explanation of why this classification was chosen */
	reasoning: string;
}

export type MilestoneType =
	// Relationship firsts
	| 'first_meeting'
	| 'first_conflict'
	| 'first_alliance'

	// Emotional milestones
	| 'confession' // Confessing feelings
	| 'emotional_intimacy' // Deep emotional connection/vulnerability

	// Bonding milestones (friendly gate)
	| 'first_laugh' // First shared genuine laugh
	| 'first_gift' // First gift exchanged
	| 'first_date' // First date or romantic outing
	| 'first_i_love_you' // First declaration of love
	| 'first_sleepover' // First time sleeping over together (non-sexual)
	| 'first_shared_meal' // First meal shared together
	| 'first_shared_activity' // First activity done together
	| 'first_compliment' // First sincere compliment
	| 'first_tease' // First playful teasing
	| 'first_flirt' // First flirtatious interaction
	| 'first_helped' // First time helping
	| 'first_common_interest' // First shared interest discovered
	| 'first_outing' // First casual outing together

	// Physical intimacy milestones (granular)
	| 'first_touch' // First meaningful physical contact (hand-holding, etc.)
	| 'first_kiss' // First kiss
	| 'first_embrace' // First hug/cuddle
	| 'first_heated' // First making out / heavy petting

	// Sexual milestones (atomic, matching event types)
	| 'first_foreplay' // First sexual foreplay
	| 'first_oral' // First oral sexual activity
	| 'first_manual' // First manual stimulation
	| 'first_penetrative' // First penetrative sex
	| 'first_climax' // First climax together

	// Life commitment milestones
	| 'promised_exclusivity' // Committed to exclusivity
	| 'marriage' // Got married
	| 'pregnancy' // Pregnancy discovered
	| 'had_child' // Child was born

	// Trust & commitment (close gate)
	| 'promise_made'
	| 'promise_broken'
	| 'betrayal'
	| 'reconciliation'
	| 'sacrifice'
	| 'first_support' // First emotional support
	| 'first_comfort' // First time comforting
	| 'defended' // Defended them
	| 'crisis_together' // Faced danger together
	| 'first_vulnerability' // First vulnerability shown
	| 'trusted_with_task' // Entrusted with task

	// Secrets
	| 'secret_shared'
	| 'secret_revealed'

	// Conflicts
	| 'major_argument'
	| 'major_reconciliation';

// ============================================
// Chapter Types
// ============================================

/**
 * A chapter represents a narrative segment with coherent time/location.
 */
export interface Chapter {
	/** 0-based chapter index */
	index: number;
	/** AI-generated chapter title */
	title: string;
	/** Brief summary of what happened */
	summary: string;
	/** Time range of the chapter */
	timeRange: {
		start: NarrativeDateTime;
		end: NarrativeDateTime;
	};
	/** Location where most of the chapter took place */
	primaryLocation: string;
	/** Events that occurred during this chapter (archived from currentEvents) */
	events: TimestampedEvent[];
	/** Outcomes extracted when chapter closed */
	outcomes: ChapterOutcomes;
}

/**
 * Outcomes extracted when a chapter is finalized.
 */
export interface ChapterOutcomes {
	/** Relationships that changed during this chapter */
	relationshipChanges: string[];
	/** Secrets that were revealed */
	secretsRevealed: string[];
	/** New complications introduced */
	newComplications: string[];
}

// ============================================
// Relationship Types
// ============================================

export type RelationshipStatus =
	| 'strangers'
	| 'acquaintances'
	| 'friendly'
	| 'close'
	| 'intimate'
	| 'strained'
	| 'hostile'
	| 'complicated';

/**
 * A versioned snapshot of relationship state at a status change.
 */
export interface RelationshipVersion {
	/** Message ID when this version was created */
	messageId: number;
	/** Relationship status at this version */
	status: RelationshipStatus;
	/** A's attitude toward B at this version */
	aToB: RelationshipAttitude;
	/** B's attitude toward A at this version */
	bToA: RelationshipAttitude;
	/** Milestones at this version */
	milestones: MilestoneEvent[];
}

/**
 * A relationship between two characters.
 */
export interface Relationship {
	/** Sorted pair of character names */
	pair: [string, string];
	/** Current relationship status */
	status: RelationshipStatus;
	/** How A feels about B */
	aToB: RelationshipAttitude;
	/** How B feels about A */
	bToA: RelationshipAttitude;
	/** Milestones in this relationship */
	milestones: MilestoneEvent[];
	/** Historical snapshots at chapter boundaries */
	history: RelationshipSnapshot[];
	/** Version history - snapshots at each status change */
	versions: RelationshipVersion[];
}

/**
 * One character's attitude toward another.
 */
export interface RelationshipAttitude {
	/** Current feelings (e.g., "trusting", "suspicious", "attracted") */
	feelings: string[];
	/** What they know that the other doesn't (for dramatic irony) */
	secrets: string[];
	/** What they want from the relationship */
	wants: string[];
}

/**
 * A snapshot of relationship state at a chapter boundary.
 */
export interface RelationshipSnapshot {
	chapterIndex: number;
	status: RelationshipStatus;
	summary: string;
}

// ============================================
// Chat-Level Narrative State
// ============================================

/**
 * Chat-level narrative state stored in message 0.
 * Contains information that spans the entire chat.
 *
 * Version 3: Event-sourced architecture (Phase 1)
 * - Events stored in central eventStore (single source of truth)
 * - Chapters reference events by ID
 * - Milestones derived from event.affectedPairs[].firstFor
 *
 * Version 4: Full state event-sourcing (Phase 2)
 * - All state (time, location, characters) stored as events
 * - State projected from events instead of stored per-message
 * - UnifiedEventStore replaces EventStore
 */
export interface NarrativeState {
	/** Schema version for migrations */
	version: number;
	/** Central event store (v3: EventStore, v4+: UnifiedEventStore) */
	eventStore?: EventStore | UnifiedEventStore;
	/** Completed chapters (v3+: DerivedChapter with eventIds) */
	chapters: (Chapter | DerivedChapter)[];
	/** All tracked relationships (v3+: may be DerivedRelationship) */
	relationships: (Relationship | DerivedRelationship)[];
	/** Snapshots at chapter boundaries for projection performance (v3+) */
	chapterSnapshots?: ChapterSnapshot[];
	/** Cached weather forecasts by location */
	forecastCache: ForecastCacheEntry[];
	/** Fantasy location → real-world climate mappings */
	locationMappings: LocationMapping[];
}

// ============================================
// Character Types (simplified in v1.0.0)
// ============================================

export interface Character {
	name: string;
	position: string;
	activity?: string;
	// Note: goals removed in v1.0.0, now tracked in CharacterArc
	mood: string[];
	physicalState?: string[];
	outfit: CharacterOutfit;
	// Note: dispositions removed in v1.0.0, now tracked in Relationship
}

export interface CharacterOutfit {
	head: string | null;
	neck: string | null; // necklaces, chokers, scarves, ties
	jacket: string | null;
	back: string | null; // backpacks, quivers, cloaks, capes
	torso: string | null;
	legs: string | null;
	footwear: string | null;
	socks: string | null;
	underwear: string | null;
}

export interface StoredStateData {
	state: TrackedState;
	extractedAt: string;
}

// ============================================
// Event Store Types (Phase 1: Event-Sourced Architecture)
// ============================================

/**
 * Central event store in NarrativeState.
 * Single source of truth for all narrative events.
 */
export interface EventStore {
	events: NarrativeEvent[];
	version: number;
}

/**
 * Canonical narrative event stored in the event store.
 */
export interface NarrativeEvent {
	/** UUID for this event */
	id: string;
	/** Message ID that generated this event */
	messageId: number;
	/** Swipe ID within the message */
	swipeId: number;
	/** Real-world extraction timestamp */
	timestamp: number;
	/** Soft delete flag */
	deleted?: boolean;

	// Content
	/** Brief summary of what happened (1-2 sentences) */
	summary: string;
	/** Event type flags - multiple can apply */
	eventTypes: EventType[];
	/** Tension level at the moment of this event */
	tensionLevel: TensionLevel;
	/** Tension type at the moment of this event */
	tensionType: TensionType;
	/** Characters who witnessed/participated in this event */
	witnesses: string[];
	/** Location summary where event occurred */
	location: string;
	/** Narrative timestamp when the event occurred */
	narrativeTimestamp: NarrativeDateTime;
	/** Chapter index assigned when chapter closes */
	chapterIndex?: number;

	// Relationship effects
	/** Relationship effects for character pairs */
	affectedPairs: AffectedPair[];
}

/**
 * Relationship effect for a character pair within an event.
 */
export interface AffectedPair {
	/** The two characters involved (alphabetically sorted) */
	pair: [string, string];
	/** Directional attitude changes */
	changes?: DirectionalChange[];
	/** This event is "first" for these milestone types (computed, not extracted) */
	firstFor?: MilestoneType[];
	/** LLM-generated milestone descriptions, cached */
	milestoneDescriptions?: Partial<Record<MilestoneType, string>>;
}

/**
 * Chapter that references events by ID instead of embedding them.
 */
export interface DerivedChapter {
	/** 0-based chapter index */
	index: number;
	/** AI-generated chapter title */
	title: string;
	/** Brief summary of what happened */
	summary: string;
	/** Outcomes extracted when chapter closed */
	outcomes: ChapterOutcomes;
	/** Event IDs that belong to this chapter */
	eventIds: string[];
	/** Message ID where chapter boundary was detected */
	boundaryMessageId: number;
	/** Time range of the chapter */
	timeRange: {
		start: NarrativeDateTime;
		end: NarrativeDateTime;
	};
	/** Location where most of the chapter took place */
	primaryLocation: string;
	/** Flag indicating chapter summary needs regeneration */
	needsRegeneration?: boolean;
}

/**
 * Relationship projected from events.
 */
export interface DerivedRelationship {
	/** Sorted pair of character names */
	pair: [string, string];
	/** Current relationship status */
	status: RelationshipStatus;
	/** How A feels about B */
	aToB: RelationshipAttitude;
	/** How B feels about A */
	bToA: RelationshipAttitude;
	/** Event IDs that contain firstFor entries for this pair */
	milestoneEventIds: string[];
	/** Historical snapshots at chapter boundaries */
	history: RelationshipSnapshot[];
}

/**
 * Snapshot of relationships at a chapter boundary for projection performance.
 */
export interface ChapterSnapshot {
	chapterIndex: number;
	boundaryMessageId: number;
	relationships: DerivedRelationship[];
}

// ============================================
// Phase 2: State Events (Full Event-Sourcing)
// ============================================

/**
 * Outfit slot names for character events.
 */
export type OutfitSlot = keyof CharacterOutfit;

export const OUTFIT_SLOTS: readonly OutfitSlot[] = [
	'head',
	'neck',
	'jacket',
	'back',
	'torso',
	'legs',
	'footwear',
	'socks',
	'underwear',
];

/**
 * Base interface for all state events.
 */
export interface BaseStateEvent {
	/** UUID for this event */
	id: string;
	/** Message ID that generated this event */
	messageId: number;
	/** Swipe ID within the message */
	swipeId: number;
	/** Real-world extraction timestamp */
	timestamp: number;
	/** Soft delete flag */
	deleted?: boolean;
}

/**
 * Event representing the initial time (first message only).
 * Sets the absolute time from which all deltas are calculated.
 */
export interface InitialTimeEvent extends BaseStateEvent {
	kind: 'time_initial';
	/** Absolute narrative time from initial extraction */
	initialTime: NarrativeDateTime;
}

/**
 * Event representing a time change (all subsequent messages).
 * Stores ONLY the delta - current time is calculated by projection (summing all deltas from initial time).
 * This ensures edits to prior TimeEvents automatically propagate correctly.
 */
export interface TimeEvent extends BaseStateEvent {
	kind: 'time';
	/** Time delta from previous state - ONLY stores the delta, not calculated time */
	delta: {
		days: number;
		hours: number;
		minutes: number;
	};
}

/**
 * Event representing a location change.
 */
/**
 * Location event subkinds for fine-grained state tracking.
 */
export type LocationEventSubkind = 'moved' | 'prop_added' | 'prop_removed';

/**
 * Event representing a location move (area/place/position change).
 */
export interface LocationMovedEvent extends BaseStateEvent {
	kind: 'location';
	subkind: 'moved';
	newArea: string;
	newPlace: string;
	newPosition: string;
	previousArea?: string;
	previousPlace?: string;
	previousPosition?: string;
}

/**
 * Event representing a prop change in the location.
 * Props are added when items are placed in the environment (e.g., clothes removed and dropped).
 * Props are removed when items are picked up or moved out of the scene.
 */
export interface LocationPropEvent extends BaseStateEvent {
	kind: 'location';
	subkind: 'prop_added' | 'prop_removed';
	/** The prop being added or removed */
	prop: string;
}

/**
 * Union type for all location events.
 */
export type LocationEvent = LocationMovedEvent | LocationPropEvent;

/**
 * Character event subkinds for fine-grained state tracking.
 */
export type CharacterEventSubkind =
	| 'appeared'
	| 'departed'
	| 'mood_added'
	| 'mood_removed'
	| 'outfit_changed'
	| 'position_changed'
	| 'activity_changed'
	| 'physical_state_added'
	| 'physical_state_removed';

/**
 * Event representing a character state change.
 */
export interface CharacterEvent extends BaseStateEvent {
	kind: 'character';
	/** The specific type of character change */
	subkind: CharacterEventSubkind;
	/** Character this event applies to */
	character: string;
	/** Outfit slot (for outfit_changed) */
	slot?: OutfitSlot;
	/** New value (for position_changed, activity_changed, outfit_changed) */
	newValue?: string | null;
	/** Previous value (for changes) */
	previousValue?: string | null;
	/** Mood (for mood_added, mood_removed) */
	mood?: string;
	/** Physical state (for physical_state_added, physical_state_removed) */
	physicalState?: string;
	/** Initial position (for appeared) */
	initialPosition?: string;
	/** Initial activity (for appeared) */
	initialActivity?: string;
}

/**
 * Location prop event subkind type (for backwards compatibility).
 * @deprecated Use LocationEventSubkind instead
 */
export type LocationPropSubkind = 'prop_added' | 'prop_removed';

/**
 * Event representing a weather forecast being generated.
 * Forecasts are generated once per area and cached.
 */
export interface ForecastGeneratedEvent extends BaseStateEvent {
	kind: 'forecast_generated';
	/** The area name for this forecast */
	areaName: string;
	/** The 28-day forecast data */
	forecast: LocationForecast;
}

/**
 * Relationship event subkinds for attitude tracking (directional).
 * These events have fromCharacter and towardCharacter - pair is derived.
 */
export type DirectionalRelationshipSubkind =
	| 'feeling_added'
	| 'feeling_removed'
	| 'secret_added'
	| 'secret_removed'
	| 'want_added'
	| 'want_removed';

/**
 * All relationship event subkinds.
 */
export type RelationshipEventSubkind = DirectionalRelationshipSubkind | 'status_changed';

/**
 * Directional relationship event - tracks attitude changes from one character toward another.
 * The pair is derived from fromCharacter/towardCharacter using derivePair().
 */
export interface DirectionalRelationshipEvent extends BaseStateEvent {
	kind: 'relationship';
	subkind: DirectionalRelationshipSubkind;
	/** Character whose attitude is changing (required) */
	fromCharacter: string;
	/** Character they feel differently about (required) */
	towardCharacter: string;
	/** The feeling/secret/want value */
	value: string;
}

/**
 * Status change event - tracks overall relationship status changes.
 * Requires explicit pair since there's no directional component.
 */
export interface StatusChangedEvent extends BaseStateEvent {
	kind: 'relationship';
	subkind: 'status_changed';
	/** Character pair (alphabetically sorted) - required for status events */
	pair: [string, string];
	/** New status */
	newStatus: RelationshipStatus;
	/** Previous status */
	previousStatus?: RelationshipStatus;
}

/**
 * Union type for all relationship events.
 * Directional events derive pair from fromCharacter/towardCharacter.
 * Status events have explicit pair.
 */
export type RelationshipEvent = DirectionalRelationshipEvent | StatusChangedEvent;

/**
 * Union type for all state events.
 * Note: Climate is derived from time + location + forecastCache, not stored as events.
 */
export type StateEvent =
	| InitialTimeEvent
	| TimeEvent
	| LocationEvent
	| CharacterEvent
	| ForecastGeneratedEvent
	| RelationshipEvent;

/**
 * Type guard for InitialTimeEvent.
 */
export function isInitialTimeEvent(event: StateEvent): event is InitialTimeEvent {
	return event.kind === 'time_initial';
}

/**
 * Type guard for TimeEvent (delta).
 */
export function isTimeEvent(event: StateEvent): event is TimeEvent {
	return event.kind === 'time';
}

/**
 * Type guard for LocationEvent.
 */
export function isLocationEvent(event: StateEvent): event is LocationEvent {
	return event.kind === 'location';
}

/**
 * Type guard for CharacterEvent.
 */
export function isCharacterEvent(event: StateEvent): event is CharacterEvent {
	return event.kind === 'character';
}

/**
 * Type guard for LocationMovedEvent.
 */
export function isLocationMovedEvent(event: StateEvent): event is LocationMovedEvent {
	return event.kind === 'location' && (event as LocationMovedEvent).subkind === 'moved';
}

/**
 * Type guard for LocationPropEvent.
 */
export function isLocationPropEvent(event: StateEvent): event is LocationPropEvent {
	return (
		event.kind === 'location' &&
		((event as LocationPropEvent).subkind === 'prop_added' ||
			(event as LocationPropEvent).subkind === 'prop_removed')
	);
}

/**
 * Type guard for ForecastGeneratedEvent.
 */
export function isForecastGeneratedEvent(event: StateEvent): event is ForecastGeneratedEvent {
	return event.kind === 'forecast_generated';
}

/**
 * Type guard for RelationshipEvent (any type).
 */
export function isRelationshipEvent(event: StateEvent): event is RelationshipEvent {
	return event.kind === 'relationship';
}

/**
 * Type guard for DirectionalRelationshipEvent.
 * Directional events have fromCharacter and towardCharacter.
 */
export function isDirectionalRelationshipEvent(
	event: StateEvent | RelationshipEvent,
): event is DirectionalRelationshipEvent {
	if (event.kind !== 'relationship') return false;
	const subkind = (event as RelationshipEvent).subkind;
	return subkind !== 'status_changed';
}

/**
 * Type guard for StatusChangedEvent.
 * Status events have explicit pair and subkind === 'status_changed'.
 */
export function isStatusChangedEvent(
	event: StateEvent | RelationshipEvent,
): event is StatusChangedEvent {
	return (
		event.kind === 'relationship' &&
		(event as StatusChangedEvent).subkind === 'status_changed'
	);
}

/**
 * A snapshot of projected state at a chapter boundary.
 * Used to avoid replaying all events when projecting state at a message.
 */
export interface StateProjectionSnapshot {
	/** Chapter index this snapshot is for */
	chapterIndex: number;
	/** Message ID at the end of the chapter */
	messageId: number;
	/** Swipe ID at the snapshot point */
	swipeId: number;
	/** Serializable projection state */
	projection: SerializableProjectedState;
}

/**
 * Projected relationship state from events.
 */
export interface ProjectedRelationship {
	pair: [string, string];
	status: RelationshipStatus;
	aToB: RelationshipAttitude;
	bToA: RelationshipAttitude;
}

/**
 * Serializable version of ProjectedState (uses object instead of Map).
 */
export interface SerializableProjectedState {
	time: NarrativeDateTime | null;
	location: LocationState | null;
	characters: Record<string, ProjectedCharacter>;
	relationships: Record<string, ProjectedRelationship>;
}

/**
 * Unified event store that holds both narrative events and state events.
 */
export interface UnifiedEventStore {
	/** Narrative events (Phase 1) */
	narrativeEvents: NarrativeEvent[];
	/** State events (Phase 2) - time, location, character changes */
	stateEvents: StateEvent[];
	/** Store version */
	version: number;
	/** Initial projection snapshot (first extraction with no prior events) */
	initialProjection?: SerializableProjectedState;
	/** Chapter snapshots for projection performance */
	chapterSnapshots?: StateProjectionSnapshot[];
	/** Cached projection invalidation marker - projections from this messageId onward need recalculation */
	projectionInvalidFrom?: number;
}

/**
 * Projected character state from events.
 */
export interface ProjectedCharacter {
	name: string;
	position: string;
	activity?: string;
	mood: string[];
	physicalState: string[];
	outfit: CharacterOutfit;
}

/**
 * Projected state at a specific message.
 * Computed by folding events onto a snapshot.
 */
export interface ProjectedState {
	time: NarrativeDateTime | null;
	location: LocationState | null;
	// Note: climate is derived from time + location + forecastCache, not stored
	characters: Map<string, ProjectedCharacter>;
	relationships: Map<string, ProjectedRelationship>;
}

/**
 * Per-message data in Phase 2 (minimal, events are in central store).
 */
export interface PerMessageEventData {
	/** Event IDs generated from this message */
	eventIds: string[];
	/** When extraction happened */
	extractedAt: string;
}

// ============================================
// Constants
// ============================================

export const NARRATIVE_STATE_VERSION = 4;

export const TENSION_LEVELS: readonly TensionLevel[] = [
	'relaxed',
	'aware',
	'guarded',
	'tense',
	'charged',
	'volatile',
	'explosive',
];

export const TENSION_TYPES: readonly TensionType[] = [
	'confrontation',
	'intimate',
	'vulnerable',
	'celebratory',
	'negotiation',
	'suspense',
	'conversation',
];

export const RELATIONSHIP_STATUSES: readonly RelationshipStatus[] = [
	'strangers',
	'acquaintances',
	'friendly',
	'close',
	'intimate',
	'strained',
	'hostile',
	'complicated',
];

export const MILESTONE_TYPES: readonly MilestoneType[] = [
	// Relationship firsts
	'first_meeting',
	'first_conflict',
	'first_alliance',
	// Emotional
	'confession',
	'emotional_intimacy',
	// Bonding (friendly gate)
	'first_laugh',
	'first_gift',
	'first_date',
	'first_i_love_you',
	'first_sleepover',
	'first_shared_meal',
	'first_shared_activity',
	'first_compliment',
	'first_tease',
	'first_flirt',
	'first_helped',
	'first_common_interest',
	'first_outing',
	// Physical intimacy (granular)
	'first_touch',
	'first_kiss',
	'first_embrace',
	'first_heated',
	// Sexual milestones (atomic)
	'first_foreplay',
	'first_oral',
	'first_manual',
	'first_penetrative',
	'first_climax',
	// Life commitment
	'promised_exclusivity',
	'marriage',
	'pregnancy',
	'had_child',
	// Trust & commitment (close gate)
	'promise_made',
	'promise_broken',
	'betrayal',
	'reconciliation',
	'sacrifice',
	'first_support',
	'first_comfort',
	'defended',
	'crisis_together',
	'first_vulnerability',
	'trusted_with_task',
	// Secrets
	'secret_shared',
	'secret_revealed',
	// Conflicts
	'major_argument',
	'major_reconciliation',
];

// ============================================
// Type Guards
// ============================================

/**
 * Check if a chapter is a DerivedChapter (v3 format with eventIds).
 */
export function isDerivedChapter(chapter: Chapter | DerivedChapter): chapter is DerivedChapter {
	return 'eventIds' in chapter && Array.isArray((chapter as DerivedChapter).eventIds);
}

/**
 * Check if a chapter is a legacy Chapter (v2 format with embedded events).
 */
export function isLegacyChapter(chapter: Chapter | DerivedChapter): chapter is Chapter {
	return 'events' in chapter && Array.isArray((chapter as Chapter).events);
}

/**
 * Check if a relationship is a DerivedRelationship (v3 format).
 */
export function isDerivedRelationship(
	relationship: Relationship | DerivedRelationship,
): relationship is DerivedRelationship {
	return 'milestoneEventIds' in relationship;
}

/**
 * Check if a relationship is a legacy Relationship (v2 format with embedded milestones).
 */
export function isLegacyRelationship(
	relationship: Relationship | DerivedRelationship | ProjectedRelationship,
): relationship is Relationship {
	return (
		'milestones' in relationship &&
		Array.isArray((relationship as Relationship).milestones)
	);
}

/**
 * Check if a relationship is a ProjectedRelationship (projected from events).
 * ProjectedRelationship has no milestones or milestoneEventIds - milestones are computed separately.
 */
export function isProjectedRelationship(
	relationship: Relationship | DerivedRelationship | ProjectedRelationship,
): relationship is ProjectedRelationship {
	return !('milestones' in relationship) && !('milestoneEventIds' in relationship);
}

/**
 * Type guard for UnifiedEventStore (v4+).
 */
export function isUnifiedEventStore(
	store: EventStore | UnifiedEventStore | undefined,
): store is UnifiedEventStore {
	return store !== undefined && 'stateEvents' in store;
}

/**
 * Type guard for legacy EventStore (v3).
 */
export function isLegacyEventStore(
	store: EventStore | UnifiedEventStore | undefined,
): store is EventStore {
	return store !== undefined && 'events' in store && !('stateEvents' in store);
}

/**
 * Mapping from event types to potential milestone types.
 * Used by the event store to compute firstFor designations.
 */
export const EVENT_TYPE_TO_MILESTONE: Partial<Record<EventType, MilestoneType>> = {
	// Bonding (friendly gate)
	laugh: 'first_laugh',
	gift: 'first_gift',
	date: 'first_date',
	i_love_you: 'first_i_love_you',
	sleepover: 'first_sleepover',
	shared_meal: 'first_shared_meal',
	shared_activity: 'first_shared_activity',
	compliment: 'first_compliment',
	tease: 'first_tease',
	flirt: 'first_flirt',
	helped: 'first_helped',
	common_interest: 'first_common_interest',
	outing: 'first_outing',
	// Physical intimacy
	intimate_touch: 'first_touch',
	intimate_kiss: 'first_kiss',
	intimate_embrace: 'first_embrace',
	intimate_heated: 'first_heated',
	// Sexual milestones (atomic)
	intimate_foreplay: 'first_foreplay',
	intimate_oral: 'first_oral',
	intimate_manual: 'first_manual',
	intimate_penetrative: 'first_penetrative',
	intimate_climax: 'first_climax',
	// Emotional (close gate mappings)
	emotionally_intimate: 'emotional_intimacy',
	confession: 'confession',
	secret_shared: 'secret_shared',
	secret_revealed: 'secret_revealed',
	supportive: 'first_support',
	comfort: 'first_comfort',
	forgiveness: 'reconciliation',
	defended: 'defended',
	crisis_together: 'crisis_together',
	shared_vulnerability: 'first_vulnerability',
	entrusted: 'trusted_with_task',
	// Commitment
	promise: 'promise_made',
	betrayal: 'betrayal',
	// Life events
	exclusivity: 'promised_exclusivity',
	marriage: 'marriage',
	pregnancy: 'pregnancy',
	childbirth: 'had_child',
	// Conflicts
	argument: 'first_conflict',
	combat: 'first_conflict',
};
