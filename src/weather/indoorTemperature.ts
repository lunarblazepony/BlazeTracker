/**
 * Indoor Temperature Calculator
 *
 * Calculates indoor temperatures based on building type and outdoor conditions.
 * All temperatures in Fahrenheit.
 */

import type { BuildingType } from './types';
import type { LocationState } from '../extractors/extractLocation';

// ============================================
// Indoor Temperature Calculation
// ============================================

export interface IndoorTempParams {
	outdoorTemp: number; // °F
	buildingType: BuildingType;
	hour: number; // 0-23
	prevIndoorTemp?: number; // For gradual changes
}

/**
 * Calculate indoor temperature based on building type
 */
export function calculateIndoorTemp(params: IndoorTempParams): number {
	const { outdoorTemp, buildingType, hour } = params;

	switch (buildingType) {
		case 'modern':
			// HVAC maintains 65-75°F
			// Slight variation based on outdoor (AC struggles in extreme heat)
			if (outdoorTemp > 95) return 75 + (outdoorTemp - 95) * 0.1;
			if (outdoorTemp < 14) return 65 - (14 - outdoorTemp) * 0.05;
			return 70;

		case 'heated': {
			// Fireplace/hearth - aims for ~65°F but influenced by outdoor
			// Warmer during "active" hours, cooler at night (fire dies down)
			const heatedTarget = hour >= 6 && hour <= 22 ? 65 : 57;
			const heatedDamping = 0.3; // 30% outdoor influence
			return heatedTarget + (outdoorTemp - heatedTarget) * heatedDamping;
		}

		case 'unheated': {
			// Barn, warehouse - minimal shelter
			// Slightly warmer than outdoor in cold, slightly cooler in heat
			const unheatedDamping = 0.7;
			const shelterEffect = outdoorTemp < 50 ? 5 : outdoorTemp > 77 ? -4 : 0;
			return (
				outdoorTemp * unheatedDamping +
				70 * (1 - unheatedDamping) +
				shelterEffect
			);
		}

		case 'underground':
			// Cave, basement - stable year-round
			// Typically average annual temperature of region (~55°F)
			return 55;

		case 'tent': {
			// Almost no shelter, slight greenhouse effect
			const tentEffect = hour >= 10 && hour <= 16 ? 9 : 2;
			return outdoorTemp + tentEffect;
		}

		case 'vehicle': {
			// Car/carriage - moderate shelter
			// Greenhouse effect when sunny during day
			const vehicleEffect = hour >= 10 && hour <= 16 ? 15 : 4;
			return outdoorTemp + vehicleEffect;
		}

		default:
			return outdoorTemp;
	}
}

// ============================================
// Building Type Detection
// ============================================

/**
 * Pattern definitions for building type detection
 */
const BUILDING_PATTERNS: Array<[BuildingType, RegExp]> = [
	[
		'underground',
		/\b(cave|basement|cellar|mine|tunnel|bunker|crypt|catacomb|sewer|subway|metro|underground)\b/i,
	],
	['tent', /\b(tent|campsite|bivouac|yurt|pavilion|camping|campground)\b/i],
	[
		'vehicle',
		/\b(car|truck|van|bus|carriage|wagon|train|plane|aircraft|ship|boat|yacht|submarine|spaceship|shuttle)\b/i,
	],
	[
		'unheated',
		/\b(barn|warehouse|shed|garage|stable|hangar|greenhouse|storage|attic|loft)\b/i,
	],
	[
		'modern',
		/\b(office|apartment|hotel|hospital|mall|store|shop|restaurant|cafe|cafeteria|gym|school|university|library|museum|theater|cinema|supermarket|bank|clinic)\b/i,
	],
	[
		'heated',
		/\b(house|home|cabin|cottage|inn|tavern|castle|manor|palace|mansion|villa|lodge|hut|shack|chapel|church|temple|shrine)\b/i,
	],
];

/**
 * Infer building type from location description
 */
export function inferBuildingType(location: LocationState): BuildingType | null {
	const place = location.place?.toLowerCase() || '';
	const area = location.area?.toLowerCase() || '';
	const position = location.position?.toLowerCase() || '';

	// Combine all location text for matching
	const fullText = `${area} ${place} ${position}`;

	for (const [type, pattern] of BUILDING_PATTERNS) {
		if (pattern.test(fullText)) {
			return type;
		}
	}

	return null; // Unknown - assume outdoor
}

