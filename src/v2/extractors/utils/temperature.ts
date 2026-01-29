/**
 * Temperature Resolution Utilities
 *
 * Provides functions for resolving extractor temperatures with proper precedence:
 * 1. Per-prompt temperature override
 * 2. Category temperature
 * 3. Extractor default
 */

import type { ExtractionSettings } from '../types';

/**
 * Category type for temperature lookup.
 */
export type TemperatureCategory = keyof ExtractionSettings['temperatures'];

/**
 * Get the temperature for an extractor, with proper precedence:
 * 1. Per-prompt override (settings.promptTemperatures[promptName])
 * 2. Category temperature (settings.temperatures[category])
 * 3. Extractor default
 *
 * @param settings - The extraction settings
 * @param promptName - The prompt name/key for per-prompt lookup
 * @param category - The temperature category for fallback
 * @param defaultTemp - The extractor's default temperature
 * @returns The resolved temperature value
 */
export function getExtractorTemperature(
	settings: ExtractionSettings,
	promptName: string,
	category: TemperatureCategory,
	defaultTemp: number,
): number {
	// 1. Check per-prompt override
	const promptTemp = settings.promptTemperatures?.[promptName];
	if (promptTemp !== undefined) {
		return promptTemp;
	}

	// 2. Check category temperature
	const categoryTemp = settings.temperatures[category];
	if (categoryTemp !== undefined) {
		return categoryTemp;
	}

	// 3. Fall back to extractor default
	return defaultTemp;
}
