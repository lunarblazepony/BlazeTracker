import { describe, it, expect } from 'vitest';
import {
	isValidTensionLevel,
	isValidTensionType,
	isValidTensionDirection,
	isValidRelationshipStatus,
	isValidOutfitSlot,
	createEmptyOutfit,
	createEmptyLocationState,
	TENSION_LEVELS,
	TENSION_TYPES,
	TENSION_DIRECTIONS,
	RELATIONSHIP_STATUSES,
	OUTFIT_SLOTS,
	DAYS_OF_WEEK,
} from './common';

describe('common types', () => {
	describe('constants', () => {
		it('TENSION_LEVELS has all expected values', () => {
			expect(TENSION_LEVELS).toEqual([
				'relaxed',
				'aware',
				'guarded',
				'tense',
				'charged',
				'volatile',
				'explosive',
			]);
		});

		it('TENSION_TYPES has all expected values', () => {
			expect(TENSION_TYPES).toEqual([
				'confrontation',
				'intimate',
				'vulnerable',
				'celebratory',
				'negotiation',
				'suspense',
				'conversation',
			]);
		});

		it('TENSION_DIRECTIONS has all expected values', () => {
			expect(TENSION_DIRECTIONS).toEqual(['escalating', 'stable', 'decreasing']);
		});

		it('RELATIONSHIP_STATUSES has all expected values', () => {
			expect(RELATIONSHIP_STATUSES).toEqual([
				'strangers',
				'acquaintances',
				'friendly',
				'close',
				'intimate',
				'strained',
				'hostile',
				'complicated',
			]);
		});

		it('OUTFIT_SLOTS has all expected values', () => {
			expect(OUTFIT_SLOTS).toEqual([
				'head',
				'neck',
				'jacket',
				'back',
				'torso',
				'legs',
				'footwear',
				'socks',
				'underwear',
			]);
		});

		it('DAYS_OF_WEEK has all expected values', () => {
			expect(DAYS_OF_WEEK).toEqual([
				'Sunday',
				'Monday',
				'Tuesday',
				'Wednesday',
				'Thursday',
				'Friday',
				'Saturday',
			]);
		});
	});

	describe('isValidTensionLevel', () => {
		it('returns true for valid tension levels', () => {
			for (const level of TENSION_LEVELS) {
				expect(isValidTensionLevel(level)).toBe(true);
			}
		});

		it('returns false for invalid values', () => {
			expect(isValidTensionLevel('invalid')).toBe(false);
			expect(isValidTensionLevel('')).toBe(false);
			expect(isValidTensionLevel('RELAXED')).toBe(false); // case sensitive
		});
	});

	describe('isValidTensionType', () => {
		it('returns true for valid tension types', () => {
			for (const type of TENSION_TYPES) {
				expect(isValidTensionType(type)).toBe(true);
			}
		});

		it('returns false for invalid values', () => {
			expect(isValidTensionType('invalid')).toBe(false);
			expect(isValidTensionType('')).toBe(false);
		});
	});

	describe('isValidTensionDirection', () => {
		it('returns true for valid tension directions', () => {
			for (const direction of TENSION_DIRECTIONS) {
				expect(isValidTensionDirection(direction)).toBe(true);
			}
		});

		it('returns false for invalid values', () => {
			expect(isValidTensionDirection('invalid')).toBe(false);
			expect(isValidTensionDirection('rising')).toBe(false);
		});
	});

	describe('isValidRelationshipStatus', () => {
		it('returns true for valid relationship statuses', () => {
			for (const status of RELATIONSHIP_STATUSES) {
				expect(isValidRelationshipStatus(status)).toBe(true);
			}
		});

		it('returns false for invalid values', () => {
			expect(isValidRelationshipStatus('invalid')).toBe(false);
			expect(isValidRelationshipStatus('friends')).toBe(false);
		});
	});

	describe('isValidOutfitSlot', () => {
		it('returns true for valid outfit slots', () => {
			for (const slot of OUTFIT_SLOTS) {
				expect(isValidOutfitSlot(slot)).toBe(true);
			}
		});

		it('returns false for invalid values', () => {
			expect(isValidOutfitSlot('invalid')).toBe(false);
			expect(isValidOutfitSlot('shirt')).toBe(false);
			expect(isValidOutfitSlot('pants')).toBe(false);
		});
	});

	describe('createEmptyOutfit', () => {
		it('creates an outfit with all slots null', () => {
			const outfit = createEmptyOutfit();
			expect(outfit).toEqual({
				head: null,
				neck: null,
				jacket: null,
				back: null,
				torso: null,
				legs: null,
				footwear: null,
				socks: null,
				underwear: null,
			});
		});

		it('creates a new object each time', () => {
			const outfit1 = createEmptyOutfit();
			const outfit2 = createEmptyOutfit();
			expect(outfit1).not.toBe(outfit2);
		});
	});

	describe('createEmptyLocationState', () => {
		it('creates an empty location state', () => {
			const location = createEmptyLocationState();
			expect(location).toEqual({
				area: '',
				place: '',
				position: '',
				props: [],
				locationType: 'outdoor',
			});
		});

		it('creates a new object each time', () => {
			const location1 = createEmptyLocationState();
			const location2 = createEmptyLocationState();
			expect(location1).not.toBe(location2);
			expect(location1.props).not.toBe(location2.props);
		});
	});
});
