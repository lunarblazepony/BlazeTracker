/**
 * Tests for Relationship Attitude Consolidation Extractor
 *
 * Focuses on shouldRun logic, internal mapping logic, and message limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { relationshipAttitudeConsolidationExtractor } from './relationshipAttitudeConsolidationExtractor';
import type { RunStrategyContext, ExtractionContext, ExtractionSettings } from '../../types';
import type { EventStore } from '../../../store';
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

describe('relationshipAttitudeConsolidationExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when relationships tracking is enabled and message count is multiple of 6', () => {
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

			expect(relationshipAttitudeConsolidationExtractor.shouldRun(context)).toBe(
				true,
			);
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

			expect(relationshipAttitudeConsolidationExtractor.shouldRun(context)).toBe(
				true,
			);
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

			expect(relationshipAttitudeConsolidationExtractor.shouldRun(context)).toBe(
				false,
			);
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

			expect(relationshipAttitudeConsolidationExtractor.shouldRun(context)).toBe(
				false,
			);
		});

		it('returns false when relationships tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.relationships = false;

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 5, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(relationshipAttitudeConsolidationExtractor.shouldRun(context)).toBe(
				false,
			);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(relationshipAttitudeConsolidationExtractor.name).toBe(
				'relationshipAttitudeConsolidation',
			);
			expect(relationshipAttitudeConsolidationExtractor.category).toBe(
				'relationships',
			);
		});

		it('has low temperature for consistency', () => {
			expect(relationshipAttitudeConsolidationExtractor.defaultTemperature).toBe(
				0.3,
			);
		});

		it('uses fixedNumber message strategy with 6 messages', () => {
			expect(relationshipAttitudeConsolidationExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 6,
			});
		});

		it('uses everyNMessages run strategy with 6 messages', () => {
			expect(relationshipAttitudeConsolidationExtractor.runStrategy).toEqual({
				strategy: 'everyNMessages',
				n: 6,
			});
		});
	});
});

/**
 * Test the internal diff logic for attitude consolidation.
 */
describe('attitude consolidation mapping logic', () => {
	it('diff logic: feelings in old but not in new should be removed', () => {
		const oldFeelings = ['loves', 'adores', 'cherishes', 'devoted to'];
		const newFeelings = ['loves', 'devoted to'];

		// Logic: items in old but not in new should generate removal events
		const removed = oldFeelings.filter(
			f => !newFeelings.map(n => n.toLowerCase()).includes(f.toLowerCase()),
		);
		expect(removed).toEqual(['adores', 'cherishes']);
	});

	it('diff logic: feelings in new but not in old should be added', () => {
		const oldFeelings = ['fond of'];
		const newFeelings = ['fond of', 'trusts', 'respects'];

		// Logic: items in new but not in old should generate addition events
		const added = newFeelings.filter(
			f => !oldFeelings.map(o => o.toLowerCase()).includes(f.toLowerCase()),
		);
		expect(added).toEqual(['trusts', 'respects']);
	});

	it('diff logic: wants in old but not in new should be removed', () => {
		const oldWants = ['wants to kiss', 'wants to confess', 'wants friendship'];
		const newWants = ['wants friendship'];

		const removed = oldWants.filter(
			w => !newWants.map(n => n.toLowerCase()).includes(w.toLowerCase()),
		);
		expect(removed).toEqual(['wants to kiss', 'wants to confess']);
	});

	it('diff logic: case-insensitive matching', () => {
		const oldFeelings = ['LOVES', 'Trusts'];
		const newFeelings = ['loves', 'trusts'];

		// With case-insensitive matching, no changes should be detected
		const oldNorm = oldFeelings.map(f => f.toLowerCase());
		const newNorm = newFeelings.map(f => f.toLowerCase());

		const removed = oldFeelings.filter(f => !newNorm.includes(f.toLowerCase()));
		const added = newFeelings.filter(f => !oldNorm.includes(f.toLowerCase()));

		expect(removed).toEqual([]);
		expect(added).toEqual([]);
	});

	it('diff logic: completely replaced list', () => {
		const oldFeelings = ['suspicious', 'wary', 'distrustful'];
		const newFeelings = ['trusts', 'respects'];

		const removed = oldFeelings.filter(
			f => !newFeelings.map(n => n.toLowerCase()).includes(f.toLowerCase()),
		);
		const added = newFeelings.filter(
			f => !oldFeelings.map(o => o.toLowerCase()).includes(f.toLowerCase()),
		);

		expect(removed).toEqual(['suspicious', 'wary', 'distrustful']);
		expect(added).toEqual(['trusts', 'respects']);
	});
});

describe('relationshipAttitudeConsolidationExtractor message limiting', () => {
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

	// Helper to create store with snapshot and relationship
	const createStoreWithRelationship = (): EventStore => {
		const snapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		// Add a relationship
		const relState = createEmptyRelationshipState(['Luna', 'User']);
		relState.aToB.feelings = ['fond', 'curious', 'interested'];
		relState.aToB.wants = ['friendship'];
		relState.bToA.feelings = ['friendly'];
		relState.bToA.wants = ['help'];
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
						aToB: {
							feelings: ['fond', 'curious', 'interested'],
							secrets: [],
							wants: ['friendship'],
						},
						bToA: {
							feelings: ['friendly'],
							secrets: [],
							wants: ['help'],
						},
					},
				},
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
		const store = createStoreWithRelationship();
		const context = createLargeContext(20);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 3;
		const currentMessage: MessageAndSwipe = { messageId: 11, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Consolidated.',
				consolidatedFeelings: ['fond'],
				consolidatedWants: ['friendship'],
			}),
		);

		await relationshipAttitudeConsolidationExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
			['Luna', 'User'],
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
		const store = createStoreWithRelationship();
		const context = createLargeContext(12);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 10;
		const currentMessage: MessageAndSwipe = { messageId: 5, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Consolidated.',
				consolidatedFeelings: ['fond'],
				consolidatedWants: ['friendship'],
			}),
		);

		await relationshipAttitudeConsolidationExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
			['Luna', 'User'],
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// With 6 message window and maxMessages 10, all 6 should be included
		expect(prompt).toContain('Message 0');
		expect(prompt).toContain('Message 5');
	});

	it('uses maxMessagesToSend not maxChapterMessagesToSend', async () => {
		const store = createStoreWithRelationship();
		const context = createLargeContext(30);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 3;
		settings.maxChapterMessagesToSend = 20;
		const currentMessage: MessageAndSwipe = { messageId: 11, swipeId: 0 };
		const turnEvents: Event[] = [];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Consolidated.',
				consolidatedFeelings: ['fond'],
				consolidatedWants: ['friendship'],
			}),
		);

		await relationshipAttitudeConsolidationExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
			['Luna', 'User'],
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
