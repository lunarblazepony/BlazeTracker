import { describe, it, expect, vi } from 'vitest';
import { isLikelyRealLocation, addToCache, findInCache } from './locationMapper';
import type { LocationMapping } from './types';

vi.mock('./climateApi', () => ({
	geocodeLocation: vi.fn(),
}));
vi.mock('../v2/settings', () => ({
	getV2Settings: vi.fn(() => ({
		v2ProfileId: '',
		v2Temperatures: { climate: 0.3 },
	})),
}));
vi.mock('../utils/generator', () => ({
	makeGeneratorRequest: vi.fn(),
	buildExtractionMessages: vi.fn(),
}));
vi.mock('../utils/json', () => ({
	parseJsonResponse: vi.fn(),
}));
vi.mock('../utils/debug', () => ({
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
	debugLog: vi.fn(),
}));

// ============================================
// isLikelyRealLocation
// ============================================

describe('isLikelyRealLocation', () => {
	it('returns true for "London" (matches city name pattern)', async () => {
		expect(await isLikelyRealLocation('London')).toBe(true);
	});

	it('returns true for "New York, USA" (matches both city and country patterns)', async () => {
		expect(await isLikelyRealLocation('New York, USA')).toBe(true);
	});

	it('returns true for "Tokyo"', async () => {
		expect(await isLikelyRealLocation('Tokyo')).toBe(true);
	});

	it('returns true for "Paris, France"', async () => {
		expect(await isLikelyRealLocation('Paris, France')).toBe(true);
	});

	it('returns false for "The Enchanted Forest" (fantasy indicator)', async () => {
		expect(await isLikelyRealLocation('The Enchanted Forest')).toBe(false);
	});

	it('returns false for "Dragon\'s Lair" (fantasy indicator)', async () => {
		expect(await isLikelyRealLocation("Dragon's Lair")).toBe(false);
	});

	it('returns false for "The Kingdom of Arathia" (fantasy indicator)', async () => {
		expect(await isLikelyRealLocation('The Kingdom of Arathia')).toBe(false);
	});

	it('returns false for "Ancient Tavern" (fantasy indicator)', async () => {
		expect(await isLikelyRealLocation('Ancient Tavern')).toBe(false);
	});

	it('returns false for "Castle Blackmoor" (fantasy indicator)', async () => {
		expect(await isLikelyRealLocation('Castle Blackmoor')).toBe(false);
	});

	it('returns false for "Random Place" (no pattern matches, defaults to false)', async () => {
		expect(await isLikelyRealLocation('Random Place')).toBe(false);
	});

	it('returns false for "village of france" (fantasy "village" wins over real "France")', async () => {
		expect(await isLikelyRealLocation('village of france')).toBe(false);
	});
});

// ============================================
// addToCache
// ============================================

describe('addToCache', () => {
	const makeMapping = (fantasyLocation: string): LocationMapping => ({
		fantasyLocation,
		isFantasy: true,
		reasoning: 'test',
	});

	it('adds a new mapping to an empty cache', () => {
		const mapping = makeMapping('Winterfell');
		const result = addToCache([], mapping);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(mapping);
	});

	it('adds a new mapping to an existing cache', () => {
		const existing = makeMapping('Winterfell');
		const newMapping = makeMapping("King's Landing");
		const result = addToCache([existing], newMapping);
		expect(result).toHaveLength(2);
		expect(result[0]).toBe(existing);
		expect(result[1]).toBe(newMapping);
	});

	it('replaces an existing mapping with the same fantasyLocation (case-insensitive)', () => {
		const original = makeMapping('Winterfell');
		const replacement: LocationMapping = {
			fantasyLocation: 'winterfell',
			realWorldAnalog: 'Reykjavik, Iceland',
			isFantasy: true,
			reasoning: 'updated',
		};
		const result = addToCache([original], replacement);
		expect(result).toHaveLength(1);
		expect(result[0]).toBe(replacement);
		expect(result[0].realWorldAnalog).toBe('Reykjavik, Iceland');
	});

	it('returns a new array and does not mutate the original', () => {
		const original: LocationMapping[] = [makeMapping('Winterfell')];
		const result = addToCache(original, makeMapping("King's Landing"));
		expect(result).not.toBe(original);
		expect(original).toHaveLength(1);
		expect(result).toHaveLength(2);
	});
});

// ============================================
// findInCache
// ============================================

describe('findInCache', () => {
	const mapping: LocationMapping = {
		fantasyLocation: 'Winterfell',
		isFantasy: true,
		reasoning: 'test',
	};

	it('finds an exact match', () => {
		expect(findInCache([mapping], 'Winterfell')).toBe(mapping);
	});

	it('finds a case-insensitive match', () => {
		expect(findInCache([mapping], 'winterfell')).toBe(mapping);
		expect(findInCache([mapping], 'WINTERFELL')).toBe(mapping);
	});

	it('trims whitespace when searching', () => {
		expect(findInCache([mapping], '  Winterfell  ')).toBe(mapping);
	});

	it('returns undefined when not found', () => {
		expect(findInCache([mapping], "King's Landing")).toBeUndefined();
	});

	it('returns undefined for an empty cache', () => {
		expect(findInCache([], 'Winterfell')).toBeUndefined();
	});
});
