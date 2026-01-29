// ============================================
// Chat-Level Narrative State Management
// ============================================

import { EXTENSION_KEY } from '../constants';
import { debugLog, debugWarn } from '../utils/debug';
import type {
	NarrativeState,
	Chapter,
	Relationship,
	DerivedChapter,
	DerivedRelationship,
	EventStore,
	NarrativeEvent,
	AffectedPair,
	TimestampedEvent,
	MilestoneType,
} from '../types/state';
import {
	NARRATIVE_STATE_VERSION,
	EVENT_TYPE_TO_MILESTONE,
	isLegacyChapter,
	isLegacyRelationship,
	isUnifiedEventStore,
} from '../types/state';
import type { UnifiedEventStore, ProjectedState, ProjectedRelationship } from '../types/state';
import {
	createEventStore,
	createUnifiedEventStore,
	pairKey,
	convertToUnifiedStore,
	generateStateEventsFromDiff,
} from './eventStore';
import { getMessageState } from '../utils/messageState';
import { sortPair } from './relationships';

// Re-export the version constant
export { NARRATIVE_STATE_VERSION };

// ============================================
// Storage Keys
// ============================================

const NARRATIVE_KEY = 'narrative';

// ============================================
// Public API
// ============================================

/**
 * Get the narrative state from the chat.
 * Returns null if no narrative state exists.
 */
export function getNarrativeState(): NarrativeState | null {
	const context = SillyTavern.getContext();
	const chat = context.chat;

	if (!chat || chat.length === 0) {
		return null;
	}

	// Narrative state is stored in the first message
	const firstMessage = chat[0];
	const storage = firstMessage.extra?.[EXTENSION_KEY] as Record<string, unknown> | undefined;

	if (!storage || !storage[NARRATIVE_KEY]) {
		return null;
	}

	return storage[NARRATIVE_KEY] as NarrativeState;
}

/**
 * Set the narrative state for the chat.
 * Creates the storage structure if it doesn't exist.
 */
export function setNarrativeState(state: NarrativeState): void {
	const context = SillyTavern.getContext();
	const chat = context.chat;

	if (!chat || chat.length === 0) {
		debugWarn('Cannot set narrative state: no chat messages');
		return;
	}

	const firstMessage = chat[0];

	if (!firstMessage.extra) {
		firstMessage.extra = {};
	}

	if (!firstMessage.extra[EXTENSION_KEY]) {
		firstMessage.extra[EXTENSION_KEY] = {};
	}

	(firstMessage.extra[EXTENSION_KEY] as Record<string, unknown>)[NARRATIVE_KEY] = state;
}

/**
 * Initialize a new narrative state with default values.
 */
export function initializeNarrativeState(): NarrativeState {
	return {
		version: NARRATIVE_STATE_VERSION,
		eventStore: createUnifiedEventStore(),
		chapters: [],
		relationships: [],
		chapterSnapshots: [],
		forecastCache: [],
		locationMappings: [],
	};
}

/**
 * Get or initialize the narrative state.
 * If no state exists, creates and saves a new one.
 * Also handles migrations from older versions.
 */
export function getOrInitializeNarrativeState(): NarrativeState {
	let state = getNarrativeState();

	if (!state) {
		state = initializeNarrativeState();
		setNarrativeState(state);
	} else {
		// Run migrations if needed
		const migrated = migrateNarrativeState(state);
		if (migrated) {
			setNarrativeState(state);
		}
	}

	return state;
}

/**
 * Save the narrative state and persist the chat.
 */
export async function saveNarrativeState(state: NarrativeState): Promise<void> {
	setNarrativeState(state);

	const context = SillyTavern.getContext();
	await context.saveChat();
}

// ============================================
// Migration
// ============================================

/**
 * Migrate narrative state from older versions to current.
 * Returns true if any migration was performed.
 */
