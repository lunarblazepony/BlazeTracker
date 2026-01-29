/**
 * Climate API Client
 *
 * Fetches historical climate data from Open-Meteo API.
 * Converts metric units to imperial (Fahrenheit, mph, inches).
 */

import type { ClimateNormals } from './types';
import { getClimateNormalsFromFallback } from './fallbackProfiles';
import { debugWarn, errorLog } from '../utils/debug';

// ============================================
// Constants
// ============================================

const OPEN_METEO_ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'BlazeTracker/1.0 (SillyTavern Extension)';

// Cache for API responses
const climateCache = new Map<string, ClimateNormals>();
const geocodeCache = new Map<string, { latitude: number; longitude: number } | null>();

// ============================================
// Unit Conversion
// ============================================

function celsiusToFahrenheit(c: number): number {
	return (c * 9) / 5 + 32;
}

function kmhToMph(kmh: number): number {
	return kmh * 0.621371;
}

function mmToInches(mm: number): number {
	return mm * 0.0393701;
}

// ============================================
// Geocoding
// ============================================

/**
 * Geocode a place name to coordinates using Nominatim
 */
export async function geocodeLocation(
	placeName: string,
): Promise<{ latitude: number; longitude: number } | null> {
	const cacheKey = placeName.toLowerCase().trim();

	if (geocodeCache.has(cacheKey)) {
		return geocodeCache.get(cacheKey)!;
	}

	try {
		const params = new URLSearchParams({
			q: placeName,
			format: 'json',
			limit: '1',
		});

		const response = await fetch(`${NOMINATIM_URL}?${params}`, {
			headers: {
				'User-Agent': USER_AGENT,
			},
		});

		if (!response.ok) {
			debugWarn(`Geocoding failed for "${placeName}": ${response.status}`);
			geocodeCache.set(cacheKey, null);
			return null;
		}

		const data = await response.json();

		if (!Array.isArray(data) || data.length === 0) {
			debugWarn(`No geocoding results for "${placeName}"`);
			geocodeCache.set(cacheKey, null);
			return null;
		}

		const result = {
			latitude: parseFloat(data[0].lat),
			longitude: parseFloat(data[0].lon),
		};

		geocodeCache.set(cacheKey, result);
		return result;
	} catch (error) {
		errorLog(`Geocoding error for "${placeName}":`, error);
		geocodeCache.set(cacheKey, null);
		return null;
	}
}

// ============================================
// Climate Data Fetching
// ============================================

/**
 * Fetch historical climate data from Open-Meteo
 * Returns averages for the specified month based on historical data
 */
