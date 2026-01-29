import { describe, it, expect } from 'vitest';
import {
	sortPair,
	pairKey,
	hasMilestone,
	findUnestablishedPairs,
	formatRelationshipsForPrompt,
	createRelationship,
	addMilestone,
	getAttitudeDirection,
	narrativeDateTimeToNumber,
	compareNarrativeDateTime,
	isDateTimeOnOrAfter,
	clearMilestonesSince,
	clearAllMilestonesSince,
	clearMilestonesForMessage,
	clearAllMilestonesForMessage,
} from './relationships';
import type {
	Relationship,
	MilestoneEvent,
	MilestoneType,
	NarrativeDateTime,
} from '../types/state';

// Test timestamp for milestone creation
const testTimestamp: NarrativeDateTime = {
	year: 2024,
	month: 6,
	day: 15,
	hour: 14,
	minute: 30,
	second: 0,
	dayOfWeek: 'Saturday',
};

// Helper to create a test milestone with required fields
function createTestMilestone(type: MilestoneType, description: string): MilestoneEvent {
	return {
		type,
		description,
		timestamp: testTimestamp,
		location: 'Test Location, Test Area',
	};
}

describe('sortPair', () => {
	it('returns alphabetically sorted pair', () => {
		expect(sortPair('Bob', 'Alice')).toEqual(['Alice', 'Bob']);
		expect(sortPair('Alice', 'Bob')).toEqual(['Alice', 'Bob']);
	});

	it('handles same name', () => {
		expect(sortPair('Alice', 'Alice')).toEqual(['Alice', 'Alice']);
	});

	it('handles unicode names', () => {
		expect(sortPair('Émile', 'André')).toEqual(['André', 'Émile']);
		expect(sortPair('日本語', 'English')).toEqual(['English', '日本語']);
	});

	it('handles case sensitivity correctly', () => {
		// localeCompare puts lowercase after uppercase by default
		const result = sortPair('alice', 'Bob');
		expect(result).toEqual(['alice', 'Bob']);
	});
});

describe('pairKey', () => {
	it('returns deterministic key regardless of order', () => {
		// Keys are always lowercased for case-insensitive comparison
		expect(pairKey('Alice', 'Bob')).toBe('alice|bob');
		expect(pairKey('Bob', 'Alice')).toBe('alice|bob');
	});

	it('handles special characters in names', () => {
		expect(pairKey("O'Brien", 'Smith')).toBe("o'brien|smith");
		expect(pairKey('Smith', "O'Brien")).toBe("o'brien|smith");
	});

	it('handles names with pipes', () => {
		// This is an edge case - names with pipes could cause issues
		// but we document this as expected behavior
		expect(pairKey('A|B', 'C')).toBe('a|b|c');
	});

	it('produces case-insensitive keys', () => {
		// Different casings should produce the same key
		expect(pairKey('Alice', 'Bob')).toBe(pairKey('ALICE', 'BOB'));
		expect(pairKey('alice', 'bob')).toBe(pairKey('Alice', 'Bob'));
	});
});

describe('hasMilestone', () => {
	const createRelationshipWithMilestones = (milestones: MilestoneEvent[]): Relationship => ({
		pair: ['Alice', 'Bob'],
		status: 'acquaintances',
		aToB: { feelings: [], secrets: [], wants: [] },
		bToA: { feelings: [], secrets: [], wants: [] },
		milestones,
		history: [],
		versions: [],
	});

	it('returns false for empty milestones array', () => {
		const rel = createRelationshipWithMilestones([]);
		expect(hasMilestone(rel, 'first_meeting')).toBe(false);
	});

	it('returns true for matching milestone', () => {
		const rel = createRelationshipWithMilestones([
			createTestMilestone('first_meeting', 'They met at a bar'),
		]);
		expect(hasMilestone(rel, 'first_meeting')).toBe(true);
	});

	it('returns false for non-matching milestone', () => {
		const rel = createRelationshipWithMilestones([
			createTestMilestone('first_meeting', 'They met at a bar'),
		]);
		expect(hasMilestone(rel, 'betrayal')).toBe(false);
	});

	it('handles multiple milestones of same type', () => {
		const rel = createRelationshipWithMilestones([
			createTestMilestone('secret_shared', 'First secret'),
			createTestMilestone('secret_shared', 'Second secret'),
		]);
		expect(hasMilestone(rel, 'secret_shared')).toBe(true);
	});
});

