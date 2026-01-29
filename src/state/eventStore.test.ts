import { describe, it, expect, beforeEach } from 'vitest';
import {
	createUnifiedEventStore,
	projectStateAtMessage,
	projectStateOptimized,
	addStateEvent,
	generateUUID,
	createEventStore,
	addEvent,
	getEventsForChapter,
	getCurrentChapterEvents,
	assignEventsToChapter,
	projectRelationship,
	computeMilestonesForPair,
	computeMilestonesForEvent,
	convertProjectionToTrackedState,
	convertTrackedStateToProjection,
	clearEventsForMessage,
	invalidateSnapshotsFrom,
	invalidateProjectionsFrom,
	saveChapterSnapshot,
	findChapterSnapshotBefore,
	setInitialProjection,
	getInitialProjection,
	getLastMessageWithEvents,
	generateStateEventsFromDiff,
	deduplicateEvents,
	replaceStateEventsForMessage,
	recomputeFirstFor,
	updateNarrativeEvent,
	getEvent,
	pairKey,
	getEventsUpToMessage,
} from './eventStore';
import type {
	UnifiedEventStore,
	InitialTimeEvent,
	TimeEvent,
	LocationMovedEvent,
	LocationPropEvent,
	CharacterEvent,
	RelationshipEvent,
	DirectionalRelationshipEvent,
	StatusChangedEvent,
	EventStore,
	NarrativeEvent,
	EventType,
	ProjectedState,
	TrackedState,
	MilestoneType,
	ProjectedCharacter,
} from '../types/state';

