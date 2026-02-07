import { describe, it, expect } from 'vitest';
import { computeAkas, stripTitles, getNameParts, isAmbiguousNamePart } from './akaComputation';

describe('stripTitles', () => {
	it('strips a single title', () => {
		expect(stripTitles('Dr. John')).toBe('john');
	});

	it('strips multiple titles', () => {
		expect(stripTitles('Prof. Dr. John Smith')).toBe('john smith');
	});

	it('returns lowercased name when no titles', () => {
		expect(stripTitles('John Smith')).toBe('john smith');
	});

	it('handles empty string', () => {
		expect(stripTitles('')).toBe('');
	});

	it('handles whitespace-only string', () => {
		expect(stripTitles('   ')).toBe('');
	});

	it('strips Mr. title', () => {
		expect(stripTitles('Mr. Johnson')).toBe('johnson');
	});

	it('strips Mrs. title', () => {
		expect(stripTitles('Mrs. Smith')).toBe('smith');
	});

	it('strips Miss title', () => {
		expect(stripTitles('Miss Daisy')).toBe('daisy');
	});
});

describe('getNameParts', () => {
	it('splits name into parts after title stripping', () => {
		expect(getNameParts('John Smith')).toEqual(['john', 'smith']);
	});

	it('strips titles before splitting', () => {
		expect(getNameParts('Dr. John Smith')).toEqual(['john', 'smith']);
	});

	it('handles single-word names', () => {
		expect(getNameParts('John')).toEqual(['john']);
	});

	it('handles empty string', () => {
		expect(getNameParts('')).toEqual([]);
	});

	it('handles multiple spaces', () => {
		expect(getNameParts('John   Smith')).toEqual(['john', 'smith']);
	});
});

describe('isAmbiguousNamePart', () => {
	it('returns true when part is shared by multiple characters', () => {
		const allNames = ['John Smith', 'Jane Smith'];
		expect(isAmbiguousNamePart('smith', allNames)).toBe(true);
	});

	it('returns false when part is unique to one character', () => {
		const allNames = ['John Smith', 'Jane Doe'];
		expect(isAmbiguousNamePart('smith', allNames)).toBe(false);
	});

	it('returns false when part appears in no characters', () => {
		const allNames = ['John Smith', 'Jane Doe'];
		expect(isAmbiguousNamePart('williams', allNames)).toBe(false);
	});

	it('is case-insensitive', () => {
		const allNames = ['John Smith', 'Jane SMITH'];
		expect(isAmbiguousNamePart('Smith', allNames)).toBe(true);
	});
});

describe('computeAkas', () => {
	it('returns LLM-extracted nicknames', () => {
		const result = computeAkas('John', null, ['Johnny', 'J'], ['John']);
		expect(result).toEqual(['Johnny', 'J']);
	});

	it('excludes canonical name from nicknames', () => {
		const result = computeAkas('John', null, ['John', 'Johnny'], ['John']);
		expect(result).toEqual(['Johnny']);
	});

	it('adds fullName when different from canonical', () => {
		const result = computeAkas('John', 'John Smith', [], ['John']);
		expect(result).toContain('John Smith');
	});

	it('does not add fullName when same as canonical', () => {
		const result = computeAkas('John', 'John', [], ['John']);
		expect(result).toEqual([]);
	});

	it('strips titles from fullName and adds stripped version', () => {
		const result = computeAkas('John', 'Dr. John Smith', [], ['John']);
		expect(result).toContain('Dr. John Smith');
		expect(result).toContain('John Smith');
	});

	it('extracts non-ambiguous name parts from fullName', () => {
		const result = computeAkas('John', 'John Smith', [], ['John']);
		expect(result).toContain('Smith');
	});

	it('does not extract ambiguous name parts', () => {
		const result = computeAkas('John', 'John Smith', [], ['John', 'Jane Smith']);
		expect(result).not.toContain('Smith');
	});

	it('does not extract parts matching canonical name', () => {
		const result = computeAkas('John', 'John Smith', [], ['John']);
		// 'john' part matches canonical name lowercased, should be excluded
		expect(result).not.toContain('John');
		// But 'Smith' should be included as an AKA
		expect(result).toContain('Smith');
	});

	it('handles single-word canonical names with no fullName', () => {
		const result = computeAkas('Alice', null, [], ['Alice', 'Bob']);
		expect(result).toEqual([]);
	});

	it('deduplicates case-insensitively', () => {
		const result = computeAkas('John', null, ['johnny', 'Johnny', 'JOHNNY'], ['John']);
		expect(result).toEqual(['johnny']);
	});

	it('handles null fullName', () => {
		const result = computeAkas('John', null, [], ['John']);
		expect(result).toEqual([]);
	});

	it('handles undefined fullName', () => {
		const result = computeAkas('John', undefined, [], ['John']);
		expect(result).toEqual([]);
	});

	it('handles empty string fullName', () => {
		const result = computeAkas('John', '', [], ['John']);
		expect(result).toEqual([]);
	});

	it('handles whitespace-only fullName', () => {
		const result = computeAkas('John', '   ', [], ['John']);
		expect(result).toEqual([]);
	});

	it('handles multiple titles in fullName', () => {
		const result = computeAkas('John', 'Prof. Dr. John Smith', [], ['John']);
		expect(result).toContain('Prof. Dr. John Smith');
		expect(result).toContain('John Smith');
		expect(result).toContain('Smith');
	});

	it('trims nicknames', () => {
		const result = computeAkas('John', null, ['  Johnny  ', '  J  '], ['John']);
		expect(result).toEqual(['Johnny', 'J']);
	});

	it('skips empty nicknames', () => {
		const result = computeAkas('John', null, ['', '  ', 'Johnny'], ['John']);
		expect(result).toEqual(['Johnny']);
	});

	it('combines nicknames and fullName AKAs', () => {
		const result = computeAkas('John', 'Dr. John Smith', ['Johnny'], ['John']);
		expect(result).toContain('Johnny');
		expect(result).toContain('Dr. John Smith');
		expect(result).toContain('John Smith');
		expect(result).toContain('Smith');
	});

	it('does not produce name-part AKAs for single-word fullName', () => {
		const result = computeAkas('John', 'Johnny', [], ['John']);
		// fullName is single word, so no parts extraction
		expect(result).toEqual(['Johnny']);
	});
});
