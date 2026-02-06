import { describe, it, expect } from 'vitest';
import { replacePlaceholders, extractPlaceholders, validatePlaceholders } from './placeholders';

describe('replacePlaceholders', () => {
	it('replaces all placeholders with values', () => {
		const result = replacePlaceholders('Hello {{name}}, welcome to {{place}}!', {
			name: 'Alice',
			place: 'Wonderland',
		});
		expect(result).toBe('Hello Alice, welcome to Wonderland!');
	});

	it('throws on missing placeholder value', () => {
		expect(() => replacePlaceholders('Hello {{name}}!', {})).toThrow(
			'Missing placeholder value for {{name}}',
		);
	});

	it('handles template with no placeholders', () => {
		expect(replacePlaceholders('No placeholders here', {})).toBe(
			'No placeholders here',
		);
	});
});

describe('extractPlaceholders', () => {
	it('extracts unique placeholder names', () => {
		const result = extractPlaceholders('{{a}} and {{b}} and {{a}} again');
		expect(result).toEqual(expect.arrayContaining(['a', 'b']));
		expect(result).toHaveLength(2);
	});

	it('returns empty array for no placeholders', () => {
		expect(extractPlaceholders('plain text')).toEqual([]);
	});
});

describe('validatePlaceholders', () => {
	it('returns empty array when all placeholders are documented', () => {
		const result = validatePlaceholders('{{a}} and {{b}}', ['a', 'b', 'c']);
		expect(result).toEqual([]);
	});

	it('returns undocumented placeholder names', () => {
		const result = validatePlaceholders('{{a}} and {{unknown}}', ['a']);
		expect(result).toContain('unknown');
	});
});
