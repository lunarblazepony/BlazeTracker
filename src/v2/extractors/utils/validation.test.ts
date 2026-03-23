import { describe, it, expect } from 'vitest';
import { filterCharactersAppeared, filterCharactersDeparted } from './validation';
import type { Projection } from '../../types/snapshot';

/**
 * Build a minimal Projection with characters and presence info.
 */
function makeProjection(chars: Record<string, { akas?: string[] }>, present: string[]): Projection {
	const characters: Record<string, any> = {};
	for (const [name, opts] of Object.entries(chars)) {
		characters[name] = {
			position: null,
			activity: null,
			mood: [],
			physicalState: [],
			outfit: {
				head: null,
				neck: null,
				jacket: null,
				back: null,
				torso: null,
				legs: null,
				underwear: null,
				socks: null,
				footwear: null,
			},
			akas: opts.akas ?? [],
		};
	}
	return {
		characters,
		charactersPresent: present,
	} as unknown as Projection;
}

describe('filterCharactersAppeared', () => {
	it('filters characters already present by canonical name', () => {
		const projection = makeProjection({ Sarah: {} }, ['Sarah']);
		const appeared = [{ name: 'Sarah' }, { name: 'Bob' }];
		const result = filterCharactersAppeared(appeared, projection);
		expect(result).toEqual([{ name: 'Bob' }]);
	});

	it('filters characters when AKA matches an appeared name', () => {
		const projection = makeProjection({ Sarah: { akas: ['Sally', 'Sal'] } }, ['Sarah']);
		const appeared = [{ name: 'Sally' }, { name: 'Bob' }];
		const result = filterCharactersAppeared(appeared, projection);
		expect(result).toEqual([{ name: 'Bob' }]);
	});

	it('AKA matching is case insensitive', () => {
		const projection = makeProjection({ Sarah: { akas: ['Sally'] } }, ['Sarah']);
		const appeared = [{ name: 'sally' }];
		const result = filterCharactersAppeared(appeared, projection);
		expect(result).toEqual([]);
	});

	it('works when character has no AKAs', () => {
		const projection = makeProjection({ Sarah: {} }, ['Sarah']);
		const appeared = [{ name: 'Bob' }];
		const result = filterCharactersAppeared(appeared, projection);
		expect(result).toEqual([{ name: 'Bob' }]);
	});

	it('returns all when projection is null', () => {
		const appeared = [{ name: 'Sarah' }];
		const result = filterCharactersAppeared(appeared, null);
		expect(result).toEqual([{ name: 'Sarah' }]);
	});
});

describe('filterCharactersDeparted', () => {
	it('recognizes departure by canonical name', () => {
		const projection = makeProjection({ Sarah: {} }, ['Sarah']);
		const result = filterCharactersDeparted(['Sarah'], projection);
		expect(result).toEqual(['Sarah']);
	});

	it('recognizes departure by AKA name', () => {
		const projection = makeProjection({ Sarah: { akas: ['Sally', 'Sal'] } }, ['Sarah']);
		const result = filterCharactersDeparted(['Sally'], projection);
		expect(result).toEqual(['Sally']);
	});

	it('AKA departure matching is case insensitive', () => {
		const projection = makeProjection({ Sarah: { akas: ['Sally'] } }, ['Sarah']);
		const result = filterCharactersDeparted(['SALLY'], projection);
		expect(result).toEqual(['SALLY']);
	});

	it('filters out names not present (canonical or AKA)', () => {
		const projection = makeProjection({ Sarah: {} }, ['Sarah']);
		const result = filterCharactersDeparted(['Bob'], projection);
		expect(result).toEqual([]);
	});

	it('returns empty when projection is null', () => {
		const result = filterCharactersDeparted(['Sarah'], null);
		expect(result).toEqual([]);
	});
});
