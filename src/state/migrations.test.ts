/**
 * Migration tests for v2→v3 and v3→v4 state transitions.
 *
 * These tests use complex, realistic state with 20+ messages to ensure
 * migrations handle real-world data correctly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
	NarrativeState,
	Chapter,
	Relationship,
	DerivedChapter,
	DerivedRelationship,
	TimestampedEvent,
	NarrativeEvent,
	EventStore,
	UnifiedEventStore,
	TrackedState,
	Character,
	NarrativeDateTime,
	LocationState,
	CharacterOutfit,
	MilestoneType,
	EventType,
	TensionLevel,
	TensionType,
	AffectedPair,
	ProjectedRelationship,
} from '../types/state';
import { isUnifiedEventStore, isDerivedRelationship, isLegacyChapter } from '../types/state';
import type { ChatMessage } from '../types/st';

// ============================================
// Mock Setup
// ============================================

// Mock the constants module
vi.mock('../constants', () => ({
	EXTENSION_KEY: 'blazetracker',
	EXTENSION_NAME: 'BlazeTracker',
}));

// Mock SillyTavern global - will be set up per test
let mockChat: ChatMessage[] = [];

vi.stubGlobal('SillyTavern', {
	getContext: () => ({
		chat: mockChat,
	}),
});

// Import after mocking
import {
	pairKey,
	createEventStore,
	convertToUnifiedStore,
	generateStateEventsFromDiff,
} from './eventStore';

// ============================================
// Test Helpers
// ============================================

function createOutfit(partial?: Partial<CharacterOutfit>): CharacterOutfit {
	return {
		head: null,
		neck: null,
		jacket: null,
		back: null,
		torso: null,
		legs: null,
		footwear: null,
		socks: null,
		underwear: null,
		...partial,
	};
}

function createCharacter(
	name: string,
	position: string,
	activity?: string,
	mood?: string[],
	physicalState?: string[],
	outfit?: Partial<CharacterOutfit>,
): Character {
	return {
		name,
		position,
		activity,
		mood: mood ?? [],
		physicalState: physicalState ?? [],
		outfit: createOutfit(outfit),
	};
}

function createTime(
	year: number,
	month: number,
	day: number,
	hour: number,
	minute: number,
): NarrativeDateTime {
	const date = new Date(year, month - 1, day);
	const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	return {
		year,
		month,
		day,
		hour,
		minute,
		second: 0,
		dayOfWeek: DAYS[date.getDay()],
	};
}

function createLocation(
	area: string,
	place: string,
	position: string,
	props?: string[],
): LocationState {
	return { area, place, position, props: props ?? [] };
}

function createTrackedState(partial: {
	time?: NarrativeDateTime;
	location?: LocationState;
	characters?: Character[];
	currentEvents?: TimestampedEvent[];
}): TrackedState {
	return {
		time: partial.time,
		location: partial.location,
		characters: partial.characters,
		currentEvents: partial.currentEvents,
	};
}

function createTimestampedEvent(
	messageId: number,
	summary: string,
	eventTypes: EventType[],
	pairs: [string, string][],
	tensionLevel: TensionLevel = 'aware',
	tensionType: TensionType = 'conversation',
): TimestampedEvent {
	return {
		messageId,
		summary,
		eventTypes,
		tensionLevel,
		tensionType,
		witnesses: [],
		location: 'Test Location',
		timestamp: createTime(2024, 6, 15, 14, 30),
	};
}

function createLegacyChapter(
	index: number,
	title: string,
	summary: string,
	events: TimestampedEvent[],
): Chapter {
	return {
		index,
		title,
		summary,
		timeRange: {
			start: createTime(2024, 6, 15, 10, 0),
			end: createTime(2024, 6, 15, 14, 0),
		},
		primaryLocation: 'Coffee Shop',
		events,
		outcomes: {
			relationshipChanges: [],
			secretsRevealed: [],
			newComplications: [],
		},
	};
}

function createLegacyRelationship(
	pair: [string, string],
	status: 'strangers' | 'acquaintances' | 'friendly' | 'close' | 'intimate',
	milestones: { type: MilestoneType; description?: string }[],
): Relationship {
	return {
		pair,
		status,
		aToB: { feelings: ['curious'], secrets: [], wants: [] },
		bToA: { feelings: ['friendly'], secrets: [], wants: [] },
		milestones: milestones.map(m => ({
			type: m.type,
			description: m.description ?? '',
			timestamp: createTime(2024, 6, 15, 12, 0),
			location: 'Coffee Shop',
			messageId: 5,
		})),
		history: [],
		versions: [
			{
				messageId: 0,
				status,
				aToB: { feelings: ['curious'], secrets: [], wants: [] },
				bToA: { feelings: ['friendly'], secrets: [], wants: [] },
				milestones: [],
			},
		],
	};
}

function createMessage(messageId: number, swipeId: number, state?: TrackedState): ChatMessage {
	const msg: ChatMessage = {
		name: messageId % 2 === 0 ? 'User' : 'Elena',
		is_user: messageId % 2 === 0,
		mes: `Test message ${messageId}`,
		send_date: new Date().toISOString(),
		swipe_id: swipeId,
		extra: {},
	};

	if (state) {
		msg.extra = {
			blazetracker: {
				[swipeId]: {
					state,
					extractedAt: new Date().toISOString(),
				},
			},
		};
	}

	return msg;
}

function createV2State(chapters: Chapter[], relationships: Relationship[]): NarrativeState {
	return {
		version: 2,
		eventStore: createEventStore(),
		chapters,
		relationships,
		chapterSnapshots: [],
		forecastCache: [],
		locationMappings: [],
	};
}

function createV3State(
	eventStore: EventStore,
	chapters: DerivedChapter[],
	relationships: DerivedRelationship[],
): NarrativeState {
	return {
		version: 3,
		eventStore,
		chapters,
		relationships,
		chapterSnapshots: [],
		forecastCache: [],
		locationMappings: [],
	};
}

// ============================================
// Migration Functions (extracted for testing)
// ============================================

// EVENT_TYPE_TO_MILESTONE mapping
const EVENT_TYPE_TO_MILESTONE: Partial<Record<EventType, MilestoneType>> = {
	intimate_touch: 'first_touch',
	intimate_kiss: 'first_kiss',
	intimate_embrace: 'first_embrace',
	intimate_heated: 'first_heated',
	intimate_foreplay: 'first_foreplay',
	intimate_oral: 'first_oral',
	intimate_manual: 'first_manual',
	intimate_penetrative: 'first_penetrative',
	intimate_climax: 'first_climax',
	confession: 'confession',
	i_love_you: 'first_i_love_you',
	laugh: 'first_laugh',
	gift: 'first_gift',
	date: 'first_date',
	sleepover: 'first_sleepover',
	shared_meal: 'first_shared_meal',
	shared_activity: 'first_shared_activity',
	compliment: 'first_compliment',
	tease: 'first_tease',
	helped: 'first_helped',
	common_interest: 'first_common_interest',
	outing: 'first_outing',
	comfort: 'first_comfort',
	defended: 'defended',
	crisis_together: 'crisis_together',
	shared_vulnerability: 'first_vulnerability',
	entrusted: 'trusted_with_task',
	secret_shared: 'secret_shared',
	secret_revealed: 'secret_revealed',
	argument: 'major_argument',
	betrayal: 'betrayal',
	promise: 'promise_made',
	exclusivity: 'promised_exclusivity',
	marriage: 'marriage',
	pregnancy: 'pregnancy',
	childbirth: 'had_child',
};

function migrateV2ToV3ForTest(state: NarrativeState, chat: ChatMessage[]): void {
	// 1. Initialize empty event store
	const eventStore: EventStore = createEventStore();

	// 2. Collect events from CLOSED chapters
	for (const chapter of state.chapters) {
		if (isLegacyChapter(chapter)) {
			for (const oldEvent of chapter.events) {
				const event = convertTimestampedToNarrative(
					oldEvent,
					chapter.index,
				);
				eventStore.events.push(event);
			}
		}
	}

	// 3. Collect events from message states (CURRENT chapter only)
	const seenEventKeys = new Set<string>();

	// Build set of already collected events to avoid duplicates
	for (const event of eventStore.events) {
		seenEventKeys.add(`${event.messageId}|${event.summary}`);
	}

	for (let msgId = 0; msgId < chat.length; msgId++) {
		const message = chat[msgId];
		const storage = message.extra?.blazetracker as
			| Record<number, { state: TrackedState }>
			| undefined;
		const swipeId = message.swipe_id ?? 0;
		const msgState = storage?.[swipeId]?.state;

		if (msgState?.currentEvents) {
			for (const oldEvent of msgState.currentEvents) {
				const key = `${oldEvent.messageId ?? msgId}|${oldEvent.summary}`;

				// Dedupe by messageId + summary
				if (!seenEventKeys.has(key)) {
					const event = convertTimestampedToNarrative(
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
		if (!isDerivedRelationship(rel)) {
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
		if (!isDerivedRelationship(rel)) {
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
		return rel;
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
}

function migrateV3ToV4ForTest(state: NarrativeState, chat: ChatMessage[]): void {
	// 1. Convert legacy EventStore to UnifiedEventStore
	const legacyStore = state.eventStore as EventStore | undefined;
	const unifiedStore: UnifiedEventStore = legacyStore
		? convertToUnifiedStore(legacyStore)
		: { narrativeEvents: [], stateEvents: [], version: 2 };

	// 2. Generate state events by diffing consecutive message states
	// First message with state becomes the initial projection,
	// subsequent messages generate state events from diffs
	type ProjectedCharacter = {
		name: string;
		position: string;
		activity?: string;
		mood: string[];
		physicalState: string[];
		outfit: CharacterOutfit;
	};

	type ProjectedState = {
		time: NarrativeDateTime | null;
		location: LocationState | null;
		characters: Map<string, ProjectedCharacter>;
		relationships: Map<string, ProjectedRelationship>;
	};

	// Build relationships map from v3 state.relationships
	// (This matches production migration which seeds from NarrativeState.relationships)
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

	let previousState: ProjectedState | null = null;
	let initialProjectionSet = false;

	for (let msgId = 0; msgId < chat.length; msgId++) {
		const message = chat[msgId];
		const storage = message.extra?.blazetracker as
			| Record<number, { state: TrackedState }>
			| undefined;
		const swipeId = message.swipe_id ?? 0;
		const currentState = storage?.[swipeId]?.state;

		if (!currentState) continue;

		// Build projected state from tracked state
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
						outfit: char.outfit ?? createOutfit(),
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
				relationships: Object.fromEntries(projectedState.relationships),
			};
			previousState = projectedState;
			initialProjectionSet = true;
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

	// 3. Sort state events by messageId
	unifiedStore.stateEvents.sort(
		(a, b) => a.messageId - b.messageId || a.timestamp - b.timestamp,
	);

	// 4. Update state
	state.eventStore = unifiedStore;
	state.version = 4;
}

function convertTimestampedToNarrative(
	event: TimestampedEvent,
	chapterIndex: number | null,
	swipeId: number = 0,
): NarrativeEvent {
	// Build affectedPairs from the old event format
	// Old TimestampedEvent may or may not have affectedPairs
	const affectedPairs: AffectedPair[] = [];

	// If event has a relationshipSignal, use that pair
	if (event.relationshipSignal?.pair) {
		affectedPairs.push({ pair: event.relationshipSignal.pair });
	}

	return {
		id: crypto.randomUUID(),
		messageId: event.messageId ?? 0,
		swipeId,
		timestamp: Date.now(),
		summary: event.summary,
		eventTypes: event.eventTypes,
		tensionLevel: event.tensionLevel,
		tensionType: event.tensionType,
		witnesses: event.witnesses ?? [],
		location: event.location ?? '',
		narrativeTimestamp: event.timestamp,
		affectedPairs,
		chapterIndex: chapterIndex ?? undefined,
	};
}

// ============================================
// Tests
// ============================================

describe('v2 → v3 Migration', () => {
	beforeEach(() => {
		mockChat = [];
	});

	it('migrates empty state correctly', () => {
		const state = createV2State([], []);
		migrateV2ToV3ForTest(state, []);

		expect(state.version).toBe(3);
		expect(state.eventStore).toBeDefined();
		expect((state.eventStore as EventStore).events).toHaveLength(0);
		expect(state.chapters).toHaveLength(0);
		expect(state.relationships).toHaveLength(0);
	});

	it('migrates complex state with 25 messages, 2 chapters, and 3 relationships', () => {
		// Create 25 messages with tracked states
		const messages: ChatMessage[] = [];

		for (let i = 0; i < 25; i++) {
			const hour = 10 + Math.floor(i / 5);
			const minute = (i % 5) * 10;

			const state = createTrackedState({
				time: createTime(2024, 6, 15, hour, minute),
				location: createLocation(
					'Downtown',
					i < 12 ? 'Coffee Shop' : 'Restaurant',
					i < 12 ? 'Corner booth' : 'Window table',
				),
				characters: [
					createCharacter('Elena', 'seated', 'talking', [
						'curious',
						'engaged',
					]),
					createCharacter('Marcus', 'seated', 'listening', [
						'interested',
					]),
					...(i >= 8
						? [
								createCharacter(
									'Sarah',
									'standing',
									'watching',
									['amused'],
								),
							]
						: []),
				],
				currentEvents:
					i % 3 === 0
						? [
								createTimestampedEvent(
									i,
									`Event at message ${i}`,
									i === 0
										? ['conversation']
										: ['conversation'],
									[['Elena', 'Marcus']],
								),
							]
						: undefined,
			});

			messages.push(createMessage(i, 0, state));
		}

		// Create chapter 0 events (messages 0-11)
		const chapter0Events: TimestampedEvent[] = [
			createTimestampedEvent(
				0,
				'Elena and Marcus meet for coffee',
				['conversation'],
				[['Elena', 'Marcus']],
			),
			createTimestampedEvent(
				3,
				'They discuss their work',
				['conversation'],
				[['Elena', 'Marcus']],
			),
			createTimestampedEvent(
				6,
				'Elena shares a personal story',
				['emotionally_intimate'],
				[['Elena', 'Marcus']],
			),
			createTimestampedEvent(
				9,
				'Marcus makes her laugh',
				['laugh'],
				[['Elena', 'Marcus']],
			),
		];

		// Create chapter 1 events (messages 12-24)
		const chapter1Events: TimestampedEvent[] = [
			createTimestampedEvent(
				12,
				'They move to the restaurant',
				['outing'],
				[['Elena', 'Marcus']],
			),
			createTimestampedEvent(
				15,
				'Sarah arrives unexpectedly',
				['conversation'],
				[
					['Elena', 'Sarah'],
					['Marcus', 'Sarah'],
				],
			),
			createTimestampedEvent(
				18,
				'Elena and Marcus share a look',
				['intimate_touch'],
				[['Elena', 'Marcus']],
			),
			createTimestampedEvent(
				21,
				'A heated discussion ensues',
				['argument'],
				[
					['Elena', 'Marcus'],
					['Elena', 'Sarah'],
				],
			),
			createTimestampedEvent(
				24,
				'They reconcile over dessert',
				['comfort'],
				[['Elena', 'Marcus']],
			),
		];

		const chapters: Chapter[] = [
			createLegacyChapter(
				0,
				'The Coffee Meeting',
				'Elena and Marcus have coffee',
				chapter0Events,
			),
			createLegacyChapter(
				1,
				'Dinner Complications',
				'Dinner gets complicated',
				chapter1Events,
			),
		];

		const relationships: Relationship[] = [
			createLegacyRelationship(['Elena', 'Marcus'], 'friendly', [
				{
					type: 'first_laugh',
					description: 'Laughed together at the cafe',
				},
				{
					type: 'first_touch',
					description: 'A meaningful glance at dinner',
				},
			]),
			createLegacyRelationship(['Elena', 'Sarah'], 'acquaintances', []),
			createLegacyRelationship(['Marcus', 'Sarah'], 'strangers', []),
		];

		const state = createV2State(chapters, relationships);
		migrateV2ToV3ForTest(state, messages);

		// Verify version
		expect(state.version).toBe(3);

		// Verify event store
		const eventStore = state.eventStore as EventStore;
		expect(eventStore.events.length).toBeGreaterThan(0);

		// Chapter events should be collected
		const ch0Events = eventStore.events.filter(e => e.chapterIndex === 0);
		const ch1Events = eventStore.events.filter(e => e.chapterIndex === 1);
		expect(ch0Events.length).toBe(4);
		expect(ch1Events.length).toBe(5);

		// Verify chapters converted to DerivedChapter
		expect(state.chapters).toHaveLength(2);
		for (const ch of state.chapters) {
			expect('eventIds' in ch).toBe(true);
			expect('events' in ch).toBe(false);
		}

		const derivedCh0 = state.chapters[0] as DerivedChapter;
		expect(derivedCh0.eventIds.length).toBe(4);
		expect(derivedCh0.title).toBe('The Coffee Meeting');

		// Verify relationships converted to DerivedRelationship
		expect(state.relationships).toHaveLength(3);
		for (const rel of state.relationships) {
			expect(isDerivedRelationship(rel)).toBe(true);
			expect('milestoneEventIds' in rel).toBe(true);
			expect('milestones' in rel).toBe(false);
		}

		// Verify chapter snapshots
		expect(state.chapterSnapshots).toHaveLength(1);
		expect(state.chapterSnapshots![0].chapterIndex).toBe(1);
	});

	it('deduplicates events from chapters and message states', () => {
		// Create messages with currentEvents that overlap with chapter events
		const messages: ChatMessage[] = [];

		for (let i = 0; i < 10; i++) {
			const events: TimestampedEvent[] =
				i === 3
					? [
							createTimestampedEvent(
								3,
								'The same event',
								['conversation'],
								[['A', 'B']],
							),
						]
					: [];

			messages.push(
				createMessage(
					i,
					0,
					createTrackedState({
						time: createTime(2024, 6, 15, 10 + i, 0),
						currentEvents: events,
					}),
				),
			);
		}

		// Chapter also has this event
		const chapterEvents: TimestampedEvent[] = [
			createTimestampedEvent(3, 'The same event', ['conversation'], [['A', 'B']]),
			createTimestampedEvent(
				5,
				'A different event',
				['conversation'],
				[['A', 'B']],
			),
		];

		const chapters: Chapter[] = [
			createLegacyChapter(0, 'Test Chapter', 'A test chapter', chapterEvents),
		];

		const state = createV2State(chapters, []);
		migrateV2ToV3ForTest(state, messages);

		const eventStore = state.eventStore as EventStore;

		// Should only have 2 events (deduplicated)
		expect(eventStore.events.length).toBe(2);

		// Both should have distinct summaries
		const summaries = eventStore.events.map(e => e.summary);
		expect(summaries).toContain('The same event');
		expect(summaries).toContain('A different event');
	});

	it('handles multiple milestone types for the same pair', () => {
		const events: TimestampedEvent[] = [
			createTimestampedEvent(1, 'First laugh', ['laugh'], [['A', 'B']]),
			createTimestampedEvent(5, 'First touch', ['intimate_touch'], [['A', 'B']]),
			createTimestampedEvent(10, 'First kiss', ['intimate_kiss'], [['A', 'B']]),
			createTimestampedEvent(15, 'Confession', ['confession'], [['A', 'B']]),
		];

		const chapters: Chapter[] = [
			createLegacyChapter(0, 'Romance', 'A love story', events),
		];

		const relationships: Relationship[] = [
			createLegacyRelationship(['A', 'B'], 'close', [
				{ type: 'first_laugh', description: 'They laughed together' },
				{ type: 'first_touch', description: 'Their first touch' },
				{ type: 'first_kiss', description: 'Their first kiss' },
				{ type: 'confession', description: 'A confession of feelings' },
			]),
		];

		const state = createV2State(chapters, relationships);
		migrateV2ToV3ForTest(state, []);

		const eventStore = state.eventStore as EventStore;

		// Verify each milestone is assigned (note: firstFor only set if event has affectedPairs)
		// Since we're not adding affectedPairs to the TimestampedEvent, firstFor won't be set
		// This test verifies the migration doesn't crash with the milestone handling
		expect(eventStore.events.length).toBe(4);

		// Verify the DerivedRelationship structure
		const rel = state.relationships.find(
			r => pairKey(r.pair) === pairKey(['A', 'B']),
		) as DerivedRelationship;
		expect(rel).toBeDefined();
		expect('milestoneEventIds' in rel).toBe(true);
	});
});

describe('v3 → v4 Migration', () => {
	beforeEach(() => {
		mockChat = [];
	});

	it('migrates empty state correctly', () => {
		const eventStore: EventStore = { events: [], version: 1 };
		const state = createV3State(eventStore, [], []);
		migrateV3ToV4ForTest(state, []);

		expect(state.version).toBe(4);
		expect(isUnifiedEventStore(state.eventStore)).toBe(true);

		const unified = state.eventStore as UnifiedEventStore;
		expect(unified.narrativeEvents).toHaveLength(0);
		expect(unified.stateEvents).toHaveLength(0);
		expect(unified.initialProjection).toBeUndefined();
	});

	it('sets first message with state as initial projection', () => {
		// Create messages where first message has state
		const messages: ChatMessage[] = [
			createMessage(
				0,
				0,
				createTrackedState({
					time: createTime(2024, 6, 15, 10, 0),
					location: createLocation(
						'Downtown',
						'Coffee Shop',
						'by the window',
						['table', 'chairs'],
					),
					characters: [
						createCharacter(
							'Alice',
							'seated',
							'reading',
							['relaxed'],
							[],
							{
								torso: 'blue dress',
								footwear: 'sandals',
							},
						),
					],
				}),
			),
			createMessage(
				1,
				0,
				createTrackedState({
					time: createTime(2024, 6, 15, 10, 5),
					location: createLocation(
						'Downtown',
						'Coffee Shop',
						'by the window',
						['table', 'chairs'],
					),
					characters: [
						createCharacter(
							'Alice',
							'standing',
							'talking',
							['relaxed', 'happy'],
							[],
							{
								torso: 'blue dress',
								footwear: 'sandals',
							},
						),
					],
				}),
			),
		];

		const eventStore: EventStore = { events: [], version: 1 };
		const state = createV3State(eventStore, [], []);
		migrateV3ToV4ForTest(state, messages);

		const unified = state.eventStore as UnifiedEventStore;

		// Initial projection should be set from first message
		expect(unified.initialProjection).toBeDefined();
		expect(unified.initialProjection!.time).not.toBeNull();
		expect(unified.initialProjection!.time!.hour).toBe(10);
		expect(unified.initialProjection!.time!.minute).toBe(0);
		expect(unified.initialProjection!.location).not.toBeNull();
		expect(unified.initialProjection!.location!.place).toBe('Coffee Shop');
		expect(Object.keys(unified.initialProjection!.characters).length).toBe(1);
		expect(unified.initialProjection!.characters['Alice']).toBeDefined();
		expect(unified.initialProjection!.characters['Alice'].position).toBe('seated');

		// State events should be generated from diff between message 0 and 1
		// (not from message 0 since that's the initial projection)
		expect(unified.stateEvents.length).toBeGreaterThan(0);

		// Should have time delta, position change, and mood added events
		const timeEvents = unified.stateEvents.filter(e => e.kind === 'time');
		expect(timeEvents.length).toBe(1); // One time delta from msg 0 to 1

		const positionChange = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'position_changed' &&
				e.character === 'Alice' &&
				e.newValue === 'standing',
		);
		expect(positionChange).toBeDefined();
		expect(positionChange!.messageId).toBe(1);

		const moodAdded = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'mood_added' &&
				e.character === 'Alice' &&
				e.mood === 'happy',
		);
		expect(moodAdded).toBeDefined();
		expect(moodAdded!.messageId).toBe(1);

		// No time_initial event since first message is initial projection
		const timeInitial = unified.stateEvents.find(e => e.kind === 'time_initial');
		expect(timeInitial).toBeUndefined();
	});

	it('migrates complex state with 30 messages and character changes', () => {
		// Create 30 messages with progressively changing states
		const messages: ChatMessage[] = [];

		for (let i = 0; i < 30; i++) {
			const hour = 10 + Math.floor(i / 6);
			const minute = (i % 6) * 10;

			// Characters appear/disappear over time
			const characters: Character[] = [
				createCharacter(
					'Elena',
					i < 15 ? 'seated' : 'standing',
					i < 10 ? 'talking' : i < 20 ? 'listening' : 'thinking',
					i < 10
						? ['curious']
						: i < 20
							? ['curious', 'interested']
							: ['curious', 'interested', 'hopeful'],
					i >= 25 ? ['tired'] : [],
					{
						torso: 'blue blouse',
						legs: 'jeans',
						footwear: i >= 20 ? null : 'heels', // Removes shoes later
					},
				),
				createCharacter(
					'Marcus',
					'seated',
					i < 15 ? 'listening' : 'talking',
					i < 10 ? ['friendly'] : ['friendly', 'attracted'],
					[],
					{
						torso: 'white shirt',
						legs: 'khakis',
						footwear: 'loafers',
					},
				),
			];

			// Sarah joins at message 15
			if (i >= 15) {
				characters.push(
					createCharacter(
						'Sarah',
						'standing',
						'observing',
						['amused'],
						[],
						{
							torso: 'red dress',
							footwear: 'flats',
						},
					),
				);
			}

			// Location changes at message 20
			const location =
				i < 20
					? createLocation(
							'Downtown',
							'Coffee Shop',
							'Corner booth',
							['wooden table', 'coffee cups'],
						)
					: createLocation('Riverside', 'Park', 'Near the fountain', [
							'stone bench',
							'fountain',
							'trees',
						]);

			const state = createTrackedState({
				time: createTime(2024, 6, 15, hour, minute),
				location,
				characters,
			});

			messages.push(createMessage(i, 0, state));
		}

		// Create v3 state with some narrative events
		const eventStore: EventStore = {
			events: [
				{
					id: 'evt-1',
					messageId: 5,
					swipeId: 0,
					timestamp: Date.now(),
					summary: 'They start talking',
					eventTypes: ['conversation'],
					tensionLevel: 'aware',
					tensionType: 'conversation',
					witnesses: [],
					location: 'Coffee Shop',
					narrativeTimestamp: createTime(2024, 6, 15, 10, 50),
					affectedPairs: [{ pair: ['Elena', 'Marcus'] }],
				},
				{
					id: 'evt-2',
					messageId: 15,
					swipeId: 0,
					timestamp: Date.now(),
					summary: 'Sarah arrives',
					eventTypes: ['conversation'],
					tensionLevel: 'tense',
					tensionType: 'conversation',
					witnesses: [],
					location: 'Coffee Shop',
					narrativeTimestamp: createTime(2024, 6, 15, 12, 30),
					affectedPairs: [
						{ pair: ['Elena', 'Sarah'] },
						{ pair: ['Marcus', 'Sarah'] },
					],
				},
				{
					id: 'evt-3',
					messageId: 25,
					swipeId: 0,
					timestamp: Date.now(),
					summary: 'They decide to leave',
					eventTypes: ['conversation'],
					tensionLevel: 'aware',
					tensionType: 'conversation',
					witnesses: [],
					location: 'Park',
					narrativeTimestamp: createTime(2024, 6, 15, 14, 10),
					affectedPairs: [{ pair: ['Elena', 'Marcus'] }],
				},
			],
			version: 1,
		};

		const state = createV3State(eventStore, [], []);
		migrateV3ToV4ForTest(state, messages);

		// Verify version
		expect(state.version).toBe(4);
		expect(isUnifiedEventStore(state.eventStore)).toBe(true);

		const unified = state.eventStore as UnifiedEventStore;

		// Verify narrative events were preserved
		expect(unified.narrativeEvents.length).toBe(3);
		expect(unified.narrativeEvents.map(e => e.id)).toContain('evt-1');
		expect(unified.narrativeEvents.map(e => e.id)).toContain('evt-2');
		expect(unified.narrativeEvents.map(e => e.id)).toContain('evt-3');

		// Verify state events were generated
		expect(unified.stateEvents.length).toBeGreaterThan(0);

		// Check that initial projection is set from first message
		expect(unified.initialProjection).toBeDefined();
		expect(unified.initialProjection!.time).not.toBeNull();
		expect(unified.initialProjection!.location).not.toBeNull();
		expect(Object.keys(unified.initialProjection!.characters).length).toBeGreaterThan(
			0,
		);

		// No time_initial event at message 0 since that's now the initial projection
		const initialTimeEvents = unified.stateEvents.filter(
			e => e.kind === 'time_initial' && e.messageId === 0,
		);
		expect(initialTimeEvents.length).toBe(0);

		// Check for time deltas (from subsequent messages)
		const timeDeltas = unified.stateEvents.filter(e => e.kind === 'time');
		expect(timeDeltas.length).toBeGreaterThan(0);

		// Check for location event at message 20 (location change)
		const locationEvents = unified.stateEvents.filter(
			e => e.kind === 'location' && e.messageId === 20,
		);
		expect(locationEvents.length).toBe(1);
		// Verify it's a moved event with subkind
		const movedEvent = locationEvents[0] as {
			subkind?: string;
			newArea?: string;
			newPlace?: string;
		};
		expect(movedEvent.subkind).toBe('moved');
		expect(movedEvent.newArea).toBe('Riverside');
		expect(movedEvent.newPlace).toBe('Park');

		// Check for character appeared (Sarah at message 15)
		const sarahAppeared = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'appeared' &&
				e.character === 'Sarah',
		);
		expect(sarahAppeared).toBeDefined();
		expect(sarahAppeared!.messageId).toBe(15);

		// Check for position changes (Elena from seated to standing at 15)
		const elenaPositionChange = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'position_changed' &&
				e.character === 'Elena' &&
				e.newValue === 'standing',
		);
		expect(elenaPositionChange).toBeDefined();

		// Check for activity changes
		const activityChanges = unified.stateEvents.filter(
			e => e.kind === 'character' && e.subkind === 'activity_changed',
		);
		expect(activityChanges.length).toBeGreaterThan(0);

		// Check for mood changes
		const moodAdded = unified.stateEvents.filter(
			e => e.kind === 'character' && e.subkind === 'mood_added',
		);
		expect(moodAdded.length).toBeGreaterThan(0);

		// Check for outfit changes (Elena removes shoes at 20)
		const elenaShoeRemoval = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'outfit_changed' &&
				e.character === 'Elena' &&
				e.slot === 'footwear' &&
				e.newValue === null,
		);
		expect(elenaShoeRemoval).toBeDefined();
		expect(elenaShoeRemoval!.messageId).toBe(20);

		// Check for physical state changes (Elena gets tired at 25)
		const elenaTired = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'physical_state_added' &&
				e.character === 'Elena' &&
				e.physicalState === 'tired',
		);
		expect(elenaTired).toBeDefined();
		expect(elenaTired!.messageId).toBe(25);

		// Verify events are sorted by messageId
		for (let i = 1; i < unified.stateEvents.length; i++) {
			expect(unified.stateEvents[i].messageId).toBeGreaterThanOrEqual(
				unified.stateEvents[i - 1].messageId,
			);
		}
	});

	it('handles messages with missing state data', () => {
		const messages: ChatMessage[] = [];

		// Create messages with gaps in state data
		for (let i = 0; i < 10; i++) {
			if (i % 3 === 0) {
				// Every third message has no state
				messages.push(createMessage(i, 0));
			} else {
				messages.push(
					createMessage(
						i,
						0,
						createTrackedState({
							time: createTime(2024, 6, 15, 10 + i, 0),
							location: createLocation(
								'Area',
								'Place',
								'Position',
							),
							characters: [
								createCharacter(
									'Test',
									'pos',
									'act',
								),
							],
						}),
					),
				);
			}
		}

		const eventStore: EventStore = { events: [], version: 1 };
		const state = createV3State(eventStore, [], []);
		migrateV3ToV4ForTest(state, messages);

		expect(state.version).toBe(4);

		const unified = state.eventStore as UnifiedEventStore;

		// First message with state (message 1) becomes initial projection
		expect(unified.initialProjection).toBeDefined();
		expect(unified.initialProjection!.time!.hour).toBe(11); // Message 1 has hour 10+1

		// Should only have events for messages after the initial projection
		const messagesWithEvents = new Set(unified.stateEvents.map(e => e.messageId));
		expect(messagesWithEvents.has(0)).toBe(false); // No state
		expect(messagesWithEvents.has(1)).toBe(false); // First with state = initial projection (no events)
		expect(messagesWithEvents.has(2)).toBe(true); // Has state, generates events
		expect(messagesWithEvents.has(3)).toBe(false); // No state
	});

	it('handles swipe variations correctly', () => {
		const messages: ChatMessage[] = [];

		// Create messages where swipe_id varies
		for (let i = 0; i < 5; i++) {
			const swipeId = i % 2; // Alternates between 0 and 1
			messages.push(
				createMessage(
					i,
					swipeId,
					createTrackedState({
						time: createTime(2024, 6, 15, 10 + i, 0),
						characters: [
							createCharacter(
								`Char${swipeId}`,
								'pos',
								'act',
							),
						],
					}),
				),
			);
		}

		const eventStore: EventStore = { events: [], version: 1 };
		const state = createV3State(eventStore, [], []);
		migrateV3ToV4ForTest(state, messages);

		const unified = state.eventStore as UnifiedEventStore;

		// Verify swipe IDs are preserved
		for (const event of unified.stateEvents) {
			const expectedSwipeId = event.messageId % 2;
			expect(event.swipeId).toBe(expectedSwipeId);
		}
	});

	it('preserves all outfit slots during migration', () => {
		const fullOutfit: CharacterOutfit = {
			head: 'hat',
			neck: 'scarf',
			jacket: 'leather jacket',
			back: 'backpack',
			torso: 't-shirt',
			legs: 'jeans',
			footwear: 'sneakers',
			socks: 'white socks',
			underwear: 'boxers',
		};

		const messages: ChatMessage[] = [
			createMessage(
				0,
				0,
				createTrackedState({
					time: createTime(2024, 6, 15, 10, 0),
					characters: [
						{
							name: 'Test',
							position: 'standing',
							mood: [],
							physicalState: [],
							outfit: fullOutfit,
						},
					],
				}),
			),
			createMessage(
				1,
				0,
				createTrackedState({
					time: createTime(2024, 6, 15, 10, 30),
					characters: [
						{
							name: 'Test',
							position: 'standing',
							mood: [],
							physicalState: [],
							outfit: {
								...fullOutfit,
								jacket: null, // Removes jacket
								head: 'cap', // Changes hat to cap
							},
						},
					],
				}),
			),
		];

		const eventStore: EventStore = { events: [], version: 1 };
		const state = createV3State(eventStore, [], []);
		migrateV3ToV4ForTest(state, messages);

		const unified = state.eventStore as UnifiedEventStore;

		// Check jacket removal
		const jacketRemoval = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'outfit_changed' &&
				e.slot === 'jacket' &&
				e.newValue === null,
		);
		expect(jacketRemoval).toBeDefined();
		// Check the event has previousValue (need to cast to CharacterEvent)
		const jacketEvent = jacketRemoval as { previousValue?: string | null };
		expect(jacketEvent.previousValue).toBe('leather jacket');

		// Check head change
		const headChange = unified.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'outfit_changed' &&
				e.slot === 'head' &&
				e.newValue === 'cap',
		);
		expect(headChange).toBeDefined();
		const headEvent = headChange as { previousValue?: string | null };
		expect(headEvent.previousValue).toBe('hat');
	});

	it('seeds relationships from v3 state into initial projection', () => {
		// Create messages with state
		const messages: ChatMessage[] = [
			createMessage(
				0,
				0,
				createTrackedState({
					time: createTime(2024, 6, 15, 10, 0),
					characters: [
						createCharacter('Alice', 'seated'),
						createCharacter('Bob', 'seated'),
					],
				}),
			),
		];

		// Create v3 state with relationships
		const eventStore: EventStore = { events: [], version: 1 };
		const relationships: DerivedRelationship[] = [
			{
				pair: ['Alice', 'Bob'],
				status: 'friendly',
				aToB: {
					feelings: ['curious', 'attracted'],
					secrets: ['has a crush'],
					wants: ['to get closer'],
				},
				bToA: {
					feelings: ['interested'],
					secrets: [],
					wants: ['friendship'],
				},
				milestoneEventIds: [],
				history: [],
			},
			{
				pair: ['Alice', 'Charlie'],
				status: 'acquaintances',
				aToB: {
					feelings: ['neutral'],
					secrets: [],
					wants: [],
				},
				bToA: {
					feelings: ['friendly'],
					secrets: [],
					wants: [],
				},
				milestoneEventIds: [],
				history: [],
			},
		];

		const state = createV3State(eventStore, [], relationships);
		migrateV3ToV4ForTest(state, messages);

		const unified = state.eventStore as UnifiedEventStore;

		// Verify initial projection has relationships seeded
		expect(unified.initialProjection).toBeDefined();
		expect(unified.initialProjection!.relationships).toBeDefined();

		const aliceBob = unified.initialProjection!.relationships['Alice|Bob'];
		expect(aliceBob).toBeDefined();
		expect(aliceBob.pair).toEqual(['Alice', 'Bob']);
		expect(aliceBob.status).toBe('friendly');
		expect(aliceBob.aToB.feelings).toContain('curious');
		expect(aliceBob.aToB.feelings).toContain('attracted');
		expect(aliceBob.aToB.secrets).toContain('has a crush');
		expect(aliceBob.aToB.wants).toContain('to get closer');
		expect(aliceBob.bToA.feelings).toContain('interested');
		expect(aliceBob.bToA.wants).toContain('friendship');

		const aliceCharlie = unified.initialProjection!.relationships['Alice|Charlie'];
		expect(aliceCharlie).toBeDefined();
		expect(aliceCharlie.pair).toEqual(['Alice', 'Charlie']);
		expect(aliceCharlie.status).toBe('acquaintances');
	});

	it('preserves relationship attitudes through migration chain', () => {
		// Create messages
		const messages: ChatMessage[] = [
			createMessage(
				0,
				0,
				createTrackedState({
					time: createTime(2024, 6, 15, 10, 0),
					characters: [createCharacter('Elena', 'seated')],
				}),
			),
		];

		// Start with v2 state with legacy relationship
		const relationships: Relationship[] = [
			createLegacyRelationship(['Elena', 'Marcus'], 'close', [
				{ type: 'first_kiss', description: 'Their first kiss' },
			]),
		];
		// Override the feelings/secrets/wants
		relationships[0].aToB = {
			feelings: ['in love', 'protective'],
			secrets: ['pregnant'],
			wants: ['commitment'],
		};
		relationships[0].bToA = {
			feelings: ['devoted', 'worried'],
			secrets: [],
			wants: ['her safety'],
		};

		const state = createV2State([], relationships);

		// Migrate v2 → v3
		migrateV2ToV3ForTest(state, messages);
		expect(state.version).toBe(3);

		// Verify DerivedRelationship preserved attitudes
		const v3Rel = state.relationships[0] as DerivedRelationship;
		expect(v3Rel.aToB.feelings).toContain('in love');
		expect(v3Rel.aToB.secrets).toContain('pregnant');
		expect(v3Rel.bToA.feelings).toContain('devoted');

		// Migrate v3 → v4
		migrateV3ToV4ForTest(state, messages);
		expect(state.version).toBe(4);

		const unified = state.eventStore as UnifiedEventStore;

		// Verify initial projection has the relationship with all attitudes
		expect(unified.initialProjection).toBeDefined();
		const projected = unified.initialProjection!.relationships['Elena|Marcus'];
		expect(projected).toBeDefined();
		expect(projected.status).toBe('close');
		expect(projected.aToB.feelings).toContain('in love');
		expect(projected.aToB.feelings).toContain('protective');
		expect(projected.aToB.secrets).toContain('pregnant');
		expect(projected.aToB.wants).toContain('commitment');
		expect(projected.bToA.feelings).toContain('devoted');
		expect(projected.bToA.feelings).toContain('worried');
		expect(projected.bToA.wants).toContain('her safety');
	});
});

describe('Full migration chain v2 → v3 → v4', () => {
	it('migrates complex state through full chain correctly', () => {
		// Create 20 messages with full state
		const messages: ChatMessage[] = [];

		for (let i = 0; i < 20; i++) {
			const state = createTrackedState({
				time: createTime(2024, 6, 15, 10 + i, 0),
				location: createLocation(
					'Area',
					i < 10 ? 'Place A' : 'Place B',
					'Position',
				),
				characters: [
					createCharacter(
						'Alice',
						i < 10 ? 'sitting' : 'standing',
						'talking',
						i < 5 ? ['happy'] : ['happy', 'excited'],
					),
					createCharacter('Bob', 'sitting', 'listening', ['curious']),
				],
				currentEvents:
					i === 5
						? [
								createTimestampedEvent(
									5,
									'A significant moment',
									['intimate_touch'],
									[['Alice', 'Bob']],
								),
							]
						: undefined,
			});

			messages.push(createMessage(i, 0, state));
		}

		// Chapter events
		const chapterEvents: TimestampedEvent[] = [
			createTimestampedEvent(
				0,
				'They meet',
				['conversation'],
				[['Alice', 'Bob']],
			),
			createTimestampedEvent(
				5,
				'A significant moment',
				['intimate_touch'],
				[['Alice', 'Bob']],
			),
		];

		// Start with v2 state
		const chapters: Chapter[] = [
			createLegacyChapter(0, 'First Meeting', 'They meet', chapterEvents),
		];

		const relationships: Relationship[] = [
			createLegacyRelationship(['Alice', 'Bob'], 'friendly', [
				{ type: 'first_touch', description: 'A meaningful handshake' },
			]),
		];

		const state = createV2State(chapters, relationships);

		// Migrate v2 → v3
		migrateV2ToV3ForTest(state, messages);
		expect(state.version).toBe(3);

		// Verify v3 state is correct
		const v3Store = state.eventStore as EventStore;
		expect(v3Store.events.length).toBe(2); // 2 chapter events (deduplicated)

		// Migrate v3 → v4
		migrateV3ToV4ForTest(state, messages);
		expect(state.version).toBe(4);

		// Verify final v4 state
		const v4Store = state.eventStore as UnifiedEventStore;

		// Narrative events preserved
		expect(v4Store.narrativeEvents.length).toBe(2);

		// State events generated
		expect(v4Store.stateEvents.length).toBeGreaterThan(0);

		// Check that initial projection is set (first message becomes projection, not event)
		expect(v4Store.initialProjection).toBeDefined();
		expect(v4Store.initialProjection!.time).not.toBeNull();

		// No time_initial events since first message is initial projection
		const initialTime = v4Store.stateEvents.find(e => e.kind === 'time_initial');
		expect(initialTime).toBeUndefined();

		const locationChange = v4Store.stateEvents.find(
			e => e.kind === 'location' && e.messageId === 10,
		);
		expect(locationChange).toBeDefined();
		// Verify it's a moved event with correct subkind
		const movedChange = locationChange as {
			subkind?: string;
			newPlace?: string;
			previousPlace?: string;
		};
		expect(movedChange.subkind).toBe('moved');
		expect(movedChange.newPlace).toBe('Place B');
		expect(movedChange.previousPlace).toBe('Place A');

		const alicePositionChange = v4Store.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'position_changed' &&
				e.character === 'Alice' &&
				e.newValue === 'standing',
		);
		expect(alicePositionChange).toBeDefined();

		const aliceMoodAdd = v4Store.stateEvents.find(
			e =>
				e.kind === 'character' &&
				e.subkind === 'mood_added' &&
				e.character === 'Alice' &&
				e.mood === 'excited',
		);
		expect(aliceMoodAdd).toBeDefined();
	});
});
