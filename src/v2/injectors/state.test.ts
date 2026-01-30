/**
 * State Injection Tests
 *
 * Tests for formatStateForInjection and formatStateSummary functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import moment from 'moment';
import { formatStateForInjection, formatStateSummary, type InjectOptions } from './state';
import type {
	Projection,
	RelationshipState,
	CharacterState,
	SceneState,
	NarrativeEvent,
} from '../types/snapshot';
import type { TensionLevel, TensionType } from '../types/common';
import type { ClimateForecast, LocationState } from '../types/common';
import { createEventStore, type EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { NoSwipeFiltering } from '../../test/testUtils';

// Mock the narrative module
vi.mock('../narrative', () => ({
	computeNarrativeEvents: vi.fn(() => []),
	computeChapters: vi.fn(() => []),
}));

import { computeNarrativeEvents, computeChapters } from '../narrative';

const mockComputeNarrativeEvents = vi.mocked(computeNarrativeEvents);
const mockComputeChapters = vi.mocked(computeChapters);

/**
 * Create a test location state.
 */
function createTestLocation(overrides: Partial<LocationState> = {}): LocationState {
	return {
		area: 'Test Area',
		place: 'Test Place',
		position: 'test position',
		props: [],
		locationType: 'modern',
		...overrides,
	};
}

/**
 * Create a test climate forecast.
 */
function createTestClimate(overrides: Partial<ClimateForecast> = {}): ClimateForecast {
	return {
		conditions: 'clear',
		temperature: 70,
		outdoorTemperature: 70,
		feelsLike: 70,
		humidity: 50,
		precipitation: 0,
		cloudCover: 20,
		windSpeed: 5,
		windDirection: 'N',
		conditionType: 'clear',
		uvIndex: 5,
		daylight: 'day',
		isIndoors: false,
		...overrides,
	};
}

/**
 * Create a test scene state.
 */
function createTestScene(
	overrides: Partial<Omit<SceneState, 'tension'>> & {
		tension?: Partial<SceneState['tension']>;
	} = {},
): SceneState {
	return {
		topic: overrides.topic ?? 'test topic',
		tone: overrides.tone ?? 'neutral',
		tension: {
			level: overrides.tension?.level ?? 'guarded',
			type: overrides.tension?.type ?? 'conversation',
			direction: overrides.tension?.direction ?? 'stable',
		},
	};
}

/**
 * Create a minimal projection for testing.
 */
function createTestProjection(overrides: Partial<Projection> = {}): Projection {
	return {
		source: { messageId: 1, swipeId: 0 },
		time: null,
		location: null,
		forecasts: {},
		climate: null,
		scene: null,
		characters: {},
		relationships: {},
		currentChapter: 0,
		charactersPresent: [],
		narrativeEvents: [],
		...overrides,
	};
}

/**
 * Create a test character state.
 */
function createTestCharacter(
	name: string,
	overrides: Partial<CharacterState> = {},
): CharacterState {
	return {
		name,
		position: 'standing nearby',
		activity: 'talking',
		mood: ['happy'],
		physicalState: [],
		outfit: {
			head: null,
			neck: null,
			jacket: null,
			back: null,
			torso: 'white shirt',
			legs: 'blue jeans',
			underwear: null,
			socks: null,
			footwear: 'sneakers',
		},
		profile: undefined,
		...overrides,
	};
}

/**
 * Create a test relationship state.
 */
function createTestRelationship(
	a: string,
	b: string,
	overrides: Partial<RelationshipState> = {},
): RelationshipState {
	return {
		pair: [a, b],
		status: 'friendly',
		aToB: {
			feelings: ['fond'],
			secrets: [],
			wants: ['friendship'],
		},
		bToA: {
			feelings: ['curious'],
			secrets: [],
			wants: ['connection'],
		},
		...overrides,
	};
}

/**
 * Create a test narrative event.
 */