describe('eventStore', () => {
	describe('projectStateAtMessage', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('projects time from InitialTimeEvent', () => {
			const initialTimeEvent: Omit<InitialTimeEvent, 'id'> = {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			};

			addStateEvent(store, initialTimeEvent);

			const projected = projectStateAtMessage(store, 0, 0, []);
			expect(projected.time).not.toBeNull();
			expect(projected.time?.year).toBe(2024);
			expect(projected.time?.month).toBe(6);
			expect(projected.time?.day).toBe(15);
			expect(projected.time?.hour).toBe(14);
			expect(projected.time?.minute).toBe(30);
		});

		it('projects time from TimeEvent delta', () => {
			// First add initial time
			const initialTimeEvent: Omit<InitialTimeEvent, 'id'> = {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			};
			addStateEvent(store, initialTimeEvent);

			// Then add a time delta
			const deltaEvent: Omit<TimeEvent, 'id'> = {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 2, minutes: 15 },
			};
			addStateEvent(store, deltaEvent);

			const projected = projectStateAtMessage(store, 1, 0, []);
			expect(projected.time).not.toBeNull();
			expect(projected.time?.hour).toBe(16); // 14 + 2
			expect(projected.time?.minute).toBe(45); // 30 + 15
		});

		it('projects location from LocationEvent', () => {
			const timestamp = Date.now();

			// Add location moved event
			const locationMovedEvent: Omit<LocationMovedEvent, 'id'> = {
				messageId: 0,
				swipeId: 0,
				timestamp,
				kind: 'location',
				subkind: 'moved',
				newArea: 'Upper East Side, Manhattan, NY',
				newPlace: "Elena's Apartment",
				newPosition: 'Living room',
			};
			addStateEvent(store, locationMovedEvent);

			// Add prop events
			const props = ['Coffee table', 'Sofa', 'TV'];
			for (const prop of props) {
				const propEvent: Omit<LocationPropEvent, 'id'> = {
					messageId: 0,
					swipeId: 0,
					timestamp: timestamp + 1,
					kind: 'location',
					subkind: 'prop_added',
					prop,
				};
				addStateEvent(store, propEvent);
			}

			const projected = projectStateAtMessage(store, 0, 0, []);
			expect(projected.location).not.toBeNull();
			expect(projected.location?.area).toBe('Upper East Side, Manhattan, NY');
			expect(projected.location?.place).toBe("Elena's Apartment");
			expect(projected.location?.position).toBe('Living room');
			expect(projected.location?.props).toEqual(['Coffee table', 'Sofa', 'TV']);
		});

		it('handles character appeared event', () => {
			const appearedEvent: Omit<CharacterEvent, 'id'> = {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			};

			addStateEvent(store, appearedEvent);

			const projected = projectStateAtMessage(store, 0, 0, []);
			expect(projected.characters.has('Elena')).toBe(true);
			const elena = projected.characters.get('Elena');
			expect(elena?.name).toBe('Elena');
			expect(elena?.position).toBe('unknown');
		});

		it('handles character departed event', () => {
			// First, character appears
			const appearedEvent: Omit<CharacterEvent, 'id'> = {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			};
			addStateEvent(store, appearedEvent);

			// Then character departs
			const departedEvent: Omit<CharacterEvent, 'id'> = {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'departed',
				character: 'Elena',
			};
			addStateEvent(store, departedEvent);

			// At message 0, Elena should be present
			const projectedMsg0 = projectStateAtMessage(store, 0, 0, []);
			expect(projectedMsg0.characters.has('Elena')).toBe(true);

			// At message 1, Elena should be gone
			const projectedMsg1 = projectStateAtMessage(store, 1, 0, []);
			expect(projectedMsg1.characters.has('Elena')).toBe(false);
		});

		it('handles mood_added event', () => {
			// Character appears
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			// Add mood
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'mood_added',
				character: 'Elena',
				mood: 'anxious',
			} as Omit<CharacterEvent, 'id'>);

			const projected = projectStateAtMessage(store, 1, 0, []);
			const elena = projected.characters.get('Elena');
			expect(elena?.mood).toContain('anxious');
		});

		it('handles mood_removed event', () => {
			// Character appears with mood
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now() + 1,
				kind: 'character',
				subkind: 'mood_added',
				character: 'Elena',
				mood: 'anxious',
			} as Omit<CharacterEvent, 'id'>);

			// Remove mood
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'mood_removed',
				character: 'Elena',
				mood: 'anxious',
			} as Omit<CharacterEvent, 'id'>);

			// At message 0, Elena should have the mood
			const projectedMsg0 = projectStateAtMessage(store, 0, 0, []);
			expect(projectedMsg0.characters.get('Elena')?.mood).toContain('anxious');

			// At message 1, mood should be removed
			const projectedMsg1 = projectStateAtMessage(store, 1, 0, []);
			expect(projectedMsg1.characters.get('Elena')?.mood).not.toContain(
				'anxious',
			);
		});

		it('handles outfit_changed event', () => {
			// Character appears
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			// Add jacket
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Elena',
				slot: 'jacket',
				newValue: 'Black leather jacket',
				previousValue: null,
			} as Omit<CharacterEvent, 'id'>);

			const projected = projectStateAtMessage(store, 1, 0, []);
			const elena = projected.characters.get('Elena');
			expect(elena?.outfit.jacket).toBe('Black leather jacket');
		});

		it('handles outfit_changed with null (removal)', () => {
			// Character appears with jacket
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now() + 1,
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Elena',
				slot: 'jacket',
				newValue: 'Black leather jacket',
				previousValue: null,
			} as Omit<CharacterEvent, 'id'>);

			// Remove jacket
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Elena',
				slot: 'jacket',
				newValue: null,
				previousValue: 'Black leather jacket',
			} as Omit<CharacterEvent, 'id'>);

			// At message 0, Elena should have the jacket
			const projectedMsg0 = projectStateAtMessage(store, 0, 0, []);
			expect(projectedMsg0.characters.get('Elena')?.outfit.jacket).toBe(
				'Black leather jacket',
			);

			// At message 1, jacket should be removed (null/undefined)
			const projectedMsg1 = projectStateAtMessage(store, 1, 0, []);
			expect(
				projectedMsg1.characters.get('Elena')?.outfit.jacket,
			).toBeUndefined();
		});

		it('handles position_changed event', () => {
			// Character appears
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			// Change position
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Elena',
				newValue: 'Sitting on the couch',
				previousValue: 'unknown',
			} as Omit<CharacterEvent, 'id'>);

			const projected = projectStateAtMessage(store, 1, 0, []);
			expect(projected.characters.get('Elena')?.position).toBe(
				'Sitting on the couch',
			);
		});

		it('handles activity_changed event', () => {
			// Character appears
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			// Set activity
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'activity_changed',
				character: 'Elena',
				newValue: 'Reading a book',
				previousValue: null,
			} as Omit<CharacterEvent, 'id'>);

			const projected = projectStateAtMessage(store, 1, 0, []);
			expect(projected.characters.get('Elena')?.activity).toBe('Reading a book');
		});

		it('handles physical_state_added event', () => {
			// Character appears
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			// Add physical state
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'physical_state_added',
				character: 'Elena',
				physicalState: 'exhausted',
			} as Omit<CharacterEvent, 'id'>);

			const projected = projectStateAtMessage(store, 1, 0, []);
			expect(projected.characters.get('Elena')?.physicalState).toContain(
				'exhausted',
			);
		});

		it('handles physical_state_removed event', () => {
			// Character appears with physical state
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now() + 1,
				kind: 'character',
				subkind: 'physical_state_added',
				character: 'Elena',
				physicalState: 'exhausted',
			} as Omit<CharacterEvent, 'id'>);

			// Remove physical state
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'physical_state_removed',
				character: 'Elena',
				physicalState: 'exhausted',
			} as Omit<CharacterEvent, 'id'>);

			const projectedMsg1 = projectStateAtMessage(store, 1, 0, []);
			expect(projectedMsg1.characters.get('Elena')?.physicalState).not.toContain(
				'exhausted',
			);
		});

		it('handles multiple events in sequence', () => {
			// Setup a scene with multiple characters and events
			const events: Omit<CharacterEvent, 'id'>[] = [
				// Message 0: Elena and Marcus appear
				{
					messageId: 0,
					swipeId: 0,
					timestamp: 1000,
					kind: 'character',
					subkind: 'appeared',
					character: 'Elena',
				},
				{
					messageId: 0,
					swipeId: 0,
					timestamp: 1001,
					kind: 'character',
					subkind: 'appeared',
					character: 'Marcus',
				},
				// Message 1: Elena sits, Marcus gets anxious
				{
					messageId: 1,
					swipeId: 0,
					timestamp: 2000,
					kind: 'character',
					subkind: 'position_changed',
					character: 'Elena',
					newValue: 'Sitting on couch',
				},
				{
					messageId: 1,
					swipeId: 0,
					timestamp: 2001,
					kind: 'character',
					subkind: 'mood_added',
					character: 'Marcus',
					mood: 'anxious',
				},
				// Message 2: Marcus leaves
				{
					messageId: 2,
					swipeId: 0,
					timestamp: 3000,
					kind: 'character',
					subkind: 'departed',
					character: 'Marcus',
				},
			];

			for (const event of events) {
				addStateEvent(store, event);
			}

			// Check state at each message
			const msg0 = projectStateAtMessage(store, 0, 0, []);
			expect(msg0.characters.size).toBe(2);
			expect(msg0.characters.has('Elena')).toBe(true);
			expect(msg0.characters.has('Marcus')).toBe(true);

			const msg1 = projectStateAtMessage(store, 1, 0, []);
			expect(msg1.characters.size).toBe(2);
			expect(msg1.characters.get('Elena')?.position).toBe('Sitting on couch');
			expect(msg1.characters.get('Marcus')?.mood).toContain('anxious');

			const msg2 = projectStateAtMessage(store, 2, 0, []);
			expect(msg2.characters.size).toBe(1);
			expect(msg2.characters.has('Elena')).toBe(true);
			expect(msg2.characters.has('Marcus')).toBe(false);
		});

		it('projects correct state at earlier messageId', () => {
			// Add events across multiple messages
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: 1000,
				kind: 'character',
				subkind: 'appeared',
				character: 'Elena',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: 2000,
				kind: 'character',
				subkind: 'mood_added',
				character: 'Elena',
				mood: 'happy',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: 3000,
				kind: 'character',
				subkind: 'mood_added',
				character: 'Elena',
				mood: 'excited',
			} as Omit<CharacterEvent, 'id'>);

			// Project at message 0 - no moods yet
			const msg0 = projectStateAtMessage(store, 0, 0, []);
			expect(msg0.characters.get('Elena')?.mood).toEqual([]);

			// Project at message 1 - only 'happy'
			const msg1 = projectStateAtMessage(store, 1, 0, []);
			expect(msg1.characters.get('Elena')?.mood).toEqual(['happy']);

			// Project at message 2 - both moods
			const msg2 = projectStateAtMessage(store, 2, 0, []);
			expect(msg2.characters.get('Elena')?.mood).toContain('happy');
			expect(msg2.characters.get('Elena')?.mood).toContain('excited');
		});

		it('handles time delta that crosses day boundary', () => {
			// Initial time: 11:30 PM
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 23,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			// Add 2 hours (crosses midnight)
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 2, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			const projected = projectStateAtMessage(store, 1, 0, []);
			expect(projected.time?.day).toBe(16);
			expect(projected.time?.hour).toBe(1);
			expect(projected.time?.minute).toBe(30);
		});

		it('handles multiple time deltas cumulatively', () => {
			// Initial time: 10:00 AM
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			// Add 1 hour
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 1, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			// Add another 30 minutes
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 0, minutes: 30 },
			} as Omit<TimeEvent, 'id'>);

			// Add 1 day and 2 hours
			addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 1, hours: 2, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			const projected = projectStateAtMessage(store, 3, 0, []);
			expect(projected.time?.day).toBe(16); // 15 + 1
			expect(projected.time?.hour).toBe(13); // 10 + 1 + 2 = 13
			expect(projected.time?.minute).toBe(30);
		});

		it('returns empty state for no events', () => {
			const projected = projectStateAtMessage(store, 0, 0, []);
			expect(projected.time).toBeNull();
			expect(projected.location).toBeNull();
			expect(projected.characters.size).toBe(0);
		});
	});

	describe('generateUUID', () => {
		it('generates valid UUID format', () => {
			const uuid = generateUUID();
			// UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
			expect(uuid).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});

		it('generates unique UUIDs', () => {
			const uuids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				uuids.add(generateUUID());
			}
			expect(uuids.size).toBe(100);
		});
	});

	describe('getEventsForChapter', () => {
		let store: EventStore;

		beforeEach(() => {
			store = createEventStore();
		});

		it('groups events by chapterIndex', () => {
			// Add events with different chapter indexes
			addEvent(
				store,
				createNarrativeEvent(1, 0, ['conversation'], [['Alice', 'Bob']]),
			);
			addEvent(
				store,
				createNarrativeEvent(2, 0, ['conversation'], [['Alice', 'Bob']]),
			);
			addEvent(
				store,
				createNarrativeEvent(3, 0, ['conversation'], [['Alice', 'Bob']]),
			);

			// Assign to chapters
			const events = store.events;
			assignEventsToChapter(store, [events[0].id], 0);
			assignEventsToChapter(store, [events[1].id, events[2].id], 1);

			// Check chapter 0
			const chapter0Events = getEventsForChapter(store, 0);
			expect(chapter0Events).toHaveLength(1);
			expect(chapter0Events[0].messageId).toBe(1);

			// Check chapter 1
			const chapter1Events = getEventsForChapter(store, 1);
			expect(chapter1Events).toHaveLength(2);
			expect(chapter1Events.map(e => e.messageId)).toContain(2);
			expect(chapter1Events.map(e => e.messageId)).toContain(3);
		});

		it('returns events for specific chapter', () => {
			addEvent(
				store,
				createNarrativeEvent(1, 0, ['conversation'], [['Alice', 'Bob']]),
			);
			addEvent(
				store,
				createNarrativeEvent(2, 0, ['intimate_kiss'], [['Alice', 'Bob']]),
			);

			// Assign only first event to chapter 0
			assignEventsToChapter(store, [store.events[0].id], 0);

			const chapter0Events = getEventsForChapter(store, 0);
			expect(chapter0Events).toHaveLength(1);

			// Chapter 1 should be empty
			const chapter1Events = getEventsForChapter(store, 1);
			expect(chapter1Events).toHaveLength(0);
		});

		it('handles events without chapterIndex (current chapter)', () => {
			addEvent(
				store,
				createNarrativeEvent(1, 0, ['conversation'], [['Alice', 'Bob']]),
			);
			addEvent(
				store,
				createNarrativeEvent(2, 0, ['conversation'], [['Alice', 'Bob']]),
			);
			addEvent(
				store,
				createNarrativeEvent(3, 0, ['conversation'], [['Alice', 'Bob']]),
			);

			// Assign only first event to chapter
			assignEventsToChapter(store, [store.events[0].id], 0);

			// Events 2 and 3 should be in "current chapter" (no chapterIndex)
			const currentChapterEvents = getCurrentChapterEvents(store);
			expect(currentChapterEvents).toHaveLength(2);
			expect(currentChapterEvents.every(e => e.chapterIndex === undefined)).toBe(
				true,
			);
		});
	});

	describe('projectRelationship', () => {
		let store: EventStore;

		beforeEach(() => {
			store = createEventStore();
		});

		it('returns strangers status for pair with no events', () => {
			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.status).toBe('strangers');
			expect(relationship.pair).toEqual(['Alice', 'Bob']);
			expect(relationship.aToB.feelings).toEqual([]);
			expect(relationship.bToA.feelings).toEqual([]);
		});

		it('computes acquaintances status from first_meeting milestone', () => {
			const event = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event.affectedPairs[0].firstFor = ['first_meeting'];
			addEvent(store, event);

			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.status).toBe('acquaintances');
		});

		it('computes friendly status from shared_meal milestone', () => {
			// First meeting
			const meetingEvent = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			meetingEvent.affectedPairs[0].firstFor = ['first_meeting'];
			addEvent(store, meetingEvent);

			// Shared meal
			const mealEvent = createNarrativeEvent(
				2,
				0,
				['shared_meal'],
				[['Alice', 'Bob']],
			);
			mealEvent.affectedPairs[0].firstFor = ['first_shared_meal'];
			addEvent(store, mealEvent);

			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.status).toBe('friendly');
		});

		it('computes close status from first_kiss milestone', () => {
			// First meeting
			const meetingEvent = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			meetingEvent.affectedPairs[0].firstFor = ['first_meeting'];
			addEvent(store, meetingEvent);

			// First kiss
			const kissEvent = createNarrativeEvent(
				2,
				0,
				['intimate_kiss'],
				[['Alice', 'Bob']],
			);
			kissEvent.affectedPairs[0].firstFor = ['first_kiss'];
			addEvent(store, kissEvent);

			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.status).toBe('close');
		});

		it('computes intimate status from intimate milestone', () => {
			// First kiss
			const kissEvent = createNarrativeEvent(
				1,
				0,
				['intimate_kiss'],
				[['Alice', 'Bob']],
			);
			kissEvent.affectedPairs[0].firstFor = ['first_kiss'];
			addEvent(store, kissEvent);

			// Intimate event
			const intimateEvent = createNarrativeEvent(
				2,
				0,
				['intimate_penetrative'],
				[['Alice', 'Bob']],
			);
			intimateEvent.affectedPairs[0].firstFor = ['first_penetrative'];
			addEvent(store, intimateEvent);

			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.status).toBe('intimate');
		});

		it('aggregates directional changes from multiple events', () => {
			// Event with Alice's feeling change toward Bob
			const event1 = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event1.affectedPairs[0].changes = [
				{ from: 'Alice', toward: 'Bob', feeling: 'curious' },
			];
			addEvent(store, event1);

			// Event with Bob's feeling change toward Alice
			const event2 = createNarrativeEvent(
				2,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event2.affectedPairs[0].changes = [
				{ from: 'Bob', toward: 'Alice', feeling: 'interested' },
			];
			addEvent(store, event2);

			// Event with more changes
			const event3 = createNarrativeEvent(
				3,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event3.affectedPairs[0].changes = [
				{ from: 'Alice', toward: 'Bob', feeling: 'hopeful' },
				{ from: 'Bob', toward: 'Alice', feeling: 'attracted' },
			];
			addEvent(store, event3);

			const relationship = projectRelationship(store, ['Alice', 'Bob']);

			// Alice's feelings toward Bob
			expect(relationship.aToB.feelings).toContain('curious');
			expect(relationship.aToB.feelings).toContain('hopeful');

			// Bob's feelings toward Alice
			expect(relationship.bToA.feelings).toContain('interested');
			expect(relationship.bToA.feelings).toContain('attracted');
		});

		it('handles pair order normalization', () => {
			// Add event with pair in one order
			const event = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Bob', 'Alice']],
			);
			event.affectedPairs[0].firstFor = ['first_meeting'];
			addEvent(store, event);

			// Query with pair in opposite order
			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.status).toBe('acquaintances');
			expect(relationship.pair).toEqual(['Alice', 'Bob']); // Normalized
		});

		it('tracks milestone event IDs', () => {
			const event1 = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event1.affectedPairs[0].firstFor = ['first_meeting'];
			const id1 = addEvent(store, event1);

			const event2 = createNarrativeEvent(
				2,
				0,
				['intimate_kiss'],
				[['Alice', 'Bob']],
			);
			event2.affectedPairs[0].firstFor = ['first_kiss'];
			const id2 = addEvent(store, event2);

			const relationship = projectRelationship(store, ['Alice', 'Bob']);
			expect(relationship.milestoneEventIds).toContain(id1);
			expect(relationship.milestoneEventIds).toContain(id2);
		});
	});

	describe('computeMilestonesForPair', () => {
		let store: EventStore;

		beforeEach(() => {
			store = createEventStore();
		});

		it('returns empty array for pair with no milestones', () => {
			addEvent(
				store,
				createNarrativeEvent(1, 0, ['conversation'], [['Alice', 'Bob']]),
			);

			const milestones = computeMilestonesForPair(store, ['Alice', 'Bob']);
			expect(milestones).toHaveLength(0);
		});

		it('returns all milestones for a pair', () => {
			const event1 = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event1.affectedPairs[0].firstFor = ['first_meeting'];
			event1.affectedPairs[0].milestoneDescriptions = {
				first_meeting: 'They met at a coffee shop',
			};
			const id1 = addEvent(store, event1);

			const event2 = createNarrativeEvent(
				2,
				0,
				['intimate_kiss'],
				[['Alice', 'Bob']],
			);
			event2.affectedPairs[0].firstFor = ['first_kiss'];
			event2.affectedPairs[0].milestoneDescriptions = {
				first_kiss: 'A romantic first kiss',
			};
			const id2 = addEvent(store, event2);

			const milestones = computeMilestonesForPair(store, ['Alice', 'Bob']);

			expect(milestones).toHaveLength(2);
			expect(milestones).toContainEqual({
				type: 'first_meeting',
				eventId: id1,
				description: 'They met at a coffee shop',
			});
			expect(milestones).toContainEqual({
				type: 'first_kiss',
				eventId: id2,
				description: 'A romantic first kiss',
			});
		});

		it('handles multiple milestones from single event', () => {
			const event = createNarrativeEvent(
				1,
				0,
				['conversation', 'laugh'],
				[['Alice', 'Bob']],
			);
			event.affectedPairs[0].firstFor = ['first_meeting', 'first_laugh'];
			const id = addEvent(store, event);

			const milestones = computeMilestonesForPair(store, ['Alice', 'Bob']);

			expect(milestones).toHaveLength(2);
			expect(milestones.map(m => m.type)).toContain('first_meeting');
			expect(milestones.map(m => m.type)).toContain('first_laugh');
			expect(milestones.every(m => m.eventId === id)).toBe(true);
		});

		it('only returns milestones for specified pair', () => {
			// Event for Alice-Bob
			const event1 = createNarrativeEvent(
				1,
				0,
				['conversation'],
				[['Alice', 'Bob']],
			);
			event1.affectedPairs[0].firstFor = ['first_meeting'];
			addEvent(store, event1);

			// Event for Alice-Charlie
			const event2 = createNarrativeEvent(
				2,
				0,
				['conversation'],
				[['Alice', 'Charlie']],
			);
			event2.affectedPairs[0].firstFor = ['first_meeting'];
			addEvent(store, event2);

			const aliceBobMilestones = computeMilestonesForPair(store, [
				'Alice',
				'Bob',
			]);
			const aliceCharlieMilestones = computeMilestonesForPair(store, [
				'Alice',
				'Charlie',
			]);

			expect(aliceBobMilestones).toHaveLength(1);
			expect(aliceCharlieMilestones).toHaveLength(1);
		});
	});

	// ============================================
	// Phase 4: Projection Conversion Tests
	// ============================================

	describe('convertProjectionToTrackedState', () => {
		it('converts time correctly', () => {
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: null,
				characters: new Map(),
				relationships: new Map(),
			};

			const result = convertProjectionToTrackedState(projection);
			expect(result.time).toEqual(projection.time);
		});

		it('converts location correctly', () => {
			const projection: ProjectedState = {
				time: null,
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'By the window',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			const result = convertProjectionToTrackedState(projection);
			expect(result.location).toEqual(projection.location);
		});

		it('converts characters Map to array', () => {
			const projection: ProjectedState = {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'sitting',
							activity: 'reading',
							mood: ['happy', 'relaxed'],
							physicalState: ['healthy'],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: 'blue shirt',
								legs: 'jeans',
								underwear: null,
								socks: null,
								footwear: 'sneakers',
							},
						},
					],
					[
						'Bob',
						{
							name: 'Bob',
							position: 'standing',
							activity: 'waiting',
							mood: ['impatient'],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: 'leather jacket',
								back: null,
								torso: 't-shirt',
								legs: 'pants',
								underwear: null,
								socks: null,
								footwear: 'boots',
							},
						},
					],
				]),
				relationships: new Map(),
			};

			const result = convertProjectionToTrackedState(projection);
			expect(result.characters).toHaveLength(2);
			expect(result.characters?.find(c => c.name === 'Alice')).toBeDefined();
			expect(result.characters?.find(c => c.name === 'Bob')).toBeDefined();
		});

		it('omits empty physicalState', () => {
			const projection: ProjectedState = {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'sitting',
							activity: 'reading',
							mood: [],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: null,
								legs: null,
								underwear: null,
								socks: null,
								footwear: null,
							},
						},
					],
				]),
				relationships: new Map(),
			};

			const result = convertProjectionToTrackedState(projection);
			expect(result.characters?.[0].physicalState).toBeUndefined();
		});

		it('handles null time and location', () => {
			const projection: ProjectedState = {
				time: null,
				location: null,
				characters: new Map(),
				relationships: new Map(),
			};

			const result = convertProjectionToTrackedState(projection);
			expect(result.time).toBeUndefined();
			expect(result.location).toBeUndefined();
			expect(result.characters).toBeUndefined();
		});
	});

	describe('convertTrackedStateToProjection', () => {
		it('converts time correctly', () => {
			const tracked: Partial<TrackedState> = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			};

			const result = convertTrackedStateToProjection(tracked);
			expect(result.time).toEqual(tracked.time);
		});

		it('converts characters array to Map', () => {
			const emptyOutfit = {
				head: null,
				neck: null,
				jacket: null,
				back: null,
				torso: null,
				legs: null,
				footwear: null,
				socks: null,
				underwear: null,
			};
			const tracked: Partial<TrackedState> = {
				characters: [
					{
						name: 'Alice',
						position: 'sitting',
						activity: 'reading',
						mood: ['happy'],
						outfit: emptyOutfit,
					},
					{
						name: 'Bob',
						position: 'standing',
						activity: 'waiting',
						mood: [],
						outfit: emptyOutfit,
					},
				],
			};

			const result = convertTrackedStateToProjection(tracked);
			expect(result.characters.size).toBe(2);
			expect(result.characters.get('Alice')?.position).toBe('sitting');
			expect(result.characters.get('Bob')?.activity).toBe('waiting');
		});

		it('handles missing optional fields', () => {
			const tracked: Partial<TrackedState> = {};

			const result = convertTrackedStateToProjection(tracked);
			expect(result.time).toBeNull();
			expect(result.location).toBeNull();
			expect(result.characters.size).toBe(0);
		});
	});

	// ============================================
	// Phase 5: Swipe Handling Tests
	// ============================================

	describe('clearEventsForMessage', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('soft deletes state events for messageId', () => {
			// Add state events for different messages
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { hours: 1 },
			} as Omit<TimeEvent, 'id'>);

			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { hours: 2 },
			} as Omit<TimeEvent, 'id'>);

			// Clear message 1
			clearEventsForMessage(store, 1);

			// Message 1 events should be deleted
			const msg1Events = store.stateEvents.filter(
				e => e.messageId === 1 && !e.deleted,
			);
			expect(msg1Events).toHaveLength(0);

			// Message 2 events should remain
			const msg2Events = store.stateEvents.filter(
				e => e.messageId === 2 && !e.deleted,
			);
			expect(msg2Events).toHaveLength(1);
		});

		it('soft deletes narrative events for messageId', () => {
			// Add narrative events using the store directly
			store.narrativeEvents.push({
				id: 'ne1',
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Event 1',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'intimate',
				witnesses: [],
				location: 'Test',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [],
			});

			store.narrativeEvents.push({
				id: 'ne2',
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Event 2',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'intimate',
				witnesses: [],
				location: 'Test',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [],
			});

			// Clear message 1
			clearEventsForMessage(store, 1);

			// Message 1 events should be deleted
			const msg1Events = store.narrativeEvents.filter(
				e => e.messageId === 1 && !e.deleted,
			);
			expect(msg1Events).toHaveLength(0);

			// Message 2 events should remain
			const msg2Events = store.narrativeEvents.filter(
				e => e.messageId === 2 && !e.deleted,
			);
			expect(msg2Events).toHaveLength(1);
		});
	});

	describe('invalidateSnapshotsFrom', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
			store.chapterSnapshots = [
				{
					chapterIndex: 0,
					messageId: 10,
					swipeId: 0,
					projection: {
						time: null,
						location: null,
						characters: {},
						relationships: {},
					},
				},
				{
					chapterIndex: 1,
					messageId: 25,
					swipeId: 0,
					projection: {
						time: null,
						location: null,
						characters: {},
						relationships: {},
					},
				},
				{
					chapterIndex: 2,
					messageId: 40,
					swipeId: 0,
					projection: {
						time: null,
						location: null,
						characters: {},
						relationships: {},
					},
				},
			];
		});

		it('removes snapshots at or after messageId', () => {
			invalidateSnapshotsFrom(store, 25);

			expect(store.chapterSnapshots).toHaveLength(1);
			expect(store.chapterSnapshots![0].messageId).toBe(10);
		});

		it('keeps all snapshots if messageId is after all', () => {
			invalidateSnapshotsFrom(store, 100);

			expect(store.chapterSnapshots).toHaveLength(3);
		});

		it('removes all snapshots if messageId is before all', () => {
			invalidateSnapshotsFrom(store, 5);

			expect(store.chapterSnapshots).toHaveLength(0);
		});

		it('handles empty chapterSnapshots', () => {
			store.chapterSnapshots = [];
			invalidateSnapshotsFrom(store, 10);
			expect(store.chapterSnapshots).toHaveLength(0);
		});

		it('handles undefined chapterSnapshots', () => {
			store.chapterSnapshots = undefined;
			invalidateSnapshotsFrom(store, 10);
			expect(store.chapterSnapshots).toBeUndefined();
		});
	});

	describe('invalidateProjectionsFrom', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('sets projectionInvalidFrom', () => {
			invalidateProjectionsFrom(store, 10);
			expect(store.projectionInvalidFrom).toBe(10);
		});

		it('keeps lower messageId if already set', () => {
			invalidateProjectionsFrom(store, 20);
			invalidateProjectionsFrom(store, 10);
			expect(store.projectionInvalidFrom).toBe(10);
		});

		it('does not increase messageId if already lower', () => {
			invalidateProjectionsFrom(store, 10);
			invalidateProjectionsFrom(store, 20);
			expect(store.projectionInvalidFrom).toBe(10);
		});
	});

	// ============================================
	// Phase 6: Chapter Snapshots Tests
	// ============================================

	describe('saveChapterSnapshot', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('saves a snapshot for a chapter', () => {
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: {
					area: 'Downtown',
					place: 'Cafe',
					position: 'inside',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			saveChapterSnapshot(store, 0, 10, 0, projection);

			expect(store.chapterSnapshots).toHaveLength(1);
			expect(store.chapterSnapshots![0].chapterIndex).toBe(0);
			expect(store.chapterSnapshots![0].messageId).toBe(10);
		});

		it('replaces existing snapshot for same chapter', () => {
			const projection1: ProjectedState = {
				time: null,
				location: {
					area: 'Area1',
					place: 'Place1',
					position: 'pos1',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};
			const projection2: ProjectedState = {
				time: null,
				location: {
					area: 'Area2',
					place: 'Place2',
					position: 'pos2',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			saveChapterSnapshot(store, 0, 10, 0, projection1);
			saveChapterSnapshot(store, 0, 15, 0, projection2);

			expect(store.chapterSnapshots).toHaveLength(1);
			expect(store.chapterSnapshots![0].messageId).toBe(15);
		});

		it('allows multiple snapshots for different chapters', () => {
			const projection: ProjectedState = {
				time: null,
				location: null,
				characters: new Map(),
				relationships: new Map(),
			};

			saveChapterSnapshot(store, 0, 10, 0, projection);
			saveChapterSnapshot(store, 1, 25, 0, projection);
			saveChapterSnapshot(store, 2, 40, 0, projection);

			expect(store.chapterSnapshots).toHaveLength(3);
		});
	});

	describe('findChapterSnapshotBefore', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
			// Create projections and save snapshots
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: {
					area: 'Area',
					place: 'Place',
					position: 'pos',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			saveChapterSnapshot(store, 0, 10, 0, projection);
			saveChapterSnapshot(store, 1, 25, 0, projection);
			saveChapterSnapshot(store, 2, 40, 0, projection);
		});

		it('finds most recent snapshot before messageId', () => {
			const result = findChapterSnapshotBefore(store, 30);

			expect(result).not.toBeNull();
			expect(result!.messageId).toBe(25);
		});

		it('returns null if no snapshot before messageId', () => {
			const result = findChapterSnapshotBefore(store, 5);

			expect(result).toBeNull();
		});

		it('finds snapshot at exact boundary', () => {
			// Snapshot at message 25, querying for message 26 should find it
			const result = findChapterSnapshotBefore(store, 26);

			expect(result).not.toBeNull();
			expect(result!.messageId).toBe(25);
		});
	});

	describe('projectStateOptimized', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('uses chapter snapshot as starting point', () => {
			// Add initial time event
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			// Add time delta at message 5
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 2, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			// Save snapshot at message 10 (after the delta)
			const snapshotProjection = projectStateAtMessage(store, 10, 0, []);
			saveChapterSnapshot(store, 0, 10, 0, snapshotProjection);

			// Add another time delta at message 15
			addStateEvent(store, {
				messageId: 15,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 3, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			// Project at message 20 - should use snapshot at 10 as starting point
			const result = projectStateOptimized(store, 20, 0, []);

			// Initial 10:00 + 2 hours (msg 5) + 3 hours (msg 15) = 15:00
			expect(result.time?.hour).toBe(15);
		});

		it('falls back to full replay when no snapshot', () => {
			// Add initial time event
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			// Add time delta
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 2, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			// Project without any snapshots
			const result = projectStateOptimized(store, 10, 0, []);

			expect(result.time?.hour).toBe(12); // 10 + 2
		});

		it('matches projectStateAtMessage results', () => {
			// Add various events
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'location',
				subkind: 'moved',
				newArea: 'Downtown',
				newPlace: 'Cafe',
				newPosition: 'inside',
			} as Omit<LocationMovedEvent, 'id'>);

			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 2, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			// Both functions should return same result
			const optimized = projectStateOptimized(store, 10, 0, []);
			const standard = projectStateAtMessage(store, 10, 0, []);

			expect(optimized.time).toEqual(standard.time);
			expect(optimized.location).toEqual(standard.location);
		});
	});

	describe('initialProjection', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('returns null when no initial projection is set', () => {
			const result = getInitialProjection(store);
			expect(result).toBeNull();
		});

		it('stores and retrieves initial projection', () => {
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: {
					area: 'Downtown',
					place: 'Cafe',
					position: 'inside',
					props: ['table', 'chairs'],
				},
				characters: new Map<string, ProjectedCharacter>([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'sitting',
							activity: 'reading',
							mood: ['relaxed'],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: 'blouse',
								legs: 'jeans',
								underwear: null,
								socks: null,
								footwear: 'sneakers',
							},
						},
					],
				]),
				relationships: new Map(),
			};

			setInitialProjection(store, projection);
			const result = getInitialProjection(store);

			expect(result).not.toBeNull();
			expect(result!.time).toEqual(projection.time);
			expect(result!.location).toEqual(projection.location);
			expect(result!.characters.get('Alice')).toEqual(
				projection.characters.get('Alice'),
			);
		});

		it('projectStateAtMessage uses initial projection as base', () => {
			// Set initial projection with a character
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: {
					area: 'Downtown',
					place: 'Cafe',
					position: 'inside',
					props: [],
				},
				characters: new Map<string, ProjectedCharacter>([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'sitting',
							activity: 'reading',
							mood: ['relaxed'],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: 'blouse',
								legs: 'jeans',
								underwear: null,
								socks: null,
								footwear: 'sneakers',
							},
						},
					],
				]),
				relationships: new Map(),
			};

			setInitialProjection(store, projection);

			// Project at message 1 with no events - should return initial projection
			const result = projectStateAtMessage(store, 1, 0, []);

			expect(result.time).toEqual(projection.time);
			expect(result.location).toEqual(projection.location);
			expect(result.characters.size).toBe(1);
			expect(result.characters.get('Alice')).toEqual(
				projection.characters.get('Alice'),
			);
		});

		it('projectStateAtMessage applies events on top of initial projection', () => {
			// Set initial projection
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: {
					area: 'Downtown',
					place: 'Cafe',
					position: 'inside',
					props: [],
				},
				characters: new Map<string, ProjectedCharacter>([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'sitting',
							activity: 'reading',
							mood: ['relaxed'],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: 'blouse',
								legs: 'jeans',
								underwear: null,
								socks: null,
								footwear: 'sneakers',
							},
						},
					],
				]),
				relationships: new Map(),
			};

			setInitialProjection(store, projection);

			// Add a time delta event at message 2
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 2, minutes: 30 },
			} as Omit<TimeEvent, 'id'>);

			// Add a character entry event at message 2
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
				initialPosition: 'standing',
			} as Omit<CharacterEvent, 'id'>);

			// Project at message 3
			const result = projectStateAtMessage(store, 3, 0, []);

			// Time should be initial + delta (10:00 + 2:30 = 12:30)
			expect(result.time?.hour).toBe(12);
			expect(result.time?.minute).toBe(30);

			// Should have both Alice (from initial) and Bob (from event)
			expect(result.characters.size).toBe(2);
			expect(result.characters.has('Alice')).toBe(true);
			expect(result.characters.has('Bob')).toBe(true);
		});

		it('projectStateOptimized uses initial projection when no snapshots', () => {
			const projection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: null,
				characters: new Map<string, ProjectedCharacter>([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'standing',
							activity: 'waiting',
							mood: [],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: null,
								legs: null,
								underwear: null,
								socks: null,
								footwear: null,
							},
						},
					],
				]),
				relationships: new Map(),
			};

			setInitialProjection(store, projection);

			const result = projectStateOptimized(store, 5, 0, []);

			expect(result.characters.size).toBe(1);
			expect(result.characters.has('Alice')).toBe(true);
		});
	});

	describe('computeMilestonesForEvent', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('returns empty array when no event exists', () => {
			const result = computeMilestonesForEvent(store, 999);
			expect(result).toEqual([]);
		});

		it('returns milestones from event affectedPairs', () => {
			// Add a narrative event with milestones
			const event: NarrativeEvent = {
				id: generateUUID(),
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'First meeting',
				eventTypes: ['discovery'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Alice', 'Bob'],
				location: 'Cafe',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [
					{
						pair: ['Alice', 'Bob'] as [string, string],
						firstFor: ['first_meeting' as MilestoneType],
						milestoneDescriptions: {
							first_meeting:
								'Alice and Bob met for the first time at the cafe',
						},
					},
				],
			};

			store.narrativeEvents.push(event);

			const result = computeMilestonesForEvent(store, 5);

			expect(result).toHaveLength(1);
			expect(result[0].type).toBe('first_meeting');
			expect(result[0].pair).toEqual(['Alice', 'Bob']);
			expect(result[0].description).toBe(
				'Alice and Bob met for the first time at the cafe',
			);
		});

		it('returns multiple milestones from same event', () => {
			const event: NarrativeEvent = {
				id: generateUUID(),
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Romantic evening',
				eventTypes: ['date', 'intimate_kiss'],
				tensionLevel: 'charged',
				tensionType: 'intimate',
				witnesses: ['Alice', 'Bob'],
				location: 'Restaurant',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 20,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [
					{
						pair: ['Alice', 'Bob'] as [string, string],
						firstFor: [
							'first_kiss' as MilestoneType,
							'first_date' as MilestoneType,
						],
						milestoneDescriptions: {
							first_kiss: 'Their first kiss under the stars',
							first_date: 'A magical first date',
						},
					},
				],
			};

			store.narrativeEvents.push(event);

			const result = computeMilestonesForEvent(store, 5);

			expect(result).toHaveLength(2);
			expect(result.map(m => m.type)).toContain('first_kiss');
			expect(result.map(m => m.type)).toContain('first_date');
		});

		it('returns milestones from multiple pairs in same event', () => {
			const event: NarrativeEvent = {
				id: generateUUID(),
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Group meeting',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Alice', 'Bob', 'Charlie'],
				location: 'Office',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Monday',
				},
				affectedPairs: [
					{
						pair: ['Alice', 'Bob'] as [string, string],
						firstFor: ['first_meeting' as MilestoneType],
					},
					{
						pair: ['Alice', 'Charlie'] as [string, string],
						firstFor: ['first_meeting' as MilestoneType],
					},
				],
			};

			store.narrativeEvents.push(event);

			const result = computeMilestonesForEvent(store, 5);

			expect(result).toHaveLength(2);
			expect(
				result.find(m => m.pair[0] === 'Alice' && m.pair[1] === 'Bob'),
			).toBeDefined();
			expect(
				result.find(m => m.pair[0] === 'Alice' && m.pair[1] === 'Charlie'),
			).toBeDefined();
		});

		it('ignores deleted events', () => {
			const event: NarrativeEvent = {
				id: generateUUID(),
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Deleted event',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Alice', 'Bob'],
				location: 'Cafe',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [
					{
						pair: ['Alice', 'Bob'] as [string, string],
						firstFor: ['first_meeting' as MilestoneType],
					},
				],
				deleted: true,
			};

			store.narrativeEvents.push(event);

			const result = computeMilestonesForEvent(store, 5);

			expect(result).toHaveLength(0);
		});

		it('returns empty for event with no firstFor', () => {
			const event: NarrativeEvent = {
				id: generateUUID(),
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Normal event',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Alice', 'Bob'],
				location: 'Cafe',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [
					{
						pair: ['Alice', 'Bob'] as [string, string],
						// No firstFor
					},
				],
			};

			store.narrativeEvents.push(event);

			const result = computeMilestonesForEvent(store, 5);

			expect(result).toHaveLength(0);
		});
	});

	describe('getLastMessageWithEvents', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('returns -1 when no events exist', () => {
			const result = getLastMessageWithEvents(store);
			expect(result).toBe(-1);
		});

		it('returns the highest messageId from state events', () => {
			// Add state events at different messageIds
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 1, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			const result = getLastMessageWithEvents(store);
			expect(result).toBe(5);
		});

		it('returns the highest messageId from narrative events', () => {
			const event1: NarrativeEvent = {
				id: generateUUID(),
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Event 1',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Alice'],
				location: 'Cafe',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [],
			};

			const event2: NarrativeEvent = {
				id: generateUUID(),
				messageId: 7,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Event 2',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Bob'],
				location: 'Park',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 16,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [],
			};

			store.narrativeEvents.push(event1, event2);

			const result = getLastMessageWithEvents(store);
			expect(result).toBe(7);
		});

		it('returns the highest messageId across both state and narrative events', () => {
			// Add state event at messageId 4
			addStateEvent(store, {
				messageId: 4,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			// Add narrative event at messageId 6
			const event: NarrativeEvent = {
				id: generateUUID(),
				messageId: 6,
				swipeId: 0,
				timestamp: Date.now(),
				summary: 'Test event',
				eventTypes: ['conversation'],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: [],
				location: 'Test',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 14,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				affectedPairs: [],
			};
			store.narrativeEvents.push(event);

			const result = getLastMessageWithEvents(store);
			expect(result).toBe(6);
		});

		it('ignores deleted events', () => {
			// Add a state event
			addStateEvent(store, {
				messageId: 10,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time_initial',
				initialTime: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			} as Omit<InitialTimeEvent, 'id'>);

			// Add another state event at lower messageId
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'time',
				delta: { days: 0, hours: 1, minutes: 0 },
			} as Omit<TimeEvent, 'id'>);

			// Mark the higher one as deleted
			const higherEvent = store.stateEvents.find(e => e.messageId === 10);
			if (higherEvent) higherEvent.deleted = true;

			const result = getLastMessageWithEvents(store);
			expect(result).toBe(5);
		});
	});
});

