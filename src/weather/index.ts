/**
 * Weather System
 *
 * Main entry point for the procedural weather system.
 * Coordinates location mapping, forecast generation, and climate derivation.
 */

import type {
	ProceduralClimate,
	LocationForecast,
	LocationMapping,
	ForecastCacheEntry,
} from './types';
import type { NarrativeDateTime, Climate, LocationState } from '../types/state';
import { errorLog } from '../utils/debug';

import { mapLocation, addToCache as addLocationToCache } from './locationMapper';
import { fetchClimateNormals } from './climateApi';
import { getClimateNormalsFromFallback } from './fallbackProfiles';
import { generateForecast, lookupWeather, lookupDay, getDayIndex } from './forecastGenerator';
import { getCachedForecast, cacheForecast, shouldRegenerateForecast } from './forecastCache';
import {
	deriveCondition,
	describeCondition,
	getWindDirection,
	getDaylightPhase,
	calculateFeelsLike,
	mapLegacyWeather,
	toLegacyWeather,
} from './weatherDeriver';
import { calculateEffectiveTemperature } from './indoorTemperature';
import { shouldMentionTransition, generateTransitionInjection } from './weatherTransitions';

// Re-export types
export type {
	ProceduralClimate,
	LocationForecast,
	LocationMapping,
	ClimateExtractionResult,
	ForecastCacheEntry,
	WeatherCondition,
} from './types';

// Re-export utilities
export { toLegacyWeather, mapLegacyWeather } from './weatherDeriver';
export { getCachedForecast, cacheForecast } from './forecastCache';

// ============================================
// Legacy Climate Detection
// ============================================

/**
 * Check if a climate object is the legacy format
 */
export function isLegacyClimate(climate: unknown): climate is Climate {
	return (
		climate !== null &&
		typeof climate === 'object' &&
		'weather' in climate &&
		'temperature' in climate &&
		!('conditionType' in climate)
	);
}

// ============================================
// Main Climate Extraction
// ============================================

export interface ExtractClimateParams {
	isInitial: boolean;
	currentTime: NarrativeDateTime;
	currentLocation: LocationState;
	previousClimate: ProceduralClimate | Climate | null;
	narrativeContext?: string;

	// State for caching
	forecastCache: ForecastCacheEntry[];
	locationMappings: LocationMapping[];

	abortSignal?: AbortSignal;
}

export interface ExtractClimateResult {
	climate: ProceduralClimate;
	forecast: LocationForecast;
	transition: string | null;

	// Updated caches
	forecastCache: ForecastCacheEntry[];
	locationMappings: LocationMapping[];
}

/**
 * Main climate extraction function
 *
 * Flow:
 * 1. Check if we have a cached forecast for this location
 * 2. If not, map the location and generate a new forecast
 * 3. Look up weather for current date/time
 * 4. Calculate indoor/outdoor temperature
 * 5. Derive conditions and check for transitions
 */