function createTestNarrativeEvent(input: {
	source?: { messageId: number; swipeId: number };
	description: string;
	tension?: { level: TensionLevel; type: TensionType };
	witnesses?: string[];
	subjects?: NarrativeEvent['subjects'];
	location?: string;
	chapterIndex?: number;
	narrativeTime?: moment.Moment | null;
}): NarrativeEvent {
	return {
		source: input.source ?? { messageId: 1, swipeId: 0 },
		description: input.description,
		tension: input.tension ?? { level: 'aware', type: 'conversation' },
		witnesses: input.witnesses ?? [],
		subjects: input.subjects ?? [],
		location: input.location ?? 'Test Location',
		chapterIndex: input.chapterIndex ?? 0,
		narrativeTime: input.narrativeTime ?? null,
	};
}

describe('formatStateSummary', () => {
	it('returns empty string for projection with no data', () => {
		const projection = createTestProjection();
		const result = formatStateSummary(projection);
		expect(result).toBe('');
	});

	it('includes time when present', () => {
		const projection = createTestProjection({
			time: moment('2024-01-15T14:30:00'),
		});
		const result = formatStateSummary(projection);
		expect(result).toContain('2:30 PM');
	});

	it('includes location place when present', () => {
		const projection = createTestProjection({
			location: createTestLocation({
				area: 'Downtown',
				place: 'Coffee Shop',
				position: 'at the counter',
			}),
		});
		const result = formatStateSummary(projection);
		expect(result).toContain('Coffee Shop');
	});

	it('uses area when place is empty', () => {
		const projection = createTestProjection({
			location: createTestLocation({
				area: 'The Forest',
				place: '',
				position: 'clearing',
				locationType: 'outdoor',
			}),
		});
		const result = formatStateSummary(projection);
		expect(result).toContain('The Forest');
	});

	it('includes character count when characters present', () => {
		const projection = createTestProjection({
			charactersPresent: ['Alice', 'Bob', 'Charlie'],
		});
		const result = formatStateSummary(projection);
		expect(result).toContain('3 characters');
	});

	it('includes tension level when scene present', () => {
		const projection = createTestProjection({
			scene: createTestScene({
				topic: 'investigation',
				tone: 'mysterious',
				tension: {
					level: 'volatile',
					type: 'suspense',
					direction: 'escalating',
				},
			}),
		});
		const result = formatStateSummary(projection);
		expect(result).toContain('tension: volatile');
	});

	it('combines multiple parts with pipe separator', () => {
		const projection = createTestProjection({
			time: moment('2024-01-15T10:00:00'),
			location: createTestLocation({
				area: 'City',
				place: 'Park',
				position: 'bench',
				locationType: 'outdoor',
			}),
			charactersPresent: ['Alice', 'Bob'],
			scene: createTestScene({
				topic: 'conversation',
				tone: 'friendly',
				tension: { level: 'aware', type: 'conversation' },
			}),
		});
		const result = formatStateSummary(projection);
		expect(result).toContain(' | ');
		expect(result).toContain('10:00 AM');
		expect(result).toContain('Park');
		expect(result).toContain('2 characters');
		expect(result).toContain('tension: aware');
	});
});