describe('findUnestablishedPairs', () => {
	it('returns empty array for no characters', () => {
		expect(findUnestablishedPairs([], [])).toEqual([]);
	});

	it('returns empty array for one character', () => {
		expect(findUnestablishedPairs(['Alice'], [])).toEqual([]);
	});

	it('returns all pairs when no relationships exist', () => {
		const result = findUnestablishedPairs(['Alice', 'Bob', 'Charlie'], []);
		expect(result).toHaveLength(3);
		expect(result).toContainEqual(['Alice', 'Bob']);
		expect(result).toContainEqual(['Alice', 'Charlie']);
		expect(result).toContainEqual(['Bob', 'Charlie']);
	});

	it('returns empty when all pairs exist', () => {
		const relationships: Relationship[] = [
			createRelationship('Alice', 'Bob'),
			createRelationship('Alice', 'Charlie'),
			createRelationship('Bob', 'Charlie'),
		];
		const result = findUnestablishedPairs(['Alice', 'Bob', 'Charlie'], relationships);
		expect(result).toHaveLength(0);
	});

	it('returns only missing pairs', () => {
		const relationships: Relationship[] = [createRelationship('Alice', 'Bob')];
		const result = findUnestablishedPairs(['Alice', 'Bob', 'Charlie'], relationships);
		expect(result).toHaveLength(2);
		expect(result).toContainEqual(['Alice', 'Charlie']);
		expect(result).toContainEqual(['Bob', 'Charlie']);
	});
});

describe('formatRelationshipsForPrompt', () => {
	it('returns message for empty relationships', () => {
		expect(formatRelationshipsForPrompt([])).toBe('No established relationships.');
	});

	it('formats relationship with asymmetric attitudes', () => {
		const relationship: Relationship = {
			pair: ['Alice', 'Bob'],
			status: 'complicated',
			aToB: {
				feelings: ['trusting', 'hopeful'],
				secrets: ['knows about the heist'],
				wants: ['friendship'],
			},
			bToA: {
				feelings: ['suspicious', 'curious'],
				secrets: [],
				wants: ['information'],
			},
			milestones: [createTestMilestone('first_meeting', 'Met at bar')],
			history: [],
			versions: [],
		};
		const result = formatRelationshipsForPrompt([relationship]);

		expect(result).toContain('Alice & Bob (complicated)');
		expect(result).toContain('Alice → Bob');
		expect(result).toContain('Feelings: trusting, hopeful');
		expect(result).toContain('Bob → Alice');
		expect(result).toContain('Feelings: suspicious, curious');
		expect(result).toContain("Secrets (Bob doesn't know): knows about the heist");
		expect(result).toContain('Milestones: first meeting');
	});

	it('filters secrets when includeSecrets is false', () => {
		const relationship: Relationship = {
			pair: ['Alice', 'Bob'],
			status: 'friendly',
			aToB: { feelings: ['happy'], secrets: ['secret info'], wants: [] },
			bToA: { feelings: ['happy'], secrets: [], wants: [] },
			milestones: [],
			history: [],
			versions: [],
		};
		const result = formatRelationshipsForPrompt([relationship], undefined, false);

		expect(result).not.toContain('Secrets');
		expect(result).not.toContain('secret info');
	});

	it('filters by present characters', () => {
		const relationships: Relationship[] = [
			createRelationship('Alice', 'Bob'),
			createRelationship('Charlie', 'David'),
		];
		const result = formatRelationshipsForPrompt(relationships, ['Alice', 'Bob']);

		expect(result).toContain('Alice & Bob');
		expect(result).not.toContain('Charlie');
		expect(result).not.toContain('David');
	});
});

