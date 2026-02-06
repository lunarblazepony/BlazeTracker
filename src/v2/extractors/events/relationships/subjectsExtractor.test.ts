/**
 * Tests for Subjects Extractor
 *
 * Focuses on shouldRun logic, extractor properties, and message limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { subjectsExtractor } from './subjectsExtractor';
import type { EventStore } from '../../../store';
import type { RunStrategyContext, ExtractionContext, ExtractionSettings } from '../../types';
import type { MessageAndSwipe, Event } from '../../../types';
import { createEmptySnapshot, createEmptyRelationshipState } from '../../../types';

// Mock store
const createMockStore = (): EventStore =>
	({
		getActiveEvents: vi.fn().mockReturnValue([]),
		snapshots: [],
		events: [],
	}) as unknown as EventStore;

// Mock context
const createMockContext = (): ExtractionContext => ({
	chat: [
		{ mes: 'Hello', is_user: true, is_system: false, name: 'User' },
		{ mes: 'Hi there!', is_user: false, is_system: false, name: 'Luna' },
		{ mes: 'Nice day!', is_user: true, is_system: false, name: 'User' },
	],
	characters: [{ name: 'Luna' }],
	characterId: 0,
	name1: 'User',
	name2: 'Luna',
});

// Mock settings
const createMockSettings = (): ExtractionSettings => ({
	profileId: 'test',
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
		characters: 0.5,
		relationships: 0.6,
		scene: 0.6,
		narrative: 0.5,
		chapters: 0.5,
	},
	customPrompts: {},
	maxMessagesToSend: 10,
	maxChapterMessagesToSend: 24,
	includeWorldinfo: true,
});

describe('subjectsExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when relationships tracking is enabled and at correct message interval with offset', () => {
			const store = createMockStore();
			// With n=2 and offset=1, runs at messages 0, 2, 4, 6...
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 0, swipeId: 0 }, // Message 1, (1 + 1) % 2 = 0
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(subjectsExtractor.shouldRun(context)).toBe(true);
		});

		it('returns false when not at the correct message interval', () => {
			const store = createMockStore();
			// With n=2 and offset=1, does NOT run at messages 1, 3, 5...
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 1, swipeId: 0 }, // Message 2, (2 + 1) % 2 = 1 != 0
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(subjectsExtractor.shouldRun(context)).toBe(false);
		});

		it('returns false when relationships tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.relationships = false;

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 0, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(subjectsExtractor.shouldRun(context)).toBe(false);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(subjectsExtractor.name).toBe('subjects');
			expect(subjectsExtractor.category).toBe('relationships');
		});

		it('has moderate temperature', () => {
			expect(subjectsExtractor.defaultTemperature).toBe(0.5);
		});

		it('uses fixedNumber message strategy with 2 messages', () => {
			expect(subjectsExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 2,
			});
		});

		it('uses everyNMessages run strategy with 2 messages and offset 1', () => {
			expect(subjectsExtractor.runStrategy).toEqual({
				strategy: 'everyNMessages',
				n: 2,
				offset: 1,
			});
		});
	});
});

describe('subjectsExtractor message limiting', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	// Helper to create context with many messages
	const createLargeContext = (messageCount: number): ExtractionContext => {
		const chat: ExtractionContext['chat'] = [];
		for (let i = 0; i < messageCount; i++) {
			chat.push({
				mes: `Message ${i}`,
				is_user: i % 2 === 0,
				is_system: false,
				name: i % 2 === 0 ? 'User' : 'Luna',
			});
		}
		return {
			chat,
			characters: [{ name: 'Luna' }],
			characterId: 0,
			name1: 'User',
			name2: 'Luna',
		};
	};

	// Helper to create store with snapshot and relationship
	const createStoreWithRelationship = (): EventStore => {
		const snapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		const relState = createEmptyRelationshipState(['Luna', 'User']);
		snapshot.relationships = { 'Luna|User': relState };

		const store = {
			getActiveEvents: vi.fn().mockReturnValue([]),
			snapshots: [snapshot],
			events: [] as Event[],
			appendEvents: vi.fn(),
			projectStateAtMessage: vi.fn().mockImplementation(() => ({
				source: { messageId: 0, swipeId: 0 },
				time: null,
				location: null,
				forecasts: {},
				climate: null,
				scene: null,
				characters: {},
				relationships: {
					'Luna|User': {
						pair: ['Luna', 'User'],
						status: 'acquaintances',
						aToB: { feelings: [], secrets: [], wants: [] },
						bToA: { feelings: [], secrets: [], wants: [] },
					},
				},
				currentChapter: 0,
				// Need at least 2 characters for subjects extractor to run
				charactersPresent: ['Luna', 'User'],
				narrativeEvents: [],
			})),
			getDeepClone: vi.fn(),
		};
		store.getDeepClone.mockReturnValue(store);
		return store as unknown as EventStore;
	};

	it('limits messages to maxMessagesToSend when context has more messages', async () => {
		const store = createStoreWithRelationship();
		const context = createLargeContext(20);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 1;
		const currentMessage: MessageAndSwipe = { messageId: 10, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Test.',
				subjects: [],
			}),
		);

		await subjectsExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should NOT contain earlier messages
		expect(prompt).not.toContain('Message 0');
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 9');

		// Should contain only the last message
		expect(prompt).toContain('Message 10');
	});

	it('uses maxMessagesToSend not maxChapterMessagesToSend', async () => {
		const store = createStoreWithRelationship();
		const context = createLargeContext(30);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 1;
		settings.maxChapterMessagesToSend = 20;
		const currentMessage: MessageAndSwipe = { messageId: 10, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Test.',
				subjects: [],
			}),
		);

		await subjectsExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should be limited to 1, not 20
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 9');

		// Should contain only the last message
		expect(prompt).toContain('Message 10');
	});
});
