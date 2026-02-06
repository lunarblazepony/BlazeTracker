/**
 * Narrative Description Event Extractor Tests
 *
 * Tests that verify the narrative description extractor generates
 * narrative summaries on every assistant message.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { narrativeDescriptionExtractor } from './narrativeDescriptionExtractor';
import { EventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type { MessageAndSwipe, Snapshot, Event, NarrativeDescriptionEvent } from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena enters the room.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I look up from my book.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*Elena sits down across from me.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: '*We talk for hours, catching up on old times. Elena shares stories of her travels.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
		],
		characters: [{ name: 'Elena', description: 'A woman with auburn hair.' }],
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
		time: '2024-11-14T15:00:00',
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'at a table',
			props: [],
			locationType: 'heated',
		},
		forecasts: {},
		climate: {
			temperature: 22,
			outdoorTemperature: 15,
			feelsLike: 14,
			humidity: 50,
			precipitation: 0,
			cloudCover: 20,
			windSpeed: 5,
			windDirection: 'N',
			conditions: 'Clear',
			conditionType: 'clear',
			uvIndex: 3,
			daylight: 'day',
			isIndoors: true,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'standing',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'blouse',
					legs: 'jeans',
					footwear: 'boots',
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {},
		scene: {
			topic: 'reunion',
			tone: 'warm',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
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

describe('narrativeDescriptionExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when narrative tracking is enabled and run strategy allows', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			// Message at index 3 (4th message) should run with everyNMessages n=4
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 3,
				swipeId: 0,
			});

			expect(narrativeDescriptionExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when narrative tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, narrative: false },
			});
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 3,
				swipeId: 0,
			});

			expect(narrativeDescriptionExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns NarrativeDescriptionEvent when extraction succeeds', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 3, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Elena and User reunite and catch up on old times.',
					description:
						'The two friends reunited, sharing stories of their travels and catching up after years apart.',
				}),
			);

			const result = await narrativeDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toHaveLength(1);
			expect(result[0].kind).toBe('narrative_description');
			expect((result[0] as NarrativeDescriptionEvent).description).toContain(
				'reunited',
			);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 3, swipeId: 0 };

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await narrativeDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toEqual([]);
		});

		it('passes messages to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 3, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test.',
					description: 'A test narrative.',
				}),
			);

			await narrativeDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			expect(promptContent).toContain('travels');
		});

		it('uses configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					narrative: 0.9,
				},
			});
			const currentMessage: MessageAndSwipe = { messageId: 3, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test.',
					description: 'A test narrative.',
				}),
			);

			await narrativeDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.9);
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(narrativeDescriptionExtractor.name).toBe('narrativeDescription');
		});

		it('has the correct category', () => {
			expect(narrativeDescriptionExtractor.category).toBe('narrative');
		});

		it('has a default temperature', () => {
			expect(narrativeDescriptionExtractor.defaultTemperature).toBe(0.5);
		});

		it('uses fixedNumber message strategy with n=4', () => {
			expect(narrativeDescriptionExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 4,
			});
		});

		it('uses everyNMessages run strategy with n=4', () => {
			expect(narrativeDescriptionExtractor.runStrategy).toEqual({
				strategy: 'everyNMessages',
				n: 4,
			});
		});
	});

	describe('message limiting', () => {
		it('limits messages to maxMessagesToSend', async () => {
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

			const settings = createMockSettings({
				maxMessagesToSend: 3,
			});

			const currentMessage: MessageAndSwipe = { messageId: 9, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Narrative test.',
					description: 'A test narrative.',
				}),
			);

			await narrativeDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			expect(promptContent).not.toContain('Message 0 - earliest');
			expect(promptContent).not.toContain('Message 1');
			expect(promptContent).not.toContain('Message 5');
			expect(promptContent).not.toContain('Message 6');

			expect(promptContent).toContain('Message 9 - latest');
		});
	});
});
