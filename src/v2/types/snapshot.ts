/**
 * V2 Snapshot and Projection Types
 *
 * Snapshots are point-in-time state captures used for efficient projection.
 * Projections are the computed current state from snapshots + events.
 *
 * Time handling:
 * - Snapshots store time as ISO string (for JSON serialization)
 * - Projections use moment.Moment (for easy manipulation)
 */

import type moment from 'moment';
import type {
	MessageAndSwipe,
	LocationState,
	CharacterOutfit,
	TensionLevel,
	TensionType,
	TensionDirection,
	RelationshipStatus,
	ClimateForecast,
} from './common';
import { deserializeMoment, serializeMoment } from './common';
import type { Subject } from './subject';
import type { LocationForecast } from '../../weather/types';

// ============================================
// Character Profile
// ============================================

/**
 * Condensed character profile for efficient context in prompts.
 * Extracted once when a character first appears.
 */
export interface CharacterProfile {
	sex: 'M' | 'F' | 'O';
	species: string;
	age: number;
	appearance: string[]; // 8-10 tags
	personality: string[]; // 8-10 tags
}

// ============================================
// Character State
// ============================================

/**
 * Character state in a snapshot or projection.
 */
export interface CharacterState {
	name: string;
	profile?: CharacterProfile;
	position: string;
	activity: string | null;
	mood: string[];
	physicalState: string[];
	outfit: CharacterOutfit;
}

/**
 * Create an empty character state.
 */
export function createEmptyCharacterState(name: string): CharacterState {
	return {
		name,
		position: '',
		activity: null,
		mood: [],
		physicalState: [],
		outfit: {
			head: null,
			neck: null,
			jacket: null,
			back: null,
			torso: null,
			legs: null,
			footwear: null,
			socks: null,
			underwear: null,
		},
	};
}

// ============================================
// Relationship State
// ============================================

/**
 * One character's attitude toward another.
 */
export interface RelationshipAttitude {
	feelings: string[];
	secrets: string[];
	wants: string[];
}

/**
 * Create an empty attitude.
 */
export function createEmptyAttitude(): RelationshipAttitude {
	return {
		feelings: [],
		secrets: [],
		wants: [],
	};
}

/**
 * Relationship state in a snapshot or projection.
 */
export interface RelationshipState {
	/** Sorted pair of character names */
	pair: [string, string];
	/** Current relationship status */
	status: RelationshipStatus;
	/** How A feels about B */
	aToB: RelationshipAttitude;
	/** How B feels about A */
	bToA: RelationshipAttitude;
}

/**
 * Create an empty relationship state for a pair.
 */
export function createEmptyRelationshipState(pair: [string, string]): RelationshipState {
	return {
		pair,
		status: 'strangers',
		aToB: createEmptyAttitude(),
		bToA: createEmptyAttitude(),
	};
}

// ============================================
// Scene State
// ============================================

/**
 * Scene state (topic, tone, tension).
 */
export interface SceneState {
	topic: string;
	tone: string;
	tension: {
		level: TensionLevel;
		type: TensionType;
		direction: TensionDirection;
	};
}

/**
 * Create an empty scene state.
 */
export function createEmptySceneState(): SceneState {
	return {
		topic: '',
		tone: '',
		tension: {
			level: 'relaxed',
			type: 'conversation',
			direction: 'stable',
		},
	};
}

// ============================================
// Snapshot (Serializable)
// ============================================

/**
 * A snapshot is a complete state capture at a point in time.
 * Used as a starting point for projection.
 *
 * Snapshots are created:
 * - Initially (first extraction, no events)
 * - At chapter boundaries (for efficient projection)
 *
 * Time is stored as ISO string for JSON serialization.
 */
export interface Snapshot {
	/** Snapshot type */
	type: 'initial' | 'chapter';
	/** For chapter snapshots, the chapter index */
	chapterIndex?: number;
	/** Message/swipe this snapshot is for */
	source: MessageAndSwipe;
	/** Real-world timestamp when snapshot was created */
	timestamp: number;
	/** Swipe ID at snapshot time (for invalidation) */
	swipeId: number;

