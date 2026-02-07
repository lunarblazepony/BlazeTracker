/**
 * Nickname Extraction Prompt Tests
 *
 * Tests that verify the parseResponse function validates structure,
 * handles edge cases, and filters correctly.
 */

import { describe, it, expect } from 'vitest';
import { nicknameExtractionPrompt } from './nicknameExtractionPrompt';

describe('nicknameExtractionPrompt', () => {
	describe('parseResponse', () => {
		it('parses valid response with nicknames', () => {
			const response = JSON.stringify({
				reasoning: 'Elena calls Marcus "sunshine".',
				nicknames: [
					{ character: 'Marcus', names: ['sunshine'] },
					{ character: 'Elena', names: ['Lena', 'troublemaker'] },
				],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.reasoning).toBe('Elena calls Marcus "sunshine".');
			expect(result!.nicknames).toHaveLength(2);
			expect(result!.nicknames[0]).toEqual({
				character: 'Marcus',
				names: ['sunshine'],
			});
			expect(result!.nicknames[1]).toEqual({
				character: 'Elena',
				names: ['Lena', 'troublemaker'],
			});
		});

		it('parses valid response with empty nicknames array', () => {
			const response = JSON.stringify({
				reasoning: 'No nicknames found in messages.',
				nicknames: [],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toEqual([]);
		});

		it('filters entries with empty names arrays', () => {
			const response = JSON.stringify({
				reasoning: 'Some entries have no names.',
				nicknames: [
					{ character: 'Marcus', names: ['sunshine'] },
					{ character: 'Elena', names: [] },
				],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toHaveLength(1);
			expect(result!.nicknames[0].character).toBe('Marcus');
		});

		it('filters non-string entries from names arrays', () => {
			const response = JSON.stringify({
				reasoning: 'Mixed types in names.',
				nicknames: [
					{
						character: 'Marcus',
						names: ['sunshine', 123, null, 'babe'],
					},
				],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toHaveLength(1);
			expect(result!.nicknames[0].names).toEqual(['sunshine', 'babe']);
		});

		it('filters empty/whitespace-only names', () => {
			const response = JSON.stringify({
				reasoning: 'Some empty names.',
				nicknames: [
					{
						character: 'Marcus',
						names: ['sunshine', '', '   ', 'babe'],
					},
				],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames[0].names).toEqual(['sunshine', 'babe']);
		});

		it('returns null for missing reasoning field', () => {
			const response = JSON.stringify({
				nicknames: [{ character: 'Marcus', names: ['sunshine'] }],
			});

			expect(nicknameExtractionPrompt.parseResponse(response)).toBeNull();
		});

		it('returns null for missing nicknames field', () => {
			const response = JSON.stringify({
				reasoning: 'Analysis complete.',
			});

			expect(nicknameExtractionPrompt.parseResponse(response)).toBeNull();
		});

		it('returns null for non-array nicknames field', () => {
			const response = JSON.stringify({
				reasoning: 'Analysis complete.',
				nicknames: 'not an array',
			});

			expect(nicknameExtractionPrompt.parseResponse(response)).toBeNull();
		});

		it('returns null for invalid JSON', () => {
			expect(nicknameExtractionPrompt.parseResponse('not valid json')).toBeNull();
		});

		it('returns null for null input', () => {
			expect(nicknameExtractionPrompt.parseResponse('null')).toBeNull();
		});

		it('returns null for array input', () => {
			expect(nicknameExtractionPrompt.parseResponse('[]')).toBeNull();
		});

		it('skips entries with non-string character field', () => {
			const response = JSON.stringify({
				reasoning: 'Entries with bad character fields.',
				nicknames: [
					{ character: 123, names: ['sunshine'] },
					{ character: 'Elena', names: ['Lena'] },
				],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toHaveLength(1);
			expect(result!.nicknames[0].character).toBe('Elena');
		});

		it('skips entries with non-array names field', () => {
			const response = JSON.stringify({
				reasoning: 'Entries with bad names fields.',
				nicknames: [
					{ character: 'Marcus', names: 'sunshine' },
					{ character: 'Elena', names: ['Lena'] },
				],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toHaveLength(1);
			expect(result!.nicknames[0].character).toBe('Elena');
		});

		it('skips null entries in nicknames array', () => {
			const response = JSON.stringify({
				reasoning: 'Some null entries.',
				nicknames: [null, { character: 'Elena', names: ['Lena'] }],
			});

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toHaveLength(1);
		});

		it('handles response with markdown code fences', () => {
			const response =
				'```json\n' +
				JSON.stringify({
					reasoning: 'Test.',
					nicknames: [{ character: 'Marcus', names: ['sunshine'] }],
				}) +
				'\n```';

			const result = nicknameExtractionPrompt.parseResponse(response);

			expect(result).not.toBeNull();
			expect(result!.nicknames).toHaveLength(1);
		});
	});
});
