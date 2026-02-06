/**
 * Tests for Appeared Character Profile Extractor
 *
 * Focuses on shouldRun logic, extractor properties, and message limiting.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { appearedCharacterProfileExtractor } from './appearedCharacterProfileExtractor';
import type { EventStore } from '../../../store';
import type { RunStrategyContext, ExtractionContext, ExtractionSettings } from '../../types';
import type { MessageAndSwipe, Event, CharacterAppearedEvent } from '../../../types';
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
		{ mes: 'Nice day!', is_user: true, is_system: false, name: 'User' },
		{ mes: 'Indeed!', is_user: false, is_system: false, name: 'Luna' },
		{ mes: 'How are you?', is_user: true, is_system: false, name: 'User' },
		{ mes: 'Great!', is_user: false, is_system: false, name: 'Luna' },
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

// Helper to create a character appeared event
const createAppearedEvent = (messageId: number, characterName: string): CharacterAppearedEvent => ({
	id: `appeared-${characterName}-${messageId}`,
	source: { messageId, swipeId: 0 },
	timestamp: Date.now(),
	kind: 'character',
	subkind: 'appeared',
	character: characterName,
	initialPosition: 'standing',
	initialActivity: undefined,
	initialMood: [],
	initialPhysicalState: [],
});

describe('appearedCharacterProfileExtractor', () => {
	describe('shouldRun', () => {
		it('returns true when characters tracking is enabled and there are new appeared events', () => {
			const store = createMockStore();
			const turnEvents: Event[] = [createAppearedEvent(1, 'Luna')];

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings: createMockSettings(),
				currentMessage: { messageId: 1, swipeId: 0 },
				turnEvents,
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(appearedCharacterProfileExtractor.shouldRun(context)).toBe(true);
		});

		it('returns false when there are no appeared events', () => {
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

			expect(appearedCharacterProfileExtractor.shouldRun(context)).toBe(false);
		});

		it('returns false when characters tracking is disabled', () => {
			const store = createMockStore();
			const settings = createMockSettings();
			settings.track.characters = false;
			const turnEvents: Event[] = [createAppearedEvent(1, 'Luna')];

			const context: RunStrategyContext = {
				store,
				context: createMockContext(),
				settings,
				currentMessage: { messageId: 1, swipeId: 0 },
				turnEvents,
				ranAtMessages: [],
				producedAtMessages: [],
			};

			expect(appearedCharacterProfileExtractor.shouldRun(context)).toBe(false);
		});
	});

	describe('extractor properties', () => {
		it('has correct name and category', () => {
			expect(appearedCharacterProfileExtractor.name).toBe(
				'appearedCharacterProfile',
			);
			expect(appearedCharacterProfileExtractor.category).toBe('characters');
		});

		it('has moderate temperature', () => {
			expect(appearedCharacterProfileExtractor.defaultTemperature).toBe(0.5);
		});

		it('uses fixedNumber message strategy with 6 messages', () => {
			expect(appearedCharacterProfileExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 6,
			});
		});

		it('uses custom run strategy', () => {
			// Uses custom strategy since shouldRun checks turnEvents manually
			expect(appearedCharacterProfileExtractor.runStrategy.strategy).toBe(
				'custom',
			);
		});
	});
});

describe('appearedCharacterProfileExtractor message limiting', () => {
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

	// Mock snapshot with character state
	const createMockSnapshotWithCharacter = (messageId: number = 0) => {
		const snapshot = createEmptySnapshot({ messageId, swipeId: 0 });
		const lunaState = createEmptyCharacterState('Luna');
		lunaState.position = 'standing';
		snapshot.characters = { Luna: lunaState };
		return snapshot;
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
						activity: null,
						mood: [],
						physicalState: [],
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
		settings.maxMessagesToSend = 3;
		const currentMessage: MessageAndSwipe = { messageId: 10, swipeId: 0 };
		const turnEvents: Event[] = [createAppearedEvent(10, 'Luna')];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Extracted profile.',
				character: 'Luna',
				profile: {
					sex: 'F',
					species: 'human',
					age: 25,
					appearance: ['long hair', 'blue eyes'],
					personality: ['friendly', 'cheerful'],
				},
			}),
		);

		await appearedCharacterProfileExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should NOT contain earlier messages
		expect(prompt).not.toContain('Message 0');
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 7');

		// Should contain the last 3 messages (8, 9, 10)
		expect(prompt).toContain('Message 8');
		expect(prompt).toContain('Message 9');
		expect(prompt).toContain('Message 10');
	});

	it('uses maxMessagesToSend not maxChapterMessagesToSend', async () => {
		const store = createStoreWithSnapshot();
		const context = createLargeContext(30);
		const settings = createMockSettings();
		settings.maxMessagesToSend = 3;
		settings.maxChapterMessagesToSend = 20;
		const currentMessage: MessageAndSwipe = { messageId: 10, swipeId: 0 };
		const turnEvents: Event[] = [createAppearedEvent(10, 'Luna')];

		mockGenerator.setDefaultResponse(
			JSON.stringify({
				reasoning: 'Extracted profile.',
				character: 'Luna',
				profile: {
					sex: 'F',
					species: 'human',
					age: 25,
					appearance: ['long hair', 'blue eyes'],
					personality: ['friendly', 'cheerful'],
				},
			}),
		);

		await appearedCharacterProfileExtractor.run(
			mockGenerator,
			context,
			settings,
			store,
			currentMessage,
			turnEvents,
		);

		const calls = mockGenerator.getCalls();
		expect(calls.length).toBeGreaterThan(0);

		const prompt = calls[0].prompt.messages.map(m => m.content).join('\n');

		// Should be limited to 3, not 20
		expect(prompt).not.toContain('Message 5');
		expect(prompt).not.toContain('Message 7');

		// Should contain last 3 messages
		expect(prompt).toContain('Message 8');
		expect(prompt).toContain('Message 9');
		expect(prompt).toContain('Message 10');
	});
});