function migrateNarrativeState(state: NarrativeState): boolean {
	let migrated = false;

	// Version 1 -> 2: Add versions array to relationships with initial version from current state
	if (!state.version || state.version < 2) {
		for (const rel of state.relationships) {
			if (isLegacyRelationship(rel) && !rel.versions) {
				// Create initial version from current relationship state
				// Use messageId 0 so it appears from the start of the chat
				rel.versions = [
					{
						messageId: 0,
						status: rel.status,
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
						milestones: [...rel.milestones],
					},
				];
			}
		}

		state.version = 2;
		migrated = true;
	}

	// Version 2 -> 3: Event-sourced architecture
	if (state.version === 2) {
		migrateV2ToV3(state);
		migrated = true;
	}

	// Version 3 -> 4: Full state events (Phase 2)
	if (state.version === 3) {
		migrateV3ToV4(state);
		migrated = true;
	}

	return migrated;
}

/**
 * Generate a UUID for event IDs during migration.
 */
function generateMigrationUUID(): string {
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
		const r = (Math.random() * 16) | 0;
		const v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Convert a legacy TimestampedEvent to a NarrativeEvent.
 */
function convertToCanonicalEvent(
	oldEvent: TimestampedEvent,
	chapterIndex: number | null,
	swipeId: number = 0,
): NarrativeEvent {
	// Extract affected pairs from relationshipSignal
	const affectedPairs: AffectedPair[] = [];

	if (oldEvent.relationshipSignal) {
		const signal = oldEvent.relationshipSignal;
		const sortedPair = sortPair(signal.pair[0], signal.pair[1]);

		affectedPairs.push({
			pair: sortedPair,
			changes: signal.changes,
			// firstFor will be computed after all events are collected
		});
	}

	return {
		id: generateMigrationUUID(),
		messageId: oldEvent.messageId ?? 0,
		swipeId,
		timestamp: Date.now(),
		summary: oldEvent.summary,
		eventTypes: oldEvent.eventTypes ?? ['conversation'],
		tensionLevel: oldEvent.tensionLevel,
		tensionType: oldEvent.tensionType,
		witnesses: oldEvent.witnesses,
		location: oldEvent.location,
		narrativeTimestamp: oldEvent.timestamp,
		chapterIndex: chapterIndex ?? undefined,
		affectedPairs,
	};
}

/**
 * Migrate from version 2 to version 3 (event-sourced architecture).
 *
 * This migration:
 * 1. Creates a central event store
 * 2. Collects events from closed chapters
 * 3. Collects events from message states (current chapter)
 * 4. Computes firstFor designations for milestones
 * 5. Converts chapters to DerivedChapter with eventIds
 * 6. Converts relationships to DerivedRelationship
 */
function migrateV2ToV3(state: NarrativeState): void {
	debugLog('Starting v2→v3 migration (event-sourced architecture)');

	// 1. Initialize empty event store
	const eventStore: EventStore = createEventStore();

	// 2. Collect events from CLOSED chapters
	for (const chapter of state.chapters) {
		if (isLegacyChapter(chapter)) {
			for (const oldEvent of chapter.events) {
				const event = convertToCanonicalEvent(oldEvent, chapter.index);
				eventStore.events.push(event);
			}
		}
	}

	// 3. Collect events from message states (CURRENT chapter only)
	try {
		const context = SillyTavern.getContext();
		const seenEventKeys = new Set<string>();

		// Build set of already collected events to avoid duplicates
		for (const event of eventStore.events) {
			seenEventKeys.add(`${event.messageId}|${event.summary}`);
		}

		for (let msgId = 0; msgId < context.chat.length; msgId++) {
			const message = context.chat[msgId];
			const msgState = getMessageState(message);

			if (msgState?.state?.currentEvents) {
				const swipeId = message.swipe_id ?? 0;

				for (const oldEvent of msgState.state.currentEvents) {
					const key = `${oldEvent.messageId ?? msgId}|${oldEvent.summary}`;

					// Dedupe by messageId + summary
					if (!seenEventKeys.has(key)) {
						const event = convertToCanonicalEvent(
							oldEvent,
							null,
							swipeId,
						);
						// Ensure messageId is set
						if (event.messageId === 0 && msgId > 0) {
							event.messageId = msgId;
						}
						eventStore.events.push(event);
						seenEventKeys.add(key);
					}
				}
			}
		}
	} catch (e) {
		debugWarn('Could not collect events from message states during migration:', e);
	}

	// 4. Sort events by messageId
	eventStore.events.sort((a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp);

	// 5. Compute firstFor designations
	const seenMilestones = new Map<string, Set<MilestoneType>>();

	for (const event of eventStore.events) {
		for (const ap of event.affectedPairs) {
			const key = pairKey(ap.pair);

			if (!seenMilestones.has(key)) {
				seenMilestones.set(key, new Set());
			}
			const seen = seenMilestones.get(key)!;

			ap.firstFor = [];

			for (const eventType of event.eventTypes) {
				const milestoneType = EVENT_TYPE_TO_MILESTONE[eventType];
				if (milestoneType && !seen.has(milestoneType)) {
					ap.firstFor.push(milestoneType);
					seen.add(milestoneType);
				}
			}

			// Clean up empty firstFor
			if (ap.firstFor.length === 0) {
				delete ap.firstFor;
			}
		}
	}

	// 6. Copy milestone descriptions from Relationship.milestones
	for (const rel of state.relationships) {
		if (isLegacyRelationship(rel)) {
			const relPairKey = pairKey(rel.pair);

			for (const milestone of rel.milestones ?? []) {
				// Find the event that has this milestone for this pair
				const event = eventStore.events.find(e =>
					e.affectedPairs.some(
						ap =>
							pairKey(ap.pair) === relPairKey &&
							ap.firstFor?.includes(milestone.type),
					),
				);

				if (event) {
					const ap = event.affectedPairs.find(
						a => pairKey(a.pair) === relPairKey,
					);
					if (ap && milestone.description) {
						if (!ap.milestoneDescriptions) {
							ap.milestoneDescriptions = {};
						}
						ap.milestoneDescriptions[milestone.type] =
							milestone.description;
					}
				}
			}
		}
	}

	// 7. Convert chapters to DerivedChapter
	const derivedChapters: DerivedChapter[] = state.chapters.map(ch => {
		if (isLegacyChapter(ch)) {
			const chapterEvents = eventStore.events.filter(
				e => e.chapterIndex === ch.index,
			);
			const lastEvent = chapterEvents[chapterEvents.length - 1];

			return {
				index: ch.index,
				title: ch.title,
				summary: ch.summary,
				outcomes: ch.outcomes,
				eventIds: chapterEvents.map(e => e.id),
				boundaryMessageId: lastEvent?.messageId ?? 0,
				timeRange: ch.timeRange,
				primaryLocation: ch.primaryLocation,
			};
		}
		// Already a DerivedChapter
		return ch as DerivedChapter;
	});

	// 8. Convert relationships to DerivedRelationship
	const derivedRelationships: DerivedRelationship[] = state.relationships.map(rel => {
		if (isLegacyRelationship(rel)) {
			const relPairKey = pairKey(rel.pair);

			// Find milestone event IDs
			const milestoneEventIds = eventStore.events
				.filter(e =>
					e.affectedPairs.some(
						ap =>
							pairKey(ap.pair) === relPairKey &&
							ap.firstFor &&
							ap.firstFor.length > 0,
					),
				)
				.map(e => e.id);

			return {
				pair: rel.pair,
				status: rel.status,
				aToB: rel.aToB,
				bToA: rel.bToA,
				milestoneEventIds,
				history: rel.history ?? [],
			};
		}
		// Already a DerivedRelationship
		return rel as DerivedRelationship;
	});

	// 9. Create chapter snapshot if chapters exist
	let chapterSnapshots: NarrativeState['chapterSnapshots'] = [];
	if (derivedChapters.length > 0) {
		const lastChapter = derivedChapters[derivedChapters.length - 1];
		chapterSnapshots = [
			{
				chapterIndex: lastChapter.index,
				boundaryMessageId: lastChapter.boundaryMessageId,
				relationships: JSON.parse(JSON.stringify(derivedRelationships)),
			},
		];
	}

	// 10. Update state
	state.eventStore = eventStore;
	state.chapters = derivedChapters;
	state.relationships = derivedRelationships;
	state.chapterSnapshots = chapterSnapshots;
	state.version = 3;

	debugLog(
		`v2→v3 migration complete: ${eventStore.events.length} events, ` +
			`${derivedChapters.length} chapters, ${derivedRelationships.length} relationships`,
	);
}

/**
 * Migrate from version 3 to version 4 (full state events - Phase 2).
 *
 * This migration:
 * 1. Converts EventStore to UnifiedEventStore
 * 2. Diffs consecutive message states to generate state events
 * 3. Adds time, location, and character change events
 */
function migrateV3ToV4(state: NarrativeState): void {
	debugLog('Starting v3→v4 migration (full state events)');

	// 1. Convert legacy EventStore to UnifiedEventStore
	const legacyStore = state.eventStore as EventStore | undefined;
	const unifiedStore: UnifiedEventStore = legacyStore
		? convertToUnifiedStore(legacyStore)
		: { narrativeEvents: [], stateEvents: [], version: 2 };

	// 2. Generate state events by diffing consecutive message states
	// First message with state becomes the initial projection,
	// subsequent messages generate state events from diffs
	try {
		const context = SillyTavern.getContext();
		let previousState: ProjectedState | null = null;
		let initialProjectionSet = false;

		for (let msgId = 0; msgId < context.chat.length; msgId++) {
			const message = context.chat[msgId];
			const msgState = getMessageState(message);

			if (!msgState?.state) continue;

			const swipeId = message.swipe_id ?? 0;
			const currentState = msgState.state;

			// Build projected state from tracked state
			// For relationships, use the NarrativeState relationships which contain
			// the full relationship history from v3
			const relationshipsMap = new Map<string, ProjectedRelationship>();
			for (const rel of state.relationships) {
				const key = `${rel.pair[0]}|${rel.pair[1]}`;
				relationshipsMap.set(key, {
					pair: rel.pair,
					status: rel.status,
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
				});
			}

			const projectedState: ProjectedState = {
				time: currentState.time ?? null,
				location: currentState.location ?? null,
				characters: new Map(
					(currentState.characters ?? []).map(char => [
						char.name,
						{
							name: char.name,
							position: char.position,
							activity: char.activity,
							mood: char.mood ?? [],
							physicalState: char.physicalState ?? [],
							outfit: char.outfit ?? {
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
						},
					]),
				),
				relationships: relationshipsMap,
			};

			// First message with state becomes the initial projection
			if (!initialProjectionSet) {
				// Convert Map to Record for serialization
				unifiedStore.initialProjection = {
					time: projectedState.time,
					location: projectedState.location,
					characters: Object.fromEntries(projectedState.characters),
					relationships: Object.fromEntries(
						projectedState.relationships,
					),
				};
				previousState = projectedState;
				initialProjectionSet = true;
				debugLog(
					`v3→v4 migration: Set initial projection from message ${msgId}`,
				);
				continue;
			}

			// Build current state for diffing
			const currForDiff = {
				time: currentState.time ?? null,
				location: currentState.location ?? null,
				characters: currentState.characters?.map(char => ({
					name: char.name,
					position: char.position,
					activity: char.activity,
					mood: char.mood,
					physicalState: char.physicalState,
					outfit: char.outfit,
				})),
			};

			// Generate events from diff
			const stateEvents = generateStateEventsFromDiff(
				msgId,
				swipeId,
				previousState,
				currForDiff,
			);

			// Add events to store
			for (const event of stateEvents) {
				unifiedStore.stateEvents.push(event);
			}

			// Update previous state for next iteration
			previousState = projectedState;
		}
	} catch (e) {
		debugWarn('Could not generate state events during migration:', e);
	}

	// 3. Sort state events by messageId
	unifiedStore.stateEvents.sort(
		(a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp,
	);

	// 4. Update state
	state.eventStore = unifiedStore;
	state.version = 4;

	debugLog(
		`v3→v4 migration complete: ` +
			`${unifiedStore.narrativeEvents.length} narrative events, ` +
			`${unifiedStore.stateEvents.length} state events` +
			(unifiedStore.initialProjection ? ', initial projection set' : ''),
	);
}

interface LegacyScene {
	topic: string;
	tone: string;
	tension: {
		level: string;
		direction: string;
		type: string;
	};
	recentEvents?: string[];
}

interface LegacyTrackedState {
	time?: unknown;
	location?: unknown;
	climate?: unknown;
	scene?: LegacyScene;
	characters?: unknown[];
}

interface LegacyStoredStateData {
	state: LegacyTrackedState;
	extractedAt: string;
}

/**
 * Migrate from legacy state format (recentEvents in Scene) to new format.
 * This should be called when opening a chat that may have old state.
 */
export function migrateFromLegacyState(): NarrativeState {
	const context = SillyTavern.getContext();
	const chat = context.chat;

	// Start with empty narrative state
	const state = initializeNarrativeState();

	if (!chat || chat.length === 0) {
		return state;
	}

	// Collect all legacy recentEvents from messages
	const collectedEvents: string[] = [];

	for (const message of chat) {
		const storage = message.extra?.[EXTENSION_KEY] as
			| Record<number, LegacyStoredStateData>
			| undefined;
		if (!storage) continue;

		// Check all swipes
		for (const swipeData of Object.values(storage)) {
			if (
				typeof swipeData === 'object' &&
				swipeData?.state?.scene?.recentEvents
			) {
				const events = swipeData.state.scene.recentEvents;
				if (Array.isArray(events)) {
					for (const event of events) {
						if (
							typeof event === 'string' &&
							!collectedEvents.includes(event)
						) {
							collectedEvents.push(event);
						}
					}
				}
			}
		}
	}

	// Note: We don't convert legacy string events to TimestampedEvents here
	// because we don't have the timestamp/tension/location info.
	// The legacy events are simply not migrated - new events will be extracted going forward.

	return state;
}

// ============================================
// Update Helpers
// ============================================

/**
 * Get the event store from narrative state, creating one if needed.
 * Returns EventStore for v3 or UnifiedEventStore for v4+.
 */
export function getEventStore(state: NarrativeState): EventStore | UnifiedEventStore {
	if (!state.eventStore) {
		// Create the appropriate event store based on version
		state.eventStore =
			state.version >= 4 ? createUnifiedEventStore() : createEventStore();
	}
	return state.eventStore;
}

/**
 * Get the event store as a legacy EventStore (v3).
 * Throws if the store is a UnifiedEventStore.
 *
 * @deprecated This function should ONLY be used in migration code (v3→v4).
 * All other code should use `getEventStore()` which returns `AnyEventStore`.
 * The functions in eventStore.ts now accept both EventStore and UnifiedEventStore.
 */
export function getLegacyEventStore(state: NarrativeState): EventStore {
	const store = getEventStore(state);
	if (isUnifiedEventStore(store)) {
		throw new Error('Expected legacy EventStore but got UnifiedEventStore');
	}
	return store;
}

/**
 * Add a chapter to the narrative state.
 * Accepts both legacy Chapter and DerivedChapter.
 */
export function addChapter(state: NarrativeState, chapter: Chapter | DerivedChapter): void {
	state.chapters.push(chapter);
}

/**
 * Update or add a relationship in the narrative state.
 * Accepts both legacy Relationship and DerivedRelationship.
 */
export function updateRelationship(
	state: NarrativeState,
	relationship: Relationship | DerivedRelationship,
): void {
	const key = relationship.pair.join('|');
	const existingIndex = state.relationships.findIndex(r => r.pair.join('|') === key);

	if (existingIndex >= 0) {
		state.relationships[existingIndex] = relationship;
	} else {
		state.relationships.push(relationship);
	}
}

/**
 * Get a relationship by character pair.
 * Returns either Relationship or DerivedRelationship.
 */
export function getRelationship(
	state: NarrativeState,
	char1: string,
	char2: string,
): Relationship | DerivedRelationship | null {
	const pair = [char1, char2].sort() as [string, string];
	const key = pair.join('|');

	return state.relationships.find(r => r.pair.join('|') === key) ?? null;
}