describe('createRelationship', () => {
	it('creates relationship with sorted pair', () => {
		const rel = createRelationship('Bob', 'Alice');
		expect(rel.pair).toEqual(['Alice', 'Bob']);
	});

	it('creates relationship with default status', () => {
		const rel = createRelationship('Alice', 'Bob');
		expect(rel.status).toBe('strangers');
	});

	it('creates relationship with specified status', () => {
		const rel = createRelationship('Alice', 'Bob', 'friendly');
		expect(rel.status).toBe('friendly');
	});

	it('creates relationship with empty attitudes', () => {
		const rel = createRelationship('Alice', 'Bob');
		expect(rel.aToB).toEqual({ feelings: [], secrets: [], wants: [] });
		expect(rel.bToA).toEqual({ feelings: [], secrets: [], wants: [] });
	});
});

describe('addMilestone', () => {
	it('adds milestone to empty list', () => {
		const rel = createRelationship('Alice', 'Bob');
		addMilestone(rel, createTestMilestone('first_meeting', 'Met at bar'));

		expect(rel.milestones).toHaveLength(1);
		expect(rel.milestones[0].type).toBe('first_meeting');
	});

	it('does not add duplicate milestone type', () => {
		const rel = createRelationship('Alice', 'Bob');
		addMilestone(rel, createTestMilestone('first_meeting', 'Met at bar'));
		addMilestone(rel, createTestMilestone('first_meeting', 'Different description'));

		expect(rel.milestones).toHaveLength(1);
	});

	it('adds different milestone types', () => {
		const rel = createRelationship('Alice', 'Bob');
		addMilestone(rel, createTestMilestone('first_meeting', 'Met at bar'));
		addMilestone(rel, createTestMilestone('secret_shared', 'Shared a secret'));

		expect(rel.milestones).toHaveLength(2);
	});
});

describe('getAttitudeDirection', () => {
	it('returns aToB for first character in pair', () => {
		const rel = createRelationship('Alice', 'Bob'); // pair is ['Alice', 'Bob']
		expect(getAttitudeDirection(rel, 'Alice')).toBe('aToB');
	});

	it('returns bToA for second character in pair', () => {
		const rel = createRelationship('Alice', 'Bob');
		expect(getAttitudeDirection(rel, 'Bob')).toBe('bToA');
	});

	it('handles case insensitivity', () => {
		const rel = createRelationship('Alice', 'Bob');
		expect(getAttitudeDirection(rel, 'ALICE')).toBe('aToB');
		expect(getAttitudeDirection(rel, 'bob')).toBe('bToA');
	});
});

describe('narrativeDateTimeToNumber', () => {
	it('converts datetime to comparable number', () => {
		const dt: NarrativeDateTime = {
			year: 2024,
			month: 6,
			day: 15,
			hour: 14,
			minute: 30,
			second: 45,
			dayOfWeek: 'Saturday',
		};
		const num = narrativeDateTimeToNumber(dt);
		expect(num).toBe(20240615143045);
	});

	it('handles single digit values correctly', () => {
		const dt: NarrativeDateTime = {
			year: 2024,
			month: 1,
			day: 5,
			hour: 9,
			minute: 5,
			second: 3,
			dayOfWeek: 'Friday',
		};
		const num = narrativeDateTimeToNumber(dt);
		expect(num).toBe(20240105090503);
	});
});