describe('RelationshipEvent projection', () => {
	it('should apply feeling_added events', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'friendly',
						aToB: {
							feelings: ['curious'],
							secrets: [],
							wants: [],
						},
						bToA: {
							feelings: ['protective'],
							secrets: [],
							wants: [],
						},
					},
				],
			]),
		});

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'feeling_added',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'trusting',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.aToB.feelings).toContain('curious');
		expect(rel!.aToB.feelings).toContain('trusting');
		expect(rel!.bToA.feelings).toEqual(['protective']); // unchanged
	});

	it('should apply feeling_removed events', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'friendly',
						aToB: {
							feelings: ['curious', 'cautious'],
							secrets: [],
							wants: [],
						},
						bToA: {
							feelings: ['protective'],
							secrets: [],
							wants: [],
						},
					},
				],
			]),
		});

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'feeling_removed',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'cautious',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.aToB.feelings).toContain('curious');
		expect(rel!.aToB.feelings).not.toContain('cautious');
	});

	it('should apply secret_added events', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'friendly',
						aToB: { feelings: [], secrets: [], wants: [] },
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				],
			]),
		});

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'secret_added',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'knows about his secret identity',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.aToB.secrets).toContain('knows about his secret identity');
	});

	it('should apply want_added events', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'friendly',
						aToB: {
							feelings: [],
							secrets: [],
							wants: ['friendship'],
						},
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				],
			]),
		});

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'want_added',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'romantic relationship',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.aToB.wants).toContain('friendship');
		expect(rel!.aToB.wants).toContain('romantic relationship');
	});

	it('should apply status_changed events', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'friendly',
						aToB: { feelings: [], secrets: [], wants: [] },
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				],
			]),
		});

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'status_changed',
			pair: ['Alice', 'Bob'],
			newStatus: 'close',
			previousStatus: 'friendly',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.status).toBe('close');
	});

	it('should create new relationship when pair not in initial projection', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map(), // Empty
		});

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'feeling_added',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'curious',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.pair).toEqual(['Alice', 'Bob']);
		expect(rel!.status).toBe('strangers'); // Default status
		expect(rel!.aToB.feelings).toContain('curious');
	});

	it('should correctly identify direction based on character names', () => {
		const store = createUnifiedEventStore();
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'friendly',
						aToB: { feelings: [], secrets: [], wants: [] },
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				],
			]),
		});

		// Bob's feeling toward Alice (bToA)
		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'feeling_added',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Bob',
			towardCharacter: 'Alice',
			value: 'grateful',
		} as Omit<RelationshipEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		const rel = projection.relationships.get('alice|bob');
		expect(rel).toBeDefined();
		expect(rel!.bToA.feelings).toContain('grateful');
		expect(rel!.aToB.feelings).toEqual([]); // unchanged
	});
});

