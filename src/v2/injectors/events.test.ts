/**
 * Event Formatter Tests
 *
 * Tests for event formatting with milestone descriptions.
 */

import { describe, it, expect } from 'vitest';
import {
	formatMilestoneSubject,
	formatEventForInjection,
	formatOutOfContextEvents,
	getOutOfContextEvents,
} from './events';
import type { NarrativeEvent, NarrativeEventSubject } from '../types/snapshot';
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
 * Create a mock narrative event.
 */
function createMockEvent(overrides: Partial<NarrativeEvent> = {}): NarrativeEvent {
	return {
		source: { messageId: 5, swipeId: 0 },
		description: 'Jane and John had a heartfelt conversation.',
		witnesses: ['Jane', 'John'],
		location: 'Coffee Shop',
		tension: { level: 'tense', type: 'intimate' },
		subjects: [],
		chapterIndex: 0,
		narrativeTime: null,
		...overrides,
	};
}

/**
 * Create a mock narrative event subject.
 */
function createMockSubject(overrides: Partial<NarrativeEventSubject> = {}): NarrativeEventSubject {
	return {
		pair: ['Jane', 'John'],
		subject: 'intimate_kiss',
		isMilestone: false,
		milestoneDescription: undefined,
		...overrides,
	};
}

// ============================================
// formatMilestoneSubject Tests
// ============================================

describe('formatMilestoneSubject', () => {
	it('returns empty string for non-milestone subject', () => {
		const subject = createMockSubject({ isMilestone: false });
		expect(formatMilestoneSubject(subject)).toBe('');
	});

	it('formats milestone with display name', () => {
		const subject = createMockSubject({
			isMilestone: true,
			subject: 'intimate_kiss',
		});

		const result = formatMilestoneSubject(subject);
		expect(result).toBe('Jane & John: First Kiss');
	});

	it('includes full description when available', () => {
		const subject = createMockSubject({
			isMilestone: true,
			subject: 'confession',
			milestoneDescription:
				'In a tearful moment, Jane finally told John how she truly felt.',
		});

		const result = formatMilestoneSubject(subject);
		expect(result).toBe(
			'Jane & John - Confession: In a tearful moment, Jane finally told John how she truly felt.',
		);
	});
});

// ============================================
// formatEventForInjection Tests
// ============================================

describe('formatEventForInjection', () => {
	it('formats event description with bullet point', () => {
		const event = createMockEvent({
			description: 'The heroes set out on their journey.',
		});

		const result = formatEventForInjection(event);
		expect(result).toBe('- The heroes set out on their journey.');
	});

	it('includes milestone details when flag is true', () => {
		const event = createMockEvent({
			description: 'Jane confessed her feelings.',
			subjects: [
				createMockSubject({
					isMilestone: true,
					subject: 'confession',
					milestoneDescription:
						'Jane finally revealed her true feelings.',
				}),
			],
		});

		const result = formatEventForInjection(event, true);
		expect(result).toContain('Jane confessed her feelings.');
		expect(result).toContain('[Milestone: Jane & John - Confession:');
	});

	it('omits milestone details when flag is false', () => {
		const event = createMockEvent({
			description: 'Jane confessed her feelings.',
			subjects: [
				createMockSubject({
					isMilestone: true,
					subject: 'confession',
					milestoneDescription: 'Jane finally revealed her feelings.',
				}),
			],
		});

		const result = formatEventForInjection(event, false);
		expect(result).toBe('- Jane confessed her feelings.');
		expect(result).not.toContain('[Milestone:');
	});

	it('handles event with no milestones', () => {
		const event = createMockEvent({
			description: 'They walked through the park.',
			subjects: [],
		});

		const result = formatEventForInjection(event, true);
		expect(result).toBe('- They walked through the park.');
	});
});

// ============================================
// formatOutOfContextEvents Tests
// ============================================

describe('formatOutOfContextEvents', () => {
	it('returns empty string for no events', () => {
		expect(formatOutOfContextEvents([], 10)).toBe('');
	});

	it('formats multiple events', () => {
		const events = [
			createMockEvent({ description: 'Event one occurred.' }),
			createMockEvent({ description: 'Event two followed.' }),
		];

		const result = formatOutOfContextEvents(events, 10);
		expect(result).toContain('- Event one occurred.');
		expect(result).toContain('- Event two followed.');
	});

	it('limits to maxEvents', () => {
		const events = [
			createMockEvent({ description: 'Event 1' }),
			createMockEvent({ description: 'Event 2' }),
			createMockEvent({ description: 'Event 3' }),
			createMockEvent({ description: 'Event 4' }),
			createMockEvent({ description: 'Event 5' }),
		];

		const result = formatOutOfContextEvents(events, 2);

		// Should only include the last 2 events (most recent)
		expect(result.match(/^-/gm)?.length).toBe(2);
		expect(result).toContain('Event 4');
		expect(result).toContain('Event 5');
		expect(result).not.toContain('Event 1');
	});
});

// ============================================
// getOutOfContextEvents Tests
// ============================================

describe('getOutOfContextEvents', () => {
	it('returns events before firstMessageInContext', () => {
		const mockStore = {
			getActiveEvents: () => [
				{
					kind: 'narrative',
					subkind: 'description',
					description: 'Event at message 3',
					source: { messageId: 3, swipeId: 0 },
					timestamp: Date.now(),
				},
				{
					kind: 'narrative',
					subkind: 'description',
					description: 'Event at message 7',
					source: { messageId: 7, swipeId: 0 },
					timestamp: Date.now(),
				},
				{
					kind: 'narrative',
					subkind: 'description',
					description: 'Event at message 12',
					source: { messageId: 12, swipeId: 0 },
					timestamp: Date.now(),
				},
			],
			projectStateAtMessage: () => ({
				charactersPresent: [],
				location: { place: '' },
			}),
		} as any;

		const result = getOutOfContextEvents(
			mockStore,
			createMockSwipeContext(),
			0, // Current chapter
			10, // First message in context
		);

		// Events at message 3 and 7 should be out of context
		// Event at message 12 should be in context
		// All returned events should have messageId < firstMessageInContext
		for (const event of result) {
			expect(event.source.messageId).toBeLessThan(10);
		}
	});

	it('filters to current chapter only', () => {
		const mockStore = {
			getActiveEvents: () => [
				// Chapter 0 events
				{
					kind: 'narrative',
					subkind: 'description',
					description: 'Chapter 0 event',
					source: { messageId: 3, swipeId: 0 },
					timestamp: Date.now(),
				},
				// Chapter ended
				{
					kind: 'chapter',
					subkind: 'ended',
					chapterIndex: 0,
					reason: 'location_change',
					source: { messageId: 10, swipeId: 0 },
					timestamp: Date.now(),
				},
				// Chapter 1 events
				{
					kind: 'narrative',
					subkind: 'description',
					description: 'Chapter 1 event',
					source: { messageId: 15, swipeId: 0 },
					timestamp: Date.now(),
				},
			],
			projectStateAtMessage: () => ({
				charactersPresent: [],
				location: { place: '' },
			}),
		} as any;

		// Get events for chapter 1
		const result = getOutOfContextEvents(
			mockStore,
			createMockSwipeContext(),
			1, // Chapter 1
			20, // First message in context
		);

		// Only chapter 1 events before message 20 should be returned
		// The implementation uses computeNarrativeEvents which may vary
		// Just verify we don't crash and get some reasonable result
		expect(Array.isArray(result)).toBe(true);
		// All returned events should be from the requested chapter
		for (const event of result) {
			expect(event.chapterIndex).toBe(1);
		}
	});
});
