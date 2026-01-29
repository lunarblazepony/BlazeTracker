/**
 * Props Change Event Extractor Tests
 *
 * Tests that verify the props change extractor builds prompts correctly
 * and integrates with outfit changes properly.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { propsChangeExtractor } from './propsChangeExtractor';
import { EventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type {
	MessageAndSwipe,
	Snapshot,
	Event,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
	CharacterOutfitChangedEvent,
	OutfitSlot,
} from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena walks into the coffee shop, her leather jacket creaking as she moves.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I wave her over to my table.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*Elena takes off her jacket and drapes it over the chair, then picks up the menu from the table.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
		],
		characters: [
			{
				name: 'Elena',
				description: 'A woman with auburn hair.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A regular customer at the coffee shop.',
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
		...overrides,
	};
}

/**
 * Create a mock initial snapshot.
 */
function createMockSnapshot(): Snapshot {
	return {
		type: 'initial',
		source: { messageId: 0, swipeId: 0 },
		timestamp: Date.now(),
		swipeId: 0,
		time: '2024-11-14T15:00:00',
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'at a table by the window',
			props: ['menu', 'coffee mug'],
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
				position: 'entering the coffee shop',
				activity: 'walking in',
				mood: ['pleased'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: 'leather jacket',
					back: null,
					torso: 'white blouse',
					legs: 'jeans',
					footwear: 'boots',
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {},
		scene: {
			topic: 'Meeting up',
			tone: 'Casual',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

/**
 * Create a run strategy context for testing shouldRun.
 */
function createRunStrategyContext(
	settings: ExtractionSettings,
	context: ExtractionContext,
	store: EventStore,
	currentMessage: MessageAndSwipe,
	turnEvents: Event[] = [],
): RunStrategyContext {
	return {
		store,
		context,
		settings,
		currentMessage,
		turnEvents,
		ranAtMessages: [],
		producedAtMessages: [],
	};
}

/**
 * Create a mock outfit changed event.
 */
function createOutfitChangedEvent(
	character: string,
	slot: OutfitSlot,
	previousValue: string | null,
	newValue: string | null,
	messageId: number,
): CharacterOutfitChangedEvent {
	return {
		id: crypto.randomUUID(),
		source: { messageId, swipeId: 0 },
		timestamp: Date.now(),
		kind: 'character',
		subkind: 'outfit_changed',
		character,
		slot,
		previousValue,
		newValue,
	};
}

describe('propsChangeExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when props tracking is enabled', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(propsChangeExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when props tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, props: false },
			});
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(propsChangeExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('outfit integration', () => {
		it('passes character outfits to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'A newspaper was left on the table.',
					added: ['newspaper'],
					removed: [],
				}),
			);

			await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			// Should include outfit items
			expect(promptContent).toContain('leather jacket');
			expect(promptContent).toContain('white blouse');
		});

		it('passes outfit changes from turn events to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Simulate Elena removing her jacket (turn event)
			const outfitEvent = createOutfitChangedEvent(
				'Elena',
				'jacket',
				'leather jacket',
				null,
				2,
			);

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Elena removed her jacket.',
					added: ['leather jacket'],
					removed: [],
				}),
			);

			await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[outfitEvent],
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			// Should include the outfit changes
			expect(promptContent).toContain('removed');
			expect(promptContent).toContain('leather jacket');
		});

		it('filters out props that match worn outfit items', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// LLM suggests adding items that are actually worn
			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Items in the scene.',
					added: [
						'newspaper', // Valid prop
						'white blouse', // Worn by Elena - should be filtered
						'boots', // Worn by Elena - should be filtered
					],
					removed: [],
				}),
			);

			const result = await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Should only add props that are NOT worn
			const addedEvents = result.filter(
				e => e.kind === 'location' && e.subkind === 'prop_added',
			) as LocationPropAddedEvent[];

			expect(addedEvents.length).toBe(1);
			expect(addedEvents[0].prop).toBe('newspaper');
		});

		it('allows removed clothing to become scene props', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Simulate Elena removing her jacket (turn event)
			const outfitEvent = createOutfitChangedEvent(
				'Elena',
				'jacket',
				'leather jacket',
				null,
				2,
			);

			// LLM adds the jacket as a scene prop
			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Elena put her jacket on the chair.',
					added: ['leather jacket on chair'],
					removed: [],
				}),
			);

			const result = await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[outfitEvent], // Include outfit event so jacket is not worn anymore
			);

			// Jacket should be added as a prop since it's no longer worn
			const addedEvents = result.filter(
				e => e.kind === 'location' && e.subkind === 'prop_added',
			) as LocationPropAddedEvent[];

			expect(addedEvents.length).toBe(1);
			expect(addedEvents[0].prop).toBe('leather jacket on chair');
		});
	});

	describe('run', () => {
		it('passes current props to the prompt', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'No changes.',
					added: [],
					removed: [],
				}),
			);

			await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');
			// Should include current props from snapshot
			expect(promptContent).toContain('menu');
			expect(promptContent).toContain('coffee mug');
		});

		it('returns LocationPropAddedEvent for new props', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'A newspaper appeared on the table.',
					added: ['newspaper'],
					removed: [],
				}),
			);

			const result = await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result.length).toBe(1);
			expect(result[0].kind).toBe('location');
			expect((result[0] as LocationPropAddedEvent).subkind).toBe('prop_added');
			expect((result[0] as LocationPropAddedEvent).prop).toBe('newspaper');
		});

		it('returns LocationPropRemovedEvent for removed props', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Someone took the menu.',
					added: [],
					removed: ['menu'],
				}),
			);

			const result = await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result.length).toBe(1);
			expect(result[0].kind).toBe('location');
			expect((result[0] as LocationPropRemovedEvent).subkind).toBe(
				'prop_removed',
			);
			expect((result[0] as LocationPropRemovedEvent).prop).toBe('menu');
		});

		it('returns empty array when no prop changes', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'No changes to props.',
					added: [],
					removed: [],
				}),
			);

			const result = await propsChangeExtractor.run(
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
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await propsChangeExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(result).toEqual([]);
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(propsChangeExtractor.name).toBe('propsChange');
		});

		it('has the correct category', () => {
			expect(propsChangeExtractor.category).toBe('props');
		});

		it('has a default temperature', () => {
			expect(propsChangeExtractor.defaultTemperature).toBe(0.4);
		});
	});
});
