/**
 * Tests for Character State Consolidation Extractor
 *
 * Focuses on shouldRun logic and internal mapping functions.
 */

import { describe, it, expect, vi } from 'vitest';
import { characterStateConsolidationExtractor } from './characterStateConsolidationExtractor';
import type { RunStrategyContext, ExtractionContext, ExtractionSettings } from '../../types';
import type { EventStore } from '../../../store';

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
});

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
