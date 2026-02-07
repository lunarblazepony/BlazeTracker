/**
 * Chapter Description Event Extractor Tests
 *
 * Tests that verify the chapter description extractor generates titles and summaries.
 * IMPORTANT: This extractor uses maxChapterMessagesToSend, NOT maxMessagesToSend.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { chapterDescriptionExtractor } from './chapterDescriptionExtractor';
import { EventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type { MessageAndSwipe, Snapshot, Event, ChapterEndedEvent } from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*The journey begins.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I follow her lead.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*We arrive at the destination.*',
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
			area: 'Village',
			place: 'Town Square',
			position: 'standing',
			props: ['fountain', 'benches'],
			locationType: 'outdoor',
		},
		forecasts: {},
		climate: {
			temperature: 18,
			outdoorTemperature: 18,
			feelsLike: 17,
			humidity: 50,
			precipitation: 0,
			cloudCover: 20,
			windSpeed: 5,
			windDirection: 'E',
			conditions: 'Sunny',
			conditionType: 'clear',
			uvIndex: 5,
			daylight: 'day',
			isIndoors: false,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'standing',
				activity: 'waiting',
				mood: ['eager'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: 'backpack',
					torso: 'blouse',
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
			topic: 'Adventure begins',
			tone: 'Exciting',
			tension: { level: 'aware', type: 'suspense', direction: 'escalating' },
		},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

/**
 * Create a chapter ended event.
 */
function createChapterEndedEvent(messageId: number, chapterIndex: number): ChapterEndedEvent {
	return {
		id: `chapter-ended-${messageId}`,
		kind: 'chapter',
		subkind: 'ended',
		chapterIndex,
		reason: 'location_change',
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

describe('chapterDescriptionExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when chapters tracking is enabled and ChapterEndedEvent present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents = [createChapterEndedEvent(2, 0)];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterDescriptionExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when chapters tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, chapters: false },
			});
			const turnEvents = [createChapterEndedEvent(2, 0)];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(chapterDescriptionExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false when no ChapterEndedEvent present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				[],
			);

			expect(chapterDescriptionExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns ChapterDescriptionEvent when ChapterEndedEvent exists', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createChapterEndedEvent(2, 0)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The chapter covered the beginning of the journey.',
					title: 'The Journey Begins',
					summary: 'Elena and User set out on their adventure, leaving the village behind.',
				}),
			);

			const result = await chapterDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toHaveLength(1);
			expect(result[0].kind).toBe('chapter');
			expect((result[0] as any).subkind).toBe('described');
			expect((result[0] as any).title).toBe('The Journey Begins');
		});

		it('returns empty array when no ChapterEndedEvent exists', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			const result = await chapterDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[], // No turn events
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createChapterEndedEvent(2, 0)];

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await chapterDescriptionExtractor.run(
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
			expect(chapterDescriptionExtractor.name).toBe('chapterDescription');
		});

		it('has the correct category', () => {
			expect(chapterDescriptionExtractor.category).toBe('chapters');
		});

		it('has a default temperature', () => {
			expect(chapterDescriptionExtractor.defaultTemperature).toBe(0.7);
		});

		it('uses sinceLastEventOfKind message strategy', () => {
			expect(chapterDescriptionExtractor.messageStrategy).toEqual({
				strategy: 'sinceLastEventOfKind',
				kinds: [{ kind: 'chapter', subkind: 'ended' }],
			});
		});

		it('uses newEventsOfKind run strategy for chapter ended events', () => {
			expect(chapterDescriptionExtractor.runStrategy).toEqual({
				strategy: 'newEventsOfKind',
				kinds: [{ kind: 'chapter', subkind: 'ended' }],
			});
		});
	});

	describe('message limiting - uses maxChapterMessagesToSend', () => {
		it('uses maxChapterMessagesToSend instead of maxMessagesToSend', async () => {
			// Create context with 15 messages
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
						mes: 'Message 9',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 10',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 11',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 12',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 13',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 14 - latest',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
				],
			});

			// Set maxMessagesToSend=5 but maxChapterMessagesToSend=20
			// With 15 messages, all should be included since 15 < 20
			const settings = createMockSettings({
				maxMessagesToSend: 5,
				maxChapterMessagesToSend: 20,
				includeWorldinfo: true,
			});

			const currentMessage: MessageAndSwipe = { messageId: 14, swipeId: 0 };
			const turnEvents = [createChapterEndedEvent(14, 0)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Chapter summary',
					title: 'Test Chapter',
					summary: 'A test summary.',
				}),
			);

			await chapterDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			// Should contain ALL messages (using maxChapterMessagesToSend=20, not maxMessagesToSend=5)
			expect(promptContent).toContain('Message 0 - earliest');
			expect(promptContent).toContain('Message 5');
			expect(promptContent).toContain('Message 10');
			expect(promptContent).toContain('Message 14 - latest');
		});

		it('is NOT affected by maxMessagesToSend when lower than maxChapterMessagesToSend', async () => {
			// Create context with 15 messages
			const context = createMockContext({
				chat: [
					{
						mes: 'Msg 0 - must be included',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 1',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 2',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 3',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 4',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 5',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 6',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 7',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 8',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 9',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 10',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 11',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 12',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Msg 13',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Msg 14 - latest',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
				],
			});

			// maxMessagesToSend=3 should have NO effect on chapter description
			// Only maxChapterMessagesToSend=20 matters for this extractor
			const settings = createMockSettings({
				maxMessagesToSend: 3, // This should be ignored!
				maxChapterMessagesToSend: 20,
				includeWorldinfo: true,
			});

			const currentMessage: MessageAndSwipe = { messageId: 14, swipeId: 0 };
			const turnEvents = [createChapterEndedEvent(14, 0)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Chapter summary',
					title: 'Test Chapter',
					summary: 'A test summary.',
				}),
			);

			await chapterDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			// Should contain early messages (maxMessagesToSend=3 is ignored)
			expect(promptContent).toContain('Msg 0 - must be included');
			expect(promptContent).toContain('Msg 14 - latest');
		});

		it('limits to maxChapterMessagesToSend when there are many messages', async () => {
			// Create context with 30 messages
			const messages = [];
			for (let i = 0; i < 30; i++) {
				messages.push({
					mes: `Message ${i}${i === 0 ? ' - earliest' : ''}${i === 29 ? ' - latest' : ''}`,
					is_user: i % 2 === 1,
					is_system: false,
					name: i % 2 === 0 ? 'Elena' : 'User',
				});
			}

			const context = createMockContext({ chat: messages });

			// Set maxChapterMessagesToSend to 10
			const settings = createMockSettings({
				maxMessagesToSend: 5,
				maxChapterMessagesToSend: 10,
				includeWorldinfo: true,
			});

			const currentMessage: MessageAndSwipe = { messageId: 29, swipeId: 0 };
			const turnEvents = [createChapterEndedEvent(29, 0)];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Chapter summary',
					title: 'Test Chapter',
					summary: 'A test summary.',
				}),
			);

			await chapterDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			// Should NOT contain early messages (limited to last 10 by maxChapterMessagesToSend)
			expect(promptContent).not.toContain('Message 0 - earliest');
			expect(promptContent).not.toContain('Message 10');
			expect(promptContent).not.toContain('Message 18');

			// Should contain the most recent messages (last 10: 20-29)
			expect(promptContent).toContain('Message 29 - latest');
		});
	});
});
