/**
 * Forecast Extractor Tests
 *
 * Tests that verify the forecast extractor generates weather forecasts correctly.
 * This extractor is deterministic and doesn't use the LLM.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { initialForecastExtractor } from './forecastExtractor';
import {
	createMockContext,
	createMockSettings,
	createPartialSnapshot,
	createMockLocation,
} from './testHelpers';

// Mock the weather modules
vi.mock('../../../weather/locationMapper', () => ({
	mapLocation: vi.fn().mockResolvedValue({
		realWorldAnalog: 'Seattle, WA',
		latitude: 47.6062,
		longitude: -122.3321,
		baseClimateType: 'temperate',
	}),
}));

vi.mock('../../../weather/climateApi', () => ({
	fetchClimateNormals: vi.fn().mockResolvedValue({
		temperature: { high: 15, low: 8, mean: 11.5 },
		precipitation: { avgMm: 80, rainyDays: 15 },
		humidity: 75,
		sunlightHours: 4,
	}),
}));

vi.mock('../../../weather/fallbackProfiles', () => ({
	getClimateNormalsFromFallback: vi.fn().mockReturnValue({
		temperature: { high: 12, low: 5, mean: 8.5 },
		precipitation: { avgMm: 60, rainyDays: 12 },
		humidity: 70,
		sunlightHours: 5,
	}),
}));

vi.mock('../../../weather/forecastGenerator', () => ({
	generateForecast: vi.fn().mockReturnValue({
		startDate: { year: 2024, month: 11, day: 14 },
		days: [
			{
				date: { year: 2024, month: 11, day: 14 },
				condition: 'partly_cloudy',
				high: 12,
				low: 6,
				precipChance: 30,
				hourly: [],
			},
		],
	}),
}));

describe('initialForecastExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		vi.clearAllMocks();
	});

	describe('shouldRun', () => {
		it('returns true when climate tracking is enabled and chat has messages', () => {
			const context = createMockContext();
			const settings = createMockSettings();

			expect(initialForecastExtractor.shouldRun(settings, context)).toBe(true);
		});

		it('returns false when climate tracking is disabled', () => {
			const context = createMockContext();
			const settings = createMockSettings({
				track: { ...createMockSettings().track, climate: false },
			});

			expect(initialForecastExtractor.shouldRun(settings, context)).toBe(false);
		});

		it('returns false when chat is empty', () => {
			const context = createMockContext({ chat: [] });
			const settings = createMockSettings();

			expect(initialForecastExtractor.shouldRun(settings, context)).toBe(false);
		});
	});

	describe('run', () => {
		it('returns empty forecasts when location is missing', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				time: '2024-11-14T15:47:00.000Z',
				// No location
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts).toEqual({});
		});

		it('returns empty forecasts when time is missing', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation(),
				// No time
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts).toEqual({});
		});

		it('returns empty forecasts when location has no area', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: '' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts).toEqual({});
		});

		it('generates forecast for the location area', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: 'Seattle' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts).toBeDefined();
			expect(result.forecasts!['Seattle']).toBeDefined();
			expect(result.forecasts!['Seattle'].days).toBeDefined();
			expect(result.forecasts!['Seattle'].days.length).toBeGreaterThan(0);
		});

		it('does not call the LLM generator', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: 'Seattle' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			// The generator should not have been called
			expect(mockGenerator.getCalls()).toHaveLength(0);
		});

		it('uses location.area as the forecast key', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: 'Downtown Portland' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts).toBeDefined();
			expect(Object.keys(result.forecasts!)).toContain('Downtown Portland');
		});

		it('calls mapLocation with area name and narrative context', async () => {
			const { mapLocation } = await import('../../../weather/locationMapper');

			const context = createMockContext({
				chat: [
					{
						mes: '*The rain falls gently on the streets of the Pacific Northwest.*',
						is_user: false,
						is_system: false,
						name: 'Elena',
					},
				],
			});
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: 'Seattle' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(mapLocation).toHaveBeenCalledWith(
				'Seattle',
				expect.stringContaining('Pacific Northwest'),
				expect.any(Array),
			);
		});

		it('includes realWorldAnalog in forecast when available', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: 'Seattle' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts!['Seattle'].realWorldAnalog).toBeDefined();
			expect(result.forecasts!['Seattle'].realWorldAnalog?.name).toBe(
				'Seattle, WA',
			);
		});

		it('includes baseClimateType in forecast when available', async () => {
			const context = createMockContext();
			const settings = createMockSettings();
			const partialSnapshot = createPartialSnapshot({
				location: createMockLocation({ area: 'Seattle' }),
				time: '2024-11-14T15:47:00.000Z',
			});

			const result = await initialForecastExtractor.run(
				mockGenerator,
				context,
				settings,
				partialSnapshot,
			);

			expect(result.forecasts!['Seattle'].baseClimateType).toBe('temperate');
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(initialForecastExtractor.name).toBe('initialForecast');
		});

		it('has the correct category', () => {
			expect(initialForecastExtractor.category).toBe('climate');
		});

		it('has a default temperature', () => {
			expect(initialForecastExtractor.defaultTemperature).toBe(0.3);
		});

		it('uses noPrompt since it does not use LLM', () => {
			expect(initialForecastExtractor.prompt.name).toBe('noPrompt');
		});
	});
});