// ============================================
// Indoor/Outdoor Detection
// ============================================

/**
 * Explicit outdoor indicators
 */
const OUTDOOR_PATTERNS =
	/\b(outside|outdoor|street|road|path|trail|garden|park|beach|field|forest|mountain|river|lake|ocean|sea|sky|rooftop|balcony|patio|deck|yard|lawn|meadow|desert|plains|valley|cliff|shore|woods|jungle|savanna|tundra|swamp|marsh|courtyard|plaza|square|alley|sidewalk|highway|bridge)\b/i;

/**
 * Explicit indoor indicators
 */
const INDOOR_PATTERNS =
	/\b(inside|indoor|room|hall|chamber|office|bedroom|kitchen|bathroom|lobby|corridor|basement|attic|closet|pantry|study|den|foyer|vestibule|anteroom|parlor|salon|lounge|ward|cell|vault|treasury|armory|throne room|great hall|dining room|living room|sitting room)\b/i;

/**
 * Determine if the current location is indoors
 */
export function isIndoors(location: LocationState): boolean {
	const place = location.place?.toLowerCase() || '';
	const position = location.position?.toLowerCase() || '';
	const area = location.area?.toLowerCase() || '';

	// Check position first (most specific)
	if (OUTDOOR_PATTERNS.test(position)) {
		return false;
	}
	if (INDOOR_PATTERNS.test(position)) {
		return true;
	}

	// Check place
	if (OUTDOOR_PATTERNS.test(place)) {
		return false;
	}
	if (INDOOR_PATTERNS.test(place)) {
		return true;
	}

	// Check area
	if (OUTDOOR_PATTERNS.test(area)) {
		return false;
	}

	// If we can infer a building type, assume indoor
	const buildingType = inferBuildingType(location);
	if (buildingType && buildingType !== 'tent') {
		return true;
	}

	// Default to outdoor if uncertain
	return false;
}

// ============================================
// Combined Function
// ============================================

export interface IndoorOutdoorResult {
	isIndoors: boolean;
	buildingType?: BuildingType;
	indoorTemperature?: number;
	effectiveTemperature: number;
}

/**
 * Determine indoor/outdoor status and calculate effective temperature.
 *
 * If the location has a `locationType` field (v2), use it directly.
 * Otherwise fall back to pattern matching (v1 compatibility).
 */
export function calculateEffectiveTemperature(
	outdoorTemp: number,
	location: LocationState & { locationType?: string },
	hour: number,
): IndoorOutdoorResult {
	// V2: Check for explicit locationType field
	const locationType = (location as { locationType?: string }).locationType;
	if (locationType) {
		// If outdoor, return outdoor temperature
		if (locationType === 'outdoor') {
			return {
				isIndoors: false,
				effectiveTemperature: outdoorTemp,
			};
		}

		// locationType is a building type - use it directly
		const buildingType = locationType as BuildingType;
		const indoorTemp = calculateIndoorTemp({
			outdoorTemp,
			buildingType,
			hour,
		});

		return {
			isIndoors: true,
			buildingType,
			indoorTemperature: indoorTemp,
			effectiveTemperature: indoorTemp,
		};
	}

	// V1 fallback: Pattern matching
	const indoors = isIndoors(location);

	if (!indoors) {
		return {
			isIndoors: false,
			effectiveTemperature: outdoorTemp,
		};
	}

	const buildingType = inferBuildingType(location);

	if (!buildingType) {
		// Indoor but unknown building type - assume heated
		const indoorTemp = calculateIndoorTemp({
			outdoorTemp,
			buildingType: 'heated',
			hour,
		});

		return {
			isIndoors: true,
			buildingType: 'heated',
			indoorTemperature: indoorTemp,
			effectiveTemperature: indoorTemp,
		};
	}

	const indoorTemp = calculateIndoorTemp({
		outdoorTemp,
		buildingType,
		hour,
	});

	return {
		isIndoors: true,
		buildingType,
		indoorTemperature: indoorTemp,
		effectiveTemperature: indoorTemp,
	};
}