describe('formatStateForInjection', () => {
	let store: EventStore;
	const swipeContext: SwipeContext = NoSwipeFiltering;

	beforeEach(() => {
		store = createEventStore();
		mockComputeNarrativeEvents.mockReturnValue([]);
		mockComputeChapters.mockReturnValue([]);
	});

	it('returns empty scene state for minimal projection', () => {
		const projection = createTestProjection();
		const result = formatStateForInjection(projection, store, swipeContext);
		expect(result).toBe('');
	});

	describe('time formatting', () => {
		it('includes formatted time', () => {
			const projection = createTestProjection({
				time: moment('2024-01-15T14:30:00'),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('Time: Monday, January 15, 2024 at 2:30 PM');
		});

		it('includes daylight phase when climate has daylight', () => {
			const projection = createTestProjection({
				time: moment('2024-01-15T06:30:00'),
				climate: createTestClimate({
					conditions: 'clear',
					temperature: 55,
					daylight: 'dawn',
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('(dawn)');
		});

		it('excludes time when option disabled', () => {
			const projection = createTestProjection({
				time: moment('2024-01-15T14:30:00'),
			});
			const options: InjectOptions = { includeTime: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('Time:');
		});
	});

	describe('location formatting', () => {
		it('formats location with all parts', () => {
			const projection = createTestProjection({
				location: createTestLocation({
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'at the counter',
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain(
				'Location: Downtown - Coffee Shop - at the counter',
			);
		});

		it('includes props when present', () => {
			const projection = createTestProjection({
				location: createTestLocation({
					area: 'Kitchen',
					place: 'Home',
					position: 'by the stove',
					props: ['frying pan', 'spatula', 'cutting board'],
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain(
				'Nearby objects: frying pan, spatula, cutting board',
			);
		});

		it('excludes location when option disabled', () => {
			const projection = createTestProjection({
				location: createTestLocation({
					area: 'Downtown',
					place: 'Coffee Shop',
					position: 'counter',
				}),
			});
			const options: InjectOptions = { includeLocation: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('Location:');
		});
	});

	describe('climate formatting', () => {
		it('formats basic climate conditions', () => {
			const projection = createTestProjection({
				climate: createTestClimate({
					conditions: 'partly cloudy',
					temperature: 72,
					humidity: 45,
					windSpeed: 8,
					isIndoors: false,
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('Climate: partly cloudy, 72°F');
		});

		it('indicates indoor climate', () => {
			const projection = createTestProjection({
				climate: createTestClimate({
					conditions: 'comfortable',
					temperature: 70,
					humidity: 40,
					windSpeed: 0,
					isIndoors: true,
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('(indoors)');
		});

		it('includes humidity when high', () => {
			const projection = createTestProjection({
				climate: createTestClimate({
					conditions: 'overcast',
					temperature: 85,
					humidity: 85,
					windSpeed: 3,
					isIndoors: false,
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('humid');
		});

		it('includes wind when strong', () => {
			const projection = createTestProjection({
				climate: createTestClimate({
					conditions: 'clear',
					temperature: 65,
					humidity: 30,
					windSpeed: 25,
					isIndoors: false,
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('windy (25 mph)');
		});

		it('excludes climate when option disabled', () => {
			const projection = createTestProjection({
				climate: createTestClimate({
					conditions: 'sunny',
					temperature: 75,
				}),
			});
			const options: InjectOptions = { includeClimate: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('Climate:');
		});
	});

	describe('scene formatting', () => {
		it('formats scene with topic, tone, and tension', () => {
			const projection = createTestProjection({
				scene: createTestScene({
					topic: 'secret meeting',
					tone: 'tense',
					tension: {
						level: 'volatile',
						type: 'suspense',
						direction: 'escalating',
					},
				}),
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('Topic: secret meeting');
			expect(result).toContain('Tone: tense');
			expect(result).toContain('Tension: volatile (suspense, escalating)');
		});

		it('excludes scene when option disabled', () => {
			const projection = createTestProjection({
				scene: createTestScene({
					topic: 'conversation',
					tone: 'friendly',
				}),
			});
			const options: InjectOptions = { includeScene: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('Topic:');
			expect(result).not.toContain('Tone:');
		});
	});

	describe('character formatting', () => {
		it('formats characters with position, activity, mood, and outfit', () => {
			const alice = createTestCharacter('Alice', {
				position: 'sitting at desk',
				activity: 'typing',
				mood: ['focused', 'determined'],
			});
			const projection = createTestProjection({
				characters: { Alice: alice },
				charactersPresent: ['Alice'],
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('Characters present:');
			expect(result).toContain('Alice: sitting at desk');
			expect(result).toContain('doing: typing');
			expect(result).toContain('mood: focused, determined');
			expect(result).toContain('wearing:');
		});

		it('includes physical state when present', () => {
			const bob = createTestCharacter('Bob', {
				physicalState: ['tired', 'sweating'],
			});
			const projection = createTestProjection({
				characters: { Bob: bob },
				charactersPresent: ['Bob'],
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('physical: tired, sweating');
		});

		it('formats outfit with topless/bottomless when missing', () => {
			const charlie = createTestCharacter('Charlie', {
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: null,
					legs: null,
					underwear: 'boxers',
					socks: null,
					footwear: null,
				},
			});
			const projection = createTestProjection({
				characters: { Charlie: charlie },
				charactersPresent: ['Charlie'],
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('topless');
			expect(result).toContain('bottomless');
			expect(result).toContain('boxers');
		});

		it('excludes characters when option disabled', () => {
			const alice = createTestCharacter('Alice');
			const projection = createTestProjection({
				characters: { Alice: alice },
				charactersPresent: ['Alice'],
			});
			const options: InjectOptions = { includeCharacters: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('Characters present:');
		});
	});

	describe('relationship formatting', () => {
		it('formats relationships between present characters', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');
			const relationship = createTestRelationship('Alice', 'Bob');

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
				relationships: { 'Alice|Bob': relationship },
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('[Relationships]');
			expect(result).toContain('Alice & Bob: friendly');
			expect(result).toContain('Alice → Bob: feels fond; wants friendship');
			expect(result).toContain('Bob → Alice: feels curious; wants connection');
		});

		it('includes secrets when option enabled', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');
			const relationship = createTestRelationship('Alice', 'Bob', {
				aToB: {
					feelings: ['attracted'],
					secrets: ['has a crush'],
					wants: ['romance'],
				},
				bToA: {
					feelings: ['friendly'],
					secrets: [],
					wants: ['friendship'],
				},
			});

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
				relationships: { 'Alice|Bob': relationship },
			});
			const result = formatStateForInjection(projection, store, swipeContext, {
				includeSecrets: true,
			});
			expect(result).toContain('hides: has a crush');
		});

		it('excludes secrets when option disabled', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');
			const relationship = createTestRelationship('Alice', 'Bob', {
				aToB: {
					feelings: ['attracted'],
					secrets: ['has a crush'],
					wants: ['romance'],
				},
				bToA: {
					feelings: ['friendly'],
					secrets: [],
					wants: ['friendship'],
				},
			});

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
				relationships: { 'Alice|Bob': relationship },
			});
			const result = formatStateForInjection(projection, store, swipeContext, {
				includeSecrets: false,
			});
			expect(result).not.toContain('hides:');
		});

		it('excludes relationships for non-present characters', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');
			const charlie = createTestCharacter('Charlie');
			const aliceBob = createTestRelationship('Alice', 'Bob');
			const aliceCharlie = createTestRelationship('Alice', 'Charlie');

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob, Charlie: charlie },
				charactersPresent: ['Alice', 'Bob'], // Charlie not present
				relationships: {
					'Alice|Bob': aliceBob,
					'Alice|Charlie': aliceCharlie,
				},
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('Alice & Bob');
			expect(result).not.toContain('Alice & Charlie');
		});

		it('excludes relationships when option disabled', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');
			const relationship = createTestRelationship('Alice', 'Bob');

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
				relationships: { 'Alice|Bob': relationship },
			});
			const options: InjectOptions = { includeRelationships: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('[Relationships]');
		});
	});

	describe('chapters formatting', () => {
		it('includes story so far section with chapters', () => {
			mockComputeChapters.mockReturnValue([
				{
					index: 0,
					title: 'The Beginning',
					summary: 'Our heroes meet for the first time.',
					endReason: 'natural',
					eventCount: 5,
				},
				{
					index: 1,
					title: 'The Journey',
					summary: 'They embark on an adventure.',
					endReason: 'location_change',
					eventCount: 8,
				},
			]);

			const projection = createTestProjection();
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('[Story So Far]');
			expect(result).toContain('Chapter 1: The Beginning');
			expect(result).toContain('Our heroes meet for the first time.');
			expect(result).toContain('Chapter 2: The Journey');
			expect(result).toContain('They embark on an adventure.');
		});

		it('respects maxChapters option', () => {
			mockComputeChapters.mockReturnValue([
				{
					index: 0,
					title: 'Chapter One',
					summary: 'First chapter.',
					endReason: 'natural',
					eventCount: 3,
				},
				{
					index: 1,
					title: 'Chapter Two',
					summary: 'Second chapter.',
					endReason: 'natural',
					eventCount: 4,
				},
				{
					index: 2,
					title: 'Chapter Three',
					summary: 'Third chapter.',
					endReason: 'natural',
					eventCount: 5,
				},
			]);

			const projection = createTestProjection();
			const result = formatStateForInjection(projection, store, swipeContext, {
				maxChapters: 2,
			});
			// Should only include the most recent 2 chapters
			expect(result).not.toContain('Chapter 1: Chapter One');
			expect(result).toContain('Chapter 2: Chapter Two');
			expect(result).toContain('Chapter 3: Chapter Three');
		});

		it('excludes incomplete chapters (no end reason)', () => {
			mockComputeChapters.mockReturnValue([
				{
					index: 0,
					title: 'Completed Chapter',
					summary: 'This one is done.',
					endReason: 'natural',
					eventCount: 5,
				},
				{
					index: 1,
					title: 'Current Chapter',
					summary: 'Still in progress.',
					endReason: null, // Not ended yet
					eventCount: 2,
				},
			]);

			const projection = createTestProjection();
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('Completed Chapter');
			expect(result).not.toContain('Current Chapter');
		});

		it('excludes chapters when option disabled', () => {
			mockComputeChapters.mockReturnValue([
				{
					index: 0,
					title: 'Test Chapter',
					summary: 'Should not appear.',
					endReason: 'natural',
					eventCount: 3,
				},
			]);

			const projection = createTestProjection();
			const options: InjectOptions = { includeChapters: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('[Story So Far]');
		});
	});

	describe('events formatting', () => {
		it('includes recent events section', () => {
			mockComputeNarrativeEvents.mockReturnValue([
				createTestNarrativeEvent({
					source: { messageId: 1, swipeId: 0 },
					description: 'Alice discovered a hidden passage.',
					tension: { level: 'charged', type: 'suspense' },
					witnesses: ['Alice'],
				}),
				createTestNarrativeEvent({
					source: { messageId: 2, swipeId: 0 },
					description: 'Bob found an ancient map.',
					tension: { level: 'tense', type: 'suspense' },
					witnesses: ['Bob'],
				}),
			]);

			const projection = createTestProjection();
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('[Recent Events]');
			expect(result).toContain('- Alice discovered a hidden passage.');
			expect(result).toContain('- Bob found an ancient map.');
		});

		it('respects maxEvents option', () => {
			mockComputeNarrativeEvents.mockReturnValue([
				createTestNarrativeEvent({
					source: { messageId: 1, swipeId: 0 },
					description: 'Event 1',
					tension: { level: 'aware', type: 'conversation' },
					witnesses: ['Alice'],
				}),
				createTestNarrativeEvent({
					source: { messageId: 2, swipeId: 0 },
					description: 'Event 2',
					tension: { level: 'guarded', type: 'conversation' },
					witnesses: ['Bob'],
				}),
				createTestNarrativeEvent({
					source: { messageId: 3, swipeId: 0 },
					description: 'Event 3',
					tension: { level: 'tense', type: 'conversation' },
					witnesses: ['Charlie'],
				}),
			]);

			const projection = createTestProjection();
			const result = formatStateForInjection(projection, store, swipeContext, {
				maxEvents: 2,
			});
			// Should only include the most recent 2 events
			expect(result).not.toContain('Event 1');
			expect(result).toContain('Event 2');
			expect(result).toContain('Event 3');
		});

		it('excludes events when option disabled', () => {
			mockComputeNarrativeEvents.mockReturnValue([
				createTestNarrativeEvent({
					source: { messageId: 1, swipeId: 0 },
					description: 'Should not appear.',
					tension: { level: 'aware', type: 'conversation' },
					witnesses: ['Alice'],
				}),
			]);

			const projection = createTestProjection();
			const options: InjectOptions = { includeEvents: false };
			const result = formatStateForInjection(
				projection,
				store,
				swipeContext,
				options,
			);
			expect(result).not.toContain('[Recent Events]');
		});
	});

	describe('knowledge gaps', () => {
		it('includes knowledge gaps for characters who missed events', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');

			mockComputeNarrativeEvents.mockReturnValue([
				createTestNarrativeEvent({
					source: { messageId: 1, swipeId: 0 },
					description: 'Alice found a secret letter.',
					tension: { level: 'tense', type: 'suspense' },
					witnesses: ['Alice'], // Only Alice witnessed
				}),
			]);

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).toContain('[Knowledge Gaps]');
			expect(result).toContain(
				'Bob was not present for: Alice found a secret letter.',
			);
		});

		it('does not include knowledge gaps when all present witnessed', () => {
			const alice = createTestCharacter('Alice');
			const bob = createTestCharacter('Bob');

			mockComputeNarrativeEvents.mockReturnValue([
				createTestNarrativeEvent({
					source: { messageId: 1, swipeId: 0 },
					description: 'They both saw the sunset.',
					tension: { level: 'relaxed', type: 'intimate' },
					witnesses: ['Alice', 'Bob'], // Both witnessed
				}),
			]);

			const projection = createTestProjection({
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
			});
			const result = formatStateForInjection(projection, store, swipeContext);
			expect(result).not.toContain('[Knowledge Gaps]');
		});
	});

	describe('full integration', () => {
		it('formats complete projection with all sections', () => {
			mockComputeChapters.mockReturnValue([
				{
					index: 0,
					title: 'The Meeting',
					summary: 'Alice and Bob meet at the cafe.',
					endReason: 'natural',
					eventCount: 3,
				},
			]);

			mockComputeNarrativeEvents.mockReturnValue([
				createTestNarrativeEvent({
					source: { messageId: 5, swipeId: 0 },
					description: 'They decided to work together.',
					tension: { level: 'guarded', type: 'negotiation' },
					witnesses: ['Alice', 'Bob'],
				}),
			]);

			const alice = createTestCharacter('Alice', {
				position: 'sitting across the table',
				activity: 'sipping coffee',
				mood: ['excited', 'hopeful'],
			});
			const bob = createTestCharacter('Bob', {
				position: 'leaning forward',
				activity: 'explaining the plan',
				mood: ['confident'],
			});
			const relationship = createTestRelationship('Alice', 'Bob', {
				status: 'friendly',
				aToB: {
					feelings: ['trust', 'respect'],
					secrets: [],
					wants: ['partnership'],
				},
				bToA: {
					feelings: ['impressed', 'hopeful'],
					secrets: [],
					wants: ['collaboration'],
				},
			});

			const projection = createTestProjection({
				time: moment('2024-06-15T15:30:00'),
				location: createTestLocation({
					area: 'Downtown',
					place: 'Cozy Cafe',
					position: 'corner booth',
					props: ['coffee cups', 'notebook', 'pen'],
				}),
				climate: createTestClimate({
					conditions: 'sunny',
					temperature: 75,
					humidity: 45,
					windSpeed: 8,
					isIndoors: true,
					daylight: 'day',
				}),
				scene: createTestScene({
					topic: 'planning the heist',
					tone: 'conspiratorial',
					tension: { level: 'charged', type: 'suspense' },
				}),
				characters: { Alice: alice, Bob: bob },
				charactersPresent: ['Alice', 'Bob'],
				relationships: { 'Alice|Bob': relationship },
				currentChapter: 1,
			});

			const result = formatStateForInjection(projection, store, swipeContext);

			// Check all major sections are present
			expect(result).toContain('[Story So Far]');
			expect(result).toContain('[Scene State]');
			expect(result).toContain('[Recent Events]');
			expect(result).toContain('[Relationships]');

			// Check specific content
			expect(result).toContain('The Meeting');
			expect(result).toContain('Saturday, June 15, 2024 at 3:30 PM');
			expect(result).toContain('Downtown - Cozy Cafe - corner booth');
			expect(result).toContain('planning the heist');
			expect(result).toContain('Alice: sitting across the table');
			expect(result).toContain('Alice & Bob: friendly');
		});
	});
});
