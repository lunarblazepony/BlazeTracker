/**
 * Props Confirmation Event Extractor Tests
 *
 * Tests that verify the props confirmation extractor confirms which
 * props are still present when new props are added.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { propsConfirmationExtractor } from './propsConfirmationExtractor';
import { EventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type {
	MessageAndSwipe,
	Snapshot,
	Event,
	LocationPropAddedEvent,
	LocationPropRemovedEvent,
} from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena sits at the table.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I pick up the menu.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*Elena notices a newspaper on the next table and reaches for it.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
		],
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
		includeWorldinfo: true,
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
			position: 'at a table',
			props: ['menu', 'coffee cup', 'sugar packets'],
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
				position: 'seated',
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
			},
		},
		relationships: {},
		scene: {
			topic: 'coffee meeting',
			tone: 'casual',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
	};
}

/**
 * Create a prop_added event.
 */
function createPropAddedEvent(messageId: number, prop: string): LocationPropAddedEvent {
	return {
		id: `prop-added-${messageId}-${prop}`,
		kind: 'location',
		subkind: 'prop_added',
		prop,
		source: { messageId, swipeId: 0 },
		timestamp: Date.now(),
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

describe('propsConfirmationExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when props tracking enabled and new prop_added events present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(propsConfirmationExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when props tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, props: false },
			});
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(propsConfirmationExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false when no prop_added events present', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				[],
			);

			expect(propsConfirmationExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns LocationPropRemovedEvent for props no longer present', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'The menu and coffee cup are still on the table, but the sugar packets are gone.',
					confirmed: ['menu', 'coffee cup', 'newspaper'],
					removed: ['sugar packets'],
				}),
			);

			const result = await propsConfirmationExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toHaveLength(1);
			expect(result[0].kind).toBe('location');
			expect((result[0] as LocationPropRemovedEvent).subkind).toBe(
				'prop_removed',
			);
			expect((result[0] as LocationPropRemovedEvent).prop).toBe('sugar packets');
		});

		it('returns empty array when all props are still present', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'All props are still visible.',
					confirmed: [
						'menu',
						'coffee cup',
						'sugar packets',
						'newspaper',
					],
					removed: [],
				}),
			);

			const result = await propsConfirmationExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when no props to confirm', async () => {
			// Create snapshot with no props
			const emptyPropsSnapshot = createMockSnapshot();
			emptyPropsSnapshot.location!.props = [];
			store.replaceInitialSnapshot(emptyPropsSnapshot);

			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];

			const result = await propsConfirmationExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toEqual([]);
		});

		it('returns empty array when LLM returns invalid JSON', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];

			mockGenerator.setDefaultResponse('Not valid JSON');

			const result = await propsConfirmationExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			expect(result).toEqual([]);
		});

		it('uses configured temperature', async () => {
			const context = createMockContext();
			const settings = createMockSettings({
				temperatures: {
					...createMockSettings().temperatures,
					location: 0.2,
				},
			});
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };
			const turnEvents = [createPropAddedEvent(2, 'newspaper')];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Test.',
					confirmed: ['menu', 'coffee cup', 'sugar packets'],
					removed: [],
				}),
			);

			await propsConfirmationExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall();
			expect(call!.settings.temperature).toBe(0.2);
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(propsConfirmationExtractor.name).toBe('propsConfirmation');
		});

		it('has the correct category', () => {
			expect(propsConfirmationExtractor.category).toBe('props');
		});

		it('has a default temperature', () => {
			expect(propsConfirmationExtractor.defaultTemperature).toBe(0.3);
		});

		it('uses sinceLastEventOfKind message strategy', () => {
			expect(propsConfirmationExtractor.messageStrategy).toEqual({
				strategy: 'sinceLastEventOfKind',
				kinds: [
					{ kind: 'location', subkind: 'prop_added' },
					{ kind: 'location', subkind: 'prop_removed' },
				],
			});
		});

		it('uses newEventsOfKind run strategy', () => {
			expect(propsConfirmationExtractor.runStrategy).toEqual({
				strategy: 'newEventsOfKind',
				kinds: [
					{ kind: 'location', subkind: 'prop_added' },
					{ kind: 'location', subkind: 'prop_removed' },
				],
			});
		});
	});

	describe('message limiting', () => {
		it('limits messages to maxMessagesToSend', async () => {
			const context = createMockContext({
				chat: [
					{
						mes: 'Message 0 - earliest',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 1',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 2',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 3',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 4',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 5',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 6',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 7',
						is_user: true,
						is_system: false,
						name: 'User',
					},
					{
						mes: 'Message 8',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
					{
						mes: 'Message 9 - latest',
						is_user: true,
						is_system: false,
						name: 'User',
					},
				],
			});

			const settings = createMockSettings({
				maxMessagesToSend: 3,
			});

			const currentMessage: MessageAndSwipe = { messageId: 9, swipeId: 0 };
			const turnEvents = [createPropAddedEvent(9, 'newspaper')];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'Props test.',
					confirmed: ['menu', 'coffee cup', 'sugar packets'],
					removed: [],
				}),
			);

			await propsConfirmationExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				turnEvents,
			);

			const call = mockGenerator.getLastCall();
			const promptContent = call!.prompt.messages.map(m => m.content).join('\n');

			expect(promptContent).not.toContain('Message 0 - earliest');
			expect(promptContent).not.toContain('Message 1');
			expect(promptContent).not.toContain('Message 5');
			expect(promptContent).not.toContain('Message 6');

			expect(promptContent).toContain('Message 9 - latest');
		});
	});
});
