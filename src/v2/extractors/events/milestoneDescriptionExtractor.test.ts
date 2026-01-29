/**
 * Milestone Description Event Extractor Tests
 *
 * Tests that verify the milestone description extractor correctly identifies
 * new milestones using swipe-aware logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { milestoneDescriptionExtractor } from './milestoneDescriptionExtractor';
import { EventStore } from '../../store';
import { generateEventId } from '../../store/serialization';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type { MessageAndSwipe, Snapshot, Event, RelationshipSubjectEvent } from '../../types';

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena greets the stranger warmly.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
				swipe_id: 0,
			},
			{
				mes: 'I smile back at Elena.',
				is_user: true,
				is_system: false,
				name: 'User',
				swipe_id: 0,
			},
			{
				mes: '*Elena reaches out and gently touches your hand for the first time.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
				swipe_id: 0,
			},
		],
		characters: [
			{
				name: 'Elena',
				description: 'A kind woman.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A friendly person.',
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
		time: '2024-11-14T14:00:00',
		location: {
			area: 'Town',
			place: 'Cafe',
			position: 'at a table',
			props: ['table', 'chairs', 'cups'],
			locationType: 'heated',
		},
		forecasts: {},
		climate: {
			temperature: 22,
			outdoorTemperature: 18,
			feelsLike: 18,
			humidity: 50,
			precipitation: 0,
			cloudCover: 20,
			windSpeed: 5,
			windDirection: 'N',
			conditions: 'Partly Cloudy',
			conditionType: 'partly_cloudy',
			uvIndex: 3,
			daylight: 'day',
			isIndoors: true,
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'seated across',
				activity: 'talking',
				mood: ['friendly'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'blouse',
					legs: 'skirt',
					footwear: 'heels',
					socks: null,
					underwear: null,
				},
			},
			User: {
				name: 'User',
				position: 'seated',
				activity: 'talking',
				mood: ['curious'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 't-shirt',
					legs: 'jeans',
					footwear: 'sneakers',
					socks: 'socks',
					underwear: null,
				},
			},
		},
		relationships: {
			'Elena|User': {
				pair: ['Elena', 'User'],
				status: 'strangers',
				aToB: { feelings: ['curious'], wants: [], secrets: [] },
				bToA: { feelings: ['interested'], wants: [], secrets: [] },
			},
		},
		scene: {
			topic: 'Getting to know each other',
			tone: 'Warm',
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
 * Create a RelationshipSubjectEvent for testing.
 */
function createSubjectEvent(
	pair: [string, string],
	subject: RelationshipSubjectEvent['subject'],
	messageId: number,
	swipeId: number = 0,
	timestamp?: number,
): RelationshipSubjectEvent {
	return {
		id: generateEventId(),
		kind: 'relationship',
		subkind: 'subject',
		source: { messageId, swipeId },
		timestamp: timestamp ?? Date.now(),
		pair,
		subject,
	};
}

