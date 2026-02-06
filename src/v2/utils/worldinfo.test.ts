/**
 * Worldinfo Utility Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	filterEntriesByCharacter,
	filterEntriesByRelationship,
	formatEntriesForPrompt,
	getMatchedWorldinfo,
	getWorldinfoForCharacter,
	getWorldinfoForRelationship,
	getWorldinfoForPrompt,
	type WorldinfoEntry,
} from './worldinfo';

// Mock the debug utilities
vi.mock('../../utils/debug', () => ({
	debugLog: vi.fn(),
	debugWarn: vi.fn(),
}));

// Mock the dynamic import of world-info.js
const mockCheckWorldInfo = vi.fn();
vi.mock('../../../../world-info.js', () => ({
	checkWorldInfo: mockCheckWorldInfo,
}));

describe('worldinfo utility', () => {
	describe('filterEntriesByCharacter', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena', 'thief'],
				keysecondary: [],
				content: 'Elena is a former thief.',
				comment: 'Elena background',
				order: 100,
				constant: false,
				selective: false,
			},
			{
				uid: 2,
				world: 'test',
				key: ['Marcus', 'detective'],
				keysecondary: [],
				content: 'Marcus is a retired detective.',
				comment: 'Marcus background',
				order: 90,
				constant: false,
				selective: false,
			},
			{
				uid: 3,
				world: 'test',
				key: ['Seattle', 'city'],
				keysecondary: [],
				content: 'Seattle is a rainy city.',
				comment: 'Location info',
				order: 80,
				constant: false,
				selective: false,
			},
		];

		it('should return entries matching character name in primary keys', () => {
			const result = filterEntriesByCharacter(mockEntries, 'Elena');
			expect(result).toHaveLength(1);
			expect(result[0].uid).toBe(1);
		});

		it('should return entries matching character name case-insensitively', () => {
			const result = filterEntriesByCharacter(mockEntries, 'elena');
			expect(result).toHaveLength(1);
			expect(result[0].uid).toBe(1);
		});

		it('should return entries matching character name in comment', () => {
			const entriesWithCommentMatch: WorldinfoEntry[] = [
				{
					uid: 4,
					world: 'test',
					key: ['history'],
					keysecondary: [],
					content: 'Some history about Elena.',
					comment: 'About Elena',
					order: 70,
					constant: false,
					selective: false,
				},
			];
			const result = filterEntriesByCharacter(entriesWithCommentMatch, 'Elena');
			expect(result).toHaveLength(1);
		});

		it('should return empty array when no entries match', () => {
			const result = filterEntriesByCharacter(mockEntries, 'Zoe');
			expect(result).toHaveLength(0);
		});

		it('should return empty array when character name is empty', () => {
			const result = filterEntriesByCharacter(mockEntries, '');
			expect(result).toHaveLength(0);
		});

		it('should return empty array when entries array is empty', () => {
			const result = filterEntriesByCharacter([], 'Elena');
			expect(result).toHaveLength(0);
		});
	});

	describe('filterEntriesByRelationship', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena'],
				keysecondary: [],
				content: 'Elena background.',
				comment: '',
				order: 100,
				constant: false,
				selective: false,
			},
			{
				uid: 2,
				world: 'test',
				key: ['Marcus'],
				keysecondary: [],
				content: 'Marcus background.',
				comment: '',
				order: 90,
				constant: false,
				selective: false,
			},
			{
				uid: 3,
				world: 'test',
				key: ['Elena', 'Marcus'],
				keysecondary: [],
				content: 'Elena and Marcus relationship history.',
				comment: 'Relationship',
				order: 110,
				constant: false,
				selective: false,
			},
			{
				uid: 4,
				world: 'test',
				key: ['Seattle'],
				keysecondary: [],
				content: 'Seattle info.',
				comment: '',
				order: 80,
				constant: false,
				selective: false,
			},
		];

		it('should return entries mentioning either character in the pair', () => {
			const result = filterEntriesByRelationship(mockEntries, [
				'Elena',
				'Marcus',
			]);
			expect(result).toHaveLength(3);
			expect(result.map(e => e.uid)).toContain(1);
			expect(result.map(e => e.uid)).toContain(2);
			expect(result.map(e => e.uid)).toContain(3);
		});

		it('should exclude entries not mentioning either character', () => {
			const result = filterEntriesByRelationship(mockEntries, [
				'Elena',
				'Marcus',
			]);
			expect(result.map(e => e.uid)).not.toContain(4);
		});

		it('should return empty array when entries array is empty', () => {
			const result = filterEntriesByRelationship([], ['Elena', 'Marcus']);
			expect(result).toHaveLength(0);
		});
	});

	describe('formatEntriesForPrompt', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena'],
				keysecondary: [],
				content: 'Elena is a former thief who turned detective.',
				comment: 'Elena Background',
				order: 100,
				constant: false,
				selective: false,
			},
			{
				uid: 2,
				world: 'test',
				key: ['Marcus'],
				keysecondary: [],
				content: 'Marcus is her partner.',
				comment: '',
				order: 90,
				constant: false,
				selective: false,
			},
		];

		it('should format entries with comment as label', () => {
			const result = formatEntriesForPrompt(mockEntries);
			expect(result).toContain('[Elena Background]');
			expect(result).toContain('Elena is a former thief who turned detective.');
		});

		it('should use [Lore Entry] label when no comment', () => {
			const result = formatEntriesForPrompt(mockEntries);
			expect(result).toContain('[Lore Entry]');
			expect(result).toContain('Marcus is her partner.');
		});

		it('should sort entries by order (higher first)', () => {
			const result = formatEntriesForPrompt(mockEntries);
			const elenaIndex = result.indexOf('Elena is a former thief');
			const marcusIndex = result.indexOf('Marcus is her partner');
			expect(elenaIndex).toBeLessThan(marcusIndex);
		});

		it('should respect maxEntries limit', () => {
			const manyEntries: WorldinfoEntry[] = Array.from(
				{ length: 20 },
				(_, i) => ({
					uid: i,
					world: 'test',
					key: [`Entry${i}`],
					keysecondary: [],
					content: `Content for entry ${i}`,
					comment: `Entry ${i}`,
					order: i,
					constant: false,
					selective: false,
				}),
			);

			const result = formatEntriesForPrompt(manyEntries, 5);
			// Count occurrences of "[Entry" which indicates entry labels
			const entryCount = (result.match(/\[Entry \d+\]/g) || []).length;
			expect(entryCount).toBe(5);
		});

		it('should return empty string for empty entries array', () => {
			const result = formatEntriesForPrompt([]);
			expect(result).toBe('');
		});

		it('should skip entries with empty content', () => {
			const entriesWithEmpty: WorldinfoEntry[] = [
				{
					uid: 1,
					world: 'test',
					key: ['test'],
					keysecondary: [],
					content: '',
					comment: 'Empty',
					order: 100,
					constant: false,
					selective: false,
				},
				{
					uid: 2,
					world: 'test',
					key: ['test'],
					keysecondary: [],
					content: 'Valid content',
					comment: 'Valid',
					order: 90,
					constant: false,
					selective: false,
				},
			];

			const result = formatEntriesForPrompt(entriesWithEmpty);
			expect(result).not.toContain('[Empty]');
			expect(result).toContain('[Valid]');
		});
	});

	describe('getMatchedWorldinfo', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena'],
				keysecondary: [],
				content: 'Elena is a thief.',
				comment: 'Elena',
				order: 100,
				constant: false,
				selective: false,
			},
		];

		beforeEach(() => {
			vi.clearAllMocks();
			// Setup default mock for SillyTavern context
			(global as Record<string, unknown>).SillyTavern = {
				getContext: () => ({
					characterId: 0,
					characters: [
						{
							description: 'Test character',
							personality: 'Friendly',
						},
					],
					persona: 'Test persona',
				}),
			};
		});

		afterEach(() => {
			delete (global as Record<string, unknown>).SillyTavern;
		});

		it('should return matched entries from checkWorldInfo', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: 'Before content',
				worldInfoAfter: 'After content',
			});

			const result = await getMatchedWorldinfo(['Hello Elena']);

			expect(result.entries).toHaveLength(1);
			expect(result.entries[0].uid).toBe(1);
			expect(result.formattedBefore).toBe('Before content');
			expect(result.formattedAfter).toBe('After content');
		});

		it('should return empty result when checkWorldInfo returns no entries', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getMatchedWorldinfo(['Hello world']);

			expect(result.entries).toHaveLength(0);
			expect(result.formattedBefore).toBe('');
			expect(result.formattedAfter).toBe('');
		});

		it('should handle undefined allActivatedEntries gracefully', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: undefined,
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getMatchedWorldinfo(['Test']);

			expect(result.entries).toHaveLength(0);
		});

		it('should return empty result when checkWorldInfo throws', async () => {
			mockCheckWorldInfo.mockRejectedValue(new Error('API error'));

			const result = await getMatchedWorldinfo(['Test']);

			expect(result.entries).toHaveLength(0);
			expect(result.formattedBefore).toBe('');
			expect(result.formattedAfter).toBe('');
		});

		it('should build globalScanData from SillyTavern context', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			await getMatchedWorldinfo(['Test']);

			expect(mockCheckWorldInfo).toHaveBeenCalledWith(
				['Test'],
				Infinity,
				true,
				expect.objectContaining({
					trigger: 'blazetracker',
					characterDescription: 'Test character',
					personaDescription: 'Test persona',
				}),
			);
		});

		it('should handle missing SillyTavern context gracefully', async () => {
			delete (global as Record<string, unknown>).SillyTavern;
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getMatchedWorldinfo(['Test']);

			expect(result.entries).toHaveLength(0);
			expect(mockCheckWorldInfo).toHaveBeenCalledWith(
				['Test'],
				Infinity,
				true,
				expect.objectContaining({
					trigger: 'blazetracker',
					characterDescription: '',
					personaDescription: '',
				}),
			);
		});
	});

	describe('getWorldinfoForCharacter', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena'],
				keysecondary: [],
				content: 'Elena is a thief.',
				comment: 'Elena Background',
				order: 100,
				constant: false,
				selective: false,
			},
			{
				uid: 2,
				world: 'test',
				key: ['Marcus'],
				keysecondary: [],
				content: 'Marcus is a detective.',
				comment: 'Marcus Background',
				order: 90,
				constant: false,
				selective: false,
			},
		];

		beforeEach(() => {
			vi.clearAllMocks();
			(global as Record<string, unknown>).SillyTavern = {
				getContext: () => ({
					characterId: 0,
					characters: [{}],
					persona: '',
				}),
			};
		});

		afterEach(() => {
			delete (global as Record<string, unknown>).SillyTavern;
		});

		it('should return formatted worldinfo for specific character', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForCharacter(['Test message'], 'Elena');

			expect(result).toContain('Elena is a thief');
			expect(result).not.toContain('Marcus');
		});

		it('should return all entries when no character specified', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForCharacter(['Test message']);

			expect(result).toContain('Elena is a thief');
			expect(result).toContain('Marcus is a detective');
		});

		it('should return empty string when no matching entries', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForCharacter(['Test message'], 'Zoe');

			expect(result).toBe('');
		});
	});

	describe('getWorldinfoForRelationship', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena'],
				keysecondary: [],
				content: 'Elena background.',
				comment: 'Elena',
				order: 100,
				constant: false,
				selective: false,
			},
			{
				uid: 2,
				world: 'test',
				key: ['Marcus'],
				keysecondary: [],
				content: 'Marcus background.',
				comment: 'Marcus',
				order: 90,
				constant: false,
				selective: false,
			},
			{
				uid: 3,
				world: 'test',
				key: ['Seattle'],
				keysecondary: [],
				content: 'Seattle info.',
				comment: 'Location',
				order: 80,
				constant: false,
				selective: false,
			},
		];

		beforeEach(() => {
			vi.clearAllMocks();
			(global as Record<string, unknown>).SillyTavern = {
				getContext: () => ({
					characterId: 0,
					characters: [{}],
					persona: '',
				}),
			};
		});

		afterEach(() => {
			delete (global as Record<string, unknown>).SillyTavern;
		});

		it('should return formatted worldinfo for relationship pair', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForRelationship(
				['Test message'],
				['Elena', 'Marcus'],
			);

			expect(result).toContain('Elena background');
			expect(result).toContain('Marcus background');
			expect(result).not.toContain('Seattle');
		});

		it('should return empty string when no matching entries', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForRelationship(
				['Test message'],
				['Zoe', 'Alex'],
			);

			expect(result).toBe('');
		});
	});

	describe('getWorldinfoForPrompt', () => {
		const mockEntries: WorldinfoEntry[] = [
			{
				uid: 1,
				world: 'test',
				key: ['Elena'],
				keysecondary: [],
				content: 'Elena is a thief.',
				comment: 'Elena',
				order: 100,
				constant: false,
				selective: false,
			},
		];

		beforeEach(() => {
			vi.clearAllMocks();
			(global as Record<string, unknown>).SillyTavern = {
				getContext: () => ({
					characterId: 0,
					characters: [{}],
					persona: '',
				}),
			};
		});

		afterEach(() => {
			delete (global as Record<string, unknown>).SillyTavern;
		});

		it('should prefer ST formatted output when available', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: 'ST Before Content',
				worldInfoAfter: 'ST After Content',
			});

			const result = await getWorldinfoForPrompt(['Test message']);

			expect(result).toBe('ST Before Content\n\nST After Content');
		});

		it('should use only formattedBefore when formattedAfter is empty', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: 'ST Before Content',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForPrompt(['Test message']);

			expect(result).toBe('ST Before Content');
		});

		it('should fall back to manual formatting when ST formatted is empty', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(mockEntries),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForPrompt(['Test message']);

			expect(result).toContain('Elena is a thief');
			expect(result).toContain('[Elena]');
		});

		it('should return empty string when no entries and no ST formatted content', async () => {
			mockCheckWorldInfo.mockResolvedValue({
				allActivatedEntries: new Set(),
				worldInfoBefore: '',
				worldInfoAfter: '',
			});

			const result = await getWorldinfoForPrompt(['Test message']);

			expect(result).toBe('');
		});
	});
});