describe('generateStateEventsFromDiff', () => {
	describe('location events', () => {
		it('generates LocationMovedEvent with subkind "moved" for new location', () => {
			const events = generateStateEventsFromDiff(1, 0, null, {
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: [],
				},
			});

			const locationEvent = events.find(e => e.kind === 'location');
			expect(locationEvent).toBeDefined();
			expect(locationEvent!.kind).toBe('location');
			expect((locationEvent as LocationMovedEvent).subkind).toBe('moved');
			expect((locationEvent as LocationMovedEvent).newArea).toBe('Downtown');
			expect((locationEvent as LocationMovedEvent).newPlace).toBe('Coffee Shop');
			expect((locationEvent as LocationMovedEvent).newPosition).toBe(
				'by the window',
			);
			expect((locationEvent as LocationMovedEvent).previousArea).toBeUndefined();
		});

		it('generates LocationMovedEvent when area changes', () => {
			const prevProjection: ProjectedState = {
				time: null,
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(2, 0, prevProjection, {
				location: {
					area: 'Uptown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: [],
				},
			});

			const locationEvent = events.find(
				e => e.kind === 'location',
			) as LocationMovedEvent;
			expect(locationEvent).toBeDefined();
			expect(locationEvent.subkind).toBe('moved');
			expect(locationEvent.newArea).toBe('Uptown');
			expect(locationEvent.previousArea).toBe('Downtown');
		});

		it('generates LocationMovedEvent when place changes', () => {
			const prevProjection: ProjectedState = {
				time: null,
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(2, 0, prevProjection, {
				location: {
					area: 'Downtown',
					place: 'Restaurant',
					position: 'by the window',
					props: [],
				},
			});

			const locationEvent = events.find(
				e => e.kind === 'location',
			) as LocationMovedEvent;
			expect(locationEvent).toBeDefined();
			expect(locationEvent.subkind).toBe('moved');
			expect(locationEvent.newPlace).toBe('Restaurant');
			expect(locationEvent.previousPlace).toBe('Coffee Shop');
		});

		it('generates LocationMovedEvent when position changes', () => {
			const prevProjection: ProjectedState = {
				time: null,
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(2, 0, prevProjection, {
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'at the counter',
					props: [],
				},
			});

			const locationEvent = events.find(
				e => e.kind === 'location',
			) as LocationMovedEvent;
			expect(locationEvent).toBeDefined();
			expect(locationEvent.subkind).toBe('moved');
			expect(locationEvent.newPosition).toBe('at the counter');
			expect(locationEvent.previousPosition).toBe('by the window');
		});

		it('does not generate event when location is unchanged', () => {
			const prevProjection: ProjectedState = {
				time: null,
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: ['table', 'chairs'],
				},
				characters: new Map(),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(2, 0, prevProjection, {
				location: {
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'by the window',
					props: ['table', 'chairs', 'cup'], // props change but area/place/position same
				},
			});

			// No location event - props are handled separately by extractLocationProps
			const locationEvents = events.filter(e => e.kind === 'location');
			expect(locationEvents).toHaveLength(0);
		});
	});

	describe('time events', () => {
		it('generates InitialTimeEvent when no previous time', () => {
			const events = generateStateEventsFromDiff(0, 0, null, {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			});

			const timeEvent = events.find(
				e => e.kind === 'time_initial',
			) as InitialTimeEvent;
			expect(timeEvent).toBeDefined();
			expect(timeEvent.initialTime.year).toBe(2024);
			expect(timeEvent.initialTime.hour).toBe(10);
		});

		it('generates TimeEvent with delta when time changes', () => {
			const prevProjection: ProjectedState = {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10,
					minute: 0,
					second: 0,
					dayOfWeek: 'Saturday',
				},
				location: null,
				characters: new Map(),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(1, 0, prevProjection, {
				time: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 12,
					minute: 30,
					second: 0,
					dayOfWeek: 'Saturday',
				},
			});

			const timeEvent = events.find(e => e.kind === 'time') as TimeEvent;
			expect(timeEvent).toBeDefined();
			expect(timeEvent.delta.hours).toBe(2);
			expect(timeEvent.delta.minutes).toBe(30);
		});
	});

	describe('character events', () => {
		it('generates appeared event for new character', () => {
			const events = generateStateEventsFromDiff(1, 0, null, {
				characters: [
					{
						name: 'Alice',
						position: 'standing',
						mood: ['curious'],
					},
				],
			});

			const appearedEvent = events.find(
				e =>
					e.kind === 'character' &&
					(e as CharacterEvent).subkind === 'appeared',
			) as CharacterEvent;
			expect(appearedEvent).toBeDefined();
			expect(appearedEvent.character).toBe('Alice');
		});

		it('generates position_changed event when position differs', () => {
			const prevProjection: ProjectedState = {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'standing',
							mood: [],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: null,
								legs: null,
								underwear: null,
								socks: null,
								footwear: null,
							},
						},
					],
				]),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(2, 0, prevProjection, {
				characters: [
					{
						name: 'Alice',
						position: 'sitting',
						mood: [],
					},
				],
			});

			const positionEvent = events.find(
				e =>
					e.kind === 'character' &&
					(e as CharacterEvent).subkind === 'position_changed',
			) as CharacterEvent;
			expect(positionEvent).toBeDefined();
			expect(positionEvent.newValue).toBe('sitting');
			expect(positionEvent.previousValue).toBe('standing');
		});

		it('generates mood_added and mood_removed events', () => {
			const prevProjection: ProjectedState = {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'standing',
							mood: ['happy', 'excited'],
							physicalState: [],
							outfit: {
								head: null,
								neck: null,
								jacket: null,
								back: null,
								torso: null,
								legs: null,
								underwear: null,
								socks: null,
								footwear: null,
							},
						},
					],
				]),
				relationships: new Map(),
			};

			const events = generateStateEventsFromDiff(2, 0, prevProjection, {
				characters: [
					{
						name: 'Alice',
						position: 'standing',
						mood: ['happy', 'nervous'], // removed 'excited', added 'nervous'
					},
				],
			});

			const moodAdded = events.find(
				e =>
					e.kind === 'character' &&
					(e as CharacterEvent).subkind === 'mood_added' &&
					(e as CharacterEvent).mood === 'nervous',
			);
			const moodRemoved = events.find(
				e =>
					e.kind === 'character' &&
					(e as CharacterEvent).subkind === 'mood_removed' &&
					(e as CharacterEvent).mood === 'excited',
			);

			expect(moodAdded).toBeDefined();
			expect(moodRemoved).toBeDefined();
		});
	});
});

describe('Location prop event projection', () => {
	it('projects prop_added events onto location', () => {
		const store = createUnifiedEventStore();

		// Set initial location without props
		setInitialProjection(store, {
			time: null,
			location: {
				area: 'Downtown',
				place: 'Cafe',
				position: 'inside',
				props: [],
			},
			characters: new Map(),
			relationships: new Map(),
		});

		// Add prop_added event
		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'location',
			subkind: 'prop_added',
			prop: 'coffee cup',
		} as Omit<LocationPropEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		expect(projection.location?.props).toContain('coffee cup');
	});

	it('projects prop_removed events onto location', () => {
		const store = createUnifiedEventStore();

		// Set initial location with props
		setInitialProjection(store, {
			time: null,
			location: {
				area: 'Downtown',
				place: 'Cafe',
				position: 'inside',
				props: ['coffee cup', 'newspaper'],
			},
			characters: new Map(),
			relationships: new Map(),
		});

		// Add prop_removed event
		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'location',
			subkind: 'prop_removed',
			prop: 'coffee cup',
		} as Omit<LocationPropEvent, 'id'>);

		const projection = projectStateAtMessage(store, 1, 0, []);
		expect(projection.location?.props).not.toContain('coffee cup');
		expect(projection.location?.props).toContain('newspaper');
	});

	it('handles location move with separate prop events', () => {
		const store = createUnifiedEventStore();

		setInitialProjection(store, {
			time: null,
			location: {
				area: 'Downtown',
				place: 'Cafe',
				position: 'inside',
				props: ['table', 'chairs'],
			},
			characters: new Map(),
			relationships: new Map(),
		});

		// Move to new location
		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'location',
			subkind: 'moved',
			newArea: 'Uptown',
			newPlace: 'Park',
			newPosition: 'on a bench',
			previousArea: 'Downtown',
			previousPlace: 'Cafe',
			previousPosition: 'inside',
		} as Omit<LocationMovedEvent, 'id'>);

		// Props should be preserved from before the move
		const projection = projectStateAtMessage(store, 1, 0, []);
		expect(projection.location?.area).toBe('Uptown');
		expect(projection.location?.place).toBe('Park');
		expect(projection.location?.props).toEqual(['table', 'chairs']);

		// Now add new props
		addStateEvent(store, {
			messageId: 2,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'location',
			subkind: 'prop_added',
			prop: 'fountain',
		} as Omit<LocationPropEvent, 'id'>);

		const projection2 = projectStateAtMessage(store, 2, 0, []);
		expect(projection2.location?.props).toContain('fountain');
		expect(projection2.location?.props).toContain('table');
	});

	it('projects multiple prop events in sequence', () => {
		const store = createUnifiedEventStore();

		setInitialProjection(store, {
			time: null,
			location: {
				area: 'Room',
				place: 'Bedroom',
				position: 'center',
				props: [],
			},
			characters: new Map(),
			relationships: new Map(),
		});

		// Add multiple props
		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'location',
			subkind: 'prop_added',
			prop: 'bed',
		} as Omit<LocationPropEvent, 'id'>);

		addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now() + 1,
			kind: 'location',
			subkind: 'prop_added',
			prop: 'dresser',
		} as Omit<LocationPropEvent, 'id'>);

		addStateEvent(store, {
			messageId: 2,
			swipeId: 0,
			timestamp: Date.now() + 2,
			kind: 'location',
			subkind: 'prop_removed',
			prop: 'bed',
		} as Omit<LocationPropEvent, 'id'>);

		// At message 1, both props should be present
		const proj1 = projectStateAtMessage(store, 1, 0, []);
		expect(proj1.location?.props).toContain('bed');
		expect(proj1.location?.props).toContain('dresser');

		// At message 2, bed should be removed
		const proj2 = projectStateAtMessage(store, 2, 0, []);
		expect(proj2.location?.props).not.toContain('bed');
		expect(proj2.location?.props).toContain('dresser');
	});

	it('should not include props from soft-deleted events', () => {
		const store = createUnifiedEventStore();

		// Set initial projection with empty props
		setInitialProjection(store, {
			time: null,
			location: {
				area: 'Test Area',
				place: 'Test Place',
				position: 'center',
				props: [], // Start with NO props
			},
			characters: new Map(),
			relationships: new Map(),
		});

		// Add a prop_added event
		const propEventId = addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'location',
			subkind: 'prop_added',
			prop: 'deleted prop',
		} as Omit<LocationPropEvent, 'id'>);

		// Verify the prop appears in projection
		const projBefore = projectStateAtMessage(store, 1, 0, []);
		expect(projBefore.location?.props).toContain('deleted prop');

		// Soft delete the event
		const event = store.stateEvents.find(e => e.id === propEventId);
		expect(event).toBeDefined();
		event!.deleted = true;

		// Verify the prop is NO LONGER in projection
		const projAfter = projectStateAtMessage(store, 1, 0, []);
		expect(projAfter.location?.props).not.toContain('deleted prop');
	});

	it('should not include relationship data from soft-deleted events', () => {
		const store = createUnifiedEventStore();

		// Set initial projection with no relationship feelings
		setInitialProjection(store, {
			time: null,
			location: null,
			characters: new Map(),
			relationships: new Map([
				[
					'Alice|Bob',
					{
						pair: ['Alice', 'Bob'],
						status: 'strangers',
						aToB: { feelings: [], secrets: [], wants: [] },
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				],
			]),
		});

		// Add a feeling_added event
		const feelingEventId = addStateEvent(store, {
			messageId: 1,
			swipeId: 0,
			timestamp: Date.now(),
			kind: 'relationship',
			subkind: 'feeling_added',
			pair: ['Alice', 'Bob'],
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'deleted feeling',
		} as Omit<RelationshipEvent, 'id'>);

		// Verify the feeling appears in projection
		const projBefore = projectStateAtMessage(store, 1, 0, []);
		const relBefore = projBefore.relationships.get('alice|bob');
		expect(relBefore?.aToB.feelings).toContain('deleted feeling');

		// Soft delete the event
		const event = store.stateEvents.find(e => e.id === feelingEventId);
		expect(event).toBeDefined();
		event!.deleted = true;

		// Verify the feeling is NO LONGER in projection
		const projAfter = projectStateAtMessage(store, 1, 0, []);
		const relAfter = projAfter.relationships.get('alice|bob');
		expect(relAfter?.aToB.feelings).not.toContain('deleted feeling');
	});
});

