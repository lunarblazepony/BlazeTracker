import { describe, it, expect } from 'vitest';
import moment from 'moment';
import type {
	Event,
	TimeInitialEvent,
	TimeDeltaEvent,
	LocationMovedEvent,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
	CharacterAppearedEvent,
	CharacterDepartedEvent,
	CharacterOutfitChangedEvent,
	CharacterMoodAddedEvent,
	RelationshipFeelingAddedEvent,
	RelationshipStatusChangedEvent,
	RelationshipSubjectEvent,
	TopicToneEvent,
	TensionEvent,
	NarrativeDescriptionEvent,
	ChapterEndedEvent,
	ChapterDescribedEvent,
} from './event';
import {
	isTimeEvent,
	isTimeInitialEvent,
	isTimeDeltaEvent,
	isLocationEvent,
	isLocationMovedEvent,
	isLocationPropAddedEvent,
	isLocationPropRemovedEvent,
	isCharacterEvent,
	isCharacterAppearedEvent,
	isCharacterDepartedEvent,
	isCharacterOutfitChangedEvent,
	isCharacterMoodAddedEvent,
	isRelationshipEvent,
	isRelationshipFeelingAddedEvent,
	isRelationshipStatusChangedEvent,
	isRelationshipSubjectEvent,
	isTopicToneEvent,
	isTensionEvent,
	isNarrativeDescriptionEvent,
	isChapterEvent,
	isChapterEndedEvent,
	isChapterDescribedEvent,
	isDirectionalRelationshipEvent,
	getRelationshipPair,
	matchesKindAndSubkind,
} from './event';
import { serializeMoment } from './common';

// Helper to create base event properties
function createBaseEvent(id: string = 'test-id') {
	return {
		id,
		source: { messageId: 1, swipeId: 0 },
		timestamp: Date.now(),
	};
}

