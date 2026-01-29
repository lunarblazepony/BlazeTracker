/**
 * Time Change Event Extractor Tests
 *
 * Tests that verify the time change extractor builds prompts correctly
 * with mocked ST context and MockGenerator.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { timeChangeExtractor } from './timeChangeExtractor';
import { EventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type { MessageAndSwipe, Snapshot, Event, TimeDeltaEvent } from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Morning light streams through the window as Elena wakes up.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I stretch and get out of bed.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*Several hours pass. By the time Elena finishes her work, the sun has set and the city lights are twinkling outside.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
		],
		characters: [
			{
				name: 'Elena',
				description: 'A writer working on her novel.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A supportive friend.',
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
			area: 'Home',
			place: 'Bedroom',
			position: 'in bed',
			props: ['bed', 'window', 'desk'],
			locationType: 'heated',
		},
		forecasts: {},
		climate: {
			temperature: 20,
			outdoorTemperature: 15,
			feelsLike: 14,
			humidity: 50,
			precipitation: 0,
			cloudCover: 0,
			windSpeed: 5,
			windDirection: 'N',
			conditions: 'Clear',
			conditionType: 'clear',
			uvIndex: 2,
			daylight: 'day',
			isIndoors: true,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'in bed',
				activity: 'waking up',
				mood: ['sleepy'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'pajama top',
					legs: 'pajama pants',
					footwear: null,
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {},
		scene: {
			topic: 'Morning routine',
			tone: 'Peaceful',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

/**
 * Create a run strategy context for testing shouldRun.
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

describe('timeChangeExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when time tracking is enabled', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(timeChangeExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when time tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, time: false },
			});
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(timeChangeExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('passes current time to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Several hours passed from morning to evening.',
					changed: true,
					delta: {
						days: 0,
						hours: 10,
						minutes: 0,
						seconds: 0,
					},
				}),
			);

			await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			expect(call).toBeDefined();

			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			// Should contain the current time from projection
			expect(promptContent).toContain('2024');
		});

		it('passes the current message to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test - several hours passed.',
					delta: { days: 0, hours: 10, minutes: 0, seconds: 0 },
				}),
			);

			await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			// Message at index 2 contains time passage text
			expect(promptContent).toContain('sun has set');
			expect(promptContent).toContain('city lights');
		});

		it('uses configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: { ...createMockSettings().temperatures, time: 0.5 },
			});
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Pure dialogue - about 1 minute.',
					delta: { days: 0, hours: 0, minutes: 1, seconds: 0 },
				}),
			);

			await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.5);
		});

		it('returns minimal delta for pure dialogue', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 1, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Pure dialogue exchange - about 1 minute.',
					delta: { days: 0, hours: 0, minutes: 1, seconds: 0 },
				}),
			);

			const result = await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Now always returns a delta event, even for minimal time
			expect(result).toHaveLength(1);
			expect(result[0].kind).toBe('time');
		});

		it('returns TimeDeltaEvent when time change detected', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Several hours passed from morning to evening (about 10 hours).',
					changed: true,
					delta: {
						days: 0,
						hours: 10,
						minutes: 0,
						seconds: 0,
					},
				}),
			);

			const result = await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toHaveLength(1);
			expect(result[0].kind).toBe('time');
			expect((result[0] as TimeDeltaEvent).subkind).toBe('delta');
			expect(result[0].source.messageId).toBe(2);
		});

		it('includes correct delta in the event', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Time passed.',
					changed: true,
					delta: {
						days: 1,
						hours: 5,
						minutes: 30,
						seconds: 0,
					},
				}),
			);

			const result = await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toHaveLength(1);
			const event = result[0] as Event & {
				delta: {
					days: number;
					hours: number;
					minutes: number;
					seconds: number;
				};
			};
			expect(event.delta.days).toBe(1);
			expect(event.delta.hours).toBe(5);
			expect(event.delta.minutes).toBe(30);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when LLM returns incomplete data (missing delta)', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Incomplete - missing delta field',
					// Missing 'delta' field
				}),
			);

			const result = await timeChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toEqual([]);
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(timeChangeExtractor.name).toBe('timeChange');
		});

		it('has the correct category', () => {
			expect(timeChangeExtractor.category).toBe('time');
		});

		it('has a default temperature', () => {
			expect(timeChangeExtractor.defaultTemperature).toBe(0.3);
		});

		it('uses fixedNumber message strategy with n=1', () => {
			expect(timeChangeExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 1,
			});
		});

		it('uses everyMessage run strategy', () => {
			expect(timeChangeExtractor.runStrategy).toEqual({
				strategy: 'everyMessage',
			});
		});
	});
});
