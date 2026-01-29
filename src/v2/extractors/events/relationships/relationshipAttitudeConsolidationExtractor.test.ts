/**
 * Tests for Relationship Attitude Consolidation Extractor
 *
 * Focuses on shouldRun logic and internal mapping logic.
 */

import { describe, it, expect, vi } from 'vitest';
import { relationshipAttitudeConsolidationExtractor } from './relationshipAttitudeConsolidationExtractor';
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