export async function extractProceduralClimate(
	params: ExtractClimateParams,
): Promise<ExtractClimateResult> {
	const {
		isInitial,
		currentTime,
		currentLocation,
		previousClimate,
		narrativeContext,
		abortSignal,
	} = params;

	let { forecastCache, locationMappings } = params;

	const area = currentLocation.area || 'Unknown';

	// Check for existing forecast
	let forecast = getCachedForecast(forecastCache, area, currentTime);
	const needsNewForecast = shouldRegenerateForecast(forecast, currentTime);

	// Handle initial extraction or missing forecast
	if (needsNewForecast || !forecast) {
		// Get initial conditions from previous climate (for anchoring)
		let initialConditions: { temperature: number; condition: string } | null = null;

		if (isInitial && previousClimate) {
			if (isLegacyClimate(previousClimate)) {
				initialConditions = {
					temperature: previousClimate.temperature,
					condition: previousClimate.weather,
				};
			} else {
				initialConditions = {
					temperature: previousClimate.temperature,
					condition: previousClimate.conditionType,
				};
			}
		}

		// Map location to climate data source
		const mapping = await mapLocation(
			area,
			narrativeContext || '',
			locationMappings,
			abortSignal,
		);

		// Update location mappings cache
		locationMappings = addLocationToCache(locationMappings, mapping);

		// Fetch or generate climate normals
		let climateNormals;
		if (mapping.latitude !== undefined && mapping.longitude !== undefined) {
			climateNormals = await fetchClimateNormals(
				mapping.latitude,
				mapping.longitude,
				currentTime.month,
				mapping.baseClimateType,
			);
		} else if (mapping.baseClimateType) {
			climateNormals = getClimateNormalsFromFallback(
				mapping.baseClimateType,
				currentTime.month,
			);
		} else {
			// Ultimate fallback
			climateNormals = getClimateNormalsFromFallback(
				'temperate',
				currentTime.month,
			);
		}

		// Generate forecast
		const seed = `${area}-${currentTime.year}-${currentTime.month}-${currentTime.day}`;
		forecast = generateForecast({
			climateNormals,
			startDate: currentTime,
			initialConditions,
			seed,
			days: 28,
		});

		// Update location info on forecast
		if (mapping.realWorldAnalog && mapping.latitude && mapping.longitude) {
			forecast.realWorldAnalog = {
				name: mapping.realWorldAnalog,
				latitude: mapping.latitude,
				longitude: mapping.longitude,
			};
		}
		if (mapping.baseClimateType) {
			forecast.baseClimateType = mapping.baseClimateType;
		}

		// Cache the forecast
		forecastCache = cacheForecast(forecastCache, area, forecast);
	}

	// Look up current weather
	const hourlyWeather = lookupWeather(forecast, currentTime);
	const dayForecast = lookupDay(forecast, currentTime);

	if (!hourlyWeather || !dayForecast) {
		// This shouldn't happen if forecast generation is correct
		errorLog('Failed to look up weather for date');
		// Return a default climate
		return createDefaultResult(
			currentTime,
			currentLocation,
			forecastCache,
			locationMappings,
		);
	}

	// Calculate indoor/outdoor temperature
	const tempResult = calculateEffectiveTemperature(
		hourlyWeather.temperature,
		currentLocation,
		currentTime.hour,
	);

	// Derive condition
	const conditionType = deriveCondition(hourlyWeather);
	const conditions = describeCondition(conditionType);

	// Build climate object
	const climate: ProceduralClimate = {
		temperature: Math.round(tempResult.effectiveTemperature),
		outdoorTemperature: hourlyWeather.temperature,
		indoorTemperature: tempResult.indoorTemperature,
		feelsLike: calculateFeelsLike(
			hourlyWeather.temperature,
			hourlyWeather.humidity,
			hourlyWeather.windSpeed,
		),
		humidity: hourlyWeather.humidity,
		precipitation: hourlyWeather.precipitation,
		cloudCover: hourlyWeather.cloudCover,
		windSpeed: hourlyWeather.windSpeed,
		windDirection: getWindDirection(hourlyWeather.windDirection),
		conditions,
		conditionType,
		uvIndex: hourlyWeather.uvIndex,
		daylight: getDaylightPhase(
			currentTime.hour,
			dayForecast.sunrise,
			dayForecast.sunset,
		),
		isIndoors: tempResult.isIndoors,
		buildingType: tempResult.buildingType,
	};

	// Check for weather transition
	let transition: string | null = null;
	if (previousClimate && !isInitial) {
		const prevProcedural = isLegacyClimate(previousClimate)
			? convertLegacyClimate(previousClimate)
			: previousClimate;

		if (shouldMentionTransition(prevProcedural, climate)) {
			transition = generateTransitionInjection(prevProcedural, climate);
		}
	}

	return {
		climate,
		forecast,
		transition,
		forecastCache,
		locationMappings,
	};
}

/**
 * Convert legacy climate to procedural format (for comparison)
 */
function convertLegacyClimate(legacy: Climate): ProceduralClimate {
	const conditionType = mapLegacyWeather(legacy.weather);

	return {
		temperature: legacy.temperature,
		outdoorTemperature: legacy.temperature,
		feelsLike: legacy.temperature,
		humidity: 50,
		precipitation: 0,
		cloudCover: 50,
		windSpeed: 5,
		windDirection: 'N',
		conditions: legacy.weather,
		conditionType,
		uvIndex: 5,
		daylight: 'day',
		isIndoors: false,
	};
}

/**
 * Create a default result when forecast lookup fails
 */
function createDefaultResult(
	currentTime: NarrativeDateTime,
	currentLocation: LocationState,
	forecastCache: ForecastCacheEntry[],
	locationMappings: LocationMapping[],
): ExtractClimateResult {
	const climate: ProceduralClimate = {
		temperature: 70,
		outdoorTemperature: 70,
		feelsLike: 70,
		humidity: 50,
		precipitation: 0,
		cloudCover: 30,
		windSpeed: 5,
		windDirection: 'N',
		conditions: 'pleasant weather',
		conditionType: 'clear',
		uvIndex: 5,
		daylight: currentTime.hour >= 6 && currentTime.hour < 18 ? 'day' : 'night',
		isIndoors: false,
	};

	// Create a minimal forecast
	const forecast: LocationForecast = {
		locationId: currentLocation.area || 'unknown',
		startDate: `${currentTime.year}-${String(currentTime.month).padStart(2, '0')}-${String(currentTime.day).padStart(2, '0')}`,
		days: [],
	};

	return {
		climate,
		forecast,
		transition: null,
		forecastCache,
		locationMappings,
	};
}

// ============================================
// Utility Functions
// ============================================

/**
 * Convert ProceduralClimate to legacy Climate format
 * Used for backward compatibility with existing code
 */
export function tolegacyClimateFormat(climate: ProceduralClimate): Climate {
	return {
		weather: toLegacyWeather(climate.conditionType),
		temperature: climate.temperature,
	};
}

/**
 * Get forecast day index for debugging
 */
export { getDayIndex };
