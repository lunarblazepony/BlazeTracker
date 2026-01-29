/**
 * Location Mapper
 *
 * Maps fictional/fantasy locations to real-world climate analogs
 * or base climate types.
 */

import type { LocationMapping, BaseClimateType } from './types';
import { geocodeLocation } from './climateApi';
import { getV2Settings } from '../v2/settings';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse } from '../utils/json';
import { debugWarn, errorLog } from '../utils/debug';

// ============================================
// Constants
// ============================================

const SYSTEM_PROMPT = 'You are a climate analysis assistant. Return only valid JSON.';

const LOCATION_ANALYSIS_PROMPT = `
Analyze this location for climate mapping.

Location: {{location}}
Context: {{context}}

Determine:
1. Is the LOCATION itself a real Earth location, or fictional/fantasy?
2. If fictional, what real-world city has the most similar climate?
3. If you cannot determine a good real-world equivalent, classify into a base climate type.

CRITICAL: You are classifying the LOCATION, not the characters or story.
- Fictional characters in a real location = isFantasy: FALSE (the location is still real)
- A real location in a fictional story = isFantasy: FALSE (the location is still real)
- Only fictional/fantasy LOCATIONS should be isFantasy: true

Base climate types (use ONLY if no good real-world match):
- temperate: Mild seasons, moderate precipitation (e.g., generic forests, villages)
- desert: Hot/dry, large day/night temperature swings
- arctic: Cold year-round, possible polar day/night cycles
- tropical: Hot/humid, consistent temperatures, possible monsoons
- mediterranean: Warm dry summers, mild wet winters
- continental: Hot summers, cold winters, variable weather
- oceanic: Mild temperatures, frequent rain, small variations

Examples:
- "London" → isFantasy: false (real location)
- "London" (with Doctor Who) → isFantasy: false (London is real regardless of fictional characters)
- "Tokyo" (in an anime) → isFantasy: false (Tokyo is a real city)
- "New York" (with Spider-Man) → isFantasy: false (New York is real)
- "Winterfell" → isFantasy: true, realWorldAnalog: "Reykjavik, Iceland"
- "The Void Dimension" → isFantasy: true, baseClimateType: "arctic" (no good match)
- "Generic fantasy tavern" → isFantasy: true, baseClimateType: "temperate"
- "Tatooine" → isFantasy: true, realWorldAnalog: "Phoenix, Arizona"
- "King's Landing" → isFantasy: true, realWorldAnalog: "Dubrovnik, Croatia"
- "Gotham City" → isFantasy: true, realWorldAnalog: "New York City, USA"

Output JSON:
{
  "isFantasy": true/false,
  "realWorldAnalog": "City, Country" or null,
  "baseClimateType": "temperate" or null,
  "reasoning": "Brief explanation"
}
`;

// Schema for validation (reserved for future use)
const _LOCATION_ANALYSIS_SCHEMA = {
	type: 'object',
	properties: {
		isFantasy: { type: 'boolean' },
		realWorldAnalog: { type: ['string', 'null'] },
		baseClimateType: {
			type: ['string', 'null'],
			enum: [
				'temperate',
				'desert',
				'arctic',
				'tropical',
				'mediterranean',
				'continental',
				'oceanic',
				null,
			],
		},
		reasoning: { type: 'string' },
	},
	required: ['isFantasy', 'reasoning'],
};

// ============================================
// Geocoding Helpers
// ============================================

interface GeocodeFallbackResult {
	latitude: number;
	longitude: number;
	usedLocation: string;
}

/**
 * Try geocoding with progressively shorter location strings.
 * For "Industrial District, Huntsville, AL", tries:
 * 1. "Industrial District, Huntsville, AL"
 * 2. "Huntsville, AL"
 * 3. "AL"
 */
async function geocodeWithFallback(location: string): Promise<GeocodeFallbackResult | null> {
	// Split by comma and try progressively shorter versions
	const parts = location.split(',').map(p => p.trim());

	for (let i = 0; i < parts.length; i++) {
		const tryLocation = parts.slice(i).join(', ');
		const coords = await geocodeLocation(tryLocation);
		if (coords) {
			return {
				latitude: coords.latitude,
				longitude: coords.longitude,
				usedLocation: tryLocation,
			};
		}
	}

	return null;
}

// ============================================
// Main API
// ============================================

/**
 * Map a location to climate data source
 *
 * Flow:
 * 1. Check cache
 * 2. Ask LLM if fantasy or real
 * 3. If real, try geocoding
 * 4. If fantasy with analog, try geocoding analog
 * 5. If geocoding fails, fall back to base climate type
 */