// Helper function to create a narrative event for testing
function createNarrativeEvent(
	messageId: number,
	swipeId: number,
	eventTypes: EventType[],
	pairs: [string, string][],
): Omit<NarrativeEvent, 'id'> {
	return {
		messageId,
		swipeId,
		timestamp: Date.now() + messageId * 1000,
		summary: 'Test event',
		eventTypes,
		tensionLevel: 'relaxed',
		tensionType: 'intimate',
		witnesses: [],
		location: 'Test Location',
		narrativeTimestamp: {
			year: 2024,
			month: 6,
			day: 15,
			hour: 14,
			minute: 30,
			second: 0,
			dayOfWeek: 'Saturday',
		},
		affectedPairs: pairs.map(pair => ({
			pair,
		})),
	};
}

// Helper to create an empty outfit for tests
function createTestOutfit(): {
	head: null;
	neck: null;
	jacket: null;
	back: null;
	torso: null;
	legs: null;
	footwear: null;
	socks: null;
	underwear: null;
} {
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
	};
}

describe('Projection Immutability', () => {
	describe('initialProjection should never be mutated', () => {
		describe('LocationPropEvent', () => {
			it('adding a prop_added event does not modify initialProjection', () => {
				const store = createUnifiedEventStore();
				const initialProps = ['original prop'];

				setInitialProjection(store, {
					time: null,
					location: {
						area: 'Test Area',
						place: 'Test Place',
						position: 'center',
						props: initialProps,
					},
					characters: new Map(),
					relationships: new Map(),
				});

				// Capture initial state
				const initialProjection = getInitialProjection(store);
				const propsBeforeAdd = [...initialProjection!.location!.props];

				// Add a prop event
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'location',
					subkind: 'prop_added',
					prop: 'new prop',
				} as Omit<LocationPropEvent, 'id'>);

				// Project state (which should apply the event)
				const projected = projectStateAtMessage(store, 1, 0, []);

				// Verify the projected state has the new prop
				expect(projected.location?.props).toContain('new prop');
				expect(projected.location?.props).toContain('original prop');

				// Verify initialProjection was NOT mutated
				const propsAfterAdd = initialProjection!.location!.props;
				expect(propsAfterAdd).toEqual(propsBeforeAdd);
				expect(propsAfterAdd).not.toContain('new prop');
			});

			it('soft-deleting a prop_added event does not leave residue in initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: {
						area: 'Test Area',
						place: 'Test Place',
						position: 'center',
						props: [],
					},
					characters: new Map(),
					relationships: new Map(),
				});

				const initialProjection = getInitialProjection(store);
				const propsBeforeAdd = [...initialProjection!.location!.props];

				// Add and then soft-delete a prop event
				const eventId = addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'location',
					subkind: 'prop_added',
					prop: 'temporary prop',
				} as Omit<LocationPropEvent, 'id'>);

				// Project to apply the event
				projectStateAtMessage(store, 1, 0, []);

				// Soft delete
				const event = store.stateEvents.find(e => e.id === eventId);
				event!.deleted = true;

				// Verify initialProjection was NOT mutated
				expect(initialProjection!.location!.props).toEqual(propsBeforeAdd);
			});
		});

		describe('CharacterEvent', () => {
			it('adding a mood_added event does not modify initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map([
						[
							'Alice',
							{
								name: 'Alice',
								position: 'standing',
								mood: ['happy'],
								physicalState: [],
								outfit: createTestOutfit(),
							},
						],
					]),
					relationships: new Map(),
				});

				const initialProjection = getInitialProjection(store);
				const moodsBefore = [
					...initialProjection!.characters.get('Alice')!.mood,
				];

				// Add a mood event
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'mood_added',
					character: 'Alice',
					mood: 'excited',
				} as Omit<CharacterEvent, 'id'>);

				// Project state
				const projected = projectStateAtMessage(store, 1, 0, []);

				// Verify the projected state has the new mood
				expect(projected.characters.get('Alice')?.mood).toContain(
					'excited',
				);
				expect(projected.characters.get('Alice')?.mood).toContain('happy');

				// Verify initialProjection was NOT mutated
				expect(initialProjection!.characters.get('Alice')!.mood).toEqual(
					moodsBefore,
				);
				expect(
					initialProjection!.characters.get('Alice')!.mood,
				).not.toContain('excited');
			});

			it('adding a physical_state_added event does not modify initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map([
						[
							'Bob',
							{
								name: 'Bob',
								position: 'sitting',
								mood: [],
								physicalState: ['tired'],
								outfit: createTestOutfit(),
							},
						],
					]),
					relationships: new Map(),
				});

				const initialProjection = getInitialProjection(store);
				const physicalBefore = [
					...initialProjection!.characters.get('Bob')!.physicalState,
				];

				// Add a physical state event
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'physical_state_added',
					character: 'Bob',
					physicalState: 'injured',
				} as Omit<CharacterEvent, 'id'>);

				// Project state
				const projected = projectStateAtMessage(store, 1, 0, []);

				// Verify the projected state has the new physical state
				expect(projected.characters.get('Bob')?.physicalState).toContain(
					'injured',
				);

				// Verify initialProjection was NOT mutated
				expect(
					initialProjection!.characters.get('Bob')!.physicalState,
				).toEqual(physicalBefore);
				expect(
					initialProjection!.characters.get('Bob')!.physicalState,
				).not.toContain('injured');
			});

			it('soft-deleting a mood_added event does not leave residue in initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map([
						[
							'Alice',
							{
								name: 'Alice',
								position: 'standing',
								mood: [],
								physicalState: [],
								outfit: createTestOutfit(),
							},
						],
					]),
					relationships: new Map(),
				});

				const initialProjection = getInitialProjection(store);
				const moodsBefore = [
					...initialProjection!.characters.get('Alice')!.mood,
				];

				// Add and then soft-delete a mood event
				const eventId = addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'mood_added',
					character: 'Alice',
					mood: 'temporary mood',
				} as Omit<CharacterEvent, 'id'>);

				// Project to apply the event
				projectStateAtMessage(store, 1, 0, []);

				// Soft delete
				const event = store.stateEvents.find(e => e.id === eventId);
				event!.deleted = true;

				// Verify initialProjection was NOT mutated
				expect(initialProjection!.characters.get('Alice')!.mood).toEqual(
					moodsBefore,
				);
			});
		});

		describe('RelationshipEvent', () => {
			it('adding a feeling_added event does not modify initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map(),
					relationships: new Map([
						[
							'Alice|Bob',
							{
								pair: ['Alice', 'Bob'],
								status: 'strangers',
								aToB: {
									feelings: ['curious'],
									secrets: [],
									wants: [],
								},
								bToA: {
									feelings: [],
									secrets: [],
									wants: [],
								},
							},
						],
					]),
				});

				const initialProjection = getInitialProjection(store);
				const feelingsBefore = [
					...initialProjection!.relationships.get('alice|bob')!.aToB
						.feelings,
				];

				// Add a feeling event
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'feeling_added',
					pair: ['Alice', 'Bob'],
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'attracted',
				} as Omit<RelationshipEvent, 'id'>);

				// Project state
				const projected = projectStateAtMessage(store, 1, 0, []);

				// Verify the projected state has the new feeling
				expect(
					projected.relationships.get('alice|bob')?.aToB.feelings,
				).toContain('attracted');
				expect(
					projected.relationships.get('alice|bob')?.aToB.feelings,
				).toContain('curious');

				// Verify initialProjection was NOT mutated
				expect(
					initialProjection!.relationships.get('alice|bob')!.aToB
						.feelings,
				).toEqual(feelingsBefore);
				expect(
					initialProjection!.relationships.get('alice|bob')!.aToB
						.feelings,
				).not.toContain('attracted');
			});

			it('adding a secret_added event does not modify initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map(),
					relationships: new Map([
						[
							'Alice|Bob',
							{
								pair: ['Alice', 'Bob'],
								status: 'friendly',
								aToB: {
									feelings: [],
									secrets: ['has a crush'],
									wants: [],
								},
								bToA: {
									feelings: [],
									secrets: [],
									wants: [],
								},
							},
						],
					]),
				});

				const initialProjection = getInitialProjection(store);
				const secretsBefore = [
					...initialProjection!.relationships.get('alice|bob')!.aToB
						.secrets,
				];

				// Add a secret event
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'secret_added',
					pair: ['Alice', 'Bob'],
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'planning surprise party',
				} as Omit<RelationshipEvent, 'id'>);

				// Project state
				const projected = projectStateAtMessage(store, 1, 0, []);

				// Verify the projected state has the new secret
				expect(
					projected.relationships.get('alice|bob')?.aToB.secrets,
				).toContain('planning surprise party');

				// Verify initialProjection was NOT mutated
				expect(
					initialProjection!.relationships.get('alice|bob')!.aToB
						.secrets,
				).toEqual(secretsBefore);
				expect(
					initialProjection!.relationships.get('alice|bob')!.aToB
						.secrets,
				).not.toContain('planning surprise party');
			});

			it('adding a want_added event does not modify initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map(),
					relationships: new Map([
						[
							'Alice|Bob',
							{
								pair: ['Alice', 'Bob'],
								status: 'friendly',
								aToB: {
									feelings: [],
									secrets: [],
									wants: [
										'spend time together',
									],
								},
								bToA: {
									feelings: [],
									secrets: [],
									wants: [],
								},
							},
						],
					]),
				});

				const initialProjection = getInitialProjection(store);
				const wantsBefore = [
					...initialProjection!.relationships.get('alice|bob')!.aToB
						.wants,
				];

				// Add a want event
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'want_added',
					pair: ['Alice', 'Bob'],
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'confess feelings',
				} as Omit<RelationshipEvent, 'id'>);

				// Project state
				const projected = projectStateAtMessage(store, 1, 0, []);

				// Verify the projected state has the new want
				expect(
					projected.relationships.get('alice|bob')?.aToB.wants,
				).toContain('confess feelings');

				// Verify initialProjection was NOT mutated
				expect(
					initialProjection!.relationships.get('alice|bob')!.aToB
						.wants,
				).toEqual(wantsBefore);
				expect(
					initialProjection!.relationships.get('alice|bob')!.aToB
						.wants,
				).not.toContain('confess feelings');
			});

			it('soft-deleting relationship events does not leave residue in initialProjection', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: null,
					characters: new Map(),
					relationships: new Map([
						[
							'Alice|Bob',
							{
								pair: ['Alice', 'Bob'],
								status: 'strangers',
								aToB: {
									feelings: [],
									secrets: [],
									wants: [],
								},
								bToA: {
									feelings: [],
									secrets: [],
									wants: [],
								},
							},
						],
					]),
				});

				const initialProjection = getInitialProjection(store);
				const attitudeBefore = {
					feelings: [
						...initialProjection!.relationships.get(
							'alice|bob',
						)!.aToB.feelings,
					],
					secrets: [
						...initialProjection!.relationships.get(
							'alice|bob',
						)!.aToB.secrets,
					],
					wants: [
						...initialProjection!.relationships.get(
							'alice|bob',
						)!.aToB.wants,
					],
				};

				// Add feeling, secret, and want events
				const feelingId = addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'feeling_added',
					pair: ['Alice', 'Bob'],
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'temp feeling',
				} as Omit<RelationshipEvent, 'id'>);

				const secretId = addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'relationship',
					subkind: 'secret_added',
					pair: ['Alice', 'Bob'],
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'temp secret',
				} as Omit<RelationshipEvent, 'id'>);

				const wantId = addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 2,
					kind: 'relationship',
					subkind: 'want_added',
					pair: ['Alice', 'Bob'],
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'temp want',
				} as Omit<RelationshipEvent, 'id'>);

				// Project to apply events
				projectStateAtMessage(store, 1, 0, []);

				// Soft delete all
				store.stateEvents.find(e => e.id === feelingId)!.deleted = true;
				store.stateEvents.find(e => e.id === secretId)!.deleted = true;
				store.stateEvents.find(e => e.id === wantId)!.deleted = true;

				// Verify initialProjection was NOT mutated
				const rel = initialProjection!.relationships.get('alice|bob')!;
				expect(rel.aToB.feelings).toEqual(attitudeBefore.feelings);
				expect(rel.aToB.secrets).toEqual(attitudeBefore.secrets);
				expect(rel.aToB.wants).toEqual(attitudeBefore.wants);
			});
		});

		describe('Multiple projections from same initialProjection', () => {
			it('projecting multiple messages does not accumulate mutations', () => {
				const store = createUnifiedEventStore();

				setInitialProjection(store, {
					time: null,
					location: {
						area: 'Area',
						place: 'Place',
						position: 'Position',
						props: [],
					},
					characters: new Map([
						[
							'Alice',
							{
								name: 'Alice',
								position: 'standing',
								mood: [],
								physicalState: [],
								outfit: createTestOutfit(),
							},
						],
					]),
					relationships: new Map([
						[
							'Alice|Bob',
							{
								pair: ['Alice', 'Bob'],
								status: 'strangers',
								aToB: {
									feelings: [],
									secrets: [],
									wants: [],
								},
								bToA: {
									feelings: [],
									secrets: [],
									wants: [],
								},
							},
						],
					]),
				});

				const initialProjection = getInitialProjection(store);

				// Add events across multiple messages
				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'location',
					subkind: 'prop_added',
					prop: 'prop1',
				} as Omit<LocationPropEvent, 'id'>);

				addStateEvent(store, {
					messageId: 2,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'location',
					subkind: 'prop_added',
					prop: 'prop2',
				} as Omit<LocationPropEvent, 'id'>);

				addStateEvent(store, {
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'mood_added',
					character: 'Alice',
					mood: 'mood1',
				} as Omit<CharacterEvent, 'id'>);

				addStateEvent(store, {
					messageId: 2,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'character',
					subkind: 'mood_added',
					character: 'Alice',
					mood: 'mood2',
				} as Omit<CharacterEvent, 'id'>);

				// Project multiple times from different messages
				const proj1 = projectStateAtMessage(store, 1, 0, []);
				const proj2 = projectStateAtMessage(store, 2, 0, []);
				const proj1Again = projectStateAtMessage(store, 1, 0, []);

				// Each projection should be independent
				expect(proj1.location?.props).toEqual(['prop1']);
				expect(proj2.location?.props).toEqual(['prop1', 'prop2']);
				expect(proj1Again.location?.props).toEqual(['prop1']);

				expect(proj1.characters.get('Alice')?.mood).toEqual(['mood1']);
				expect(proj2.characters.get('Alice')?.mood).toEqual([
					'mood1',
					'mood2',
				]);
				expect(proj1Again.characters.get('Alice')?.mood).toEqual(['mood1']);

				// initialProjection should still be empty
				expect(initialProjection!.location?.props).toEqual([]);
				expect(initialProjection!.characters.get('Alice')?.mood).toEqual(
					[],
				);
			});
		});
	});

	describe('Chapter snapshots should not be mutated', () => {
		it('projecting from chapter snapshot does not mutate the snapshot', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Area',
					place: 'Place',
					position: 'Position',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			// Save a chapter snapshot at message 5 (chapterIndex=0, messageId=5, swipeId=0)
			saveChapterSnapshot(store, 0, 5, 0, {
				time: null,
				location: {
					area: 'Chapter Area',
					place: 'Chapter Place',
					position: 'Chapter Position',
					props: ['snapshot prop'],
				},
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'sitting',
							mood: ['snapshot mood'],
							physicalState: [],
							outfit: createTestOutfit(),
						},
					],
				]),
				relationships: new Map([
					[
						'Alice|Bob',
						{
							pair: ['Alice', 'Bob'],
							status: 'friendly',
							aToB: {
								feelings: ['snapshot feeling'],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				]),
			});

			// Get the snapshot
			const snapshot = findChapterSnapshotBefore(store, 10);
			expect(snapshot).toBeDefined();

			const propsBefore = [...snapshot!.snapshot.location!.props];
			const moodsBefore = [...snapshot!.snapshot.characters.get('Alice')!.mood];
			const feelingsBefore = [
				...snapshot!.snapshot.relationships.get('alice|bob')!.aToB.feelings,
			];

			// Add events after the snapshot
			addStateEvent(store, {
				messageId: 6,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'location',
				subkind: 'prop_added',
				prop: 'new prop',
			} as Omit<LocationPropEvent, 'id'>);

			addStateEvent(store, {
				messageId: 6,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'mood_added',
				character: 'Alice',
				mood: 'new mood',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 6,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				pair: ['Alice', 'Bob'],
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'new feeling',
			} as Omit<RelationshipEvent, 'id'>);

			// Project using the optimized method (which uses snapshots)
			const projected = projectStateOptimized(store, 6, 0, []);

			// Verify projection has new data
			expect(projected.location?.props).toContain('new prop');
			expect(projected.characters.get('Alice')?.mood).toContain('new mood');
			expect(projected.relationships.get('alice|bob')?.aToB.feelings).toContain(
				'new feeling',
			);

			// Verify snapshot was NOT mutated
			expect(snapshot!.snapshot.location!.props).toEqual(propsBefore);
			expect(snapshot!.snapshot.characters.get('Alice')!.mood).toEqual(
				moodsBefore,
			);
			expect(
				snapshot!.snapshot.relationships.get('alice|bob')!.aToB.feelings,
			).toEqual(feelingsBefore);
		});
	});

	describe('Projection invalidation', () => {
		it('adding an event invalidates later cached projections', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Area',
					place: 'Place',
					position: 'Position',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			// Pre-cache projections by projecting
			projectStateOptimized(store, 5, 0, []);
			projectStateOptimized(store, 10, 0, []);

			// Add an event at message 3
			addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'location',
				subkind: 'prop_added',
				prop: 'late prop',
			} as Omit<LocationPropEvent, 'id'>);

			// Invalidate projections from message 3
			invalidateProjectionsFrom(store, 3);

			// Re-project - should reflect the new event
			const proj5 = projectStateOptimized(store, 5, 0, []);
			const proj10 = projectStateOptimized(store, 10, 0, []);

			expect(proj5.location?.props).toContain('late prop');
			expect(proj10.location?.props).toContain('late prop');
		});

		it('soft-deleting an event and invalidating updates projections', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Area',
					place: 'Place',
					position: 'Position',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			// Add event
			const eventId = addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'location',
				subkind: 'prop_added',
				prop: 'deletable prop',
			} as Omit<LocationPropEvent, 'id'>);

			// Project to cache
			const projBefore = projectStateOptimized(store, 5, 0, []);
			expect(projBefore.location?.props).toContain('deletable prop');

			// Soft delete
			const event = store.stateEvents.find(e => e.id === eventId);
			event!.deleted = true;

			// Invalidate and re-project
			invalidateProjectionsFrom(store, 3);
			const projAfter = projectStateOptimized(store, 5, 0, []);

			expect(projAfter.location?.props).not.toContain('deletable prop');
		});

		it('editing an event value and invalidating updates projections', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Area',
					place: 'Place',
					position: 'Position',
					props: [],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			// Add event
			const eventId = addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'location',
				subkind: 'prop_added',
				prop: 'original prop',
			} as Omit<LocationPropEvent, 'id'>);

			// Project to cache
			const projBefore = projectStateOptimized(store, 5, 0, []);
			expect(projBefore.location?.props).toContain('original prop');

			// Edit the event's prop value
			const event = store.stateEvents.find(
				e => e.id === eventId,
			) as LocationPropEvent;
			event.prop = 'edited prop';

			// Invalidate and re-project
			invalidateProjectionsFrom(store, 3);
			const projAfter = projectStateOptimized(store, 5, 0, []);

			expect(projAfter.location?.props).not.toContain('original prop');
			expect(projAfter.location?.props).toContain('edited prop');
		});
	});
});

