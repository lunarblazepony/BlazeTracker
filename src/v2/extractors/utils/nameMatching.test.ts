import { describe, it, expect } from 'vitest';
import {
	namesMatch,
	normalizeName,
	findMatchingCharacterKey,
	buildNameLookup,
	findNameInLookup,
} from './nameMatching';

describe('nameMatching', () => {
	describe('normalizeName', () => {
		it('lowercases and trims', () => {
			expect(normalizeName('  John  ')).toBe('john');
		});

		it('strips titles', () => {
			expect(normalizeName('Dr. John Smith')).toBe('john smith');
			expect(normalizeName('Mr. Smith')).toBe('smith');
			expect(normalizeName('Mrs. Jane Doe')).toBe('jane doe');
			expect(normalizeName('Professor Xavier')).toBe('xavier');
		});

		it('collapses multiple spaces', () => {
			expect(normalizeName('John   Smith')).toBe('john smith');
		});

		it('only strips one title', () => {
			expect(normalizeName('Dr. Mr. Smith')).toBe('mr. smith');
		});
	});

	describe('namesMatch', () => {
		it('matches exact names', () => {
			expect(namesMatch('John', 'John')).toBe(true);
		});

		it('matches case-insensitive', () => {
			expect(namesMatch('John', 'john')).toBe(true);
			expect(namesMatch('JOHN', 'john')).toBe(true);
		});

		it('matches first name prefix', () => {
			expect(namesMatch('John Smith', 'John')).toBe(true);
		});

		it('matches when extracted has more names', () => {
			expect(namesMatch('John', 'John Smith')).toBe(true);
		});

		it('matches with title', () => {
			expect(namesMatch('Dr. John Smith', 'John Smith')).toBe(true);
			expect(namesMatch('Dr. John Smith', 'John')).toBe(true);
		});

		it('matches initials', () => {
			expect(namesMatch('J. Smith', 'John Smith')).toBe(true);
			expect(namesMatch('John Smith', 'J. Smith')).toBe(true);
		});

		it('matches single letter initials without period', () => {
			expect(namesMatch('J Smith', 'John Smith')).toBe(true);
		});

		it('rejects non-matching names', () => {
			expect(namesMatch('John', 'Jane')).toBe(false);
			expect(namesMatch('John Smith', 'Jane Doe')).toBe(false);
		});

		it('handles middle names', () => {
			expect(namesMatch('John Michael Smith', 'John Smith')).toBe(true);
		});

		it('handles empty strings', () => {
			expect(namesMatch('', '')).toBe(true);
			expect(namesMatch('John', '')).toBe(false);
		});
	});

	describe('findMatchingCharacterKey', () => {
		const availableNames = ['Elena', 'Dr. Marcus Chen', 'Alice'];

		it('finds exact match (case-insensitive)', () => {
			expect(findMatchingCharacterKey('elena', availableNames)).toBe('Elena');
			expect(findMatchingCharacterKey('ELENA', availableNames)).toBe('Elena');
			expect(findMatchingCharacterKey('Elena', availableNames)).toBe('Elena');
		});

		it('finds fuzzy match with title', () => {
			expect(findMatchingCharacterKey('Marcus Chen', availableNames)).toBe(
				'Dr. Marcus Chen',
			);
		});

		it('finds fuzzy match with first name only', () => {
			expect(findMatchingCharacterKey('Marcus', availableNames)).toBe(
				'Dr. Marcus Chen',
			);
		});

		it('returns null for no match', () => {
			expect(findMatchingCharacterKey('Bob', availableNames)).toBe(null);
		});

		it('prefers exact match over fuzzy match', () => {
			const names = ['Al', 'Alice'];
			expect(findMatchingCharacterKey('Alice', names)).toBe('Alice');
			expect(findMatchingCharacterKey('Al', names)).toBe('Al');
		});
	});

	describe('buildNameLookup', () => {
		it('builds lowercase lookup map', () => {
			const lookup = buildNameLookup(['Elena', 'Marcus']);
			expect(lookup.get('elena')).toBe('Elena');
			expect(lookup.get('marcus')).toBe('Marcus');
		});

		it('handles empty array', () => {
			const lookup = buildNameLookup([]);
			expect(lookup.size).toBe(0);
		});

		it('preserves original casing', () => {
			const lookup = buildNameLookup(['Dr. Marcus Chen']);
			expect(lookup.get('dr. marcus chen')).toBe('Dr. Marcus Chen');
		});
	});

	describe('findNameInLookup', () => {
		const names = ['Elena', 'Dr. Marcus Chen'];
		const lookup = buildNameLookup(names);

		it('finds exact match in lookup', () => {
			expect(findNameInLookup('elena', lookup, names)).toBe('Elena');
			expect(findNameInLookup('Elena', lookup, names)).toBe('Elena');
		});

		it('falls back to fuzzy match', () => {
			expect(findNameInLookup('Marcus', lookup, names)).toBe('Dr. Marcus Chen');
			expect(findNameInLookup('Marcus Chen', lookup, names)).toBe(
				'Dr. Marcus Chen',
			);
		});

		it('returns null for no match', () => {
			expect(findNameInLookup('Bob', lookup, names)).toBe(null);
		});

		it('prefers exact lookup over fuzzy', () => {
			const testNames = ['El', 'Elena'];
			const testLookup = buildNameLookup(testNames);
			expect(findNameInLookup('El', testLookup, testNames)).toBe('El');
		});
	});
});