export async function mapLocation(
	location: string,
	context: string,
	cache: LocationMapping[],
	abortSignal?: AbortSignal,
): Promise<LocationMapping> {
	// Check cache first
	const normalizedLocation = location.toLowerCase().trim();
	const cached = cache.find(
		m => m.fantasyLocation.toLowerCase().trim() === normalizedLocation,
	);
	if (cached) {
		return cached;
	}

	// Ask LLM to analyze the location
	const analysis = await analyzeLocation(location, context, abortSignal);

	// Handle real locations
	if (!analysis.isFantasy) {
		const coords = await geocodeWithFallback(location);
		if (coords) {
			return {
				fantasyLocation: location,
				realWorldAnalog: coords.usedLocation,
				latitude: coords.latitude,
				longitude: coords.longitude,
				isFantasy: false,
				reasoning: analysis.reasoning,
			};
		}
		// Geocoding failed - treat as fantasy and re-analyze
		debugWarn(`Geocoding failed for "${location}", treating as fantasy`);
	}

	// Handle fantasy with real-world analog
	if (analysis.realWorldAnalog) {
		const coords = await geocodeLocation(analysis.realWorldAnalog);
		if (coords) {
			return {
				fantasyLocation: location,
				realWorldAnalog: analysis.realWorldAnalog,
				latitude: coords.latitude,
				longitude: coords.longitude,
				isFantasy: true,
				reasoning: analysis.reasoning,
			};
		}
		// Analog geocoding failed - fall through to base climate type
		debugWarn(`Geocoding failed for analog "${analysis.realWorldAnalog}"`);
	}

	// Fall back to base climate type
	const baseClimateType = analysis.baseClimateType || 'temperate';

	return {
		fantasyLocation: location,
		baseClimateType: baseClimateType as BaseClimateType,
		isFantasy: true,
		reasoning: analysis.reasoning || 'Using fallback climate type',
	};
}

/**
 * Quick check if a location is likely real (for optimization)
 */
export async function isLikelyRealLocation(location: string): Promise<boolean> {
	// Simple heuristics for common real locations
	const realIndicators = [
		/^[A-Z][a-z]+,\s*[A-Z][a-z]+/, // "City, Country" format
		/\b(USA|UK|France|Germany|Japan|China|Australia|Canada)\b/i,
		/\b(New York|London|Paris|Tokyo|Sydney|Toronto)\b/i,
	];

	const fantasyIndicators = [
		/\b(castle|kingdom|realm|dimension|void|magical|enchanted)\b/i,
		/\b(tavern|inn|guild|dungeon|forest|village)\b/i,
		/'s\s+(lair|tower|fortress|domain)/i,
	];

	const locationLower = location.toLowerCase();

	// Check fantasy indicators first
	if (fantasyIndicators.some(r => r.test(locationLower))) {
		return false;
	}

	// Check real indicators
	if (realIndicators.some(r => r.test(location))) {
		return true;
	}

	// Uncertain - will need LLM analysis
	return false;
}

// ============================================
// Internal: LLM Analysis
// ============================================

interface LocationAnalysisResult {
	isFantasy: boolean;
	realWorldAnalog: string | null;
	baseClimateType: string | null;
	reasoning: string;
}

async function analyzeLocation(
	location: string,
	context: string,
	abortSignal?: AbortSignal,
): Promise<LocationAnalysisResult> {
	const settings = getV2Settings();

	const prompt = LOCATION_ANALYSIS_PROMPT.replace('{{location}}', location).replace(
		'{{context}}',
		context || 'No additional context',
	);

	const messages = buildExtractionMessages(SYSTEM_PROMPT, prompt);

	try {
		const response = await makeGeneratorRequest(messages, {
			profileId: settings.v2ProfileId,
			maxTokens: 500,
			temperature: settings.v2Temperatures.climate,
			abortSignal,
		});

		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName: 'BlazeTracker/LocationMapper',
		});

		return validateAnalysisResult(parsed);
	} catch (error) {
		errorLog('Location analysis failed:', error);
		// Return safe default
		return {
			isFantasy: true,
			realWorldAnalog: null,
			baseClimateType: 'temperate',
			reasoning: 'Analysis failed, using default',
		};
	}
}

function validateAnalysisResult(data: unknown): LocationAnalysisResult {
	if (typeof data !== 'object' || data === null) {
		throw new Error('Invalid location analysis result');
	}

	const obj = data as Record<string, unknown>;

	const validBaseTypes = [
		'temperate',
		'desert',
		'arctic',
		'tropical',
		'mediterranean',
		'continental',
		'oceanic',
	];

	return {
		isFantasy: typeof obj.isFantasy === 'boolean' ? obj.isFantasy : true,
		realWorldAnalog:
			typeof obj.realWorldAnalog === 'string' ? obj.realWorldAnalog : null,
		baseClimateType:
			typeof obj.baseClimateType === 'string' &&
			validBaseTypes.includes(obj.baseClimateType)
				? obj.baseClimateType
				: null,
		reasoning:
			typeof obj.reasoning === 'string' ? obj.reasoning : 'No reasoning provided',
	};
}

// ============================================
// Cache Management
// ============================================

/**
 * Add a mapping to the cache
 */
export function addToCache(cache: LocationMapping[], mapping: LocationMapping): LocationMapping[] {
	const normalizedLocation = mapping.fantasyLocation.toLowerCase().trim();

	// Remove existing entry if present
	const filtered = cache.filter(
		m => m.fantasyLocation.toLowerCase().trim() !== normalizedLocation,
	);

	return [...filtered, mapping];
}

/**
 * Find a mapping in the cache
 */
export function findInCache(
	cache: LocationMapping[],
	location: string,
): LocationMapping | undefined {
	const normalizedLocation = location.toLowerCase().trim();
	return cache.find(m => m.fantasyLocation.toLowerCase().trim() === normalizedLocation);
}