describe('Event Deduplication', () => {
	describe('LocationPropEvent deduplication', () => {
		it('filters out prop_added if prop already exists in projection', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Test Area',
					place: 'Test Place',
					position: 'center',
					props: ['existing prop'],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			const events: Omit<LocationPropEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'location',
					subkind: 'prop_added',
					prop: 'existing prop', // Should be filtered (already exists)
				},
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'location',
					subkind: 'prop_added',
					prop: 'new prop', // Should be kept
				},
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as LocationPropEvent).prop).toBe('new prop');
		});

		it('filters out prop_removed if prop does not exist in projection', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Test Area',
					place: 'Test Place',
					position: 'center',
					props: ['chair'],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			const events: Omit<LocationPropEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'location',
					subkind: 'prop_removed',
					prop: 'nonexistent', // Should be filtered (doesn't exist)
				},
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'location',
					subkind: 'prop_removed',
					prop: 'chair', // Should be kept
				},
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as LocationPropEvent).prop).toBe('chair');
		});
	});

	describe('CharacterEvent deduplication', () => {
		it('filters out mood_added if mood already exists', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'standing',
							mood: ['happy'],
							physicalState: [],
							outfit: createTestOutfit(),
						},
					],
				]),
				relationships: new Map(),
			});

			const events: Omit<CharacterEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'mood_added',
					character: 'Alice',
					mood: 'happy', // Should be filtered (already exists)
				},
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'character',
					subkind: 'mood_added',
					character: 'Alice',
					mood: 'excited', // Should be kept
				},
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as CharacterEvent).mood).toBe('excited');
		});

		it('filters out position_changed if position matches projection', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map([
					[
						'Bob',
						{
							name: 'Bob',
							position: 'sitting',
							mood: [],
							physicalState: [],
							outfit: createTestOutfit(),
						},
					],
				]),
				relationships: new Map(),
			});

			const events: Omit<CharacterEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'position_changed',
					character: 'Bob',
					newValue: 'sitting', // Should be filtered (same as projection)
				},
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'character',
					subkind: 'position_changed',
					character: 'Bob',
					newValue: 'standing', // Should be kept
				},
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as CharacterEvent).newValue).toBe('standing');
		});

		it('updates previousValue for outfit_changed to match projection', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'standing',
							mood: [],
							physicalState: [],
							outfit: {
								...createTestOutfit(),
								legs: 'blue jeans',
							},
						},
					],
				]),
				relationships: new Map(),
			});

			const events: Omit<CharacterEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'outfit_changed',
					character: 'Alice',
					slot: 'legs',
					previousValue: 'jeans', // Wrong - doesn't match projection
					newValue: 'skirt',
				},
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			// The previousValue should be updated to match the projection
			expect((deduped[0] as CharacterEvent).previousValue).toBe('blue jeans');
			expect((deduped[0] as CharacterEvent).newValue).toBe('skirt');
		});

		it('filters out outfit_changed if newValue matches projection', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map([
					[
						'Alice',
						{
							name: 'Alice',
							position: 'standing',
							mood: [],
							physicalState: [],
							outfit: {
								...createTestOutfit(),
								torso: 't-shirt',
							},
						},
					],
				]),
				relationships: new Map(),
			});

			const events: Omit<CharacterEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'character',
					subkind: 'outfit_changed',
					character: 'Alice',
					slot: 'torso',
					previousValue: 'blouse',
					newValue: 't-shirt', // Should be filtered (same as projection)
				},
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(0);
		});
	});

	describe('RelationshipEvent deduplication', () => {
		it('filters out feeling_added if feeling already exists', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map(),
				relationships: new Map([
					[
						'Alice|Bob',
						{
							pair: ['Alice', 'Bob'],
							status: 'strangers',
							aToB: {
								feelings: ['curious'],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				]),
			});

			const events: Omit<RelationshipEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'feeling_added',
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'curious', // Should be filtered (already exists)
				} as Omit<DirectionalRelationshipEvent, 'id'>,
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'relationship',
					subkind: 'feeling_added',
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'attracted', // Should be kept
				} as Omit<DirectionalRelationshipEvent, 'id'>,
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as DirectionalRelationshipEvent).value).toBe(
				'attracted',
			);
		});

		it('filters out status_changed if status matches projection', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map(),
				relationships: new Map([
					[
						'Alice|Bob',
						{
							pair: ['Alice', 'Bob'],
							status: 'friendly',
							aToB: {
								feelings: [],
								secrets: [],
								wants: [],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				]),
			});

			const events: Omit<RelationshipEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'status_changed',
					pair: ['Alice', 'Bob'],
					newStatus: 'friendly', // Should be filtered (same as projection)
				} as Omit<StatusChangedEvent, 'id'>,
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'relationship',
					subkind: 'status_changed',
					pair: ['Alice', 'Bob'],
					newStatus: 'close', // Should be kept
				} as Omit<StatusChangedEvent, 'id'>,
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as StatusChangedEvent).newStatus).toBe('close');
		});

		it('filters out want_removed if want does not exist', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: null,
				characters: new Map(),
				relationships: new Map([
					[
						'Alice|Bob',
						{
							pair: ['Alice', 'Bob'],
							status: 'strangers',
							aToB: {
								feelings: [],
								secrets: [],
								wants: ['spend time'],
							},
							bToA: {
								feelings: [],
								secrets: [],
								wants: [],
							},
						},
					],
				]),
			});

			const events: Omit<RelationshipEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'relationship',
					subkind: 'want_removed',
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'nonexistent', // Should be filtered (doesn't exist)
				} as Omit<DirectionalRelationshipEvent, 'id'>,
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'relationship',
					subkind: 'want_removed',
					fromCharacter: 'Alice',
					towardCharacter: 'Bob',
					value: 'spend time', // Should be kept
				} as Omit<DirectionalRelationshipEvent, 'id'>,
			];

			const deduped = deduplicateEvents(store, 1, 0, events, []);

			expect(deduped).toHaveLength(1);
			expect((deduped[0] as DirectionalRelationshipEvent).value).toBe(
				'spend time',
			);
		});
	});

	describe('replaceStateEventsForMessage with deduplication', () => {
		it('automatically deduplicates events when replacing', () => {
			const store = createUnifiedEventStore();

			setInitialProjection(store, {
				time: null,
				location: {
					area: 'Test Area',
					place: 'Test Place',
					position: 'center',
					props: ['existing prop'],
				},
				characters: new Map(),
				relationships: new Map(),
			});

			const newEvents: Omit<LocationPropEvent, 'id'>[] = [
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now(),
					kind: 'location',
					subkind: 'prop_added',
					prop: 'existing prop', // Should be filtered
				},
				{
					messageId: 1,
					swipeId: 0,
					timestamp: Date.now() + 1,
					kind: 'location',
					subkind: 'prop_added',
					prop: 'new prop', // Should be kept
				},
			];

			const ids = replaceStateEventsForMessage(store, 1, 0, newEvents, []);

			// Only one event should be added
			expect(ids).toHaveLength(1);

			// Verify the projection shows both props (one from initial, one from event)
			const projection = projectStateAtMessage(store, 1, 0, []);
			expect(projection.location?.props).toContain('existing prop');
			expect(projection.location?.props).toContain('new prop');
			expect(projection.location?.props).toHaveLength(2);
		});
	});
});

// ============================================
// Milestone Management Tests - Event Type Editing
// ============================================