describe('compareNarrativeDateTime', () => {
	const earlier: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 15,
		hour: 10,
		minute: 0,
		second: 0,
		dayOfWeek: 'Saturday',
	};

	const later: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 15,
		hour: 14,
		minute: 30,
		second: 0,
		dayOfWeek: 'Saturday',
	};

	it('returns negative when first is earlier', () => {
		expect(compareNarrativeDateTime(earlier, later)).toBeLessThan(0);
	});

	it('returns positive when first is later', () => {
		expect(compareNarrativeDateTime(later, earlier)).toBeGreaterThan(0);
	});

	it('returns zero for equal times', () => {
		expect(compareNarrativeDateTime(earlier, earlier)).toBe(0);
	});
});

describe('isDateTimeOnOrAfter', () => {
	const reference: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Saturday',
	};

	it('returns true for same time', () => {
		expect(isDateTimeOnOrAfter(reference, reference)).toBe(true);
	});

	it('returns true for later time', () => {
		const later: NarrativeDateTime = { ...reference, hour: 14 };
		expect(isDateTimeOnOrAfter(later, reference)).toBe(true);
	});

	it('returns false for earlier time', () => {
		const earlier: NarrativeDateTime = { ...reference, hour: 10 };
		expect(isDateTimeOnOrAfter(earlier, reference)).toBe(false);
	});
});

describe('clearMilestonesSince', () => {
	const earlyTimestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 10,
		hour: 10,
		minute: 0,
		second: 0,
		dayOfWeek: 'Monday',
	};

	const midTimestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Saturday',
	};

	const lateTimestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 20,
		hour: 14,
		minute: 0,
		second: 0,
		dayOfWeek: 'Thursday',
	};

	it('removes milestones on or after the given time', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_meeting',
				description: 'Early',
				timestamp: earlyTimestamp,
				location: 'Park',
			},
			{
				type: 'first_kiss',
				description: 'Mid',
				timestamp: midTimestamp,
				location: 'Cafe',
			},
			{
				type: 'first_embrace',
				description: 'Late',
				timestamp: lateTimestamp,
				location: 'Home',
			},
		];

		const removed = clearMilestonesSince(rel, midTimestamp);

		expect(removed).toBe(2); // mid and late
		expect(rel.milestones).toHaveLength(1);
		expect(rel.milestones[0].type).toBe('first_meeting');
	});

	it('removes nothing if all milestones are earlier', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_meeting',
				description: 'Early',
				timestamp: earlyTimestamp,
				location: 'Park',
			},
		];

		const removed = clearMilestonesSince(rel, lateTimestamp);

		expect(removed).toBe(0);
		expect(rel.milestones).toHaveLength(1);
	});

	it('removes all milestones if all are on or after', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_kiss',
				description: 'Mid',
				timestamp: midTimestamp,
				location: 'Cafe',
			},
			{
				type: 'first_embrace',
				description: 'Late',
				timestamp: lateTimestamp,
				location: 'Home',
			},
		];

		const removed = clearMilestonesSince(rel, earlyTimestamp);

		expect(removed).toBe(2);
		expect(rel.milestones).toHaveLength(0);
	});
});

describe('clearAllMilestonesSince', () => {
	const earlyTimestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 10,
		hour: 10,
		minute: 0,
		second: 0,
		dayOfWeek: 'Monday',
	};

	const lateTimestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 20,
		hour: 14,
		minute: 0,
		second: 0,
		dayOfWeek: 'Thursday',
	};

	it('clears milestones from multiple relationships', () => {
		const rel1 = createRelationship('Alice', 'Bob');
		rel1.milestones = [
			{
				type: 'first_meeting',
				description: 'Early',
				timestamp: earlyTimestamp,
				location: 'Park',
			},
			{
				type: 'first_kiss',
				description: 'Late',
				timestamp: lateTimestamp,
				location: 'Home',
			},
		];

		const rel2 = createRelationship('Charlie', 'Diana');
		rel2.milestones = [
			{
				type: 'first_meeting',
				description: 'Late',
				timestamp: lateTimestamp,
				location: 'Office',
			},
		];

		const midTimestamp: NarrativeDateTime = {
			year: 2024,
			month: 6,
			day: 15,
			hour: 12,
			minute: 0,
			second: 0,
			dayOfWeek: 'Saturday',
		};

		const totalRemoved = clearAllMilestonesSince([rel1, rel2], midTimestamp);

		expect(totalRemoved).toBe(2); // first_kiss from rel1, first_meeting from rel2
		expect(rel1.milestones).toHaveLength(1);
		expect(rel2.milestones).toHaveLength(0);
	});

	it('returns 0 when no milestones to clear', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_meeting',
				description: 'Early',
				timestamp: earlyTimestamp,
				location: 'Park',
			},
		];

		const totalRemoved = clearAllMilestonesSince([rel], lateTimestamp);

		expect(totalRemoved).toBe(0);
		expect(rel.milestones).toHaveLength(1);
	});
});