describe('milestoneDescriptionExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('shouldRun', () => {
		it('returns true when narrative tracking is enabled and subject events exist in turnEvents', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const subjectEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
			);
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				[subjectEvent],
			);

			expect(milestoneDescriptionExtractor.shouldRun(runContext)).toBe(true);
		});

		it('returns false when narrative tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, narrative: false },
			});
			const subjectEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
			);
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				[subjectEvent],
			);

			expect(milestoneDescriptionExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false when no subject events in turnEvents', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(milestoneDescriptionExtractor.shouldRun(runContext)).toBe(false);
		});
	});

	describe('milestone first-occurrence detection', () => {
		it('detects milestone when no prior occurrence exists', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Create subject event for intimate_touch - first occurrence
			const subjectEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
			);

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'This is the first time Elena touches the user.',
					description: 'Elena gently touched your hand at the cafe.',
				}),
			);

			await milestoneDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[subjectEvent],
			);

			// Verify the LLM was called (milestone was detected)
			expect(mockGenerator.getCalls().length).toBe(1);
			// Verify the milestone description was set on the event
			expect(subjectEvent.milestoneDescription).toBe(
				'Elena gently touched your hand at the cafe.',
			);
		});

		it('skips milestone when prior occurrence exists on canonical path', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Add a prior intimate_touch event to the store (on canonical path)
			const priorEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				1, // prior message
				0, // canonical swipe
			);
			store.appendEvents([priorEvent]);

			// New subject event for same pair and subject
			const subjectEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
			);

			await milestoneDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[subjectEvent],
			);

			// LLM should NOT be called since this is not a first occurrence
			expect(mockGenerator.getCalls().length).toBe(0);
			expect(subjectEvent.milestoneDescription).toBeUndefined();
		});

		it('detects milestone when prior occurrence only exists on non-canonical swipe', async () => {
			// Setup context where canonical swipe is 0, but prior event is on swipe 1
			const context = createMockContext({
				chat: [
					{
						mes: '*Elena greets the stranger warmly.*',
						is_user: false,
						is_system: false,
						name: 'Elena',
						swipe_id: 0, // Canonical is swipe 0
					},
					{
						mes: 'I smile back at Elena.',
						is_user: true,
						is_system: false,
						name: 'User',
						swipe_id: 0,
					},
					{
						mes: '*Elena reaches out and gently touches your hand.*',
						is_user: false,
						is_system: false,
						name: 'Elena',
						swipe_id: 0, // Current canonical swipe
					},
				],
			});
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Add prior event on a DIFFERENT swipe (non-canonical)
			const priorEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				1,
				1, // Non-canonical swipe
			);
			store.appendEvents([priorEvent]);

			// New subject event on canonical swipe
			const subjectEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
				0,
			);

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					reasoning: 'First occurrence on canonical path.',
					description: 'Elena touched your hand for the first time.',
				}),
			);

			await milestoneDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[subjectEvent],
			);

			// LLM SHOULD be called - the prior event is on a non-canonical swipe
			expect(mockGenerator.getCalls().length).toBe(1);
			expect(subjectEvent.milestoneDescription).toBe(
				'Elena touched your hand for the first time.',
			);
		});

		it('detects multiple milestones for different pairs in same turn', async () => {
			// Add Carol to the context
			const context = createMockContext({
				chat: [
					...createMockContext().chat.slice(0, 2),
					{
						mes: '*Elena touches your hand while Carol laughs at your joke.*',
						is_user: false,
						is_system: false,
						name: 'Elena',
						swipe_id: 0,
					},
				],
			});
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Add Carol to the snapshot
			const snapshot = createMockSnapshot();
			snapshot.characters['Carol'] = {
				name: 'Carol',
				position: 'seated nearby',
				activity: 'chatting',
				mood: ['amused'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'dress',
					legs: null,
					footwear: 'sandals',
					socks: null,
					underwear: null,
				},
			};
			snapshot.relationships['Carol|User'] = {
				pair: ['Carol', 'User'],
				status: 'acquaintances',
				aToB: { feelings: ['friendly'], wants: [], secrets: [] },
				bToA: { feelings: ['friendly'], wants: [], secrets: [] },
			};
			store.replaceInitialSnapshot(snapshot);

			// Two subject events for different pairs
			const touchEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
			);
			const laughEvent = createSubjectEvent(['Carol', 'User'], 'laugh', 2);

			let callCount = 0;
			mockGenerator.setDefaultResponse(() => {
				callCount++;
				return JSON.stringify({
					reasoning: `Milestone ${callCount}`,
					description: `Description ${callCount}`,
				});
			});

			await milestoneDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[touchEvent, laughEvent],
			);

			// Both should be detected as milestones
			expect(mockGenerator.getCalls().length).toBe(2);
			expect(touchEvent.milestoneDescription).toBe('Description 1');
			expect(laughEvent.milestoneDescription).toBe('Description 2');
		});

		it('detects multiple milestones for same pair in same turn', async () => {
			const context = createMockContext({
				chat: [
					...createMockContext().chat.slice(0, 2),
					{
						mes: '*Elena touches your hand, then leans in and kisses you.*',
						is_user: false,
						is_system: false,
						name: 'Elena',
						swipe_id: 0,
					},
				],
			});
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// Two different subject types for the same pair
			const touchEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_touch',
				2,
				0,
				Date.now(),
			);
			const kissEvent = createSubjectEvent(
				['Elena', 'User'],
				'intimate_kiss',
				2,
				0,
				Date.now() + 100,
			);

			let callCount = 0;
			mockGenerator.setDefaultResponse(() => {
				callCount++;
				return JSON.stringify({
					reasoning: `Milestone ${callCount}`,
					description: `Description ${callCount}`,
				});
			});

			await milestoneDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[touchEvent, kissEvent],
			);

			// Both should be detected as different milestone types
			expect(mockGenerator.getCalls().length).toBe(2);
			expect(touchEvent.milestoneDescription).toBeDefined();
			expect(kissEvent.milestoneDescription).toBeDefined();
		});

		it('does not detect non-milestone-worthy subjects as milestones', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			// 'conversation' is NOT milestone-worthy
			const conversationEvent = createSubjectEvent(
				['Elena', 'User'],
				'conversation',
				2,
			);

			await milestoneDescriptionExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[conversationEvent],
			);

			// LLM should NOT be called for non-milestone-worthy subjects
			expect(mockGenerator.getCalls().length).toBe(0);
			expect(conversationEvent.milestoneDescription).toBeUndefined();
		});
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(milestoneDescriptionExtractor.name).toBe('milestoneDescription');
		});

		it('has the correct category', () => {
			expect(milestoneDescriptionExtractor.category).toBe('narrative');
		});

		it('has a default temperature', () => {
			expect(milestoneDescriptionExtractor.defaultTemperature).toBe(0.5);
		});

		it('uses fixedNumber message strategy with n=2', () => {
			expect(milestoneDescriptionExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 2,
			});
		});

		it('uses newEventsOfKind run strategy for relationship subject events', () => {
			expect(milestoneDescriptionExtractor.runStrategy).toEqual({
				strategy: 'newEventsOfKind',
				kinds: [{ kind: 'relationship', subkind: 'subject' }],
			});
		});
	});
});