describe('milestone management when editing event types', () => {
	let store: EventStore;

	// Helper to create a narrative event with specific event types and pairs
	function createTestEvent(
		messageId: number,
		eventTypes: EventType[],
		pairs: [string, string][],
		firstFor?: Record<string, MilestoneType[]>,
		milestoneDescriptions?: Record<string, Partial<Record<MilestoneType, string>>>,
	): Omit<NarrativeEvent, 'id'> {
		return {
			messageId,
			swipeId: 0,
			timestamp: Date.now() + messageId * 1000,
			summary: `Test event at message ${messageId}`,
			eventTypes,
			tensionLevel: 'relaxed',
			tensionType: 'intimate',
			witnesses: [],
			location: 'Test Location',
			narrativeTimestamp: {
				year: 2024,
				month: 6,
				day: 15 + messageId,
				hour: 14,
				minute: 30,
				second: 0,
				dayOfWeek: 'Saturday',
			},
			affectedPairs: pairs.map(pair => {
				const key = pairKey(pair);
				return {
					pair,
					firstFor: firstFor?.[key],
					milestoneDescriptions: milestoneDescriptions?.[key],
				};
			}),
		};
	}

	beforeEach(() => {
		store = createEventStore();
	});

	describe('removing milestone types from event_types', () => {
		it('removes milestone when event type is removed', () => {
			// Create an event with intimate_kiss that has first_kiss milestone
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);
			const event = createTestEvent(
				1,
				['intimate_kiss', 'conversation'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
				{ [keyAB]: { first_kiss: 'Their first kiss at the park' } },
			);
			const eventId = addEvent(store, event);

			// Verify milestone exists initially
			let milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].type).toBe('first_kiss');
			expect(milestones[0].description).toBe('Their first kiss at the park');

			// Remove intimate_kiss from event types
			updateNarrativeEvent(store, eventId, {
				eventTypes: ['conversation'],
			});

			// Recompute milestones
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone is removed
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(0);

			// Verify projection reflects the change
			const relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toHaveLength(0);
		});

		it('removes only the specific milestone type while leaving others intact', () => {
			// Create an event with both intimate_kiss and laugh (first_kiss and first_laugh)
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);
			const event = createTestEvent(
				1,
				['intimate_kiss', 'laugh'],
				[pairAB],
				{ [keyAB]: ['first_kiss', 'first_laugh'] },
				{
					[keyAB]: {
						first_kiss: 'Their first kiss',
						first_laugh: 'They laughed together',
					},
				},
			);
			const eventId = addEvent(store, event);

			// Verify both milestones exist initially
			let milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(2);
			expect(milestones.map(m => m.type)).toContain('first_kiss');
			expect(milestones.map(m => m.type)).toContain('first_laugh');

			// Remove only intimate_kiss, keep laugh
			updateNarrativeEvent(store, eventId, {
				eventTypes: ['laugh'],
			});

			// Recompute milestones
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify only first_kiss is removed, first_laugh remains
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].type).toBe('first_laugh');
			expect(milestones[0].description).toBe('They laughed together');

			// Verify projection
			const relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toHaveLength(1);
		});

		it('moves milestone to later event when removed from earlier event', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create first event with intimate_kiss and first_kiss milestone
			const event1 = createTestEvent(
				1,
				['intimate_kiss', 'conversation'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
				{ [keyAB]: { first_kiss: 'First kiss at message 1' } },
			);
			const eventId1 = addEvent(store, event1);

			// Create second event also with intimate_kiss (but no milestone yet since first already has it)
			const event2 = createTestEvent(2, ['intimate_kiss'], [pairAB]);
			const eventId2 = addEvent(store, event2);

			// Verify only first event has the milestone
			let milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].eventId).toBe(eventId1);

			// Remove intimate_kiss from first event
			updateNarrativeEvent(store, eventId1, {
				eventTypes: ['conversation'],
			});

			// Recompute milestones - this should move the milestone to event2
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone moved to second event
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].type).toBe('first_kiss');
			expect(milestones[0].eventId).toBe(eventId2);

			// The new event should have the milestone in its firstFor
			const updatedEvent2 = getEvent(store, eventId2);
			expect(updatedEvent2?.affectedPairs[0].firstFor).toContain('first_kiss');

			// Verify projection includes the milestone at the new event's date
			const relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId2);
			expect(relationship.milestoneEventIds).not.toContain(eventId1);
		});
	});

	describe('adding milestone types to event_types', () => {
		it('adds new milestone when adding milestone-triggering event type', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create event without milestone-triggering type
			const event = createTestEvent(1, ['conversation'], [pairAB]);
			const eventId = addEvent(store, event);

			// Verify no milestones initially
			let milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(0);

			// Add intimate_kiss to event types
			updateNarrativeEvent(store, eventId, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});

			// Recompute milestones
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone was added
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].type).toBe('first_kiss');
			expect(milestones[0].eventId).toBe(eventId);

			// Verify the event's firstFor was updated
			const updatedEvent = getEvent(store, eventId);
			expect(updatedEvent?.affectedPairs[0].firstFor).toContain('first_kiss');

			// Verify projection includes the milestone
			const relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId);
		});

		it('does not add milestone if older event already has it', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create first event with intimate_kiss and first_kiss milestone
			const event1 = createTestEvent(
				1,
				['intimate_kiss'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
				{ [keyAB]: { first_kiss: 'First kiss at message 1' } },
			);
			const eventId1 = addEvent(store, event1);

			// Create second event without intimate_kiss
			const event2 = createTestEvent(2, ['conversation'], [pairAB]);
			const eventId2 = addEvent(store, event2);

			// Verify only first event has milestone
			let milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].eventId).toBe(eventId1);

			// Add intimate_kiss to second event
			updateNarrativeEvent(store, eventId2, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});

			// Recompute milestones from the second event
			recomputeFirstFor(store, 2, new Set([keyAB]));

			// Verify milestone stays on first event - second event should NOT get it
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].eventId).toBe(eventId1);
			expect(milestones[0].description).toBe('First kiss at message 1');

			// Verify second event does NOT have the milestone
			const updatedEvent2 = getEvent(store, eventId2);
			expect(updatedEvent2?.affectedPairs[0].firstFor ?? []).not.toContain(
				'first_kiss',
			);
		});

		it('moves milestone from newer event to earlier event when adding event type', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create first event without intimate_kiss
			const event1 = createTestEvent(1, ['conversation'], [pairAB]);
			const eventId1 = addEvent(store, event1);

			// Create second event with intimate_kiss and first_kiss milestone
			const event2 = createTestEvent(
				2,
				['intimate_kiss'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
				{ [keyAB]: { first_kiss: 'First kiss at message 2' } },
			);
			const eventId2 = addEvent(store, event2);

			// Verify milestone is on second event initially
			let milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].eventId).toBe(eventId2);
			expect(milestones[0].description).toBe('First kiss at message 2');

			// Add intimate_kiss to first (earlier) event
			updateNarrativeEvent(store, eventId1, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});

			// Recompute milestones from the first event onwards
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone moved to first event
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].type).toBe('first_kiss');
			expect(milestones[0].eventId).toBe(eventId1);

			// Verify first event now has the milestone
			const updatedEvent1 = getEvent(store, eventId1);
			expect(updatedEvent1?.affectedPairs[0].firstFor).toContain('first_kiss');

			// Verify second event no longer has the milestone
			const updatedEvent2 = getEvent(store, eventId2);
			expect(updatedEvent2?.affectedPairs[0].firstFor ?? []).not.toContain(
				'first_kiss',
			);

			// Verify projection shows milestone on first event
			const relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId1);
			expect(relationship.milestoneEventIds).not.toContain(eventId2);
		});
	});

	describe('milestone date tracking', () => {
		it('milestone has correct date from the event narrativeTimestamp', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			const event = createTestEvent(1, ['intimate_kiss'], [pairAB], {
				[keyAB]: ['first_kiss'],
			});
			// Set specific narrative timestamp
			event.narrativeTimestamp = {
				year: 2024,
				month: 7,
				day: 20,
				hour: 18,
				minute: 45,
				second: 0,
				dayOfWeek: 'Saturday',
			};
			addEvent(store, event);

			const milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);

			// Get the actual event to verify the date
			const milestoneEvent = getEvent(store, milestones[0].eventId);
			expect(milestoneEvent?.narrativeTimestamp).toEqual({
				year: 2024,
				month: 7,
				day: 20,
				hour: 18,
				minute: 45,
				second: 0,
				dayOfWeek: 'Saturday',
			});
		});

		it('milestone date changes when moved to different event', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// First event - day 15
			const event1 = createTestEvent(1, ['conversation'], [pairAB]);
			event1.narrativeTimestamp = {
				year: 2024,
				month: 6,
				day: 15,
				hour: 10,
				minute: 0,
				second: 0,
				dayOfWeek: 'Saturday',
			};
			const eventId1 = addEvent(store, event1);

			// Second event with milestone - day 20
			const event2 = createTestEvent(2, ['intimate_kiss'], [pairAB], {
				[keyAB]: ['first_kiss'],
			});
			event2.narrativeTimestamp = {
				year: 2024,
				month: 6,
				day: 20,
				hour: 14,
				minute: 30,
				second: 0,
				dayOfWeek: 'Thursday',
			};
			addEvent(store, event2);

			// Verify milestone is at day 20 initially
			let milestones = computeMilestonesForPair(store, pairAB);
			let milestoneEvent = getEvent(store, milestones[0].eventId);
			expect(milestoneEvent?.narrativeTimestamp?.day).toBe(20);

			// Add intimate_kiss to first event (day 15)
			updateNarrativeEvent(store, eventId1, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone is now at day 15
			milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones[0].eventId).toBe(eventId1);
			milestoneEvent = getEvent(store, milestones[0].eventId);
			expect(milestoneEvent?.narrativeTimestamp?.day).toBe(15);
		});
	});

	describe('milestone description handling', () => {
		it('preserves existing milestone description when event type is not changed', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			const event = createTestEvent(
				1,
				['intimate_kiss', 'conversation'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
				{ [keyAB]: { first_kiss: 'A beautiful first kiss' } },
			);
			const eventId = addEvent(store, event);

			// Update something unrelated to event types
			updateNarrativeEvent(store, eventId, {
				summary: 'Updated summary',
			});

			// Milestone description should be preserved
			const milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones[0].description).toBe('A beautiful first kiss');
		});

		it('milestone description is undefined for newly created milestone', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create event without milestone initially
			const event = createTestEvent(1, ['conversation'], [pairAB]);
			const eventId = addEvent(store, event);

			// Add intimate_kiss to create a milestone
			updateNarrativeEvent(store, eventId, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// The newly created milestone should not have a description
			// (description would be generated by LLM separately)
			const milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones).toHaveLength(1);
			expect(milestones[0].type).toBe('first_kiss');
			expect(milestones[0].description).toBeUndefined();
		});

		it('milestone is stored as firstFor on event, not separate persistent state', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			const event = createTestEvent(
				1,
				['intimate_kiss'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
				{ [keyAB]: { first_kiss: 'Their first kiss' } },
			);
			const eventId = addEvent(store, event);

			// Verify milestone is stored on the event's affectedPairs
			const storedEvent = getEvent(store, eventId);
			expect(storedEvent).toBeDefined();
			expect(storedEvent?.affectedPairs[0].firstFor).toContain('first_kiss');
			expect(
				storedEvent?.affectedPairs[0].milestoneDescriptions?.first_kiss,
			).toBe('Their first kiss');

			// Verify milestone comes from the event store, not separate state
			const milestones = computeMilestonesForPair(store, pairAB);
			expect(milestones[0].eventId).toBe(eventId);
		});
	});

	describe('projection updates after milestone changes', () => {
		it('relationship projection reflects added milestone', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create event without milestone
			const event = createTestEvent(1, ['conversation'], [pairAB]);
			const eventId = addEvent(store, event);

			// Verify no milestones in projection
			let relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toHaveLength(0);

			// Add milestone-triggering event type
			updateNarrativeEvent(store, eventId, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone appears in projection
			relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId);
		});

		it('relationship projection reflects removed milestone', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create event with milestone
			const event = createTestEvent(
				1,
				['intimate_kiss', 'conversation'],
				[pairAB],
				{ [keyAB]: ['first_kiss'] },
			);
			const eventId = addEvent(store, event);

			// Verify milestone in projection
			let relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId);

			// Remove milestone-triggering event type
			updateNarrativeEvent(store, eventId, {
				eventTypes: ['conversation'],
			});
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone is removed from projection
			relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toHaveLength(0);
		});

		it('relationship projection reflects milestone moved between events', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const keyAB = pairKey(pairAB);

			// Create two events, second one has the milestone
			const event1 = createTestEvent(1, ['conversation'], [pairAB]);
			const eventId1 = addEvent(store, event1);

			const event2 = createTestEvent(2, ['intimate_kiss'], [pairAB], {
				[keyAB]: ['first_kiss'],
			});
			const eventId2 = addEvent(store, event2);

			// Verify milestone on event2
			let relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId2);
			expect(relationship.milestoneEventIds).not.toContain(eventId1);

			// Move milestone to event1 by adding event type
			updateNarrativeEvent(store, eventId1, {
				eventTypes: ['conversation', 'intimate_kiss'],
			});
			recomputeFirstFor(store, 1, new Set([keyAB]));

			// Verify milestone moved
			relationship = projectRelationship(store, pairAB);
			expect(relationship.milestoneEventIds).toContain(eventId1);
			expect(relationship.milestoneEventIds).not.toContain(eventId2);
		});
	});

	describe('multiple pairs handling', () => {
		it('milestone changes for one pair do not affect other pairs', () => {
			const pairAB: [string, string] = ['Alice', 'Bob'];
			const pairAC: [string, string] = ['Alice', 'Charlie'];
			const keyAB = pairKey(pairAB);
			const keyAC = pairKey(pairAC);

			// Create event affecting both pairs with milestones
			const event = createTestEvent(
				1,
				['intimate_kiss'],
				[pairAB, pairAC],
				{
					[keyAB]: ['first_kiss'],
					[keyAC]: ['first_kiss'],
				},
				{
					[keyAB]: { first_kiss: 'Alice and Bob first kiss' },
					[keyAC]: { first_kiss: 'Alice and Charlie first kiss' },
				},
			);
			const eventId = addEvent(store, event);

			// Verify both pairs have milestones
			let milestonesAB = computeMilestonesForPair(store, pairAB);
			let milestonesAC = computeMilestonesForPair(store, pairAC);
			expect(milestonesAB).toHaveLength(1);
			expect(milestonesAC).toHaveLength(1);

			// Remove milestone only for pair AB by recomputing with that pair only affected
			// First update event to remove kiss for AB specifically
			const updatedEvent = getEvent(store, eventId)!;
			updatedEvent.affectedPairs = [
				{ pair: pairAB }, // No firstFor, milestone removed
				{
					pair: pairAC,
					firstFor: ['first_kiss'],
					milestoneDescriptions: {
						first_kiss: 'Alice and Charlie first kiss',
					},
				},
			];

			// Recompute for AB only - but since we manually removed, just verify state
			milestonesAB = computeMilestonesForPair(store, pairAB);
			milestonesAC = computeMilestonesForPair(store, pairAC);

			// AB should have no milestone, AC should still have it
			expect(milestonesAB).toHaveLength(0);
			expect(milestonesAC).toHaveLength(1);
			expect(milestonesAC[0].description).toBe('Alice and Charlie first kiss');
		});
	});

	describe('swipeId filtering', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		it('excludes events with wrong swipeId on the same messageId', () => {
			// Add a character event with swipeId 0
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as Omit<CharacterEvent, 'id'>);

			// Add a character event with swipeId 1 (different swipe)
			addStateEvent(store, {
				messageId: 5,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as Omit<CharacterEvent, 'id'>);

			// Project with swipeId 0 - should only see Alice
			const projectedSwipe0 = projectStateAtMessage(store, 5, 0, []);
			expect(projectedSwipe0.characters.has('Alice')).toBe(true);
			expect(projectedSwipe0.characters.has('Bob')).toBe(false);

			// Project with swipeId 1 - should only see Bob
			const projectedSwipe1 = projectStateAtMessage(store, 5, 1, []);
			expect(projectedSwipe1.characters.has('Alice')).toBe(false);
			expect(projectedSwipe1.characters.has('Bob')).toBe(true);
		});

		it('excludes relationship events with wrong swipeId on the same messageId', () => {
			// Add relationship events with different swipeIds
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Bob'] as [string, string],
				newStatus: 'friendly',
				previousStatus: 'strangers',
			} as Omit<RelationshipEvent, 'id'>);

			addStateEvent(store, {
				messageId: 5,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Bob'] as [string, string],
				newStatus: 'hostile',
				previousStatus: 'strangers',
			} as Omit<RelationshipEvent, 'id'>);

			// Project with swipeId 0 - should see friendly status
			const projectedSwipe0 = projectStateAtMessage(store, 5, 0, []);
			expect(projectedSwipe0.relationships.get('alice|bob')?.status).toBe(
				'friendly',
			);

			// Project with swipeId 1 - should see hostile status
			const projectedSwipe1 = projectStateAtMessage(store, 5, 1, []);
			expect(projectedSwipe1.relationships.get('alice|bob')?.status).toBe(
				'hostile',
			);
		});

		it('excludes feeling_added events with wrong swipeId', () => {
			// Add initial relationship
			addStateEvent(store, {
				messageId: 0,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Bob'] as [string, string],
				newStatus: 'strangers',
				previousStatus: 'strangers',
			} as Omit<RelationshipEvent, 'id'>);

			// Add feeling with swipeId 0
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				pair: ['Alice', 'Bob'] as [string, string],
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'trust',
			} as Omit<RelationshipEvent, 'id'>);

			// Add different feeling with swipeId 1
			addStateEvent(store, {
				messageId: 5,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				pair: ['Alice', 'Bob'] as [string, string],
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'hatred',
			} as Omit<RelationshipEvent, 'id'>);

			// Project with swipeId 0 - should see 'trust'
			const projectedSwipe0 = projectStateAtMessage(store, 5, 0, []);
			expect(
				projectedSwipe0.relationships.get('alice|bob')?.aToB.feelings,
			).toContain('trust');
			expect(
				projectedSwipe0.relationships.get('alice|bob')?.aToB.feelings,
			).not.toContain('hatred');

			// Project with swipeId 1 - should see 'hatred'
			const projectedSwipe1 = projectStateAtMessage(store, 5, 1, []);
			expect(
				projectedSwipe1.relationships.get('alice|bob')?.aToB.feelings,
			).not.toContain('trust');
			expect(
				projectedSwipe1.relationships.get('alice|bob')?.aToB.feelings,
			).toContain('hatred');
		});

		it('defaults to swipeId 0 when chat array is empty', () => {
			// When chat is empty, all messages default to swipeId 0 for filtering

			// Add event at message 3 with swipeId 0
			addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as Omit<CharacterEvent, 'id'>);

			// Add event at message 3 with swipeId 1
			addStateEvent(store, {
				messageId: 3,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as Omit<CharacterEvent, 'id'>);

			// When projecting with empty chat, only swipeId 0 events are included
			const projected = projectStateAtMessage(store, 5, 0, []);

			// Only Alice appears (swipeId 0), Bob is excluded (swipeId 1)
			expect(projected.characters.has('Alice')).toBe(true);
			expect(projected.characters.has('Bob')).toBe(false);
		});

		it('filters previous messages by canonical swipeId when chat is provided', () => {
			// When chat is provided, only events from each message's canonical swipe are included

			// Add event at message 3 with swipeId 0
			addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as Omit<CharacterEvent, 'id'>);

			// Add event at message 3 with swipeId 1
			addStateEvent(store, {
				messageId: 3,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as Omit<CharacterEvent, 'id'>);

			// Mock chat where message 3 is on swipe 1 (Bob's swipe)
			const chat = [
				{ swipe_id: 0 }, // message 0
				{ swipe_id: 0 }, // message 1
				{ swipe_id: 0 }, // message 2
				{ swipe_id: 1 }, // message 3 - canonical swipe is 1
				{ swipe_id: 0 }, // message 4
				{ swipe_id: 0 }, // message 5 (target)
			];

			// When projecting at message 5 WITH chat, only Bob (swipe 1) should be included
			const projected = projectStateAtMessage(store, 5, 0, chat);

			// Only Bob appears because message 3's canonical swipe is 1
			expect(projected.characters.has('Alice')).toBe(false);
			expect(projected.characters.has('Bob')).toBe(true);
		});

		it('uses swipe 0 as default when message has no swipe_id in chat', () => {
			// Add event at message 2 with swipeId 0
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as Omit<CharacterEvent, 'id'>);

			// Add event at message 2 with swipeId 1
			addStateEvent(store, {
				messageId: 2,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as Omit<CharacterEvent, 'id'>);

			// Mock chat where message 2 has no swipe_id (undefined)
			const chat = [
				{ swipe_id: 0 }, // message 0
				{ swipe_id: 0 }, // message 1
				{}, // message 2 - no swipe_id, defaults to 0
				{ swipe_id: 0 }, // message 3 (target)
			];

			const projected = projectStateAtMessage(store, 3, 0, chat);

			// Only Alice appears (swipe 0 is default)
			expect(projected.characters.has('Alice')).toBe(true);
			expect(projected.characters.has('Bob')).toBe(false);
		});

		it('correctly handles mixed swipeIds across multiple messages', () => {
			// Message 1, swipeId 0: Alice appears
			addStateEvent(store, {
				messageId: 1,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as Omit<CharacterEvent, 'id'>);

			// Message 2, swipeId 0: Bob appears
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as Omit<CharacterEvent, 'id'>);

			// Message 3, swipeId 0: Charlie appears
			addStateEvent(store, {
				messageId: 3,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Charlie',
			} as Omit<CharacterEvent, 'id'>);

			// Message 3, swipeId 1: Diana appears (alternate swipe)
			addStateEvent(store, {
				messageId: 3,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Diana',
			} as Omit<CharacterEvent, 'id'>);

			// Project at message 3, swipeId 0
			const projectedSwipe0 = projectStateAtMessage(store, 3, 0, []);
			expect(projectedSwipe0.characters.has('Alice')).toBe(true);
			expect(projectedSwipe0.characters.has('Bob')).toBe(true);
			expect(projectedSwipe0.characters.has('Charlie')).toBe(true);
			expect(projectedSwipe0.characters.has('Diana')).toBe(false);

			// Project at message 3, swipeId 1
			const projectedSwipe1 = projectStateAtMessage(store, 3, 1, []);
			expect(projectedSwipe1.characters.has('Alice')).toBe(true);
			expect(projectedSwipe1.characters.has('Bob')).toBe(true);
			expect(projectedSwipe1.characters.has('Charlie')).toBe(false);
			expect(projectedSwipe1.characters.has('Diana')).toBe(true);
		});

		it('projectStateOptimized also respects swipeId filtering', () => {
			// Add events with different swipeIds
			addStateEvent(store, {
				messageId: 5,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as Omit<CharacterEvent, 'id'>);

			addStateEvent(store, {
				messageId: 5,
				swipeId: 1,
				timestamp: Date.now(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as Omit<CharacterEvent, 'id'>);

			// Project with optimized function
			const projectedSwipe0 = projectStateOptimized(store, 5, 0, []);
			expect(projectedSwipe0.characters.has('Alice')).toBe(true);
			expect(projectedSwipe0.characters.has('Bob')).toBe(false);

			const projectedSwipe1 = projectStateOptimized(store, 5, 1, []);
			expect(projectedSwipe1.characters.has('Alice')).toBe(false);
			expect(projectedSwipe1.characters.has('Bob')).toBe(true);
		});
	});

	// ============================================
	// getEventsUpToMessage Tests
	// ============================================
	// Regression tests for event sourcing in stateDisplay
	// Events should be sourced from eventStore, not per-message state

	describe('getEventsUpToMessage', () => {
		let store: UnifiedEventStore;

		beforeEach(() => {
			store = createUnifiedEventStore();
		});

		function createTestNarrativeEvent(
			messageId: number,
			summary: string,
			deleted = false,
		): NarrativeEvent {
			return {
				id: generateUUID(),
				messageId,
				swipeId: 0,
				timestamp: Date.now() + messageId * 1000,
				summary,
				eventTypes: ['conversation'] as EventType[],
				tensionLevel: 'relaxed',
				tensionType: 'conversation',
				witnesses: ['Alice'],
				location: 'Test Location',
				narrativeTimestamp: {
					year: 2024,
					month: 6,
					day: 15,
					hour: 10 + messageId,
					minute: 0,
					second: 0,
					dayOfWeek: 'Monday',
				},
				affectedPairs: [],
				deleted,
			};
		}

		it('returns events up to and including the specified messageId', () => {
			// Add events at different message IDs
			store.narrativeEvents.push(
				createTestNarrativeEvent(1, 'Event at message 1'),
			);
			store.narrativeEvents.push(
				createTestNarrativeEvent(3, 'Event at message 3'),
			);
			store.narrativeEvents.push(
				createTestNarrativeEvent(5, 'Event at message 5'),
			);
			store.narrativeEvents.push(
				createTestNarrativeEvent(7, 'Event at message 7'),
			);

			// Get events up to message 5
			const events = getEventsUpToMessage(store, 5);

			expect(events).toHaveLength(3);
			expect(events.map(e => e.summary)).toContain('Event at message 1');
			expect(events.map(e => e.summary)).toContain('Event at message 3');
			expect(events.map(e => e.summary)).toContain('Event at message 5');
			expect(events.map(e => e.summary)).not.toContain('Event at message 7');
		});

		it('does not return events after the specified messageId', () => {
			store.narrativeEvents.push(createTestNarrativeEvent(10, 'Future event'));
			store.narrativeEvents.push(createTestNarrativeEvent(2, 'Past event'));

			const events = getEventsUpToMessage(store, 5);

			expect(events).toHaveLength(1);
			expect(events[0].summary).toBe('Past event');
		});

		it('filters out deleted events', () => {
			store.narrativeEvents.push(createTestNarrativeEvent(1, 'Active event'));
			store.narrativeEvents.push(
				createTestNarrativeEvent(2, 'Deleted event', true),
			);
			store.narrativeEvents.push(
				createTestNarrativeEvent(3, 'Another active event'),
			);

			const events = getEventsUpToMessage(store, 5);

			expect(events).toHaveLength(2);
			expect(events.map(e => e.summary)).toContain('Active event');
			expect(events.map(e => e.summary)).toContain('Another active event');
			expect(events.map(e => e.summary)).not.toContain('Deleted event');
		});

		it('returns empty array when no events exist up to messageId', () => {
			store.narrativeEvents.push(createTestNarrativeEvent(10, 'Future event'));

			const events = getEventsUpToMessage(store, 5);

			expect(events).toHaveLength(0);
		});

		it('returns empty array for empty store', () => {
			const events = getEventsUpToMessage(store, 5);

			expect(events).toHaveLength(0);
		});

		it('includes events at exactly the specified messageId', () => {
			store.narrativeEvents.push(
				createTestNarrativeEvent(5, 'Event at exact message'),
			);

			const events = getEventsUpToMessage(store, 5);

			expect(events).toHaveLength(1);
			expect(events[0].summary).toBe('Event at exact message');
		});

		it('works correctly at message 0', () => {
			store.narrativeEvents.push(createTestNarrativeEvent(0, 'First event'));
			store.narrativeEvents.push(createTestNarrativeEvent(1, 'Second event'));

			const events = getEventsUpToMessage(store, 0);

			expect(events).toHaveLength(1);
			expect(events[0].summary).toBe('First event');
		});

		it('returns all events when messageId is very large', () => {
			store.narrativeEvents.push(createTestNarrativeEvent(1, 'Event 1'));
			store.narrativeEvents.push(createTestNarrativeEvent(5, 'Event 5'));
			store.narrativeEvents.push(createTestNarrativeEvent(10, 'Event 10'));

			const events = getEventsUpToMessage(store, 1000);

			expect(events).toHaveLength(3);
		});

		it('maintains event order by messageId', () => {
			// Add events in non-sequential order
			store.narrativeEvents.push(createTestNarrativeEvent(5, 'Event at 5'));
			store.narrativeEvents.push(createTestNarrativeEvent(1, 'Event at 1'));
			store.narrativeEvents.push(createTestNarrativeEvent(3, 'Event at 3'));

			const events = getEventsUpToMessage(store, 10);

			// Events should be in the order they were added (filtered, not sorted)
			// The function filters but doesn't guarantee order
			expect(events).toHaveLength(3);
			expect(events.every(e => e.messageId <= 10)).toBe(true);
		});

		// Regression test: Ensures stateDisplay can source events from eventStore
		// instead of per-message state.currentEvents
		it('provides correct events for display at each message position', () => {
			// Simulate a conversation with events at various points
			store.narrativeEvents.push(createTestNarrativeEvent(2, 'Alice arrives'));
			store.narrativeEvents.push(createTestNarrativeEvent(4, 'Bob joins'));
			store.narrativeEvents.push(createTestNarrativeEvent(6, 'Tension rises'));
			store.narrativeEvents.push(
				createTestNarrativeEvent(8, 'Conflict resolved'),
			);

			// At message 3, should only see first event
			const eventsAt3 = getEventsUpToMessage(store, 3);
			expect(eventsAt3).toHaveLength(1);
			expect(eventsAt3[0].summary).toBe('Alice arrives');

			// At message 5, should see first two events
			const eventsAt5 = getEventsUpToMessage(store, 5);
			expect(eventsAt5).toHaveLength(2);

			// At message 7, should see first three events
			const eventsAt7 = getEventsUpToMessage(store, 7);
			expect(eventsAt7).toHaveLength(3);

			// At message 10, should see all four events
			const eventsAt10 = getEventsUpToMessage(store, 10);
			expect(eventsAt10).toHaveLength(4);
		});

		// Regression test: Editing relationships shouldn't affect event display
		// because events come from eventStore, not per-message state
		it('events remain accessible even if per-message state would be modified', () => {
			// Add some events to the store
			store.narrativeEvents.push(
				createTestNarrativeEvent(1, 'Important event 1'),
			);
			store.narrativeEvents.push(
				createTestNarrativeEvent(2, 'Important event 2'),
			);
			store.narrativeEvents.push(
				createTestNarrativeEvent(3, 'Important event 3'),
			);

			// Simulate what happens when relationships are edited:
			// The eventStore is the source of truth, so events should still be accessible
			const eventsBefore = getEventsUpToMessage(store, 5);
			expect(eventsBefore).toHaveLength(3);

			// Add a relationship event (simulating relationship edit)
			addStateEvent(store, {
				messageId: 2,
				swipeId: 0,
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				pair: ['Alice', 'Bob'] as [string, string],
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'trust',
			} as Omit<RelationshipEvent, 'id'>);

			// Events should still be accessible after relationship changes
			const eventsAfter = getEventsUpToMessage(store, 5);
			expect(eventsAfter).toHaveLength(3);
			expect(eventsAfter.map(e => e.summary)).toEqual(
				eventsBefore.map(e => e.summary),
			);
		});
	});
});
