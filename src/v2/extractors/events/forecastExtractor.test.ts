/**
 * Forecast Event Extractor Tests
 *
 * Tests the forecast extension behavior, particularly:
 * - Triggering when <8 days remain
 * - Splicing existing forecast days with new generated days
 * - Maintaining weather continuity through initialConditions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import moment from 'moment';
import { createMockGenerator, type MockGenerator } from '../../generator';
import { forecastExtractor } from './forecastExtractor';
import type { EventStore } from '../../store';
import { createEventStore } from '../../store';
import type { ExtractionContext, ExtractionSettings, RunStrategyContext } from '../types';
import type { MessageAndSwipe, Snapshot, ForecastGeneratedEvent } from '../../types';
import type { LocationForecast, DailyForecast, HourlyWeather } from '../../../weather/types';

// Store generated forecast for assertions
let lastGeneratedForecast: LocationForecast | null = null;
let lastGenerateCall: {
	startDate: { year: number; month: number; day: number };
	days: number;
	initialConditions: { temperature: number | null; condition: string | null } | null;
} | null = null;

// Mock the weather modules
vi.mock('../../../weather/locationMapper', () => ({
	mapLocation: vi.fn().mockResolvedValue({
		realWorldAnalog: 'Test City',
		latitude: 40.0,
		longitude: -74.0,
		baseClimateType: 'temperate',
	}),
}));

vi.mock('../../../weather/climateApi', () => ({
	fetchClimateNormals: vi.fn().mockResolvedValue({
		avgHigh: 70,
		avgLow: 50,
		avgPrecipitation: 0.1,
		avgPrecipDays: 10,
		avgHumidity: 60,
		avgWindSpeed: 8,
		avgCloudCover: 40,
		avgSunriseHour: 6.5,
		avgSunsetHour: 18.5,
		tempStdDev: 5,
		conditionProbabilities: {
			clear: 0.4,
			partlyCloudy: 0.3,
			overcast: 0.15,
			rain: 0.1,
			snow: 0.05,
		},
	}),
}));

vi.mock('../../../weather/fallbackProfiles', () => ({
	getClimateNormalsFromFallback: vi.fn().mockReturnValue({
		avgHigh: 65,
		avgLow: 45,
		avgPrecipitation: 0.15,
		avgPrecipDays: 12,
		avgHumidity: 70,
		avgWindSpeed: 10,
		avgCloudCover: 50,
		avgSunriseHour: 7,
		avgSunsetHour: 18,
		tempStdDev: 6,
		conditionProbabilities: {
			clear: 0.3,
			partlyCloudy: 0.35,
			overcast: 0.2,
			rain: 0.15,
			snow: 0,
		},
	}),
}));

vi.mock('../../../weather/forecastGenerator', () => ({
	generateForecast: vi.fn().mockImplementation(params => {
		lastGenerateCall = {
			startDate: params.startDate,
			days: params.days,
			initialConditions: params.initialConditions,
		};

		const { startDate, days } = params;
		const start = moment({
			year: startDate.year,
			month: startDate.month - 1,
			day: startDate.day,
		});

		const forecastDays: DailyForecast[] = [];
		for (let i = 0; i < days; i++) {
			const d = start.clone().add(i, 'days');
			forecastDays.push(createMockDay(d.format('YYYY-MM-DD'), 70 + i)); // Incrementing temp to identify days
		}

		lastGeneratedForecast = {
			locationId: 'generated',
			startDate: start.format('YYYY-MM-DD'),
			days: forecastDays,
		};

		return lastGeneratedForecast;
	}),
}));

/**
 * Create a mock hourly weather entry.
 */