	// State
	/** Time as ISO string (null if not set) */
	time: string | null;
	location: LocationState | null;
	/** Weather forecasts keyed by area name */
	forecasts: Record<string, LocationForecast>;
	/** Computed climate (derived from forecasts + time + location, not stored) */
	climate: ClimateForecast | null;
	scene: SceneState | null;
	/** Present characters keyed by name */
	characters: Record<string, CharacterState>;
	/** Relationships keyed by sorted pair key (e.g., "Alice|Bob") */
	relationships: Record<string, RelationshipState>;
	/** Current chapter index */
	currentChapter: number;
	/** Narrative events up to this snapshot (serialized for JSON storage) */
	narrativeEvents: SerializedNarrativeEvent[];
}

/**
 * Create an empty initial snapshot.
 */
export function createEmptySnapshot(source: MessageAndSwipe): Snapshot {
	return {
		type: 'initial',
		source,
		timestamp: Date.now(),
		swipeId: source.swipeId,
		time: null,
		location: null,
		forecasts: {},
		climate: null,
		scene: null,
		characters: {},
		relationships: {},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

// ============================================
// Projection (In-Memory, uses moment)
// ============================================

/**
 * A projection is the computed state at a specific message.
 * Created by applying events to a snapshot.
 *
 * Projections are NOT stored - they are computed on demand.
 * Time is a moment.Moment for easy manipulation.
 */
export interface Projection {
	/** Message/swipe this projection is for */
	source: MessageAndSwipe;

	// State
	/** Time as moment (null if not set) */
	time: moment.Moment | null;
	location: LocationState | null;
	/** Weather forecasts keyed by area name */
	forecasts: Record<string, LocationForecast>;
	/** Computed climate (derived from forecasts + time + location) */
	climate: ClimateForecast | null;
	scene: SceneState | null;
	characters: Record<string, CharacterState>;
	relationships: Record<string, RelationshipState>;
	currentChapter: number;

	/** Characters currently present (subset of characters keys) */
	charactersPresent: string[];

	/** Narrative events up to this point (computed from narrative_description + relationship_subject events) */
	narrativeEvents: NarrativeEvent[];
}

/**
 * Create a projection from a snapshot.
 * Deep clones the snapshot to avoid mutation.
 * Deserializes time from ISO string to moment.
 */
export function createProjectionFromSnapshot(
	snapshot: Snapshot,
	source: MessageAndSwipe,
): Projection {
	return {
		source,
		time: snapshot.time ? deserializeMoment(snapshot.time) : null,
		location: snapshot.location
			? { ...snapshot.location, props: [...snapshot.location.props] }
			: null,
		forecasts: snapshot.forecasts
			? Object.fromEntries(
					Object.entries(snapshot.forecasts).map(
						([areaName, forecast]) => [
							areaName,
							{
								...forecast,
								days: forecast.days.map(d => ({
									...d,
									hourly: [...d.hourly],
								})),
							},
						],
					),
				)
			: {},
		climate: snapshot.climate ? { ...snapshot.climate } : null,
		scene: snapshot.scene
			? {
					...snapshot.scene,
					tension: { ...snapshot.scene.tension },
				}
			: null,
		characters: Object.fromEntries(
			Object.entries(snapshot.characters).map(([name, char]) => [
				name,
				{
					...char,
					profile: char.profile
						? {
								...char.profile,
								appearance: [
									...char.profile.appearance,
								],
								personality: [
									...char.profile.personality,
								],
							}
						: undefined,
					mood: [...char.mood],
					physicalState: [...char.physicalState],
					outfit: { ...char.outfit },
				},
			]),
		),
		relationships: Object.fromEntries(
			Object.entries(snapshot.relationships).map(([key, rel]) => [
				key,
				{
					...rel,
					aToB: {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					},
					bToA: {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					},
				},
			]),
		),
		currentChapter: snapshot.currentChapter,
		charactersPresent: Object.keys(snapshot.characters),
		// Deserialize narrative events from snapshot (convert ISO time to moment)
		narrativeEvents: (snapshot.narrativeEvents || []).map(e => ({
			...e,
			source: { ...e.source },
			witnesses: [...e.witnesses],
			tension: { ...e.tension },
			subjects: e.subjects.map(s => ({
				...s,
				pair: [...s.pair] as [string, string],
			})),
			narrativeTime: e.narrativeTime ? deserializeMoment(e.narrativeTime) : null,
		})),
	};
}

/**
 * Create a snapshot from a projection (for chapter boundaries).
 * Serializes time from moment to ISO string.
 */
export function createSnapshotFromProjection(
	projection: Projection,
	chapterIndex: number,
): Snapshot {
	return {
		type: 'chapter',
		chapterIndex,
		source: projection.source,
		timestamp: Date.now(),
		swipeId: projection.source.swipeId,
		time: projection.time ? serializeMoment(projection.time) : null,
		location: projection.location
			? { ...projection.location, props: [...projection.location.props] }
			: null,
		forecasts: Object.fromEntries(
			Object.entries(projection.forecasts).map(([areaName, forecast]) => [
				areaName,
				{
					...forecast,
					days: forecast.days.map(d => ({
						...d,
						hourly: [...d.hourly],
					})),
				},
			]),
		),
		climate: projection.climate ? { ...projection.climate } : null,
		scene: projection.scene
			? {
					...projection.scene,
					tension: { ...projection.scene.tension },
				}
			: null,
		characters: Object.fromEntries(
			Object.entries(projection.characters).map(([name, char]) => [
				name,
				{
					...char,
					profile: char.profile
						? {
								...char.profile,
								appearance: [
									...char.profile.appearance,
								],
								personality: [
									...char.profile.personality,
								],
							}
						: undefined,
					mood: [...char.mood],
					physicalState: [...char.physicalState],
					outfit: { ...char.outfit },
				},
			]),
		),
		relationships: Object.fromEntries(
			Object.entries(projection.relationships).map(([key, rel]) => [
				key,
				{
					...rel,
					aToB: {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					},
					bToA: {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					},
				},
			]),
		),
		currentChapter: projection.currentChapter,
		// Serialize narrative events (convert moment time to ISO string)
		narrativeEvents: projection.narrativeEvents.map(e => ({
			...e,
			source: { ...e.source },
			witnesses: [...e.witnesses],
			tension: { ...e.tension },
			subjects: e.subjects.map(s => ({
				...s,
				pair: [...s.pair] as [string, string],
			})),
			narrativeTime: e.narrativeTime ? serializeMoment(e.narrativeTime) : null,
		})),
	};
}

// ============================================
// Narrative Events (Projected)
// ============================================

/**
 * Serialized narrative event for JSON storage in snapshots.
 * Time is stored as ISO string instead of moment.
 */
export interface SerializedNarrativeEvent {
	/** Source message/swipe */
	source: MessageAndSwipe;
	/** Description of what happened */
	description: string;
	/** Characters who witnessed/participated */
	witnesses: string[];
	/** Location where it occurred */
	location: string;
	/** Tension at the moment */
	tension: {
		level: TensionLevel;
		type: TensionType;
	};
	/** Subjects detected in this event (for relationship tracking) */
	subjects: NarrativeEventSubject[];
	/** Chapter this event belongs to */
	chapterIndex: number;
	/** Narrative timestamp as ISO string (null if not set) */
	narrativeTime: string | null;
}

/**
 * A narrative event is a projected view of what happened at a message.
 * Computed from narrative_description, tension, and relationship subject events.
 */
export interface NarrativeEvent {
	/** Source message/swipe */
	source: MessageAndSwipe;
	/** Description of what happened */
	description: string;
	/** Characters who witnessed/participated */
	witnesses: string[];
	/** Location where it occurred */
	location: string;
	/** Tension at the moment */
	tension: {
		level: TensionLevel;
		type: TensionType;
	};
	/** Subjects detected in this event (for relationship tracking) */
	subjects: NarrativeEventSubject[];
	/** Chapter this event belongs to */
	chapterIndex: number;
	/** Narrative timestamp when this occurred (moment for easy formatting) */
	narrativeTime: moment.Moment | null;
}

/**
 * A subject occurrence within a narrative event.
 */
export interface NarrativeEventSubject {
	/** Character pair */
	pair: [string, string];
	/** The subject */
	subject: Subject;
	/** Is this the first occurrence of this subject for this pair? */
	isMilestone: boolean;
	/** Milestone description (if this is a milestone and description was generated) */
	milestoneDescription?: string;
}

// ============================================
// Chapter (Projected)
// ============================================

/**
 * A chapter is a projected view of a narrative segment.
 * Computed from chapter events and narrative events.
 */
export interface Chapter {
	/** Chapter index (0-based) */
	index: number;
	/** Chapter title */
	title: string;
	/** Chapter summary */
	summary: string;
	/** Why the chapter ended */
	endReason: 'location_change' | 'time_jump' | 'both' | 'manual' | null;
	/** Message where chapter ended (null if current chapter) */
	endedAtMessage: MessageAndSwipe | null;
	/** Number of narrative events in this chapter */
	eventCount: number;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get the key for a relationship pair.
 */
export function getRelationshipKey(pair: [string, string]): string {
	return `${pair[0]}|${pair[1]}`;
}

/**
 * Parse a relationship key back to a pair.
 */
export function parseRelationshipKey(key: string): [string, string] {
	const [a, b] = key.split('|');
	return [a, b];
}

/**
 * Sort a character pair alphabetically.
 */
export function sortPair(a: string, b: string): [string, string] {
	return a < b ? [a, b] : [b, a];
}

/**
 * Deep clone a snapshot.
 */
export function cloneSnapshot(snapshot: Snapshot): Snapshot {
	return {
		...snapshot,
		source: { ...snapshot.source },
		// time is just a string, no cloning needed
		location: snapshot.location
			? { ...snapshot.location, props: [...snapshot.location.props] }
			: null,
		forecasts: snapshot.forecasts
			? Object.fromEntries(
					Object.entries(snapshot.forecasts).map(
						([areaName, forecast]) => [
							areaName,
							{
								...forecast,
								days: forecast.days.map(d => ({
									...d,
									hourly: [...d.hourly],
								})),
							},
						],
					),
				)
			: {},
		climate: snapshot.climate ? { ...snapshot.climate } : null,
		scene: snapshot.scene
			? {
					...snapshot.scene,
					tension: { ...snapshot.scene.tension },
				}
			: null,
		characters: Object.fromEntries(
			Object.entries(snapshot.characters).map(([name, char]) => [
				name,
				{
					...char,
					profile: char.profile
						? {
								...char.profile,
								appearance: [
									...char.profile.appearance,
								],
								personality: [
									...char.profile.personality,
								],
							}
						: undefined,
					mood: [...char.mood],
					physicalState: [...char.physicalState],
					outfit: { ...char.outfit },
				},
			]),
		),
		relationships: Object.fromEntries(
			Object.entries(snapshot.relationships).map(([key, rel]) => [
				key,
				{
					...rel,
					aToB: {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					},
					bToA: {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					},
				},
			]),
		),
		narrativeEvents: (snapshot.narrativeEvents || []).map(e => ({
			...e,
			source: { ...e.source },
			witnesses: [...e.witnesses],
			tension: { ...e.tension },
			subjects: e.subjects.map(s => ({
				...s,
				pair: [...s.pair] as [string, string],
			})),
		})),
	};
}

/**
 * Deep clone a projection.
 */
export function cloneProjection(projection: Projection): Projection {
	return {
		...projection,
		source: { ...projection.source },
		time: projection.time ? projection.time.clone() : null,
		location: projection.location
			? { ...projection.location, props: [...projection.location.props] }
			: null,
		forecasts: Object.fromEntries(
			Object.entries(projection.forecasts).map(([areaName, forecast]) => [
				areaName,
				{
					...forecast,
					days: forecast.days.map(d => ({
						...d,
						hourly: [...d.hourly],
					})),
				},
			]),
		),
		climate: projection.climate ? { ...projection.climate } : null,
		scene: projection.scene
			? {
					...projection.scene,
					tension: { ...projection.scene.tension },
				}
			: null,
		characters: Object.fromEntries(
			Object.entries(projection.characters).map(([name, char]) => [
				name,
				{
					...char,
					profile: char.profile
						? {
								...char.profile,
								appearance: [
									...char.profile.appearance,
								],
								personality: [
									...char.profile.personality,
								],
							}
						: undefined,
					mood: [...char.mood],
					physicalState: [...char.physicalState],
					outfit: { ...char.outfit },
				},
			]),
		),
		relationships: Object.fromEntries(
			Object.entries(projection.relationships).map(([key, rel]) => [
				key,
				{
					...rel,
					aToB: {
						feelings: [...rel.aToB.feelings],
						secrets: [...rel.aToB.secrets],
						wants: [...rel.aToB.wants],
					},
					bToA: {
						feelings: [...rel.bToA.feelings],
						secrets: [...rel.bToA.secrets],
						wants: [...rel.bToA.wants],
					},
				},
			]),
		),
		charactersPresent: [...projection.charactersPresent],
		narrativeEvents: projection.narrativeEvents.map(e => ({
			...e,
			source: { ...e.source },
			witnesses: [...e.witnesses],
			tension: { ...e.tension },
			subjects: e.subjects.map(s => ({
				...s,
				pair: [...s.pair] as [string, string],
			})),
			narrativeTime: e.narrativeTime ? e.narrativeTime.clone() : null,
		})),
	};
}
