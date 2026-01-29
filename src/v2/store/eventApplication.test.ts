import { describe, it, expect } from 'vitest';
import moment from 'moment';
import { applyEventToProjection } from './eventApplication';
import { addTimeDelta, serializeMoment } from '../types/common';
import type {
	TimeInitialEvent,
	TimeDeltaEvent,
	LocationMovedEvent,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
	CharacterAppearedEvent,
	CharacterDepartedEvent,
	CharacterPositionChangedEvent,
	CharacterMoodAddedEvent,
	CharacterMoodRemovedEvent,
	CharacterOutfitChangedEvent,
	RelationshipFeelingAddedEvent,
	RelationshipFeelingRemovedEvent,
	RelationshipStatusChangedEvent,
	TopicToneEvent,
	TensionEvent,
	ChapterEndedEvent,
} from '../types/event';
import type { Projection } from '../types/snapshot';
import { createEmptySnapshot, createProjectionFromSnapshot } from '../types/snapshot';

function createTestProjection(): Projection {
	const snapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
	return createProjectionFromSnapshot(snapshot, { messageId: 1, swipeId: 0 });
}

function createBaseEvent(id: string = 'test-id') {
	return {
		id,
		source: { messageId: 1, swipeId: 0 },
		timestamp: Date.now(),
	};
}

describe('addTimeDelta', () => {
	it('adds minutes correctly', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 10,
			minute: 30,
			second: 0,
		});
		const result = addTimeDelta(time, { days: 0, hours: 0, minutes: 20, seconds: 0 });
		expect(result.minute()).toBe(50);
	});

	it('adds seconds correctly', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 10,
			minute: 30,
			second: 30,
		});
		const result = addTimeDelta(time, { days: 0, hours: 0, minutes: 0, seconds: 45 });
		expect(result.minute()).toBe(31);
		expect(result.second()).toBe(15);
	});

	it('handles minute overflow', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 10,
			minute: 45,
			second: 0,
		});
		const result = addTimeDelta(time, { days: 0, hours: 0, minutes: 30, seconds: 0 });
		expect(result.hour()).toBe(11);
		expect(result.minute()).toBe(15);
	});

	it('handles hour overflow', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 23,
			minute: 0,
			second: 0,
		});
		const result = addTimeDelta(time, { days: 0, hours: 2, minutes: 0, seconds: 0 });
		expect(result.date()).toBe(16);
		expect(result.hour()).toBe(1);
		expect(result.format('dddd')).toBe('Tuesday');
	});

	it('handles day overflow', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 31,
			hour: 10,
			minute: 0,
			second: 0,
		});
		const result = addTimeDelta(time, { days: 1, hours: 0, minutes: 0, seconds: 0 });
		expect(result.month()).toBe(1); // 0-indexed, so 1 = February
		expect(result.date()).toBe(1);
	});

	it('handles leap year February', () => {
		const time = moment({
			year: 2024,
			month: 1,
			date: 28,
			hour: 10,
			minute: 0,
			second: 0,
		}); // Feb 28, 2024
		const result = addTimeDelta(time, { days: 1, hours: 0, minutes: 0, seconds: 0 });
		expect(result.month()).toBe(1); // Still February
		expect(result.date()).toBe(29);
	});

	it('handles non-leap year February', () => {
		const time = moment({
			year: 2023,
			month: 1,
			date: 28,
			hour: 10,
			minute: 0,
			second: 0,
		}); // Feb 28, 2023
		const result = addTimeDelta(time, { days: 1, hours: 0, minutes: 0, seconds: 0 });
		expect(result.month()).toBe(2); // March (0-indexed)
		expect(result.date()).toBe(1);
	});

	it('handles year overflow', () => {
		const time = moment({
			year: 2024,
			month: 11,
			date: 31,
			hour: 10,
			minute: 0,
			second: 0,
		}); // Dec 31, 2024
		const result = addTimeDelta(time, { days: 1, hours: 0, minutes: 0, seconds: 0 });
		expect(result.year()).toBe(2025);
		expect(result.month()).toBe(0); // January (0-indexed)
		expect(result.date()).toBe(1);
	});

	it('does not mutate the original moment', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 10,
			minute: 0,
			second: 0,
		});
		const originalHour = time.hour();
		addTimeDelta(time, { days: 0, hours: 5, minutes: 0, seconds: 0 });
		expect(time.hour()).toBe(originalHour);
	});

	it('handles combined delta with seconds', () => {
		const time = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 10,
			minute: 59,
			second: 45,
		});
		const result = addTimeDelta(time, { days: 0, hours: 0, minutes: 0, seconds: 30 });
		expect(result.hour()).toBe(11);
		expect(result.minute()).toBe(0);
		expect(result.second()).toBe(15);
	});
});

