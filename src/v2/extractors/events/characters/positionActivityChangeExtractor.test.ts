/**
 * Tests for Position Activity Change Extractor
 *
 * Focuses on shouldRun logic and extractor properties.
 */

import { describe, it, expect, vi } from 'vitest';
import { positionActivityChangeExtractor } from './positionActivityChangeExtractor';
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

describe('positionActivityChangeExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and at correct message interval with offset', () => {
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

			expect(positionActivityChangeExtractor.shouldRun(context)).toBe(true);
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

			expect(positionActivityChangeExtractor.shouldRun(context)).toBe(false);
		});

		it('returns false when characters tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.characters = false;

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 0, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(positionActivityChangeExtractor.shouldRun(context)).toBe(false);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(positionActivityChangeExtractor.name).toBe('positionActivityChange');
			expect(positionActivityChangeExtractor.category).toBe('characters');
		});

		it('has moderate temperature', () => {
			expect(positionActivityChangeExtractor.defaultTemperature).toBe(0.5);
		});

		it('uses sinceLastEventOfKind message strategy', () => {
			expect(positionActivityChangeExtractor.messageStrategy.strategy).toBe(
				'sinceLastEventOfKind',
			);
		});

		it('uses everyNMessages run strategy with 2 messages and offset 1', () => {
			expect(positionActivityChangeExtractor.runStrategy).toEqual({
				strategy: 'everyNMessages',
				n: 2,
				offset: 1,
			});
		});
	});
});
