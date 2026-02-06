/**
 * Tests for Mood Change Extractor
 *
 * Focuses on shouldRun logic, extractor properties, and message limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { moodChangeExtractor } from './moodChangeExtractor';
import type { EventStore } from '../../../store';
import type { RunStrategyContext, ExtractionContext, ExtractionSettings } from '../../types';
import type { MessageAndSwipe, Event } from '../../../types';
import { createEmptySnapshot, createEmptyCharacterState } from '../../../types';

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
		{ mes: 'How are you?', is_user: true, is_system: false, name: 'User' },
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

// Mock snapshot with character state
const createMockSnapshotWithCharacter = (messageId: number = 0) => {
	const snapshot = createEmptySnapshot({ messageId, swipeId: 0 });
	const lunaState = createEmptyCharacterState('Luna');
	lunaState.position = 'standing';
	lunaState.activity = 'talking';
	lunaState.mood = ['happy'];
	lunaState.physicalState = ['healthy'];
	snapshot.characters = { Luna: lunaState };
	return snapshot;
};

describe('moodChangeExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and at correct message interval', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 2, swipeId: 0 }, // Message 3 (0-indexed 2), 3 % 3 = 0
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(moodChangeExtractor.shouldRun(context)).toBe(true);
		});

		it('returns false when not at the correct message interval', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 1, swipeId: 0 }, // Message 2, 2 % 3 != 0
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(moodChangeExtractor.shouldRun(context)).toBe(false);
		});

		it('returns false when characters tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.characters = false;

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 2, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(moodChangeExtractor.shouldRun(context)).toBe(false);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(moodChangeExtractor.name).toBe('moodChange');
			expect(moodChangeExtractor.category).toBe('characters');
		});

		it('has moderate temperature', () => {
			expect(moodChangeExtractor.defaultTemperature).toBe(0.6);
		});

		it('uses fixedNumber message strategy with 3 messages', () => {
			expect(moodChangeExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 3,
			});
		});

		it('uses everyNMessages run strategy with 3 messages', () => {
			expect(moodChangeExtractor.runStrategy).toEqual({
				strategy: 'everyNMessages',
				n: 3,
			});
		});
	});
});

describe('moodChangeExtractor message limiting', () => {
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

	// Helper to create store with snapshot
	const createStoreWithSnapshot = (): EventStore => {
		const snapshot = createMockSnapshotWithCharacter(0);
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
				characters: {
					Luna: {
						name: 'Luna',
						position: 'standing',
						activity: 'talking',
						mood: ['happy'],
						physicalState: ['healthy'],
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
					},
				},
				relationships: {},
				currentChapter: 0,
				charactersPresent: ['Luna'],
				narrativeEvents: [],
			})),
			getDeepClone: vi.fn(),
		};
		store.getDeepClone.mockReturnValue(store);
		return store as unknown as EventStore;
	};

	it('limits messages to maxMessagesToSend when context has more messages', async () => {
		const store = createStoreWithSnapshot();
		const context = createLargeContext(20);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 2;
		const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 }; // 9th message, 9 % 3 = 0
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Test.',
				character: 'Luna',
				changed: false,
			}),
		);

		await moodChangeExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
			'Luna',
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should NOT contain earlier messages
		expect(prompt).not.toContain('Message 0');
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 6');

		// Should contain the last 2 messages (7, 8)
		expect(prompt).toContain('Message 7');
		expect(prompt).toContain('Message 8');
	});

	it('uses maxMessagesToSend not maxChapterMessagesToSend', async () => {
		const store = createStoreWithSnapshot();
		const context = createLargeContext(30);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 2;
		settings.maxChapterMessagesToSend = 20;
		const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Test.',
				character: 'Luna',
				changed: false,
			}),
		);

		await moodChangeExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
			'Luna',
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should be limited to 2, not 20
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 6');

		// Should contain last 2 messages
		expect(prompt).toContain('Message 7');
		expect(prompt).toContain('Message 8');
	});
});
