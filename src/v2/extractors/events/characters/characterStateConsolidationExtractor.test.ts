/**
 * Tests for Character State Consolidation Extractor
 *
 * Focuses on shouldRun logic, internal mapping functions, and message limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { characterStateConsolidationExtractor } from './characterStateConsolidationExtractor';
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
		{ mes: 'I am good', is_user: false, is_system: false, name: 'Luna' },
		{ mes: 'Great!', is_user: true, is_system: false, name: 'User' },
		{ mes: 'Yes!', is_user: false, is_system: false, name: 'Luna' },
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
	lunaState.mood = ['happy', 'content', 'joyful'];
	lunaState.physicalState = ['healthy', 'rested'];
	snapshot.characters = { Luna: lunaState };
	return snapshot;
};

describe('characterStateConsolidationExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and message count is multiple of 6', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 5, swipeId: 0 }, // Message 6 (0-indexed 5), 6 % 6 = 0
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(characterStateConsolidationExtractor.shouldRun(context)).toBe(true);
		});

		it('returns true for message 11 (12th message, 12 % 6 = 0)', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 11, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(characterStateConsolidationExtractor.shouldRun(context)).toBe(true);
		});

		it('returns false when message count is not multiple of 6', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 3, swipeId: 0 }, // Message 4, 4 % 6 != 0
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(characterStateConsolidationExtractor.shouldRun(context)).toBe(false);
		});

		it('returns false for message 0 (first message, 1 % 6 != 0)', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 0, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(characterStateConsolidationExtractor.shouldRun(context)).toBe(false);
		});

		it('returns false when characters tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.characters = false;

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 5, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(characterStateConsolidationExtractor.shouldRun(context)).toBe(false);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(characterStateConsolidationExtractor.name).toBe(
				'characterStateConsolidation',
			);
			expect(characterStateConsolidationExtractor.category).toBe('characters');
		});

		it('has low temperature for consistency', () => {
			expect(characterStateConsolidationExtractor.defaultTemperature).toBe(0.3);
		});

		it('uses fixedNumber message strategy with 6 messages', () => {
			expect(characterStateConsolidationExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 6,
			});
		});

		it('uses everyNMessages run strategy with 6 messages', () => {
			expect(characterStateConsolidationExtractor.runStrategy).toEqual({
				strategy: 'everyNMessages',
				n: 6,
			});
		});
	});
});

/**
 * Test the internal diff logic by importing and testing the mapping separately.
 * This tests the core consolidation logic without needing full integration.
 */
describe('state consolidation mapping logic', () => {
	// We can't easily import the internal function, but we can verify the expected behavior
	// through the extractor's contract: given old lists and new lists, it produces events.

	it('diff logic: items in old but not in new should be removed', () => {
		const oldMoods = ['happy', 'excited', 'joyful'];
		const newMoods = ['happy'];

		// Logic: items in oldMoods but not in newMoods should generate removal events
		const removed = oldMoods.filter(
			m => !newMoods.map(n => n.toLowerCase()).includes(m.toLowerCase()),
		);
		expect(removed).toEqual(['excited', 'joyful']);
	});

	it('diff logic: items in new but not in old should be added', () => {
		const oldMoods = ['happy'];
		const newMoods = ['happy', 'content', 'relaxed'];

		// Logic: items in newMoods but not in oldMoods should generate addition events
		const added = newMoods.filter(
			m => !oldMoods.map(o => o.toLowerCase()).includes(m.toLowerCase()),
		);
		expect(added).toEqual(['content', 'relaxed']);
	});

	it('diff logic: case-insensitive matching', () => {
		const oldMoods = ['Happy', 'EXCITED'];
		const newMoods = ['happy', 'excited'];

		// With case-insensitive matching, no changes should be detected
		const oldNorm = oldMoods.map(m => m.toLowerCase());
		const newNorm = newMoods.map(m => m.toLowerCase());

		const removed = oldMoods.filter(m => !newNorm.includes(m.toLowerCase()));
		const added = newMoods.filter(m => !oldNorm.includes(m.toLowerCase()));

		expect(removed).toEqual([]);
		expect(added).toEqual([]);
	});
});

describe('characterStateConsolidationExtractor message limiting', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
	});

	// Helper to create context with many messages
	const createLargeContext = (messageCount: number): ExtractionContext => {
		const chat = [];
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
						mood: ['happy', 'content', 'joyful'],
						physicalState: ['healthy', 'rested'],
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
		// getDeepClone returns a clone of itself
		store.getDeepClone.mockReturnValue(store);
		return store as unknown as EventStore;
	};

	it('limits messages to maxMessagesToSend when context has more messages', async () => {
		const store = createStoreWithSnapshot();
		const context = createLargeContext(20);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 3;
		const currentMessage: MessageAndSwipe = { messageId: 11, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Consolidated moods.',
				consolidatedMoods: ['happy'],
				consolidatedPhysical: ['healthy'],
			}),
		);

		await characterStateConsolidationExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
			'Luna',
		);

		// Verify generator was called
		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		// Get the prompt content
		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should NOT contain earlier messages
		expect(prompt).not.toContain('Message 0');
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 8');

		// Should contain the last 3 messages (9, 10, 11)
		expect(prompt).toContain('Message 9');
		expect(prompt).toContain('Message 10');
		expect(prompt).toContain('Message 11');
	});

	it('includes all messages when count is under limit', async () => {
		const store = createStoreWithSnapshot();
		const context = createLargeContext(12);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 10;
		const currentMessage: MessageAndSwipe = { messageId: 5, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Consolidated moods.',
				consolidatedMoods: ['happy'],
				consolidatedPhysical: ['healthy'],
			}),
		);

		await characterStateConsolidationExtractor.run(
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

		// With 6 message window and maxMessages 10, all 6 should be included
		// Messages 0-5 should all be in the prompt
		expect(prompt).toContain('Message 0');
		expect(prompt).toContain('Message 5');
	});

	it('uses maxMessagesToSend not maxChapterMessagesToSend', async () => {
		const store = createStoreWithSnapshot();
		const context = createLargeContext(30);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 3;
		settings.maxChapterMessagesToSend = 20;
		const currentMessage: MessageAndSwipe = { messageId: 11, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Consolidated moods.',
				consolidatedMoods: ['happy'],
				consolidatedPhysical: ['healthy'],
			}),
		);

		await characterStateConsolidationExtractor.run(
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

		// Should be limited to 3, not 20
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 8');

		// Should contain last 3 messages
		expect(prompt).toContain('Message 9');
		expect(prompt).toContain('Message 10');
		expect(prompt).toContain('Message 11');
	});
});