describe('event type guards', () => {
	describe('time events', () => {
		const testTime = moment({
			year: 2024,
			month: 0,
			date: 15,
			hour: 10,
			minute: 30,
			second: 0,
		});
		const initialEvent: TimeInitialEvent = {
			...createBaseEvent(),
			kind: 'time',
			subkind: 'initial',
			time: serializeMoment(testTime),
		};

		const deltaEvent: TimeDeltaEvent = {
			...createBaseEvent(),
			kind: 'time',
			subkind: 'delta',
			delta: { days: 0, hours: 2, minutes: 30, seconds: 0 },
		};

		it('isTimeEvent', () => {
			expect(isTimeEvent(initialEvent)).toBe(true);
			expect(isTimeEvent(deltaEvent)).toBe(true);
			expect(
				isTimeEvent({
					...createBaseEvent(),
					kind: 'location',
					subkind: 'moved',
				} as Event),
			).toBe(false);
		});

		it('isTimeInitialEvent', () => {
			expect(isTimeInitialEvent(initialEvent)).toBe(true);
			expect(isTimeInitialEvent(deltaEvent)).toBe(false);
		});

		it('isTimeDeltaEvent', () => {
			expect(isTimeDeltaEvent(deltaEvent)).toBe(true);
			expect(isTimeDeltaEvent(initialEvent)).toBe(false);
		});
	});

	describe('location events', () => {
		const movedEvent: LocationMovedEvent = {
			...createBaseEvent(),
			kind: 'location',
			subkind: 'moved',
			newArea: 'Downtown',
			newPlace: 'Coffee Shop',
			newPosition: 'at the counter',
		};

		const propAddedEvent: LocationPropAddedEvent = {
			...createBaseEvent(),
			kind: 'location',
			subkind: 'prop_added',
			prop: 'jacket on chair',
		};

		const propRemovedEvent: LocationPropRemovedEvent = {
			...createBaseEvent(),
			kind: 'location',
			subkind: 'prop_removed',
			prop: 'laptop',
		};

		it('isLocationEvent', () => {
			expect(isLocationEvent(movedEvent)).toBe(true);
			expect(isLocationEvent(propAddedEvent)).toBe(true);
			expect(isLocationEvent(propRemovedEvent)).toBe(true);
			expect(
				isLocationEvent({
					...createBaseEvent(),
					kind: 'time',
					subkind: 'initial',
				} as Event),
			).toBe(false);
		});

		it('isLocationMovedEvent', () => {
			expect(isLocationMovedEvent(movedEvent)).toBe(true);
			expect(isLocationMovedEvent(propAddedEvent)).toBe(false);
		});

		it('isLocationPropAddedEvent', () => {
			expect(isLocationPropAddedEvent(propAddedEvent)).toBe(true);
			expect(isLocationPropAddedEvent(movedEvent)).toBe(false);
		});

		it('isLocationPropRemovedEvent', () => {
			expect(isLocationPropRemovedEvent(propRemovedEvent)).toBe(true);
			expect(isLocationPropRemovedEvent(propAddedEvent)).toBe(false);
		});
	});

	describe('character events', () => {
		const appearedEvent: CharacterAppearedEvent = {
			...createBaseEvent(),
			kind: 'character',
			subkind: 'appeared',
			character: 'Alice',
			initialPosition: 'standing by the door',
		};

		const departedEvent: CharacterDepartedEvent = {
			...createBaseEvent(),
			kind: 'character',
			subkind: 'departed',
			character: 'Bob',
		};

		const outfitEvent: CharacterOutfitChangedEvent = {
			...createBaseEvent(),
			kind: 'character',
			subkind: 'outfit_changed',
			character: 'Alice',
			slot: 'torso',
			newValue: null,
		};

		const moodEvent: CharacterMoodAddedEvent = {
			...createBaseEvent(),
			kind: 'character',
			subkind: 'mood_added',
			character: 'Alice',
			mood: 'nervous',
		};

		it('isCharacterEvent', () => {
			expect(isCharacterEvent(appearedEvent)).toBe(true);
			expect(isCharacterEvent(departedEvent)).toBe(true);
			expect(isCharacterEvent(outfitEvent)).toBe(true);
			expect(isCharacterEvent(moodEvent)).toBe(true);
			expect(
				isCharacterEvent({
					...createBaseEvent(),
					kind: 'location',
				} as Event),
			).toBe(false);
		});

		it('isCharacterAppearedEvent', () => {
			expect(isCharacterAppearedEvent(appearedEvent)).toBe(true);
			expect(isCharacterAppearedEvent(departedEvent)).toBe(false);
		});

		it('isCharacterDepartedEvent', () => {
			expect(isCharacterDepartedEvent(departedEvent)).toBe(true);
			expect(isCharacterDepartedEvent(appearedEvent)).toBe(false);
		});

		it('isCharacterOutfitChangedEvent', () => {
			expect(isCharacterOutfitChangedEvent(outfitEvent)).toBe(true);
			expect(isCharacterOutfitChangedEvent(moodEvent)).toBe(false);
		});

		it('isCharacterMoodAddedEvent', () => {
			expect(isCharacterMoodAddedEvent(moodEvent)).toBe(true);
			expect(isCharacterMoodAddedEvent(outfitEvent)).toBe(false);
		});
	});

	describe('relationship events', () => {
		const feelingEvent: RelationshipFeelingAddedEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'feeling_added',
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'trust',
		};

		const statusEvent: RelationshipStatusChangedEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'status_changed',
			pair: ['Alice', 'Bob'],
			newStatus: 'close',
		};

		const subjectEvent: RelationshipSubjectEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'subject',
			pair: ['Alice', 'Bob'],
			subject: 'intimate_kiss',
		};

		it('isRelationshipEvent', () => {
			expect(isRelationshipEvent(feelingEvent)).toBe(true);
			expect(isRelationshipEvent(statusEvent)).toBe(true);
			expect(isRelationshipEvent(subjectEvent)).toBe(true);
			expect(
				isRelationshipEvent({
					...createBaseEvent(),
					kind: 'character',
				} as Event),
			).toBe(false);
		});

		it('isRelationshipFeelingAddedEvent', () => {
			expect(isRelationshipFeelingAddedEvent(feelingEvent)).toBe(true);
			expect(isRelationshipFeelingAddedEvent(statusEvent)).toBe(false);
		});

		it('isRelationshipStatusChangedEvent', () => {
			expect(isRelationshipStatusChangedEvent(statusEvent)).toBe(true);
			expect(isRelationshipStatusChangedEvent(feelingEvent)).toBe(false);
		});

		it('isRelationshipSubjectEvent', () => {
			expect(isRelationshipSubjectEvent(subjectEvent)).toBe(true);
			expect(isRelationshipSubjectEvent(statusEvent)).toBe(false);
		});

		it('isDirectionalRelationshipEvent', () => {
			expect(isDirectionalRelationshipEvent(feelingEvent)).toBe(true);
			expect(isDirectionalRelationshipEvent(statusEvent)).toBe(false);
			expect(isDirectionalRelationshipEvent(subjectEvent)).toBe(false);
		});
	});

	describe('other events', () => {
		const topicToneEvent: TopicToneEvent = {
			...createBaseEvent(),
			kind: 'topic_tone',
			topic: 'relationship',
			tone: 'romantic',
		};

		const tensionEvent: TensionEvent = {
			...createBaseEvent(),
			kind: 'tension',
			level: 'charged',
			type: 'intimate',
			direction: 'escalating',
		};

		const narrativeEvent: NarrativeDescriptionEvent = {
			...createBaseEvent(),
			kind: 'narrative_description',
			description: 'Alice confessed her feelings to Bob.',
		};

		const chapterEndedEvent: ChapterEndedEvent = {
			...createBaseEvent(),
			kind: 'chapter',
			subkind: 'ended',
			chapterIndex: 0,
			reason: 'location_change',
		};

		const chapterDescribedEvent: ChapterDescribedEvent = {
			...createBaseEvent(),
			kind: 'chapter',
			subkind: 'described',
			chapterIndex: 0,
			title: 'The Meeting',
			summary: 'Alice and Bob met for the first time.',
		};

		it('isTopicToneEvent', () => {
			expect(isTopicToneEvent(topicToneEvent)).toBe(true);
			expect(isTopicToneEvent(tensionEvent)).toBe(false);
		});

		it('isTensionEvent', () => {
			expect(isTensionEvent(tensionEvent)).toBe(true);
			expect(isTensionEvent(topicToneEvent)).toBe(false);
		});

		it('isNarrativeDescriptionEvent', () => {
			expect(isNarrativeDescriptionEvent(narrativeEvent)).toBe(true);
			expect(isNarrativeDescriptionEvent(topicToneEvent)).toBe(false);
		});

		it('isChapterEvent', () => {
			expect(isChapterEvent(chapterEndedEvent)).toBe(true);
			expect(isChapterEvent(chapterDescribedEvent)).toBe(true);
			expect(isChapterEvent(narrativeEvent)).toBe(false);
		});

		it('isChapterEndedEvent', () => {
			expect(isChapterEndedEvent(chapterEndedEvent)).toBe(true);
			expect(isChapterEndedEvent(chapterDescribedEvent)).toBe(false);
		});

		it('isChapterDescribedEvent', () => {
			expect(isChapterDescribedEvent(chapterDescribedEvent)).toBe(true);
			expect(isChapterDescribedEvent(chapterEndedEvent)).toBe(false);
		});
	});
});

