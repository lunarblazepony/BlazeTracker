/**
 * Nickname Extractor Tests
 *
 * Tests that verify the nickname extractor correctly extracts pet names,
 * nicknames, and aliases from recent messages.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { nicknameExtractor } from './nicknameExtractor';
import { EventStore } from '../../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../../types';
import type { MessageAndSwipe, Snapshot, Event, CharacterAkasAddEvent } from '../../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	// Create 9 messages (indices 0-8) so we can test at messageId 8
	const chat = [];
	for (let i = 0; i < 9; i++) {
		chat.push({
			mes:
				i % 2 === 0
					? `*Elena does something in message ${i}.*`
					: `User does something in message ${i}.`,
			is_user: i % 2 !== 0,
			is_system: false,
			name: i % 2 === 0 ? 'Elena' : 'User',
		});
	}

	return {
		chat,
		characters: [{ name: 'Elena', description: 'A woman with auburn hair.' }],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A traveler.',
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test-profile',
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
			characters: 0.7,
			relationships: 0.6,
			scene: 0.6,
			narrative: 0.7,
			chapters: 0.5,
		},
		customPrompts: {},
		maxMessagesToSend: 10,
		maxChapterMessagesToSend: 24,
		includeWorldinfo: false,
		...overrides,
	};
}

/**
 * Create a mock initial snapshot.
 */
function createMockSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
	return {
		type: 'initial',
		source: { messageId: 0, swipeId: 0 },
		timestamp: Date.now(),
		swipeId: 0,
		time: '2024-11-14T15:00:00',
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'at a table',
			props: [],
			locationType: 'heated',
		},
		forecasts: {},
		climate: {
			temperature: 22,
			outdoorTemperature: 15,
			feelsLike: 14,
			humidity: 50,
			precipitation: 0,
			cloudCover: 20,
			windSpeed: 5,
			windDirection: 'N',
			conditions: 'Clear',
			conditionType: 'clear',
			uvIndex: 3,
			daylight: 'day',
			isIndoors: true,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'standing',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'blouse',
					legs: 'jeans',
					footwear: 'boots',
					socks: null,
					underwear: null,
				},
				akas: [],
			},
			Marcus: {
				name: 'Marcus',
				position: 'sitting',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'shirt',
					legs: 'pants',
					footwear: 'shoes',
					socks: null,
					underwear: null,
				},
				akas: [],
			},
		},
		relationships: {},
		scene: {
			topic: 'meeting',
			tone: 'casual',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
		...overrides,
	};
}

/**
 * Create a run strategy context.
 */
function createRunStrategyContext(
	settings: ExtractionSettings,
	context: ExtractionContext,
	store: EventStore,
	currentMessage: MessageAndSwipe,
	turnEvents: Event[] = [],
	ranAtMessages: MessageAndSwipe[] = [],
): RunStrategyContext {
	return {
		store,
		context,
		settings,
		currentMessage,
		turnEvents,
		ranAtMessages,
		producedAtMessages: [],
	};
}

describe('nicknameExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and at correct interval', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			// Message at index 7 (8th message, 0-indexed) should run with everyNMessages n=8
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 7,
				swipeId: 0,
			});

			expect(nicknameExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when characters tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, characters: false },
			});
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 7,
				swipeId: 0,
			});

			expect(nicknameExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false when not at correct message interval', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			// Message at index 3 should NOT run with everyNMessages n=8
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 3,
				swipeId: 0,
			});

			expect(nicknameExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('extracts nicknames and emits akas_add events', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Elena calls Marcus "sunshine", Marcus calls Elena "Lena".',
					nicknames: [
						{ character: 'Marcus', names: ['sunshine'] },
						{ character: 'Elena', names: ['Lena'] },
					],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toHaveLength(2);

			const marcusEvent = result.find(
				e =>
					e.kind === 'character' &&
					(e as CharacterAkasAddEvent).character === 'Marcus',
			) as CharacterAkasAddEvent;
			expect(marcusEvent).toBeDefined();
			expect(marcusEvent.subkind).toBe('akas_add');
			expect(marcusEvent.akas).toEqual(['sunshine']);

			const elenaEvent = result.find(
				e =>
					e.kind === 'character' &&
					(e as CharacterAkasAddEvent).character === 'Elena',
			) as CharacterAkasAddEvent;
			expect(elenaEvent).toBeDefined();
			expect(elenaEvent.subkind).toBe('akas_add');
			expect(elenaEvent.akas).toEqual(['Lena']);
		});

		it('deduplicates against existing AKAs', async () => {
			// Set up snapshot with Elena already having "Lena" as an AKA
			const snapshot = createMockSnapshot();
			snapshot.characters.Elena.akas = ['Lena'];
			store.replaceInitialSnapshot(snapshot);

			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Marcus calls Elena "Lena" and "sweetheart".',
					nicknames: [
						{
							character: 'Elena',
							names: ['Lena', 'sweetheart'],
						},
					],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toHaveLength(1);
			const event = result[0] as CharacterAkasAddEvent;
			// "Lena" should be filtered out since it already exists
			expect(event.akas).toEqual(['sweetheart']);
		});

		it('deduplicates case-insensitively against existing AKAs', async () => {
			const snapshot = createMockSnapshot();
			snapshot.characters.Elena.akas = ['Lena'];
			store.replaceInitialSnapshot(snapshot);

			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Testing case-insensitive dedup.',
					nicknames: [
						{ character: 'Elena', names: ['lena', 'LENA'] },
					],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Both "lena" and "LENA" match existing "Lena", so no events
			expect(result).toEqual([]);
		});

		it('skips canonical character names', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'LLM incorrectly extracted canonical names.',
					nicknames: [
						{ character: 'Elena', names: ['Elena'] },
						{
							character: 'Marcus',
							names: ['Marcus', 'sunshine'],
						},
					],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Elena entry should be skipped entirely (only canonical name)
			// Marcus should only have "sunshine" (canonical "Marcus" filtered)
			expect(result).toHaveLength(1);
			const event = result[0] as CharacterAkasAddEvent;
			expect(event.character).toBe('Marcus');
			expect(event.akas).toEqual(['sunshine']);
		});

		it('skips unresolvable character names', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'LLM returned unknown character.',
					nicknames: [
						{
							character: 'UnknownCharacter',
							names: ['nickname'],
						},
						{ character: 'Elena', names: ['Lena'] },
					],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Only Elena should produce an event
			expect(result).toHaveLength(1);
			const event = result[0] as CharacterAkasAddEvent;
			expect(event.character).toBe('Elena');
		});

		it('handles empty extraction result', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'No nicknames found.',
					nicknames: [],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toEqual([]);
		});

		it('resolves fuzzy character name matches', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 8, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'LLM used slightly different casing.',
					nicknames: [{ character: 'elena', names: ['Lena'] }],
				}),
			);

			const result = await nicknameExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toHaveLength(1);
			const event = result[0] as CharacterAkasAddEvent;
			// Should resolve to canonical "Elena"
			expect(event.character).toBe('Elena');
			expect(event.akas).toEqual(['Lena']);
		});
	});
});
