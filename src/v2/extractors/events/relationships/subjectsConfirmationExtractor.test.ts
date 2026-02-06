/**
 * Tests for subjectsConfirmationExtractor
 *
 * Focuses on the duplicate subject prevention logic and message limiting.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../../generator';
import { subjectsConfirmationExtractor } from './subjectsConfirmationExtractor';
import { EventStore } from '../../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../../types';
import type { MessageAndSwipe, Snapshot, RelationshipSubjectEvent, Event } from '../../../types';

/**
 * Helper to check if an event is a RelationshipSubjectEvent.
 */
function isSubjectEvent(event: Event): event is RelationshipSubjectEvent {
	return event.kind === 'relationship' && 'subkind' in event && event.subkind === 'subject';
}

/**
 * Check if a subject already exists for this pair in the CURRENT TURN only.
 * We allow the same subject to appear in different turns (historical),
 * but not twice in the same turn.
 *
 * This is a copy of the function from subjectsConfirmationExtractor.ts for testing.
 */
function subjectExistsInTurn(
	turnEvents: Event[],
	pair: [string, string],
	subject: string,
	excludeEventId?: string,
): boolean {
	const pairKey = `${pair[0].toLowerCase()}|${pair[1].toLowerCase()}`;

	for (const event of turnEvents) {
		if (!isSubjectEvent(event) || event.deleted) continue;
		if (excludeEventId && event.id === excludeEventId) continue;
		const eventPairKey = `${event.pair[0].toLowerCase()}|${event.pair[1].toLowerCase()}`;
		if (eventPairKey === pairKey && event.subject === subject) return true;
	}

	return false;
}

function createSubjectEvent(
	id: string,
	pair: [string, string],
	subject: string,
	deleted = false,
): RelationshipSubjectEvent {
	return {
		id,
		source: { messageId: 1, swipeId: 0 },
		timestamp: Date.now(),
		kind: 'relationship',
		subkind: 'subject',
		pair,
		subject: subject as any,
		deleted,
	};
}

describe('subjectExistsInTurn', () => {
	it('returns false when turnEvents is empty', () => {
		const result = subjectExistsInTurn([], ['Alice', 'Bob'], 'trust');
		expect(result).toBe(false);
	});

	it('returns false when no matching subject exists', () => {
		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Bob'], 'conflict'),
		];
		const result = subjectExistsInTurn(turnEvents, ['Alice', 'Bob'], 'trust');
		expect(result).toBe(false);
	});

	it('returns true when matching subject exists for same pair', () => {
		const turnEvents: Event[] = [createSubjectEvent('e1', ['Alice', 'Bob'], 'trust')];
		const result = subjectExistsInTurn(turnEvents, ['Alice', 'Bob'], 'trust');
		expect(result).toBe(true);
	});

	it('returns false when subject exists for different pair', () => {
		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Charlie'], 'trust'),
		];
		const result = subjectExistsInTurn(turnEvents, ['Alice', 'Bob'], 'trust');
		expect(result).toBe(false);
	});

	it('ignores deleted events', () => {
		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Bob'], 'trust', true), // deleted
		];
		const result = subjectExistsInTurn(turnEvents, ['Alice', 'Bob'], 'trust');
		expect(result).toBe(false);
	});

	it('excludes the specified event by ID', () => {
		const turnEvents: Event[] = [createSubjectEvent('e1', ['Alice', 'Bob'], 'trust')];
		const result = subjectExistsInTurn(
			turnEvents,
			['Alice', 'Bob'],
			'trust',
			'e1', // exclude this event
		);
		expect(result).toBe(false);
	});

	it('finds duplicate when excluding different event', () => {
		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Bob'], 'trust'),
			createSubjectEvent('e2', ['Alice', 'Bob'], 'conflict'),
		];
		const result = subjectExistsInTurn(
			turnEvents,
			['Alice', 'Bob'],
			'trust',
			'e2', // exclude e2, but e1 still matches
		);
		expect(result).toBe(true);
	});

	it('handles case-insensitive pair matching', () => {
		const turnEvents: Event[] = [createSubjectEvent('e1', ['Alice', 'Bob'], 'trust')];
		const result = subjectExistsInTurn(turnEvents, ['alice', 'bob'], 'trust');
		expect(result).toBe(true);
	});

	it('ignores non-subject events', () => {
		const turnEvents: Event[] = [
			{
				id: 'e1',
				source: { messageId: 1, swipeId: 0 },
				timestamp: Date.now(),
				kind: 'relationship',
				subkind: 'feeling_added',
				fromCharacter: 'Alice',
				towardCharacter: 'Bob',
				value: 'trust',
			} as any,
		];
		const result = subjectExistsInTurn(turnEvents, ['Alice', 'Bob'], 'trust');
		expect(result).toBe(false);
	});

	it('finds duplicate among multiple events', () => {
		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Bob'], 'conflict'),
			createSubjectEvent('e2', ['Alice', 'Charlie'], 'trust'),
			createSubjectEvent('e3', ['Alice', 'Bob'], 'trust'),
			createSubjectEvent('e4', ['Bob', 'Charlie'], 'attraction'),
		];
		const result = subjectExistsInTurn(turnEvents, ['Alice', 'Bob'], 'trust');
		expect(result).toBe(true);
	});
});

