/**
 * Tests for subjectsConfirmationExtractor
 *
 * Focuses on the duplicate subject prevention logic.
 */

import { describe, it, expect } from 'vitest';
import type { RelationshipSubjectEvent, Event } from '../../../types/event';

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
