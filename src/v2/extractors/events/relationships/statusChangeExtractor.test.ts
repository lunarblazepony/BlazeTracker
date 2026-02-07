/**
 * Relationship Status Change Extractor Tests
 *
 * Tests that verify the status change extractor detects relationship
 * status changes between characters.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { statusChangeExtractor } from './statusChangeExtractor';
import { EventStore } from '../../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../../types';
import type { MessageAndSwipe, Snapshot, Event } from '../../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena smiles warmly at Marcus.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I watch their interaction.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*Elena and Marcus share a tender moment, their bond growing stronger.*',
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
				akas: [],
			},
			Marcus: {
				name: 'Marcus',
				position: 'standing',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: 'jacket',
					back: null,
					torso: 'shirt',
					legs: 'pants',
					footwear: 'shoes',
					socks: null,
					underwear: null,
				},
				akas: [],
			},
		},
		relationships: {
			'Elena/Marcus': {
				pair: ['Elena', 'Marcus'],
				status: 'acquaintances',
				aToB: { feelings: [], secrets: [], wants: [] },
				bToA: { feelings: [], secrets: [], wants: [] },
			},
		},
		scene: {
			topic: 'meeting',
			tone: 'casual',
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

describe('statusChangeExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when relationships tracking is enabled', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(statusChangeExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when relationships tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, relationships: false },
			});
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(statusChangeExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns empty array when no status change detected', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Response must include pair field for valid parsing
			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'No status change detected.',
					pair: ['Elena', 'Marcus'],
					changed: false,
				}),
			);

			const result = await statusChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
				['Elena', 'Marcus'],
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await statusChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
				['Elena', 'Marcus'],
			);

			expect(result).toEqual([]);
		});

		it('uses configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					relationships: 0.9,
				},
			});
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Response must include pair field for valid parsing
			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test.',
					pair: ['Elena', 'Marcus'],
					changed: false,
				}),
			);

			await statusChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
				['Elena', 'Marcus'],
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.9);
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(statusChangeExtractor.name).toBe('statusChange');
		});

		it('has the correct category', () => {
			expect(statusChangeExtractor.category).toBe('relationships');
		});

		it('has a default temperature', () => {
			expect(statusChangeExtractor.defaultTemperature).toBe(0.5);
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
					reasoning: 'Status test.',
					pair: ['Elena', 'Marcus'],
					changed: false,
				}),
			);

			await statusChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
				['Elena', 'Marcus'],
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
