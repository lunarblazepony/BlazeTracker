/**
 * Tests for Activity Change Extractor
 *
 * Focuses on shouldRun logic and extractor properties.
 */

import { describe, it, expect, vi } from 'vitest';
import { activityChangeExtractor } from './activityChangeExtractor';
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

describe('activityChangeExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled', () => {
			const store = createMockStore();
			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 1, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(activityChangeExtractor.shouldRun(context)).toBe(true);
		});

		it('returns false when characters tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.characters = false;

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 1, swipeId: 0 },
				turnEvents: [],
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(activityChangeExtractor.shouldRun(context)).toBe(false);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(activityChangeExtractor.name).toBe('activityChange');
			expect(activityChangeExtractor.category).toBe('characters');
		});

		it('has moderate temperature', () => {
			expect(activityChangeExtractor.defaultTemperature).toBe(0.5);
		});

		it('uses fixedNumber message strategy with 1 message', () => {
			expect(activityChangeExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 1,
			});
		});

		it('uses everyMessage run strategy', () => {
			expect(activityChangeExtractor.runStrategy).toEqual({
				strategy: 'everyMessage',
			});
		});
	});
});
