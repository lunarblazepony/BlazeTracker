/**
 * Initial Forecast Extractor
 *
 * Generates a 28-day weather forecast for the initial location.
 * Climate is computed from forecasts + time + location during projection.
 *
 * Resolution priority:
 * 1. Real-world location → use real climate data from API
 * 2. Fantastical location with real-world analog → use analog's climate data
 * 3. All else fails → use base climate type (temperate, desert, arctic, etc.)
 */

import type { Generator } from '../../generator';
import type { Snapshot } from '../../types';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import { noPrompt } from '../../prompts/initial/noPrompt';
import { deserializeMoment } from '../../types/common';
import { mapLocation } from '../../../weather/locationMapper';
import { fetchClimateNormals } from '../../../weather/climateApi';
import { getClimateNormalsFromFallback } from '../../../weather/fallbackProfiles';
import { generateForecast } from '../../../weather/forecastGenerator';
import type { LocationMapping } from '../../../weather/types';
import { debugLog, errorLog } from '../../../utils/debug';

/**
 * Initial forecast extractor.
 * Generates a 28-day weather forecast for the initial location using the procedural weather system.
 */
export const initialForecastExtractor: InitialExtractor = {
	name: 'initialForecast',
	displayName: 'forecast',
	category: 'climate',
	defaultTemperature: 0.3,
	prompt: noPrompt, // No LLM prompt needed - uses weather system

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		return settings.track.climate && context.chat.length > 0;
	},

	async run(
		_generator: Generator,
		context: ExtractionContext,
		_settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
		_abortSignal?: AbortSignal,
	): Promise<Partial<Snapshot>> {
		// Need both location and time to generate a forecast
		const location = partialSnapshot.location;
		const timeStr = partialSnapshot.time;

		if (!location?.area || !timeStr) {
			debugLog(
				'initialForecast: No location area or time available, skipping forecast generation',
			);
			return { forecasts: {} };
		}

		const time = deserializeMoment(timeStr);
		const areaName = location.area;

		try {
			// Build narrative context for location mapping
			const narrativeContext = context.chat
				.slice(0, Math.min(3, context.chat.length))
				.map(m => m.mes)
				.join('\n')
				.slice(0, 1000);

			// Get existing location mappings from snapshot (or start fresh)
			const existingMappings: LocationMapping[] = [];

			// Map location to climate data source
			const mapping = await mapLocation(
				areaName,
				narrativeContext,
				existingMappings,
			);

			// Fetch or generate climate normals
			let climateNormals;
			if (mapping.latitude !== undefined && mapping.longitude !== undefined) {
				climateNormals = await fetchClimateNormals(
					mapping.latitude,
					mapping.longitude,
					time.month() + 1, // moment months are 0-indexed
					mapping.baseClimateType,
				);
			} else if (mapping.baseClimateType) {
				climateNormals = getClimateNormalsFromFallback(
					mapping.baseClimateType,
					time.month() + 1,
				);
			} else {
				// Ultimate fallback
				climateNormals = getClimateNormalsFromFallback(
					'temperate',
					time.month() + 1,
				);
			}

			// Generate 28-day forecast
			const seed = `${areaName}-${time.year()}-${time.month() + 1}-${time.date()}`;
			const forecast = generateForecast({
				climateNormals,
				startDate: {
					year: time.year(),
					month: time.month() + 1, // Convert to 1-indexed
					day: time.date(),
					hour: time.hour(),
					minute: time.minute(),
					second: time.second(),
					dayOfWeek: time.format('dddd'),
				},
				initialConditions: null, // No prior conditions to anchor
				seed,
				days: 28,
			});

			// Add location info to forecast
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

			debugLog(
				`Generated initial forecast for "${areaName}" (${mapping.realWorldAnalog || mapping.baseClimateType || 'temperate'})`,
			);

			return {
				forecasts: {
					[areaName]: forecast,
				},
			};
		} catch (error) {
			errorLog('initialForecast extraction failed:', error);
			return { forecasts: {} };
		}
	},
};

// Keep the old export name for backwards compatibility during transition
export const climateExtractor = initialForecastExtractor;
