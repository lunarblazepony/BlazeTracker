import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asNumber } from '../utils/json';
import type {
	NarrativeDateTime,
	Climate,
	ProceduralClimate,
	UnifiedEventStore,
} from '../types/state';
import type { LocationState } from './extractLocation';
import {
	extractProceduralClimate,
	isLegacyClimate,
	type ExtractClimateParams,
	type ExtractClimateResult,
} from '../weather';
import type { ForecastCacheEntry, LocationMapping } from '../weather/types';
import { getLatestForecastForArea } from '../state/eventStore';

// ============================================
// Types
// ============================================

export type WeatherType = Climate['weather'];

// Alias for backward compatibility
export type ClimateState = Climate;

// Extended result type that includes cache updates for procedural weather
export interface ClimateExtractionResult {
	climate: Climate | ProceduralClimate;
	transition: string | null;
	forecastCache?: ForecastCacheEntry[];
	locationMappings?: LocationMapping[];
}

// ============================================
// Schema & Example (Legacy)
// ============================================

export const CLIMATE_SCHEMA = {
	type: 'object',
	description: 'Current climate/weather conditions',
	additionalProperties: false,
	properties: {
		weather: {
			type: 'string',
			enum: ['sunny', 'cloudy', 'snowy', 'rainy', 'windy', 'thunderstorm'],
			description:
				'The current weather in the locale (if characters are indoors, give the weather outdoors)',
		},
		temperature: {
			type: 'number',
			description:
				'Current temperature in Fahrenheit (if characters are indoors, give the indoor temperature)',
		},
	},
	required: ['weather', 'temperature'],
};

const CLIMATE_EXAMPLE = JSON.stringify(
	{
		weather: 'rainy',
		temperature: 52,
	},
	null,
	2,
);

// ============================================
// Constants
// ============================================

const VALID_WEATHER: readonly WeatherType[] = [
	'sunny',
	'cloudy',
	'snowy',
	'rainy',
	'windy',
	'thunderstorm',
];

// ============================================
// Public API
// ============================================

export interface ExtractClimateOptions {
	isInitial: boolean;
	messages: string;
	narrativeTime: NarrativeDateTime;
	location: LocationState;
	characterInfo: string;
	previousClimate: Climate | ProceduralClimate | null;
	forecastCache: ForecastCacheEntry[];
	locationMappings: LocationMapping[];
	abortSignal?: AbortSignal;
	/** Optional event store for checking existing forecasts */
	eventStore?: UnifiedEventStore;
}

/**
 * Main climate extraction function.
 * Uses procedural weather system if enabled, otherwise falls back to LLM extraction.
 */
export async function extractClimateWithContext(
	options: ExtractClimateOptions,
): Promise<ClimateExtractionResult> {
	const settings = getSettings();

	if (settings.useProceduralWeather) {
		return extractProceduralClimateWrapper(options);
	} else {
		const climate = await extractLegacyClimate(
			options.isInitial,
			options.messages,
			options.narrativeTime,
			options.location,
			options.characterInfo,
			isLegacyClimate(options.previousClimate) ? options.previousClimate : null,
			options.abortSignal,
		);

		return {
			climate,
			transition: null,
			// Return unchanged caches when using legacy mode
			forecastCache: options.forecastCache,
			locationMappings: options.locationMappings,
		};
	}
}

/**
 * Legacy extraction function for backward compatibility.
 * Uses LLM to extract climate data.
 */
export async function extractClimate(
	isInitial: boolean,
	messages: string,
	narrativeTime: NarrativeDateTime,
	location: LocationState,
	characterInfo: string,
	previousClimate: ClimateState | null,
	abortSignal?: AbortSignal,
): Promise<ClimateState> {
	return extractLegacyClimate(
		isInitial,
		messages,
		narrativeTime,
		location,
		characterInfo,
		previousClimate,
		abortSignal,
	);
}

// ============================================
// Procedural Weather Wrapper
// ============================================

