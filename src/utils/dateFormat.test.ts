import { describe, it, expect } from 'vitest';
import { getDayOrdinal, formatNarrativeDateTime } from './dateFormat';
import type { NarrativeDateTime } from '../types/state';

describe('getDayOrdinal', () => {
	it('returns "st" for 1, 21, 31', () => {
		expect(getDayOrdinal(1)).toBe('st');
		expect(getDayOrdinal(21)).toBe('st');
		expect(getDayOrdinal(31)).toBe('st');
	});

	it('returns "nd" for 2, 22', () => {
		expect(getDayOrdinal(2)).toBe('nd');
		expect(getDayOrdinal(22)).toBe('nd');
	});

	it('returns "rd" for 3, 23', () => {
		expect(getDayOrdinal(3)).toBe('rd');
		expect(getDayOrdinal(23)).toBe('rd');
	});

	it('returns "th" for 11, 12, 13 (special cases)', () => {
		expect(getDayOrdinal(11)).toBe('th');
		expect(getDayOrdinal(12)).toBe('th');
		expect(getDayOrdinal(13)).toBe('th');
	});

	it('returns "th" for other numbers', () => {
		expect(getDayOrdinal(4)).toBe('th');
		expect(getDayOrdinal(5)).toBe('th');
		expect(getDayOrdinal(10)).toBe('th');
		expect(getDayOrdinal(14)).toBe('th');
		expect(getDayOrdinal(20)).toBe('th');
		expect(getDayOrdinal(24)).toBe('th');
	});
});

describe('formatNarrativeDateTime', () => {
	it('formats a morning time correctly', () => {
		const time: NarrativeDateTime = {
			year: 2024,
			month: 6,
			day: 15,
			hour: 9,
			minute: 30,
			second: 0,
			dayOfWeek: 'Saturday',
		};

		expect(formatNarrativeDateTime(time)).toBe('Saturday, June 15th, 2024 at 9:30 AM');
	});

	it('formats an afternoon time correctly', () => {
		const time: NarrativeDateTime = {
			year: 2024,
			month: 1,
			day: 1,
			hour: 14,
			minute: 5,
			second: 0,
			dayOfWeek: 'Monday',
		};

		expect(formatNarrativeDateTime(time)).toBe('Monday, January 1st, 2024 at 2:05 PM');
	});

	it('formats noon correctly', () => {
		const time: NarrativeDateTime = {
			year: 2024,
			month: 12,
			day: 25,
			hour: 12,
			minute: 0,
			second: 0,
			dayOfWeek: 'Wednesday',
		};

		expect(formatNarrativeDateTime(time)).toBe(
			'Wednesday, December 25th, 2024 at 12:00 PM',
		);
	});

	it('formats midnight correctly', () => {
		const time: NarrativeDateTime = {
			year: 2024,
			month: 3,
			day: 21,
			hour: 0,
			minute: 0,
			second: 0,
			dayOfWeek: 'Thursday',
		};

		expect(formatNarrativeDateTime(time)).toBe(
			'Thursday, March 21st, 2024 at 12:00 AM',
		);
	});

	it('pads minutes with leading zero', () => {
		const time: NarrativeDateTime = {
			year: 2024,
			month: 7,
			day: 4,
			hour: 10,
			minute: 5,
			second: 0,
			dayOfWeek: 'Thursday',
		};

		expect(formatNarrativeDateTime(time)).toBe('Thursday, July 4th, 2024 at 10:05 AM');
	});

	it('handles all months correctly', () => {
		const months = [
			'January',
			'February',
			'March',
			'April',
			'May',
			'June',
			'July',
			'August',
			'September',
			'October',
			'November',
			'December',
		];

		months.forEach((expectedMonth, index) => {
			const time: NarrativeDateTime = {
				year: 2024,
				month: index + 1,
				day: 15,
				hour: 12,
				minute: 0,
				second: 0,
				dayOfWeek: 'Sunday',
			};

			expect(formatNarrativeDateTime(time)).toContain(expectedMonth);
		});
	});
});