describe('clearMilestonesForMessage', () => {
	const timestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Saturday',
	};

	it('removes milestones with matching messageId', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_meeting',
				description: 'Test',
				timestamp,
				location: 'Park',
				messageId: 5,
			},
			{
				type: 'first_kiss',
				description: 'Test',
				timestamp,
				location: 'Cafe',
				messageId: 10,
			},
			{
				type: 'first_embrace',
				description: 'Test',
				timestamp,
				location: 'Home',
				messageId: 5,
			},
		];

		const removed = clearMilestonesForMessage(rel, 5);

		expect(removed).toBe(2);
		expect(rel.milestones).toHaveLength(1);
		expect(rel.milestones[0].type).toBe('first_kiss');
	});

	it('removes nothing if no matching messageId', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_meeting',
				description: 'Test',
				timestamp,
				location: 'Park',
				messageId: 5,
			},
		];

		const removed = clearMilestonesForMessage(rel, 10);

		expect(removed).toBe(0);
		expect(rel.milestones).toHaveLength(1);
	});

	it('handles milestones without messageId', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{ type: 'first_meeting', description: 'Test', timestamp, location: 'Park' }, // no messageId
			{
				type: 'first_kiss',
				description: 'Test',
				timestamp,
				location: 'Cafe',
				messageId: 5,
			},
		];

		const removed = clearMilestonesForMessage(rel, 5);

		expect(removed).toBe(1);
		expect(rel.milestones).toHaveLength(1);
		expect(rel.milestones[0].type).toBe('first_meeting');
	});
});

describe('clearAllMilestonesForMessage', () => {
	const timestamp: NarrativeDateTime = {
		year: 2024,
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Saturday',
	};

	it('clears milestones from multiple relationships', () => {
		const rel1 = createRelationship('Alice', 'Bob');
		rel1.milestones = [
			{
				type: 'first_meeting',
				description: 'Test',
				timestamp,
				location: 'Park',
				messageId: 5,
			},
			{
				type: 'first_kiss',
				description: 'Test',
				timestamp,
				location: 'Home',
				messageId: 10,
			},
		];

		const rel2 = createRelationship('Charlie', 'Diana');
		rel2.milestones = [
			{
				type: 'first_meeting',
				description: 'Test',
				timestamp,
				location: 'Office',
				messageId: 5,
			},
		];

		const totalRemoved = clearAllMilestonesForMessage([rel1, rel2], 5);

		expect(totalRemoved).toBe(2);
		expect(rel1.milestones).toHaveLength(1);
		expect(rel1.milestones[0].messageId).toBe(10);
		expect(rel2.milestones).toHaveLength(0);
	});

	it('returns 0 when no matching messageId', () => {
		const rel = createRelationship('Alice', 'Bob');
		rel.milestones = [
			{
				type: 'first_meeting',
				description: 'Test',
				timestamp,
				location: 'Park',
				messageId: 5,
			},
		];

		const totalRemoved = clearAllMilestonesForMessage([rel], 99);

		expect(totalRemoved).toBe(0);
		expect(rel.milestones).toHaveLength(1);
	});
});