async function extractProceduralClimateWrapper(
	options: ExtractClimateOptions,
): Promise<ClimateExtractionResult> {
	// Check event store for existing forecast first (Phase 9)
	let forecastCache = options.forecastCache;
	if (options.eventStore) {
		const areaName = options.location.area;
		const eventForecast = getLatestForecastForArea(options.eventStore, areaName);
		if (eventForecast) {
			// Check if this forecast is already in the cache
			const existsInCache = forecastCache.some(
				f => f.areaName.toLowerCase() === areaName.toLowerCase(),
			);
			if (!existsInCache) {
				// Add event-based forecast to cache
				forecastCache = [
					...forecastCache,
					{
						areaName,
						forecast: eventForecast,
						lastAccessedDate: new Date()
							.toISOString()
							.split('T')[0],
					},
				];
			}
		}
	}

	const params: ExtractClimateParams = {
		isInitial: options.isInitial,
		currentTime: options.narrativeTime,
		currentLocation: options.location,
		previousClimate: options.previousClimate,
		narrativeContext: options.messages,
		forecastCache,
		locationMappings: options.locationMappings,
		abortSignal: options.abortSignal,
	};

	const result: ExtractClimateResult = await extractProceduralClimate(params);

	return {
		climate: result.climate,
		transition: result.transition,
		forecastCache: result.forecastCache,
		locationMappings: result.locationMappings,
	};
}

// ============================================
// Legacy LLM Extraction
// ============================================

async function extractLegacyClimate(
	isInitial: boolean,
	messages: string,
	narrativeTime: NarrativeDateTime,
	location: LocationState,
	characterInfo: string,
	previousClimate: ClimateState | null,
	abortSignal?: AbortSignal,
): Promise<ClimateState> {
	const settings = getSettings();

	const timeStr = formatNarrativeTime(narrativeTime);
	const locationStr = `${location.area} - ${location.place} (${location.position})`;
	const schemaStr = JSON.stringify(CLIMATE_SCHEMA, null, 2);

	const promptParts = getPromptParts(isInitial ? 'climate_initial' : 'climate_update');
	const userPrompt = isInitial
		? promptParts.user
				.replace('{{narrativeTime}}', timeStr)
				.replace('{{location}}', locationStr)
				.replace('{{characterInfo}}', characterInfo)
				.replace('{{messages}}', messages)
				.replace('{{schema}}', schemaStr)
				.replace('{{schemaExample}}', CLIMATE_EXAMPLE)
		: promptParts.user
				.replace('{{narrativeTime}}', timeStr)
				.replace('{{location}}', locationStr)
				.replace(
					'{{previousState}}',
					JSON.stringify(previousClimate, null, 2),
				)
				.replace('{{messages}}', messages)
				.replace('{{schema}}', schemaStr)
				.replace('{{schemaExample}}', CLIMATE_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature(isInitial ? 'climate_initial' : 'climate_update'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/Climate',
	});

	return validateClimate(parsed);
}

// ============================================
// Internal: Helpers
// ============================================

function formatNarrativeTime(time: NarrativeDateTime): string {
	const monthNames = [
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

	const hour12 = time.hour % 12 || 12;
	const ampm = time.hour < 12 ? 'AM' : 'PM';
	const minuteStr = String(time.minute).padStart(2, '0');

	return `${time.dayOfWeek}, ${monthNames[time.month - 1]} ${time.day}, ${time.year} at ${hour12}:${minuteStr} ${ampm}`;
}

// ============================================
// Validation
// ============================================

function validateClimate(data: unknown): ClimateState {
	if (typeof data !== 'object' || data === null) {
		throw new Error('Invalid climate: expected object');
	}

	const obj = data as Record<string, unknown>;
	const weather = VALID_WEATHER.includes(obj.weather as WeatherType)
		? (obj.weather as WeatherType)
		: 'sunny';
	const temperature = asNumber(obj.temperature, 70);

	return { weather, temperature };
}

// ============================================
// Type Guards
// ============================================

export { isLegacyClimate } from '../weather';
