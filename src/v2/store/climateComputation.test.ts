/**
 * Climate Computation Tests
 *
 * Tests for forecast-related utility functions including:
 * - getDaysRemainingInForecast
 * - needsNewForecast
 * - isTimeWithinForecast
 * - MIN_FORECAST_DAYS constant
 */

import { describe, it, expect } from 'vitest';
import moment from 'moment';
import {
	getDaysRemainingInForecast,
	isTimeWithinForecast,
	needsNewForecast,
	MIN_FORECAST_DAYS,
} from './climateComputation';
import type { LocationForecast, DailyForecast, HourlyWeather } from '../../weather/types';

/**
 * Create a mock hourly weather entry.
 */
function createMockHourly(hour: number): HourlyWeather {
	return {
		hour,
		temperature: 70,
		feelsLike: 70,
		humidity: 50,
		precipitation: 0,
		precipProbability: 10,
		cloudCover: 30,
		windSpeed: 5,
		windDirection: 180,
		uvIndex: 5,
	};
}

/**
 * Create a mock daily forecast.
 */
function createMockDay(dateStr: string): DailyForecast {
	return {
		date: dateStr,
		high: 75,
		low: 55,
		sunrise: 6.5,
		sunset: 18.5,
		hourly: Array.from({ length: 24 }, (_, i) => createMockHourly(i)),
		dominantCondition: 'partly_cloudy',
	};
}

/**
 * Create a mock forecast with a specified number of days starting from a date.
 */
function createMockForecast(startDate: string, numDays: number): LocationForecast {
	const [year, month, day] = startDate.split('-').map(Number);
	const start = moment({ year, month: month - 1, day });

	const days: DailyForecast[] = [];
	for (let i = 0; i < numDays; i++) {
		const d = start.clone().add(i, 'days');
		days.push(createMockDay(d.format('YYYY-MM-DD')));
	}

	return {
		locationId: 'test-location',
		startDate,
		days,
	};
}

describe('MIN_FORECAST_DAYS', () => {
	it('is set to 8 days (current + 7)', () => {
		expect(MIN_FORECAST_DAYS).toBe(8);
	});
});

describe('getDaysRemainingInForecast', () => {
	it('returns full days when time is at start of forecast', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-01T12:00:00');

		expect(getDaysRemainingInForecast(forecast, time)).toBe(28);
	});

	it('returns correct remaining days in the middle of forecast', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-10T12:00:00'); // Day 10 (index 9)

		// Day 10 is index 9, so 28 - 9 = 19 days remaining
		expect(getDaysRemainingInForecast(forecast, time)).toBe(19);
	});

	it('returns 1 when time is on the last day of forecast', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-28T12:00:00'); // Last day (index 27)

		expect(getDaysRemainingInForecast(forecast, time)).toBe(1);
	});

	it('returns 0 when time is after forecast range', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-30T12:00:00'); // 2 days after end

		expect(getDaysRemainingInForecast(forecast, time)).toBe(0);
	});

	it('returns 0 when time is before forecast start', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2023-12-31T12:00:00'); // Day before start

		expect(getDaysRemainingInForecast(forecast, time)).toBe(0);
	});

	it('handles edge case at midnight correctly', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-15T00:00:00'); // Midnight of day 15

		expect(getDaysRemainingInForecast(forecast, time)).toBe(14);
	});

	it('handles edge case at end of day correctly', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-15T23:59:59'); // End of day 15

		expect(getDaysRemainingInForecast(forecast, time)).toBe(14);
	});
});

describe('isTimeWithinForecast', () => {
	it('returns true when time is within forecast range', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-15T12:00:00');

		expect(isTimeWithinForecast(forecast, time)).toBe(true);
	});

	it('returns true on first day of forecast', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-01T00:00:00');

		expect(isTimeWithinForecast(forecast, time)).toBe(true);
	});

	it('returns true on last day of forecast', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-28T23:59:59');

		expect(isTimeWithinForecast(forecast, time)).toBe(true);
	});

	it('returns false when time is after forecast range', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2024-01-29T00:00:00');

		expect(isTimeWithinForecast(forecast, time)).toBe(false);
	});

	it('returns false when time is before forecast start', () => {
		const forecast = createMockForecast('2024-01-01', 28);
		const time = moment('2023-12-31T23:59:59');

		expect(isTimeWithinForecast(forecast, time)).toBe(false);
	});
});

describe('needsNewForecast', () => {
	it('returns true when no forecast exists for area', () => {
		const forecasts = {};
		const time = moment('2024-01-15T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(true);
	});

	it('returns true when forecast exists for different area', () => {
		const forecasts = {
			'Los Angeles': createMockForecast('2024-01-01', 28),
		};
		const time = moment('2024-01-15T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(true);
	});

	it('returns false when more than MIN_FORECAST_DAYS remain', () => {
		const forecasts = {
			'New York': createMockForecast('2024-01-01', 28),
		};
		// Day 10, 19 days remaining (> 8)
		const time = moment('2024-01-10T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(false);
	});

	it('returns false when exactly MIN_FORECAST_DAYS remain', () => {
		const forecasts = {
			'New York': createMockForecast('2024-01-01', 28),
		};
		// Day 21, 8 days remaining (= MIN_FORECAST_DAYS)
		const time = moment('2024-01-21T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(false);
	});

	it('returns true when less than MIN_FORECAST_DAYS remain', () => {
		const forecasts = {
			'New York': createMockForecast('2024-01-01', 28),
		};
		// Day 22, 7 days remaining (< 8)
		const time = moment('2024-01-22T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(true);
	});

	it('returns true when only 1 day remains', () => {
		const forecasts = {
			'New York': createMockForecast('2024-01-01', 28),
		};
		// Last day
		const time = moment('2024-01-28T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(true);
	});

	it('returns true when time is beyond forecast range', () => {
		const forecasts = {
			'New York': createMockForecast('2024-01-01', 28),
		};
		const time = moment('2024-02-01T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(true);
	});

	it('returns true when time is before forecast start', () => {
		const forecasts = {
			'New York': createMockForecast('2024-01-01', 28),
		};
		const time = moment('2023-12-15T12:00:00');

		expect(needsNewForecast(forecasts, 'New York', time)).toBe(true);
	});

	describe('edge cases around MIN_FORECAST_DAYS threshold', () => {
		it('returns false at day 20 (8 days remaining)', () => {
			const forecasts = {
				Test: createMockForecast('2024-01-01', 28),
			};
			const time = moment('2024-01-21T00:00:00'); // Index 20, remaining = 8

			expect(needsNewForecast(forecasts, 'Test', time)).toBe(false);
		});

		it('returns true at day 21 (7 days remaining)', () => {
			const forecasts = {
				Test: createMockForecast('2024-01-01', 28),
			};
			const time = moment('2024-01-22T00:00:00'); // Index 21, remaining = 7

			expect(needsNewForecast(forecasts, 'Test', time)).toBe(true);
		});
	});
});
