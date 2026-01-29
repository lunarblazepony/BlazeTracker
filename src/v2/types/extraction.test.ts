import { describe, it, expect } from 'vitest';
import {
	hasReasoning,
	extractionIndicatesChange,
	extractionHasListChanges,
	extractionHasOutfitChanges,
} from './extraction';
import type {
	ExtractedTimeChange,
	ExtractedLocationChange,
	ExtractedPropsChange,
	ExtractedMoodChange,
	ExtractedOutfitChange,
	ExtractedStatusChange,
	ExtractedChapterEnded,
} from './extraction';

describe('extraction utility functions', () => {
	describe('hasReasoning', () => {
		it('returns true for objects with reasoning string', () => {
			expect(hasReasoning({ reasoning: 'test' })).toBe(true);
			expect(hasReasoning({ reasoning: '', other: 'field' })).toBe(true);
		});

		it('returns false for objects without reasoning', () => {
			expect(hasReasoning({})).toBe(false);
			expect(hasReasoning({ reason: 'test' })).toBe(false);
		});

		it('returns false for non-objects', () => {
			expect(hasReasoning(null)).toBe(false);
			expect(hasReasoning(undefined)).toBe(false);
			expect(hasReasoning('string')).toBe(false);
			expect(hasReasoning(123)).toBe(false);
		});

		it('returns false if reasoning is not a string', () => {
			expect(hasReasoning({ reasoning: 123 })).toBe(false);
			expect(hasReasoning({ reasoning: null })).toBe(false);
			expect(hasReasoning({ reasoning: ['array'] })).toBe(false);
		});
	});

	describe('extractionIndicatesChange', () => {
		it('returns changed value for TimeChange', () => {
			const noChange: ExtractedTimeChange = { reasoning: 'test', changed: false };
			const hasChange: ExtractedTimeChange = {
				reasoning: 'test',
				changed: true,
				delta: { days: 1, hours: 0, minutes: 0, seconds: 0 },
			};

			expect(extractionIndicatesChange(noChange)).toBe(false);
			expect(extractionIndicatesChange(hasChange)).toBe(true);
		});

		it('returns changed value for LocationChange', () => {
			const noChange: ExtractedLocationChange = {
				reasoning: 'test',
				changed: false,
			};
			const hasChange: ExtractedLocationChange = {
				reasoning: 'test',
				changed: true,
				newArea: 'Park',
				newPlace: 'Bench',
				newPosition: 'sitting',
			};

			expect(extractionIndicatesChange(noChange)).toBe(false);
			expect(extractionIndicatesChange(hasChange)).toBe(true);
		});

		it('returns shouldEnd value for ChapterEnded', () => {
			const noEnd: ExtractedChapterEnded = {
				reasoning: 'test',
				shouldEnd: false,
			};
			const shouldEnd: ExtractedChapterEnded = {
				reasoning: 'test',
				shouldEnd: true,
				reason: 'location_change',
			};

			expect(extractionIndicatesChange(noEnd)).toBe(false);
			expect(extractionIndicatesChange(shouldEnd)).toBe(true);
		});

		it('returns changed value for StatusChange', () => {
			const noChange: ExtractedStatusChange = {
				reasoning: 'test',
				pair: ['Alice', 'Bob'],
				changed: false,
			};
			const hasChange: ExtractedStatusChange = {
				reasoning: 'test',
				pair: ['Alice', 'Bob'],
				changed: true,
				newStatus: 'close',
			};

			expect(extractionIndicatesChange(noChange)).toBe(false);
			expect(extractionIndicatesChange(hasChange)).toBe(true);
		});
	});

	describe('extractionHasListChanges', () => {
		it('returns false when both added and removed are empty', () => {
			const extraction: ExtractedPropsChange = {
				reasoning: 'test',
				added: [],
				removed: [],
			};
			expect(extractionHasListChanges(extraction)).toBe(false);
		});

		it('returns true when added has items', () => {
			const extraction: ExtractedPropsChange = {
				reasoning: 'test',
				added: ['new item'],
				removed: [],
			};
			expect(extractionHasListChanges(extraction)).toBe(true);
		});

		it('returns true when removed has items', () => {
			const extraction: ExtractedPropsChange = {
				reasoning: 'test',
				added: [],
				removed: ['old item'],
			};
			expect(extractionHasListChanges(extraction)).toBe(true);
		});

		it('returns true when both have items', () => {
			const extraction: ExtractedMoodChange = {
				reasoning: 'test',
				character: 'Alice',
				added: ['happy'],
				removed: ['sad'],
			};
			expect(extractionHasListChanges(extraction)).toBe(true);
		});
	});

	describe('extractionHasOutfitChanges', () => {
		it('returns false when no changes', () => {
			const extraction: ExtractedOutfitChange = {
				reasoning: 'test',
				character: 'Alice',
				removed: [],
				added: {},
			};
			expect(extractionHasOutfitChanges(extraction)).toBe(false);
		});

		it('returns true when slots removed', () => {
			const extraction: ExtractedOutfitChange = {
				reasoning: 'test',
				character: 'Alice',
				removed: ['torso', 'legs'],
				added: {},
			};
			expect(extractionHasOutfitChanges(extraction)).toBe(true);
		});

		it('returns true when slots added', () => {
			const extraction: ExtractedOutfitChange = {
				reasoning: 'test',
				character: 'Alice',
				removed: [],
				added: { head: 'cap' },
			};
			expect(extractionHasOutfitChanges(extraction)).toBe(true);
		});

		it('returns true when both added and removed', () => {
			const extraction: ExtractedOutfitChange = {
				reasoning: 'test',
				character: 'Alice',
				removed: ['torso'],
				added: { head: 'cap' },
			};
			expect(extractionHasOutfitChanges(extraction)).toBe(true);
		});
	});
});

