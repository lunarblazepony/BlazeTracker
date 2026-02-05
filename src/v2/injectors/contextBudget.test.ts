/**
 * Context Budget Calculator Tests
 *
 * Tests for the optimal context computation algorithm.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	computeOptimalContext,
	getChapterAtMessage,
	computeSimpleContext,
	estimateMessageTokens,
} from './contextBudget';
import { MockTokenCounter, FixedRatioTokenCounter } from '../utils/tokenCount';
import type { ComputedChapter } from '../narrative/computeChapters';
import type { SwipeContext } from '../store/projection';

// ============================================
// Mock Factories
// ============================================

/**
 * Create a mock swipe context.
 */
function createMockSwipeContext(): SwipeContext {
	return {
		getCanonicalSwipeId: () => 0,
	};
}

/**
 * Create a mock chapter.
 */
function createMockChapter(
	index: number,
	endedAtMessageId: number | null = null,
	title: string = `Chapter ${index + 1}`,
): ComputedChapter {
	return {
		index,
		title,
		summary: `Summary for chapter ${index + 1}`,
		endReason: endedAtMessageId !== null ? 'location_change' : null,
		endedAtMessage:
			endedAtMessageId !== null
				? { messageId: endedAtMessageId, swipeId: 0 }
				: null,
		startMessageId: index === 0 ? 0 : endedAtMessageId ? endedAtMessageId + 1 : 0,
		eventCount: 5,
		milestones: [
			{
				pair: ['Jane', 'John'] as [string, string],
				subject: 'intimate_kiss',
				description: 'Their first kiss',
			},
		],
		narrativeEvents: [],
		startTime: null,
		endTime: null,
	};
}

// ============================================
// getChapterAtMessage Tests
// ============================================

describe('getChapterAtMessage', () => {
	it('returns chapter 0 for message before any chapter end', () => {
		const chapters: ComputedChapter[] = [
			createMockChapter(0, 10),
			createMockChapter(1, null), // Current chapter
		];

		expect(getChapterAtMessage(5, chapters)).toBe(0);
	});

	it('returns chapter 0 for message at chapter 0 end', () => {
		const chapters: ComputedChapter[] = [
			createMockChapter(0, 10),
			createMockChapter(1, null),
		];

		expect(getChapterAtMessage(10, chapters)).toBe(0);
	});

	it('returns chapter 1 for message after chapter 0 end', () => {
		const chapters: ComputedChapter[] = [
			createMockChapter(0, 10),
			createMockChapter(1, null),
		];

		expect(getChapterAtMessage(15, chapters)).toBe(1);
	});

	it('handles multiple chapters correctly', () => {
		const chapters: ComputedChapter[] = [
			createMockChapter(0, 10),
			createMockChapter(1, 25),
			createMockChapter(2, null),
		];

		expect(getChapterAtMessage(5, chapters)).toBe(0);
		expect(getChapterAtMessage(10, chapters)).toBe(0);
		expect(getChapterAtMessage(15, chapters)).toBe(1);
		expect(getChapterAtMessage(25, chapters)).toBe(1);
		expect(getChapterAtMessage(30, chapters)).toBe(2);
	});

	it('returns last chapter for empty chapters array', () => {
		expect(getChapterAtMessage(5, [])).toBe(0);
	});
});

// ============================================
// computeOptimalContext Tests
// ============================================

describe('computeOptimalContext', () => {
	let mockTokenCounter: MockTokenCounter;

	beforeEach(() => {
		mockTokenCounter = new MockTokenCounter();
	});

	it('returns all messages when budget is sufficient', async () => {
		// Simple case: 3 messages, plenty of budget
		const messageTokens = new Map([
			[0, 50],
			[1, 50],
			[2, 50],
		]);

		// Mock store with no events
		const mockStore = {
			getActiveEvents: () => [],
			projectStateAtMessage: () => ({}),
		} as any;

		const result = await computeOptimalContext({
			budget: 500, // Plenty of room
			stateTokens: 100,
			messageTokens,
			store: mockStore,
			swipeContext: createMockSwipeContext(),
			maxPastChapters: 5,
			maxEvents: 15,
			totalMessages: 3,
			tokenCounter: mockTokenCounter,
		});

		expect(result.firstMessageInContext).toBe(0);
	});

	it('pushes out messages when budget is tight', async () => {
		// 3 messages at 100 tokens each, budget only allows 2 messages + state
		const messageTokens = new Map([
			[0, 100],
			[1, 100],
			[2, 100],
		]);

		const mockStore = {
			getActiveEvents: () => [],
			projectStateAtMessage: () => ({}),
		} as any;

		const result = await computeOptimalContext({
			budget: 300, // Only fits 2 messages + state
			stateTokens: 100,
			messageTokens,
			store: mockStore,
			swipeContext: createMockSwipeContext(),
			maxPastChapters: 5,
			maxEvents: 15,
			totalMessages: 3,
			tokenCounter: mockTokenCounter,
		});

		// Should push out at least 1 message
		expect(result.firstMessageInContext).toBeGreaterThanOrEqual(1);
	});

	it('handles empty message list', async () => {
		const mockStore = {
			getActiveEvents: () => [],
			projectStateAtMessage: () => ({}),
		} as any;

		const result = await computeOptimalContext({
			budget: 500,
			stateTokens: 100,
			messageTokens: new Map(),
			store: mockStore,
			swipeContext: createMockSwipeContext(),
			maxPastChapters: 5,
			maxEvents: 15,
			totalMessages: 0,
			tokenCounter: mockTokenCounter,
		});

		expect(result.firstMessageInContext).toBe(0);
		expect(result.totalTokens).toBe(100); // Just state tokens
	});

	it('returns minimal plan when budget is extremely tight', async () => {
		const messageTokens = new Map([
			[0, 1000],
			[1, 1000],
			[2, 1000],
		]);

		const mockStore = {
			getActiveEvents: () => [],
			projectStateAtMessage: () => ({}),
		} as any;

		const result = await computeOptimalContext({
			budget: 50, // Only state fits
			stateTokens: 50,
			messageTokens,
			store: mockStore,
			swipeContext: createMockSwipeContext(),
			maxPastChapters: 5,
			maxEvents: 15,
			totalMessages: 3,
			tokenCounter: mockTokenCounter,
		});

		// All messages should be pushed out
		expect(result.firstMessageInContext).toBe(3);
		expect(result.pastChapters).toHaveLength(0);
		expect(result.currentChapterEvents).toHaveLength(0);
	});
});

