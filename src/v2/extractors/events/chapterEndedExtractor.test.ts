/**
 * Chapter Ended Event Extractor Tests
 *
 * Tests that verify the chapter ended extractor detects chapter boundaries
 * based on location moves or significant time jumps.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { chapterEndedExtractor } from './chapterEndedExtractor';
import { EventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type {
	MessageAndSwipe,
	Snapshot,
	Event,
	LocationMovedEvent,
	TimeDeltaEvent,
} from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena walked through the forest.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I follow her quietly.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*We arrived at the cabin.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
		],
		characters: [{ name: 'Elena', description: 'A mysterious woman.' }],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A traveler.',
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test-profile',
		track: {
			time: true,
			location: true,
			props: true,
			climate: true,
			characters: true,
			relationships: true,
			scene: true,
			narrative: true,
			chapters: true,
		},
		temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.7,
			relationships: 0.6,
			scene: 0.6,
			narrative: 0.7,
			chapters: 0.5,
		},
		customPrompts: {},
		maxMessagesToSend: 10,
		maxChapterMessagesToSend: 24,
		includeWorldinfo: true,
		...overrides,
	};
}

/**
 * Create a mock initial snapshot.
 */
function createMockSnapshot(): Snapshot {
	return {
		type: 'initial',
		source: { messageId: 0, swipeId: 0 },
		timestamp: Date.now(),
		swipeId: 0,
		time: '2024-11-14T08:00:00',
		location: {
			area: 'Forest',
			place: 'Trail',
			position: 'walking',
			props: ['trees', 'path'],
			locationType: 'outdoor',
		},
		forecasts: {},
		climate: {
			temperature: 15,
			outdoorTemperature: 15,
			feelsLike: 14,
			humidity: 60,
			precipitation: 0,
			cloudCover: 30,
			windSpeed: 5,
			windDirection: 'N',
			conditions: 'Partly Cloudy',
			conditionType: 'partly_cloudy',
			uvIndex: 3,
			daylight: 'day',
			isIndoors: false,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'walking',
				activity: 'traveling',
				mood: ['curious'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: 'cloak',
					back: null,
					torso: 'tunic',
					legs: 'trousers',
					footwear: 'boots',
					socks: null,
					underwear: null,
				},
				akas: [],
			},
		},
		relationships: {},
		scene: {
			topic: 'Journey',
			tone: 'Mysterious',
			tension: { level: 'aware', type: 'suspense', direction: 'escalating' },
		},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

/**
 * Create a location moved event.
 */
function createLocationMovedEvent(messageId: number): LocationMovedEvent {
	return {
		id: `location-moved-${messageId}`,
		kind: 'location',
		subkind: 'moved',
		newArea: 'Mountains',
		newPlace: 'Cabin',
		newPosition: 'standing',
		source: { messageId, swipeId: 0 },
		timestamp: Date.now(),
	};
}

/**
 * Create a time delta event.
 */
function createTimeDeltaEvent(messageId: number, hours: number, days: number = 0): TimeDeltaEvent {
	return {
		id: `time-delta-${messageId}`,
		kind: 'time',
		subkind: 'delta',
		delta: { days, hours, minutes: 0, seconds: 0 },
		source: { messageId, swipeId: 0 },
		timestamp: Date.now(),
	};
}

/**
 * Create a run strategy context.
 */
function createRunStrategyContext(
	settings: ExtractionSettings,
	context: ExtractionContext,
	store: EventStore,
	currentMessage: MessageAndSwipe,
	turnEvents: Event[] = [],
): RunStrategyContext {
	return {
		store,
		context,
		settings,
		currentMessage,
		turnEvents,
		ranAtMessages: [],
		producedAtMessages: [],
	};
}

describe('chapterEndedExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when chapters tracking is enabled and location moved event present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents = [createLocationMovedEvent(2)];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterEndedExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns true when chapters tracking is enabled and significant time jump present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents = [createTimeDeltaEvent(2, 8, 0)]; // 8 hours
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterEndedExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns true for day change', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents = [createTimeDeltaEvent(2, 0, 1)]; // 1 day
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterEndedExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when chapters tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, chapters: false },
			});
			const turnEvents = [createLocationMovedEvent(2)];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterEndedExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false when no triggering events present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				[],
			);

			expect(chapterEndedExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false for small time jumps (less than 6 hours)', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents = [createTimeDeltaEvent(2, 3, 0)]; // 3 hours
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterEndedExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns ChapterEndedEvent when chapter should end', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createLocationMovedEvent(2)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The characters have arrived at a new location, marking a natural chapter break.',
					shouldEnd: true,
				}),
			);

			const result = await chapterEndedExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toHaveLength(1);
			expect(result[0].kind).toBe('chapter');
			expect((result[0] as any).subkind).toBe('ended');
		});

		it('returns empty array when chapter should not end', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createLocationMovedEvent(2)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'This is still part of the same scene.',
					shouldEnd: false,
				}),
			);

			const result = await chapterEndedExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createLocationMovedEvent(2)];

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await chapterEndedExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toEqual([]);
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(chapterEndedExtractor.name).toBe('chapterEnded');
		});

		it('has the correct category', () => {
			expect(chapterEndedExtractor.category).toBe('chapters');
		});

		it('has a default temperature', () => {
			expect(chapterEndedExtractor.defaultTemperature).toBe(0.3);
		});

		it('uses fixedNumber message strategy with n=3', () => {
			expect(chapterEndedExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 3,
			});
		});

		it('uses custom run strategy', () => {
			expect(chapterEndedExtractor.runStrategy.strategy).toBe('custom');
		});
	});

	describe('message limiting', () => {
		it('limits messages to maxMessagesToSend', async () => {
			// Create context with many messages
			const context = createMockContext({
				chat: [
					{
						mes: 'Message 0 - earliest',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 1',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 2',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 3',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 4',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 5',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 6',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 7',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 8',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 9 - latest',
						is_user: true,
						is_system: false,
						name: 'User',
					},
				],
			});

			// Set maxMessagesToSend to 3
			const settings = createMockSettings({
				maxMessagesToSend: 3,
			});

			const currentMessage: MessageAndSwipe = { messageId: 9, swipeId: 0 };
			const turnEvents = [createLocationMovedEvent(9)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Chapter ended',
					shouldEnd: true,
				}),
			);

			await chapterEndedExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			// Should NOT contain early messages (limited to last 3)
			expect(promptContent).not.toContain('Message 0 - earliest');
			expect(promptContent).not.toContain('Message 1');
			expect(promptContent).not.toContain('Message 5');
			expect(promptContent).not.toContain('Message 6');

			// Should contain the most recent messages
			expect(promptContent).toContain('Message 9 - latest');
		});
	});
});