export async function fetchClimateNormals(
	latitude: number,
	longitude: number,
	month: number,
	fallbackClimateType?: string,
): Promise<ClimateNormals> {
	const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)},${month}`;

	if (climateCache.has(cacheKey)) {
		return climateCache.get(cacheKey)!;
	}

	try {
		// Query last 10 years of data for this month
		const currentYear = new Date().getFullYear();
		const years: number[] = [];
		for (let y = currentYear - 10; y < currentYear; y++) {
			years.push(y);
		}

		// Build date ranges for the target month across all years
		const allData = await Promise.all(
			years.map(year => fetchMonthData(latitude, longitude, year, month)),
		);

		// Filter out failed fetches
		const validData = allData.filter(d => d !== null) as MonthData[];

		if (validData.length === 0) {
			debugWarn(`No climate data available, using fallback`);
			return getFallbackNormals(latitude, longitude, month, fallbackClimateType);
		}

		// Calculate averages
		const normals = calculateNormals(validData, latitude, longitude, month);
		climateCache.set(cacheKey, normals);
		return normals;
	} catch (error) {
		errorLog(`Climate API error:`, error);
		return getFallbackNormals(latitude, longitude, month, fallbackClimateType);
	}
}

interface MonthData {
	highs: number[];
	lows: number[];
	precip: number[];
	humidity: number[];
	windSpeed: number[];
	cloudCover: number[];
}

/**
 * Fetch data for a single month in a single year
 */
async function fetchMonthData(
	latitude: number,
	longitude: number,
	year: number,
	month: number,
): Promise<MonthData | null> {
	try {
		// Calculate date range for the month
		const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
		const lastDay = new Date(year, month, 0).getDate();
		const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

		const params = new URLSearchParams({
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			start_date: startDate,
			end_date: endDate,
			daily: [
				'temperature_2m_max',
				'temperature_2m_min',
				'precipitation_sum',
				'relative_humidity_2m_mean',
				'windspeed_10m_max',
				'cloudcover_mean',
			].join(','),
			timezone: 'auto',
		});

		const response = await fetch(`${OPEN_METEO_ARCHIVE_URL}?${params}`);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();

		if (!data.daily) {
			return null;
		}

		return {
			highs: data.daily.temperature_2m_max || [],
			lows: data.daily.temperature_2m_min || [],
			precip: data.daily.precipitation_sum || [],
			humidity: data.daily.relative_humidity_2m_mean || [],
			windSpeed: data.daily.windspeed_10m_max || [],
			cloudCover: data.daily.cloudcover_mean || [],
		};
	} catch {
		return null;
	}
}

/**
 * Calculate climate normals from historical data
 */
function calculateNormals(
	data: MonthData[],
	latitude: number,
	longitude: number,
	month: number,
): ClimateNormals {
	// Flatten all data points
	const allHighs = data.flatMap(d => d.highs).filter(v => v !== null);
	const allLows = data.flatMap(d => d.lows).filter(v => v !== null);
	const allPrecip = data.flatMap(d => d.precip).filter(v => v !== null);
	const allHumidity = data.flatMap(d => d.humidity).filter(v => v !== null);
	const allWind = data.flatMap(d => d.windSpeed).filter(v => v !== null);
	const allClouds = data.flatMap(d => d.cloudCover).filter(v => v !== null);

	const avg = (arr: number[]) =>
		arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

	const stdDev = (arr: number[]) => {
		if (arr.length === 0) return 0;
		const mean = avg(arr);
		const squareDiffs = arr.map(v => Math.pow(v - mean, 2));
		return Math.sqrt(avg(squareDiffs));
	};

	// Count precip days (>1mm = >0.04 inches)
	const precipDays = allPrecip.filter(p => p > 1).length / data.length;

	// Calculate sun times based on latitude and month
	const sunTimes = calculateSunTimes(latitude, month);

	// Estimate condition probabilities from cloud cover and precip
	const avgCloudCover = avg(allClouds);
	const precipProb = precipDays / 30;

	const conditionProbabilities = {
		clear: Math.max(0, (100 - avgCloudCover) / 100 - precipProb) * 0.5,
		partlyCloudy: Math.min(0.3, avgCloudCover / 200),
		overcast: Math.min(0.3, avgCloudCover / 150),
		rain: precipProb * (avg(allLows) > 32 ? 1 : 0.3),
		snow: precipProb * (avg(allLows) <= 32 ? 1 : 0),
	};

	// Normalize probabilities
	const total = Object.values(conditionProbabilities).reduce((a, b) => a + b, 0);
	if (total > 0) {
		Object.keys(conditionProbabilities).forEach(k => {
			conditionProbabilities[k as keyof typeof conditionProbabilities] /= total;
		});
	}

	return {
		latitude,
		longitude,
		month,
		avgHigh: celsiusToFahrenheit(avg(allHighs)),
		avgLow: celsiusToFahrenheit(avg(allLows)),
		avgPrecipitation: mmToInches(avg(allPrecip)),
		avgPrecipDays: Math.round(precipDays),
		avgHumidity: avg(allHumidity),
		avgWindSpeed: kmhToMph(avg(allWind)),
		avgCloudCover: avg(allClouds),
		avgSunriseHour: sunTimes.sunrise,
		avgSunsetHour: sunTimes.sunset,
		tempStdDev: celsiusToFahrenheit(stdDev(allHighs)) - 32, // Convert std dev
		conditionProbabilities,
	};
}

/**
 * Calculate approximate sunrise/sunset times based on latitude and month
 */
function calculateSunTimes(latitude: number, month: number): { sunrise: number; sunset: number } {
	// Simplified calculation based on latitude and time of year
	// June 21 = summer solstice (longest day in northern hemisphere)
	// December 21 = winter solstice (shortest day)

	const dayOfYear = (month - 1) * 30 + 15; // Approximate mid-month
	const summerSolstice = 172; // ~June 21

	// Calculate day length variation based on latitude
	// At equator, day length is ~12 hours year-round
	// At 60° latitude, variation is ~6 hours
	const latitudeRadians = (Math.abs(latitude) * Math.PI) / 180;
	const maxVariation = Math.min(6, Math.tan(latitudeRadians) * 3);

	// Sinusoidal variation through the year
	const variation =
		Math.cos(((dayOfYear - summerSolstice) * 2 * Math.PI) / 365) * maxVariation;

	// Apply hemisphere correction
	const hemisphereCorrection = latitude >= 0 ? 1 : -1;
	const dayLengthHours = 12 + variation * hemisphereCorrection;

	// Calculate sunrise/sunset from day length
	const sunrise = 12 - dayLengthHours / 2;
	const sunset = 12 + dayLengthHours / 2;

	return {
		sunrise: Math.max(4, Math.min(9, sunrise)),
		sunset: Math.max(17, Math.min(21, sunset)),
	};
}

/**
 * Get fallback normals when API fails
 */
function getFallbackNormals(
	latitude: number,
	longitude: number,
	month: number,
	fallbackClimateType?: string,
): ClimateNormals {
	// Infer climate type from latitude if not provided
	let climateType = fallbackClimateType;

	if (!climateType) {
		const absLat = Math.abs(latitude);
		if (absLat > 60) climateType = 'arctic';
		else if (absLat < 25) climateType = 'tropical';
		else if (absLat > 45) climateType = 'continental';
		else climateType = 'temperate';
	}

	const normals = getClimateNormalsFromFallback(
		climateType as Parameters<typeof getClimateNormalsFromFallback>[0],
		month,
	);

	// Override with actual coordinates
	return {
		...normals,
		latitude,
		longitude,
	};
}

/**
 * Clear all caches (for testing)
 */
export function clearCaches(): void {
	climateCache.clear();
	geocodeCache.clear();
}