// ============================================
// computeSimpleContext Tests
// ============================================

describe('computeSimpleContext', () => {
	it('returns past chapters and current chapter index', () => {
		const mockStore = {
			getActiveEvents: () => [
				{
					kind: 'chapter',
					subkind: 'ended',
					chapterIndex: 0,
					source: { messageId: 10, swipeId: 0 },
					timestamp: Date.now(),
				},
				{
					kind: 'chapter',
					subkind: 'described',
					chapterIndex: 0,
					title: 'Beginning',
					summary: 'The story begins',
					source: { messageId: 10, swipeId: 0 },
					timestamp: Date.now(),
				},
			],
			projectStateAtMessage: () => ({
				charactersPresent: [],
				location: { place: '' },
			}),
			initialSnapshot: {
				type: 'initial',
				source: { messageId: 0, swipeId: 0 },
			},
			getChapterSnapshotOnCanonicalPath: () => null,
		} as any;

		const result = computeSimpleContext(mockStore, createMockSwipeContext(), 5);

		expect(result.currentChapterIndex).toBe(1);
		// Past chapters would be computed from the store's events
	});
});

// ============================================
// estimateMessageTokens Tests
// ============================================

describe('estimateMessageTokens', () => {
	it('uses pre-calculated token counts when available', async () => {
		const messages = [
			{ mes: 'Hello world', extra: { token_count: 5 } },
			{ mes: 'This is a longer message', extra: { token_count: 10 } },
		];

		const result = await estimateMessageTokens(messages);

		expect(result.get(0)).toBe(5);
		expect(result.get(1)).toBe(10);
	});

	it('estimates tokens when not pre-calculated', async () => {
		const messages = [{ mes: 'Hello world' }, { mes: 'This is a test' }];

		const fixedCounter = new FixedRatioTokenCounter(4); // 1 token per 4 chars
		const result = await estimateMessageTokens(messages, fixedCounter);

		// "Hello world" = 11 chars, ceil(11/4) = 3 tokens
		expect(result.get(0)).toBe(3);
		// "This is a test" = 14 chars, ceil(14/4) = 4 tokens
		expect(result.get(1)).toBe(4);
	});
});

// ============================================
// Token Counter Tests
// ============================================

describe('MockTokenCounter', () => {
	it('returns mapped values for exact matches', async () => {
		const tokenMap = new Map([
			['hello', 1],
			['world', 1],
			['hello world', 2],
		]);
		const counter = new MockTokenCounter(tokenMap);

		expect(await counter.countTokens('hello')).toBe(1);
		expect(await counter.countTokens('world')).toBe(1);
		expect(await counter.countTokens('hello world')).toBe(2);
	});

	it('falls back to guesstimate for unknown text', async () => {
		const counter = new MockTokenCounter(new Map());

		// "test string" = 11 chars, ceil(11/3.35) ≈ 4 tokens
		const result = await counter.countTokens('test string');
		expect(result).toBeGreaterThan(0);
	});

	it('returns 0 for empty text', async () => {
		const counter = new MockTokenCounter(new Map());
		expect(await counter.countTokens('')).toBe(0);
	});
});

describe('FixedRatioTokenCounter', () => {
	it('calculates tokens using fixed ratio', async () => {
		const counter = new FixedRatioTokenCounter(4);

		// 12 chars / 4 = 3 tokens
		expect(await counter.countTokens('hello world!')).toBe(3);
	});

	it('rounds up partial tokens', async () => {
		const counter = new FixedRatioTokenCounter(4);

		// 11 chars / 4 = 2.75, ceil = 3
		expect(await counter.countTokens('hello world')).toBe(3);
	});

	it('returns 0 for empty text', async () => {
		const counter = new FixedRatioTokenCounter(4);
		expect(await counter.countTokens('')).toBe(0);
	});
});