describe('duplicate subject prevention in corrections', () => {
	it('would delete event if correcting to existing subject in turn', () => {
		// Simulate the scenario: we have two subject events
		// e1: Alice|Bob - conflict
		// e2: Alice|Bob - trust (to be corrected to "conflict")
		// Correcting e2 to "conflict" would duplicate e1, so e2 should be deleted

		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Bob'], 'conflict'),
			createSubjectEvent('e2', ['Alice', 'Bob'], 'trust'),
		];

		const subjectEvent = turnEvents[1] as RelationshipSubjectEvent;
		const correctedSubject = 'conflict';

		// Check if correction would create duplicate
		const wouldDuplicate = subjectExistsInTurn(
			turnEvents,
			subjectEvent.pair,
			correctedSubject,
			subjectEvent.id,
		);

		expect(wouldDuplicate).toBe(true);
		// In real code, this would cause subjectEvent.deleted = true
	});

	it('would allow correction if no duplicate exists', () => {
		// e1: Alice|Bob - conflict
		// e2: Alice|Bob - trust (to be corrected to "attraction")
		// Correcting e2 to "attraction" is fine, no duplicate

		const turnEvents: Event[] = [
			createSubjectEvent('e1', ['Alice', 'Bob'], 'conflict'),
			createSubjectEvent('e2', ['Alice', 'Bob'], 'trust'),
		];

		const subjectEvent = turnEvents[1] as RelationshipSubjectEvent;
		const correctedSubject = 'attraction';

		// Check if correction would create duplicate
		const wouldDuplicate = subjectExistsInTurn(
			turnEvents,
			subjectEvent.pair,
			correctedSubject,
			subjectEvent.id,
		);

		expect(wouldDuplicate).toBe(false);
		// In real code, subjectEvent.subject would be updated to "attraction"
	});

	it('handles historical duplicates (different turns) correctly', () => {
		// Same subject can appear in different turns (for historical tracking)
		// This test ensures we only prevent duplicates within the SAME turn

		// Simulate: e1 is from a previous turn (not in turnEvents)
		// e2 is in current turn and being corrected to same subject as e1

		const turnEvents: Event[] = [
			// Only current turn events
			createSubjectEvent('e2', ['Alice', 'Bob'], 'trust'),
		];

		const subjectEvent = turnEvents[0] as RelationshipSubjectEvent;
		const correctedSubject = 'conflict'; // same as historical e1 (not in turnEvents)

		// Should NOT detect duplicate because e1 is not in current turn
		const wouldDuplicate = subjectExistsInTurn(
			turnEvents,
			subjectEvent.pair,
			correctedSubject,
			subjectEvent.id,
		);

		expect(wouldDuplicate).toBe(false);
	});
});

/**
 * Create a mock extraction context for testing.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena smiles warmly at Marcus.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'I watch their interaction.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
			{
				mes: '*Elena and Marcus share a meaningful look.*',
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
			},
			Marcus: {
				name: 'Marcus',
				position: 'standing',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: 'jacket',
					back: null,
					torso: 'shirt',
					legs: 'pants',
					footwear: 'shoes',
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {
			'Elena|Marcus': {
				pair: ['Elena', 'Marcus'],
				status: 'acquaintances',
				aToB: { feelings: [], secrets: [], wants: [] },
				bToA: { feelings: [], secrets: [], wants: [] },
			},
		},
		scene: {
			topic: 'meeting',
			tone: 'casual',
			tension: { level: 'relaxed', type: 'conversation', direction: 'stable' },
		},
		currentChapter: 0,
		narrativeEvents: [],
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

describe('subjectsConfirmationExtractor', () => {
	let mockGenerator: MockGenerator;
	let store: EventStore;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		store = new EventStore();
		store.replaceInitialSnapshot(createMockSnapshot());
	});

	describe('extractor configuration', () => {
		it('has the correct name', () => {
			expect(subjectsConfirmationExtractor.name).toBe('subjectsConfirmation');
		});

		it('has the correct category', () => {
			expect(subjectsConfirmationExtractor.category).toBe('relationships');
		});

		it('has a default temperature', () => {
			expect(subjectsConfirmationExtractor.defaultTemperature).toBe(0.2);
		});

		it('uses fixedNumber message strategy with n=2', () => {
			expect(subjectsConfirmationExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 2,
			});
		});

		it('uses newEventsOfKind run strategy', () => {
			expect(subjectsConfirmationExtractor.runStrategy).toEqual({
				strategy: 'newEventsOfKind',
				kinds: [{ kind: 'relationship', subkind: 'subject' }],
			});
		});
	});

	describe('shouldRun', () => {
		it('returns false when relationships tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, relationships: false },
			});
			const runContext = createRunStrategyContext(settings, context, store, {
				messageId: 2,
				swipeId: 0,
			});

			expect(subjectsConfirmationExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns false when no subject events in turnEvents', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				[], // no turn events
			);

			expect(subjectsConfirmationExtractor.shouldRun(runContext)).toBe(false);
		});

		it('returns true when subject events exist in turnEvents', () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const turnEvents: Event[] = [
				createSubjectEvent('e1', ['Elena', 'Marcus'], 'trust'),
			];
			const runContext = createRunStrategyContext(
				settings,
				context,
				store,
				{ messageId: 2, swipeId: 0 },
				turnEvents,
			);

			expect(subjectsConfirmationExtractor.shouldRun(runContext)).toBe(true);
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

			// Create a subject event to trigger confirmation
			const turnEvents: Event[] = [
				createSubjectEvent('e1', ['Elena', 'Marcus'], 'trust'),
			];

			mockGenerator.setDefaultResponse(
				JSON.stringify({
					result: 'accept',
					reasoning: 'Test acceptance.',
				}),
			);

			await subjectsConfirmationExtractor.run(
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
