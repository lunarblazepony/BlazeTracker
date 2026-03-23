import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchClimateNormals, clearCaches, geocodeLocation } from './climateApi';

vi.mock('../utils/debug', () => ({
	debugWarn: vi.fn(),
	errorLog: vi.fn(),
	debugLog: vi.fn(),
}));

describe('climateApi', () => {
	beforeEach(() => {
		clearCaches();
		vi.stubGlobal('fetch', vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('clearCaches', () => {
		it('can be called without error', () => {
			expect(() => clearCaches()).not.toThrow();
		});

		it('causes subsequent fetchClimateNormals to refetch', async () => {
			const mockData = {
				daily: {
					temperature_2m_max: [20],
					temperature_2m_min: [10],
					precipitation_sum: [5],
					relative_humidity_2m_mean: [60],
					windspeed_10m_max: [15],
					cloudcover_mean: [40],
				},
			};
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve(mockData),
			});
			vi.stubGlobal('fetch', mockFetch);

			await fetchClimateNormals(40, -74, 6);
			const callCount1 = mockFetch.mock.calls.length;

			// Second call should be cached (no new fetches)
			await fetchClimateNormals(40, -74, 6);
			const callCount2 = mockFetch.mock.calls.length;
			expect(callCount2).toBe(callCount1);

			// After clearing, should refetch
			clearCaches();
			await fetchClimateNormals(40, -74, 6);
			const callCount3 = mockFetch.mock.calls.length;
			expect(callCount3).toBeGreaterThan(callCount2);
		});
	});

	describe('fetchClimateNormals - fallback behavior', () => {
		beforeEach(() => {
			// Make all fetches fail so fallback is used
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({ ok: false, status: 500 }),
			);
		});

		it('returns fallback normals when all fetches fail', async () => {
			const normals = await fetchClimateNormals(40, -74, 6);

			expect(normals).toBeDefined();
			expect(normals.latitude).toBe(40);
			expect(normals.longitude).toBe(-74);
			expect(normals.month).toBe(6);
			expect(typeof normals.avgHigh).toBe('number');
			expect(typeof normals.avgLow).toBe('number');
			expect(typeof normals.avgPrecipitation).toBe('number');
			expect(typeof normals.avgPrecipDays).toBe('number');
			expect(typeof normals.avgHumidity).toBe('number');
			expect(typeof normals.avgWindSpeed).toBe('number');
			expect(typeof normals.avgCloudCover).toBe('number');
			expect(typeof normals.avgSunriseHour).toBe('number');
			expect(typeof normals.avgSunsetHour).toBe('number');
			expect(typeof normals.tempStdDev).toBe('number');
			expect(normals.conditionProbabilities).toBeDefined();
		});

		it('uses arctic fallback for latitude > 60', async () => {
			const normals = await fetchClimateNormals(65, 25, 1);

			// Arctic January should be very cold
			expect(normals.latitude).toBe(65);
			expect(normals.longitude).toBe(25);
			expect(normals.avgHigh).toBeLessThan(20);
			expect(normals.avgLow).toBeLessThan(0);
		});

		it('uses tropical fallback for latitude < 25', async () => {
			const normals = await fetchClimateNormals(10, -80, 7);

			// Tropical should be hot
			expect(normals.latitude).toBe(10);
			expect(normals.longitude).toBe(-80);
			expect(normals.avgHigh).toBeGreaterThan(80);
			expect(normals.avgLow).toBeGreaterThan(70);
		});

		it('uses temperate fallback for latitude 25-45', async () => {
			const normals = await fetchClimateNormals(35, -90, 7);

			// Temperate summer should be warm but not extreme
			expect(normals.latitude).toBe(35);
			expect(normals.avgHigh).toBeGreaterThan(70);
			expect(normals.avgHigh).toBeLessThan(100);
		});

		it('uses continental fallback for latitude 45-60', async () => {
			const normals = await fetchClimateNormals(50, 10, 1);

			// Continental winter should be cold
			expect(normals.latitude).toBe(50);
			expect(normals.avgHigh).toBeLessThan(50);
		});

		it('uses provided fallbackClimateType regardless of latitude', async () => {
			// Pass tropical climate type with arctic latitude
			const normals = await fetchClimateNormals(70, 25, 7, 'tropical');

			// Should use tropical profile (hot) despite high latitude
			expect(normals.latitude).toBe(70);
			expect(normals.avgHigh).toBeGreaterThan(80);
		});

		it('returned normals have correct latitude/longitude/month', async () => {
			const lat = 42.5;
			const lon = -71.3;
			const month = 3;
			const normals = await fetchClimateNormals(lat, lon, month);

			expect(normals.latitude).toBe(lat);
			expect(normals.longitude).toBe(lon);
			expect(normals.month).toBe(month);
		});
	});

	describe('fetchClimateNormals - with mocked API data', () => {
		function createMockResponse(data: Record<string, unknown>) {
			return {
				ok: true,
				json: () => Promise.resolve(data),
			};
		}

		it('calculates normals from valid API data', async () => {
			const mockData = {
				daily: {
					temperature_2m_max: [20],
					temperature_2m_min: [10],
					precipitation_sum: [5],
					relative_humidity_2m_mean: [60],
					windspeed_10m_max: [15],
					cloudcover_mean: [40],
				},
			};

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(createMockResponse(mockData)),
			);

			const normals = await fetchClimateNormals(40, -74, 6);

			expect(normals.latitude).toBe(40);
			expect(normals.longitude).toBe(-74);
			expect(normals.month).toBe(6);
		});

		it('converts temperatures from Celsius to Fahrenheit', async () => {
			// 20C = 68F, 10C = 50F
			const mockData = {
				daily: {
					temperature_2m_max: [20],
					temperature_2m_min: [10],
					precipitation_sum: [0],
					relative_humidity_2m_mean: [50],
					windspeed_10m_max: [10],
					cloudcover_mean: [50],
				},
			};

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(createMockResponse(mockData)),
			);

			const normals = await fetchClimateNormals(40, -74, 6);

			// 20C -> 68F
			expect(normals.avgHigh).toBeCloseTo(68, 0);
			// 10C -> 50F
			expect(normals.avgLow).toBeCloseTo(50, 0);
		});

		it('converts wind speeds from km/h to mph', async () => {
			// 15 km/h * 0.621371 = ~9.32 mph
			const mockData = {
				daily: {
					temperature_2m_max: [25],
					temperature_2m_min: [15],
					precipitation_sum: [0],
					relative_humidity_2m_mean: [50],
					windspeed_10m_max: [15],
					cloudcover_mean: [50],
				},
			};

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(createMockResponse(mockData)),
			);

			const normals = await fetchClimateNormals(40, -74, 6);

			expect(normals.avgWindSpeed).toBeCloseTo(15 * 0.621371, 1);
		});

		it('caches results so second call does not refetch', async () => {
			const mockData = {
				daily: {
					temperature_2m_max: [20],
					temperature_2m_min: [10],
					precipitation_sum: [5],
					relative_humidity_2m_mean: [60],
					windspeed_10m_max: [15],
					cloudcover_mean: [40],
				},
			};

			const mockFetch = vi.fn().mockResolvedValue(createMockResponse(mockData));
			vi.stubGlobal('fetch', mockFetch);

			const normals1 = await fetchClimateNormals(40, -74, 6);
			const callCountAfterFirst = mockFetch.mock.calls.length;

			const normals2 = await fetchClimateNormals(40, -74, 6);
			const callCountAfterSecond = mockFetch.mock.calls.length;

			// No additional fetch calls
			expect(callCountAfterSecond).toBe(callCountAfterFirst);
			// Same result
			expect(normals2).toEqual(normals1);
		});

		it('includes condition probabilities that sum to ~1', async () => {
			const mockData = {
				daily: {
					temperature_2m_max: [20],
					temperature_2m_min: [10],
					precipitation_sum: [5],
					relative_humidity_2m_mean: [60],
					windspeed_10m_max: [15],
					cloudcover_mean: [40],
				},
			};

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(createMockResponse(mockData)),
			);

			const normals = await fetchClimateNormals(40, -74, 6);
			const totalProb = Object.values(normals.conditionProbabilities).reduce(
				(a, b) => a + b,
				0,
			);

			expect(totalProb).toBeCloseTo(1, 1);
		});

		it('calculates sunrise and sunset hours', async () => {
			const mockData = {
				daily: {
					temperature_2m_max: [25],
					temperature_2m_min: [15],
					precipitation_sum: [0],
					relative_humidity_2m_mean: [50],
					windspeed_10m_max: [10],
					cloudcover_mean: [30],
				},
			};

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(createMockResponse(mockData)),
			);

			const normals = await fetchClimateNormals(40, -74, 6);

			// Sunrise should be between 4 and 9
			expect(normals.avgSunriseHour).toBeGreaterThanOrEqual(4);
			expect(normals.avgSunriseHour).toBeLessThanOrEqual(9);
			// Sunset should be between 17 and 21
			expect(normals.avgSunsetHour).toBeGreaterThanOrEqual(17);
			expect(normals.avgSunsetHour).toBeLessThanOrEqual(21);
		});

		it('falls back when fetch throws an error', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(new Error('Network error')),
			);

			const normals = await fetchClimateNormals(40, -74, 6);

			// Should still return valid normals from fallback
			expect(normals.latitude).toBe(40);
			expect(normals.longitude).toBe(-74);
			expect(normals.month).toBe(6);
			expect(typeof normals.avgHigh).toBe('number');
		});

		it('falls back when API returns no daily data', async () => {
			const mockData = { error: 'something went wrong' };

			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue(createMockResponse(mockData)),
			);

			const normals = await fetchClimateNormals(40, -74, 6);

			// Should return valid fallback normals
			expect(normals.latitude).toBe(40);
			expect(normals.longitude).toBe(-74);
			expect(typeof normals.avgHigh).toBe('number');
		});
	});

	describe('geocodeLocation', () => {
		it('returns coordinates for a successful geocode', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: () =>
						Promise.resolve([
							{ lat: '40.7128', lon: '-74.0060' },
						]),
				}),
			);

			const result = await geocodeLocation('New York');

			expect(result).toEqual({
				latitude: 40.7128,
				longitude: -74.006,
			});
		});

		it('returns null when geocoding fails with non-ok response', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({ ok: false, status: 500 }),
			);

			const result = await geocodeLocation('Nonexistent Place');

			expect(result).toBeNull();
		});

		it('returns null when geocoding returns empty results', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockResolvedValue({
					ok: true,
					json: () => Promise.resolve([]),
				}),
			);

			const result = await geocodeLocation('Nowhere');

			expect(result).toBeNull();
		});

		it('returns null when fetch throws', async () => {
			vi.stubGlobal(
				'fetch',
				vi.fn().mockRejectedValue(new Error('Network error')),
			);

			const result = await geocodeLocation('Some Place');

			expect(result).toBeNull();
		});

		it('caches geocode results', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve([{ lat: '51.5074', lon: '-0.1278' }]),
			});
			vi.stubGlobal('fetch', mockFetch);

			await geocodeLocation('London');
			const callCount1 = mockFetch.mock.calls.length;

			await geocodeLocation('London');
			const callCount2 = mockFetch.mock.calls.length;

			expect(callCount2).toBe(callCount1);
		});

		it('caches null results for failed lookups', async () => {
			const mockFetch = vi.fn().mockResolvedValue({
				ok: true,
				json: () => Promise.resolve([]),
			});
			vi.stubGlobal('fetch', mockFetch);

			await geocodeLocation('Nowhere');
			const callCount1 = mockFetch.mock.calls.length;

			await geocodeLocation('Nowhere');
			const callCount2 = mockFetch.mock.calls.length;

			expect(callCount2).toBe(callCount1);
		});
	});
});