function createMockHourly(hour: number, temp: number = 70): HourlyWeather {
	return {
		hour,
		temperature: temp,
		feelsLike: temp,
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
function createMockDay(dateStr: string, baseTemp: number = 70): DailyForecast {
	return {
		date: dateStr,
		high: baseTemp + 5,
		low: baseTemp - 10,
		sunrise: 6.5,
		sunset: 18.5,
		hourly: Array.from({ length: 24 }, (_, i) => createMockHourly(i, baseTemp)),
		dominantCondition: 'partly_cloudy',
	};
}

/**
 * Create a mock forecast with a specified number of days starting from a date.
 */
function createMockForecast(
	startDate: string,
	numDays: number,
	baseTempOffset: number = 0,
): LocationForecast {
	const [year, month, day] = startDate.split('-').map(Number);
	const start = moment({ year, month: month - 1, day });

	const days: DailyForecast[] = [];
	for (let i = 0; i < numDays; i++) {
		const d = start.clone().add(i, 'days');
		// Use baseTempOffset to distinguish old forecast days from new ones
		days.push(createMockDay(d.format('YYYY-MM-DD'), 50 + baseTempOffset + i));
	}

	return {
		locationId: 'test-location',
		startDate,
		days,
	};
}

/**
 * Create a mock extraction context.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{ mes: 'System message', is_user: false, is_system: true, name: '' },
			{
				mes: '*Elena looks out the window.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{ mes: 'Nice day today.', is_user: true, is_system: false, name: 'User' },
		],
		characters: [{ name: 'Elena', description: 'A woman' }],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A person',
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test-profile',
		track: {
			time: true,
			location: true,
			props: true,
			climate: true,
			characters: true,
			relationships: true,
			scene: true,
			narrative: true,
			chapters: true,
		},
		temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.7,
			relationships: 0.6,
			scene: 0.6,
			narrative: 0.7,
			chapters: 0.5,
		},
		customPrompts: {},
		...overrides,
	};
}

/**
 * Create a mock snapshot with forecasts.
 */
function createMockSnapshot(
	time: string,
	forecasts: Record<string, LocationForecast> = {},
): Snapshot {
	return {
		type: 'initial',
		source: { messageId: 0, swipeId: 0 },
		timestamp: Date.now(),
		swipeId: 0,
		time,
		location: {
			area: 'Test City',
			place: 'Downtown',
			position: 'on the street',
			props: [],
			locationType: 'outdoor',
		},
		climate: null,
		scene: {
			topic: 'casual conversation',
			tone: 'relaxed',
			tension: { level: 'aware', type: 'conversation', direction: 'stable' },
		},
		characters: {
			Elena: {
				name: 'Elena',
				position: 'nearby',
				activity: null,
				mood: [],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'blouse',
					legs: 'jeans',
					underwear: null,
					socks: null,
					footwear: 'sneakers',
				},
			},
		},
		relationships: {},
		currentChapter: 0,
		narrativeEvents: [],
		forecasts,
	};
}

/**
 * Create an EventStore with an initial snapshot.
 */
function createStoreWithSnapshot(snapshot: Snapshot): EventStore {
	const store = createEventStore();
	store.replaceInitialSnapshot(snapshot);
	return store;
}

/**
 * Create a RunStrategyContext for testing.
 */
function createRunStrategyContext(
	store: EventStore,
	settings: ExtractionSettings,
	context: ExtractionContext,
	currentMessage: MessageAndSwipe,
): RunStrategyContext {
	return {
		store,
		settings,
		context,
		currentMessage,
		turnEvents: [],
		ranAtMessages: [],
		producedAtMessages: [],
	};
}

describe('forecastExtractor', () => {
	let mockGenerator: MockGenerator;

	beforeEach(() => {
		mockGenerator = createMockGenerator();
		lastGeneratedForecast = null;
		lastGenerateCall = null;
		vi.clearAllMocks();
	});

	describe('shouldRun', () => {
		it('returns false when climate tracking is disabled', () => {
			const settings = createMockSettings({
				track: { ...createMockSettings().track, climate: false },
			});
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-15T12:00:00', {
					'Test City': createMockForecast('2024-01-01', 28),
				}),
			);

			const ctx = createRunStrategyContext(store, settings, createMockContext(), {
				messageId: 2,
				swipeId: 0,
			});

			expect(forecastExtractor.shouldRun(ctx)).toBe(false);
		});

		it('returns false when forecast has 8+ days remaining', () => {
			const settings = createMockSettings();
			// Day 10 of 28-day forecast = 19 days remaining
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-10T12:00:00', {
					'Test City': createMockForecast('2024-01-01', 28),
				}),
			);

			const ctx = createRunStrategyContext(store, settings, createMockContext(), {
				messageId: 2,
				swipeId: 0,
			});

			expect(forecastExtractor.shouldRun(ctx)).toBe(false);
		});

		it('returns true when forecast has <8 days remaining', () => {
			const settings = createMockSettings();
			// Day 22 of 28-day forecast = 7 days remaining
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-22T12:00:00', {
					'Test City': createMockForecast('2024-01-01', 28),
				}),
			);

			const ctx = createRunStrategyContext(store, settings, createMockContext(), {
				messageId: 2,
				swipeId: 0,
			});

			expect(forecastExtractor.shouldRun(ctx)).toBe(true);
		});

		it('returns true when no forecast exists for area', () => {
			const settings = createMockSettings();
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-15T12:00:00', {}),
			);

			const ctx = createRunStrategyContext(store, settings, createMockContext(), {
				messageId: 2,
				swipeId: 0,
			});

			expect(forecastExtractor.shouldRun(ctx)).toBe(true);
		});
	});

	describe('run - forecast generation', () => {
		it('generates new forecast when none exists', async () => {
			const settings = createMockSettings();
			const context = createMockContext();
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-15T12:00:00', {}),
			);
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			const events = await forecastExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(events).toHaveLength(1);
			expect(events[0].kind).toBe('forecast_generated');

			const forecastEvent = events[0] as ForecastGeneratedEvent;
			expect(forecastEvent.areaName).toBe('Test City');
			expect(forecastEvent.forecast.days).toHaveLength(28);
		});

		it('splices existing days when extending forecast', async () => {
			const settings = createMockSettings();
			const context = createMockContext();

			// Create a 28-day forecast starting Jan 1
			// Current time is Jan 22 = 7 days remaining (triggers extension)
			const existingForecast = createMockForecast('2024-01-01', 28, 100); // baseTempOffset=100 to identify old days
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-22T12:00:00', {
					'Test City': existingForecast,
				}),
			);
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			const events = await forecastExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(events).toHaveLength(1);
			const forecastEvent = events[0] as ForecastGeneratedEvent;

			// Should have 28 days total
			expect(forecastEvent.forecast.days).toHaveLength(28);

			// Start date should be current time (Jan 22)
			expect(forecastEvent.startDate).toBe('2024-01-22');
			expect(forecastEvent.forecast.startDate).toBe('2024-01-22');

			// First 7 days should be from old forecast (they have baseTempOffset=100)
			// Old forecast day 21 (Jan 22) has baseTemp = 50 + 100 + 21 = 171
			// Day 0 of new combined = old day 21, so high = 171 + 5 = 176
			const firstDayHigh = forecastEvent.forecast.days[0].high;
			expect(firstDayHigh).toBe(176); // 50 + 100 + 21 + 5

			// Verify we kept the expected number of days from old forecast
			// 7 days remaining, min(7, 8) = 7 days to keep
			// Day 7 (index 6) should still be from old forecast: 50 + 100 + 27 + 5 = 182
			const day7High = forecastEvent.forecast.days[6].high;
			expect(day7High).toBe(182);

			// Day 8 (index 7) should be from new forecast (baseTemp starts at 70)
			// New forecast starts at Jan 29, day 0 = 70 + 0 + 5 = 75
			const day8High = forecastEvent.forecast.days[7].high;
			expect(day8High).toBe(75);
		});

		it('passes initialConditions from last kept day', async () => {
			const settings = createMockSettings();
			const context = createMockContext();

			// Create forecast where we'll keep some days
			const existingForecast = createMockForecast('2024-01-01', 28, 100);
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-01-22T12:00:00', {
					'Test City': existingForecast,
				}),
			);
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			await forecastExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Check that generateForecast was called with initialConditions
			expect(lastGenerateCall).not.toBeNull();
			expect(lastGenerateCall!.initialConditions).not.toBeNull();

			// Initial conditions should come from hour 23 of last kept day
			// Last kept day is day 27 (Jan 28), with temp = 50 + 100 + 27 = 177
			expect(lastGenerateCall!.initialConditions!.temperature).toBe(177);
			expect(lastGenerateCall!.initialConditions!.condition).toBe(
				'partly_cloudy',
			);
		});

		it('generates from current day when no existing forecast', async () => {
			const settings = createMockSettings();
			const context = createMockContext();
			const store = createStoreWithSnapshot(
				createMockSnapshot('2024-03-15T14:30:00', {}),
			);
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			await forecastExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			// Should generate starting from current day (no days to keep)
			expect(lastGenerateCall!.startDate.year).toBe(2024);
			expect(lastGenerateCall!.startDate.month).toBe(3); // March
			expect(lastGenerateCall!.startDate.day).toBe(15);
			expect(lastGenerateCall!.initialConditions).toBeNull();
		});

		it('returns empty when location is missing', async () => {
			const settings = createMockSettings();
			const context = createMockContext();

			const snapshotWithoutLocation = createMockSnapshot(
				'2024-01-22T12:00:00',
				{},
			);
			snapshotWithoutLocation.location = null as unknown as Snapshot['location'];
			const store = createStoreWithSnapshot(snapshotWithoutLocation);
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			const events = await forecastExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(events).toHaveLength(0);
		});

		it('returns empty when time is missing', async () => {
			const settings = createMockSettings();
			const context = createMockContext();

			const snapshotWithoutTime = createMockSnapshot('2024-01-22T12:00:00', {});
			snapshotWithoutTime.time = null as unknown as string;
			const store = createStoreWithSnapshot(snapshotWithoutTime);
			const currentMessage: MessageAndSwipe = { messageId: 2, swipeId: 0 };

			const events = await forecastExtractor.run(
				mockGenerator,
				context,
				settings,
				store,
				currentMessage,
				[],
			);

			expect(events).toHaveLength(0);
		});
	});

	describe('metadata', () => {
		it('has the correct name', () => {
			expect(forecastExtractor.name).toBe('forecastUpdate');
		});

		it('has the correct display name', () => {
			expect(forecastExtractor.displayName).toBe('forecast');
		});

		it('has the correct category', () => {
			expect(forecastExtractor.category).toBe('climate');
		});

		it('has the correct default temperature', () => {
			expect(forecastExtractor.defaultTemperature).toBe(0.3);
		});

		it('uses noPrompt since it does not use LLM', () => {
			expect(forecastExtractor.prompt.name).toBe('noPrompt');
		});

		it('has messageStrategy of fixedNumber with n=0', () => {
			expect(forecastExtractor.messageStrategy).toEqual({
				strategy: 'fixedNumber',
				n: 0,
			});
		});

		it('has a custom runStrategy', () => {
			expect(forecastExtractor.runStrategy.strategy).toBe('custom');
		});
	});
});