describe('getRelationshipPair', () => {
	it('returns explicit pair for status events', () => {
		const event: RelationshipStatusChangedEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'status_changed',
			pair: ['Alice', 'Bob'],
			newStatus: 'close',
		};
		expect(getRelationshipPair(event)).toEqual(['Alice', 'Bob']);
	});

	it('returns explicit pair for subject events', () => {
		const event: RelationshipSubjectEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'subject',
			pair: ['Charlie', 'Dana'],
			subject: 'laugh',
		};
		expect(getRelationshipPair(event)).toEqual(['Charlie', 'Dana']);
	});

	it('derives pair from directional events (alphabetically sorted)', () => {
		const event: RelationshipFeelingAddedEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'feeling_added',
			fromCharacter: 'Zoe',
			towardCharacter: 'Alice',
			value: 'admiration',
		};
		expect(getRelationshipPair(event)).toEqual(['Alice', 'Zoe']);
	});

	it('handles already sorted directional pairs', () => {
		const event: RelationshipFeelingAddedEvent = {
			...createBaseEvent(),
			kind: 'relationship',
			subkind: 'feeling_added',
			fromCharacter: 'Alice',
			towardCharacter: 'Bob',
			value: 'trust',
		};
		expect(getRelationshipPair(event)).toEqual(['Alice', 'Bob']);
	});
});

describe('matchesKindAndSubkind', () => {
	it('matches by kind only', () => {
		const event: CharacterAppearedEvent = {
			...createBaseEvent(),
			kind: 'character',
			subkind: 'appeared',
			character: 'Alice',
		};
		expect(matchesKindAndSubkind(event, { kind: 'character' })).toBe(true);
		expect(matchesKindAndSubkind(event, { kind: 'location' })).toBe(false);
	});

	it('matches by kind and subkind', () => {
		const event: CharacterAppearedEvent = {
			...createBaseEvent(),
			kind: 'character',
			subkind: 'appeared',
			character: 'Alice',
		};
		expect(
			matchesKindAndSubkind(event, { kind: 'character', subkind: 'appeared' }),
		).toBe(true);
		expect(
			matchesKindAndSubkind(event, { kind: 'character', subkind: 'departed' }),
		).toBe(false);
	});

	it('handles events without subkind', () => {
		const event: TensionEvent = {
			...createBaseEvent(),
			kind: 'tension',
			level: 'relaxed',
			type: 'conversation',
			direction: 'stable',
		};
		expect(matchesKindAndSubkind(event, { kind: 'tension' })).toBe(true);
		expect(
			matchesKindAndSubkind(event, { kind: 'tension', subkind: 'something' }),
		).toBe(false);
	});
});
