/**
 * Tests for card extension reader functions.
 */

import { describe, it, expect } from 'vitest';
import { namesMatch } from './reader';

describe('namesMatch', () => {
	describe('exact matches', () => {
		it('matches identical names', () => {
			expect(namesMatch('John', 'John')).toBe(true);
		});

		it('matches case-insensitively', () => {
			expect(namesMatch('John', 'john')).toBe(true);
			expect(namesMatch('JOHN SMITH', 'john smith')).toBe(true);
		});

		it('trims whitespace', () => {
			expect(namesMatch('  John  ', 'John')).toBe(true);
		});
	});

	describe('first name matching', () => {
		it('matches first name to full name', () => {
			expect(namesMatch('John Smith', 'John')).toBe(true);
			expect(namesMatch('John', 'John Smith')).toBe(true);
		});

		it('matches first name to full name with middle name', () => {
			expect(namesMatch('John Michael Smith', 'John')).toBe(true);
		});
	});

	describe('title stripping', () => {
		it('strips Dr. title', () => {
			expect(namesMatch('Dr. John Smith', 'John Smith')).toBe(true);
			expect(namesMatch('Dr. John', 'John')).toBe(true);
		});

		it('strips Mr./Mrs./Ms. titles', () => {
			expect(namesMatch('Mr. Smith', 'Smith')).toBe(true);
			expect(namesMatch('Mrs. Smith', 'Smith')).toBe(true);
			expect(namesMatch('Ms. Smith', 'Smith')).toBe(true);
		});

		it('strips Professor title', () => {
			expect(namesMatch('Professor John', 'John')).toBe(true);
			expect(namesMatch('Prof. John', 'John')).toBe(true);
		});
	});

	describe('initial matching', () => {
		it('matches single letter initial to full name', () => {
			expect(namesMatch('J. Smith', 'John Smith')).toBe(true);
			expect(namesMatch('J Smith', 'John Smith')).toBe(true);
		});

		it('matches multiple initials', () => {
			expect(namesMatch('J. M. Smith', 'John Michael Smith')).toBe(true);
		});
	});

	describe('word-based matching', () => {
		it('matches when shorter name words all appear in longer', () => {
			expect(namesMatch('John Smith', 'John Michael Smith')).toBe(true);
		});

		it('matches last name only', () => {
			expect(namesMatch('Smith', 'John Smith')).toBe(true);
		});
	});

	describe('non-matches', () => {
		it('does not match completely different names', () => {
			expect(namesMatch('John', 'Jane')).toBe(false);
			expect(namesMatch('John Smith', 'Jane Doe')).toBe(false);
		});

		it('does not match partial word matches', () => {
			// "Jo" should not match "John" - only single letter initials do
			expect(namesMatch('Jo', 'John')).toBe(false);
		});

		it('does not match when no words overlap', () => {
			expect(namesMatch('Alice', 'Bob')).toBe(false);
		});
	});
});