describe('applyEventToProjection', () => {
	describe('time events', () => {
		it('applies time initial event', () => {
			const projection = createTestProjection();
			const testTime = moment({
				year: 2024,
				month: 5,
				date: 15,
				hour: 14,
				minute: 30,
				second: 0,
			}); // June 15, 2024
			const event: TimeInitialEvent = {
				...createBaseEvent(),
				kind: 'time',
				subkind: 'initial',
				time: serializeMoment(testTime),
			};

			applyEventToProjection(projection, event);

			expect(projection.time).not.toBeNull();
			expect(projection.time!.year()).toBe(2024);
			expect(projection.time!.month()).toBe(5); // 0-indexed, so 5 = June
			expect(projection.time!.date()).toBe(15);
			expect(projection.time!.hour()).toBe(14);
			expect(projection.time!.minute()).toBe(30);
			expect(projection.time!.second()).toBe(0);
		});

		it('applies time delta event', () => {
			const projection = createTestProjection();
			projection.time = moment({
				year: 2024,
				month: 0,
				date: 15,
				hour: 10,
				minute: 0,
				second: 0,
			});

			const event: TimeDeltaEvent = {
				...createBaseEvent(),
				kind: 'time',
				subkind: 'delta',
				delta: { days: 0, hours: 2, minutes: 30, seconds: 0 },
			};

			applyEventToProjection(projection, event);

			expect(projection.time?.hour()).toBe(12);
			expect(projection.time?.minute()).toBe(30);
		});

		it('applies time delta event with seconds', () => {
			const projection = createTestProjection();
			projection.time = moment({
				year: 2024,
				month: 0,
				date: 15,
				hour: 10,
				minute: 59,
				second: 45,
			});

			const event: TimeDeltaEvent = {
				...createBaseEvent(),
				kind: 'time',
				subkind: 'delta',
				delta: { days: 0, hours: 0, minutes: 0, seconds: 30 },
			};

			applyEventToProjection(projection, event);

			expect(projection.time?.hour()).toBe(11);
			expect(projection.time?.minute()).toBe(0);
			expect(projection.time?.second()).toBe(15);
		});

		it('ignores time delta when no initial time', () => {
			const projection = createTestProjection();
			expect(projection.time).toBeNull();

			const event: TimeDeltaEvent = {
				...createBaseEvent(),
				kind: 'time',
				subkind: 'delta',
				delta: { days: 1, hours: 0, minutes: 0, seconds: 0 },
			};

			applyEventToProjection(projection, event);

			expect(projection.time).toBeNull();
		});
	});

	describe('location events', () => {
		it('applies location moved event', () => {
			const projection = createTestProjection();
			const event: LocationMovedEvent = {
				...createBaseEvent(),
				kind: 'location',
				subkind: 'moved',
				newArea: 'Downtown',
				newPlace: 'Coffee Shop',
				newPosition: 'at the counter',
			};

			applyEventToProjection(projection, event);

			expect(projection.location?.area).toBe('Downtown');
			expect(projection.location?.place).toBe('Coffee Shop');
			expect(projection.location?.position).toBe('at the counter');
		});

		it('clears props when moving', () => {
			const projection = createTestProjection();
			projection.location = {
				area: 'Old',
				place: 'Old',
				position: 'Old',
				props: ['laptop', 'coffee'],
				locationType: 'heated',
			};

			const event: LocationMovedEvent = {
				...createBaseEvent(),
				kind: 'location',
				subkind: 'moved',
				newArea: 'New',
				newPlace: 'New',
				newPosition: 'New',
			};

			applyEventToProjection(projection, event);

			expect(projection.location?.props).toEqual([]);
		});

		it('applies prop added event', () => {
			const projection = createTestProjection();
			projection.location = {
				area: 'A',
				place: 'B',
				position: 'C',
				props: [],
				locationType: 'outdoor',
			};

			const event: LocationPropAddedEvent = {
				...createBaseEvent(),
				kind: 'location',
				subkind: 'prop_added',
				prop: 'laptop on table',
			};

			applyEventToProjection(projection, event);

			expect(projection.location?.props).toContain('laptop on table');
		});

		it('does not add duplicate props', () => {
			const projection = createTestProjection();
			projection.location = {
				area: 'A',
				place: 'B',
				position: 'C',
				props: ['laptop'],
				locationType: 'modern',
			};

			const event: LocationPropAddedEvent = {
				...createBaseEvent(),
				kind: 'location',
				subkind: 'prop_added',
				prop: 'laptop',
			};

			applyEventToProjection(projection, event);

			expect(projection.location?.props).toEqual(['laptop']);
		});

		it('applies prop removed event', () => {
			const projection = createTestProjection();
			projection.location = {
				area: 'A',
				place: 'B',
				position: 'C',
				props: ['laptop', 'coffee'],
				locationType: 'modern',
			};

			const event: LocationPropRemovedEvent = {
				...createBaseEvent(),
				kind: 'location',
				subkind: 'prop_removed',
				prop: 'laptop',
			};

			applyEventToProjection(projection, event);

			expect(projection.location?.props).toEqual(['coffee']);
		});
	});

	describe('character events', () => {
		it('applies character appeared event', () => {
			const projection = createTestProjection();
			const event: CharacterAppearedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
				initialPosition: 'standing by the door',
				initialActivity: 'looking around',
			};

			applyEventToProjection(projection, event);

			expect(projection.characters['Alice']).toBeDefined();
			expect(projection.characters['Alice'].position).toBe(
				'standing by the door',
			);
			expect(projection.characters['Alice'].activity).toBe('looking around');
			expect(projection.charactersPresent).toContain('Alice');
		});

		it('creates relationship pairs when character appears and others are present', () => {
			const projection = createTestProjection();

			// First character appears
			const event1: CharacterAppearedEvent = {
				...createBaseEvent('e1'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
				initialPosition: 'by the door',
			};
			applyEventToProjection(projection, event1);

			// Second character appears
			const event2: CharacterAppearedEvent = {
				...createBaseEvent('e2'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
				initialPosition: 'at the window',
			};
			applyEventToProjection(projection, event2);

			// Relationship pair should be created
			expect(projection.relationships['Alice|Bob']).toBeDefined();
			expect(projection.relationships['Alice|Bob'].pair).toEqual([
				'Alice',
				'Bob',
			]);
			expect(projection.relationships['Alice|Bob'].status).toBe('strangers');
		});

		it('creates multiple relationship pairs when character appears and multiple others are present', () => {
			const projection = createTestProjection();

			// Add Alice
			applyEventToProjection(projection, {
				...createBaseEvent('e1'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as CharacterAppearedEvent);

			// Add Bob
			applyEventToProjection(projection, {
				...createBaseEvent('e2'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as CharacterAppearedEvent);

			// Add Charlie - should create pairs with both Alice and Bob
			applyEventToProjection(projection, {
				...createBaseEvent('e3'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Charlie',
			} as CharacterAppearedEvent);

			// Check all pairs exist (sorted alphabetically)
			expect(projection.relationships['Alice|Bob']).toBeDefined();
			expect(projection.relationships['Alice|Charlie']).toBeDefined();
			expect(projection.relationships['Bob|Charlie']).toBeDefined();
		});

		it('does not create relationship pairs when first character appears alone', () => {
			const projection = createTestProjection();

			const event: CharacterAppearedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			};
			applyEventToProjection(projection, event);

			// No relationships should exist
			expect(Object.keys(projection.relationships)).toHaveLength(0);
		});

		it('does not overwrite existing relationship when character appears', () => {
			const projection = createTestProjection();

			// Pre-populate a relationship with data
			projection.relationships['Alice|Bob'] = {
				pair: ['Alice', 'Bob'],
				status: 'close',
				aToB: { feelings: ['trust'], secrets: [], wants: [] },
				bToA: { feelings: ['admiration'], secrets: [], wants: [] },
			};

			// Add Alice as present
			projection.charactersPresent.push('Alice');

			// Bob appears (should NOT overwrite the existing relationship)
			const event: CharacterAppearedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			};
			applyEventToProjection(projection, event);

			// Existing relationship should be preserved
			expect(projection.relationships['Alice|Bob'].status).toBe('close');
			expect(projection.relationships['Alice|Bob'].aToB.feelings).toContain(
				'trust',
			);
			expect(projection.relationships['Alice|Bob'].bToA.feelings).toContain(
				'admiration',
			);
		});

		it('does not create duplicate pairs when character appears twice', () => {
			const projection = createTestProjection();

			// Add Alice and Bob
			applyEventToProjection(projection, {
				...createBaseEvent('e1'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Alice',
			} as CharacterAppearedEvent);

			applyEventToProjection(projection, {
				...createBaseEvent('e2'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as CharacterAppearedEvent);

			// Bob appears again (should not create duplicate)
			applyEventToProjection(projection, {
				...createBaseEvent('e3'),
				kind: 'character',
				subkind: 'appeared',
				character: 'Bob',
			} as CharacterAppearedEvent);

			// Only one relationship should exist
			expect(Object.keys(projection.relationships)).toHaveLength(1);
			expect(projection.relationships['Alice|Bob']).toBeDefined();
		});

		it('applies character departed event', () => {
			const projection = createTestProjection();
			projection.characters['Alice'] = {
				name: 'Alice',
				position: 'sitting',
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
			projection.charactersPresent = ['Alice'];

			const event: CharacterDepartedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'departed',
				character: 'Alice',
			};

			applyEventToProjection(projection, event);

			expect(projection.charactersPresent).not.toContain('Alice');
			// Character data still exists for reference
			expect(projection.characters['Alice']).toBeDefined();
		});

		it('applies character position changed event', () => {
			const projection = createTestProjection();
			projection.characters['Alice'] = {
				name: 'Alice',
				position: 'standing',
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

			const event: CharacterPositionChangedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'position_changed',
				character: 'Alice',
				newValue: 'sitting on the couch',
			};

			applyEventToProjection(projection, event);

			expect(projection.characters['Alice'].position).toBe(
				'sitting on the couch',
			);
		});

		it('applies character mood added event', () => {
			const projection = createTestProjection();
			projection.characters['Alice'] = {
				name: 'Alice',
				position: '',
				activity: null,
				mood: ['happy'],
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

			const event: CharacterMoodAddedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'mood_added',
				character: 'Alice',
				mood: 'nervous',
			};

			applyEventToProjection(projection, event);

			expect(projection.characters['Alice'].mood).toContain('nervous');
			expect(projection.characters['Alice'].mood).toContain('happy');
		});

		it('applies character mood removed event', () => {
			const projection = createTestProjection();
			projection.characters['Alice'] = {
				name: 'Alice',
				position: '',
				activity: null,
				mood: ['happy', 'nervous'],
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

			const event: CharacterMoodRemovedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'mood_removed',
				character: 'Alice',
				mood: 'happy',
			};

			applyEventToProjection(projection, event);

			expect(projection.characters['Alice'].mood).not.toContain('happy');
			expect(projection.characters['Alice'].mood).toContain('nervous');
		});

		it('applies character outfit changed event', () => {
			const projection = createTestProjection();
			projection.characters['Alice'] = {
				name: 'Alice',
				position: '',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'shirt',
					legs: 'jeans',
					footwear: null,
					socks: null,
					underwear: null,
				},
			};

			const event: CharacterOutfitChangedEvent = {
				...createBaseEvent(),
				kind: 'character',
				subkind: 'outfit_changed',
				character: 'Alice',
				slot: 'torso',
				newValue: null,
			};

			applyEventToProjection(projection, event);

			expect(projection.characters['Alice'].outfit.torso).toBeNull();
			expect(projection.characters['Alice'].outfit.legs).toBe('jeans');
		});
	});

	describe('relationship events', () => {
		it('applies relationship feeling added event', () => {
			const projection = createTestProjection();

			const event: RelationshipFeelingAddedEvent = {
				...createBaseEvent(),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'trust',
			};

			applyEventToProjection(projection, event);

			const key = 'Alice|Bob';
			expect(projection.relationships[key]).toBeDefined();
			expect(projection.relationships[key].aToB.feelings).toContain('trust');
		});

		it('applies relationship feeling removed event', () => {
			const projection = createTestProjection();
			projection.relationships['Alice|Bob'] = {
				pair: ['Alice', 'Bob'],
				status: 'acquaintances',
				aToB: { feelings: ['trust', 'curiosity'], secrets: [], wants: [] },
				bToA: { feelings: [], secrets: [], wants: [] },
			};

			const event: RelationshipFeelingRemovedEvent = {
				...createBaseEvent(),
				kind: 'relationship',
				subkind: 'feeling_removed',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'trust',
			};

			applyEventToProjection(projection, event);

			expect(projection.relationships['Alice|Bob'].aToB.feelings).not.toContain(
				'trust',
			);
			expect(projection.relationships['Alice|Bob'].aToB.feelings).toContain(
				'curiosity',
			);
		});

		it('applies relationship status changed event', () => {
			const projection = createTestProjection();
			projection.relationships['Alice|Bob'] = {
				pair: ['Alice', 'Bob'],
				status: 'acquaintances',
				aToB: { feelings: [], secrets: [], wants: [] },
				bToA: { feelings: [], secrets: [], wants: [] },
			};

			const event: RelationshipStatusChangedEvent = {
				...createBaseEvent(),
				kind: 'relationship',
				subkind: 'status_changed',
				pair: ['Alice', 'Bob'],
				newStatus: 'close',
			};

			applyEventToProjection(projection, event);

			expect(projection.relationships['Alice|Bob'].status).toBe('close');
		});

		it('handles directional events with reversed character order', () => {
			const projection = createTestProjection();

			// Bob toward Alice (but alphabetically Alice|Bob)
			const event: RelationshipFeelingAddedEvent = {
				...createBaseEvent(),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Bob',
				towardCharacter: 'Alice',
				value: 'admiration',
			};

			applyEventToProjection(projection, event);

			const key = 'Alice|Bob';
			expect(projection.relationships[key]).toBeDefined();
			// Bob is B in the pair, so this should be bToA
			expect(projection.relationships[key].bToA.feelings).toContain('admiration');
		});
	});

	describe('scene events', () => {
		it('applies topic tone event', () => {
			const projection = createTestProjection();

			const event: TopicToneEvent = {
				...createBaseEvent(),
				kind: 'topic_tone',
				topic: 'relationship',
				tone: 'romantic',
			};

			applyEventToProjection(projection, event);

			expect(projection.scene?.topic).toBe('relationship');
			expect(projection.scene?.tone).toBe('romantic');
		});

		it('applies tension event', () => {
			const projection = createTestProjection();

			const event: TensionEvent = {
				...createBaseEvent(),
				kind: 'tension',
				level: 'charged',
				type: 'intimate',
				direction: 'escalating',
			};

			applyEventToProjection(projection, event);

			expect(projection.scene?.tension.level).toBe('charged');
			expect(projection.scene?.tension.type).toBe('intimate');
			expect(projection.scene?.tension.direction).toBe('escalating');
		});
	});

	describe('chapter events', () => {
		it('applies chapter ended event', () => {
			const projection = createTestProjection();
			expect(projection.currentChapter).toBe(0);

			const event: ChapterEndedEvent = {
				...createBaseEvent(),
				kind: 'chapter',
				subkind: 'ended',
				chapterIndex: 0,
				reason: 'location_change',
			};

			applyEventToProjection(projection, event);

			expect(projection.currentChapter).toBe(1);
		});
	});

	describe('unknown events', () => {
		it('does not crash on unknown event kinds', () => {
			const projection = createTestProjection();
			const event = {
				...createBaseEvent(),
				kind: 'unknown_kind',
			} as unknown as any;

			// Should not throw
			expect(() => applyEventToProjection(projection, event)).not.toThrow();
		});
	});
});