describe('extraction type shapes', () => {
	it('initial time extraction shape', () => {
		const extraction = {
			reasoning: 'Based on the story mentioning morning',
			time: {
				year: 2024,
				month: 6,
				day: 15,
				hour: 9,
				minute: 30,
				second: 0,
				dayOfWeek: 'Saturday',
			},
		};
		expect(extraction.reasoning).toBeDefined();
		expect(extraction.time.year).toBe(2024);
	});

	it('outfit change extraction shape (LLM-friendly format)', () => {
		// This is the format the LLM returns - easy to express
		const extraction: ExtractedOutfitChange = {
			reasoning: 'Alice removed her shirt and put on a cap',
			character: 'Alice',
			removed: ['torso', 'legs'],
			added: { head: 'baseball cap' },
		};

		// This is then mapped to events (done elsewhere)
		expect(extraction.removed).toContain('torso');
		expect(extraction.added.head).toBe('baseball cap');
	});

	it('subjects extraction shape', () => {
		const extraction = {
			reasoning: 'Alice and Bob shared their first kiss',
			subjects: [
				{
					pair: ['Alice', 'Bob'] as [string, string],
					subject: 'intimate_kiss' as const,
				},
				{
					pair: ['Alice', 'Bob'] as [string, string],
					subject: 'emotional' as const,
				},
			],
		};
		expect(extraction.subjects).toHaveLength(2);
		expect(extraction.subjects[0].subject).toBe('intimate_kiss');
	});

	it('batch character changes shape', () => {
		const extraction = {
			reasoning: 'Alice moved and changed her mood',
			character: 'Alice',
			position: {
				reasoning: 'She stood up from the chair',
				character: 'Alice',
				changed: true,
				newPosition: 'standing by the window',
			},
			mood: {
				reasoning: 'Her mood shifted',
				character: 'Alice',
				added: ['contemplative'],
				removed: ['cheerful'],
			},
		};
		expect(extraction.position?.changed).toBe(true);
		expect(extraction.mood?.added).toContain('contemplative');
	});
});
