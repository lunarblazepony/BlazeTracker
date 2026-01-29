/**
 * Forecast Event Extractor
 *
 * Generates new forecasts when:
 * 1. Characters move to a new area without an existing forecast
 * 2. Time exceeds the current forecast range (28 days)
 *
 * Climate is computed from forecasts + time + location during projection.
 */

import type { Generator } from '../../generator';
import type { Event, ForecastGeneratedEvent, MessageAndSwipe } from '../../types';
import type {
	EventExtractor,
	ExtractionContext,
	ExtractionSettings,
	RunStrategy,
	RunStrategyContext,
	MessageStrategy,
} from '../types';
import { noPrompt } from '../../prompts/initial/noPrompt';
import { evaluateRunStrategy, projectWithTurnEvents } from '../utils';
import type { EventStore } from '../../store';
import { mapLocation } from '../../../weather/locationMapper';
import { fetchClimateNormals } from '../../../weather/climateApi';
import { getClimateNormalsFromFallback } from '../../../weather/fallbackProfiles';
import { generateForecast } from '../../../weather/forecastGenerator';
import {
	needsNewForecast,
	getDaysRemainingInForecast,
	MIN_FORECAST_DAYS,
} from '../../store/climateComputation';
import type { LocationMapping } from '../../../weather/types';
import { debugLog, errorLog } from '../../../utils/debug';

/**
 * Custom run strategy check for forecast extractor.
 * Returns true if:
 * 1. There's a location change event in turnEvents to a new area without a forecast, OR
 * 2. Current time is beyond the forecast range
 */
function customCheck(ctx: RunStrategyContext): boolean {
	const projection = ctx.store.projectStateAtMessage(ctx.currentMessage.messageId);

	const currentArea = projection.location?.area;
	const currentTime = projection.time;

	if (!currentArea || !currentTime) {
		return false;
	}

	// Check if we need a new forecast for this area/time
	return needsNewForecast(projection.forecasts, currentArea, currentTime);
}

/**
 * Forecast event extractor.
 * Generates new forecasts when area changes or time exceeds forecast range.
 */
export const forecastExtractor: EventExtractor = {
	name: 'forecastUpdate',
	displayName: 'forecast',
	category: 'climate',
	defaultTemperature: 0.3,
	prompt: noPrompt, // No LLM prompt needed - uses weather system

	messageStrategy: { strategy: 'fixedNumber', n: 0 } as MessageStrategy,

	runStrategy: { strategy: 'custom', check: customCheck } as RunStrategy,

	shouldRun(ctx: RunStrategyContext): boolean {
		// Check if climate tracking is enabled
		if (!ctx.settings.track.climate) {
			return false;
		}

		// Evaluate the run strategy
		return evaluateRunStrategy(this.runStrategy, ctx);
	},

	async run(
		_generator: Generator,
		context: ExtractionContext,
		_settings: ExtractionSettings,
		store: EventStore,
		currentMessage: MessageAndSwipe,
		turnEvents: Event[],
		_abortSignal?: AbortSignal,
	): Promise<Event[]> {
		// Get current state projection including turn events
		const projection = projectWithTurnEvents(
			store,
			turnEvents,
			currentMessage.messageId,
			context,
		);

		const currentArea = projection.location?.area;
		const currentTime = projection.time;

		if (!currentArea || !currentTime) {
			return [];
		}

		// Verify we actually need a new forecast
		if (!needsNewForecast(projection.forecasts, currentArea, currentTime)) {
			return [];
		}

		try {
			// Build narrative context for location mapping
			const narrativeContext = context.chat
				.slice(
					Math.max(0, currentMessage.messageId - 2),
					Math.min(context.chat.length, currentMessage.messageId + 1),
				)
				.map(m => m.mes)
				.join('\n')
				.slice(0, 1000);

			// Get existing location mappings from store or start fresh
			const existingMappings: LocationMapping[] = [];

			// Map location to climate data source
			const mapping = await mapLocation(
				currentArea,
				narrativeContext,
				existingMappings,
			);

			// Fetch or generate climate normals
			let climateNormals;
			if (mapping.latitude !== undefined && mapping.longitude !== undefined) {
				climateNormals = await fetchClimateNormals(
					mapping.latitude,
					mapping.longitude,
					currentTime.month() + 1, // moment months are 0-indexed
					mapping.baseClimateType,
				);
			} else if (mapping.baseClimateType) {
				climateNormals = getClimateNormalsFromFallback(
					mapping.baseClimateType,
					currentTime.month() + 1,
				);
			} else {
				// Ultimate fallback
				climateNormals = getClimateNormalsFromFallback(
					'temperate',
					currentTime.month() + 1,
				);
			}

			// Check for existing forecast to preserve continuity
			const existingForecast = projection.forecasts[currentArea];
			const existingDaysRemaining = existingForecast
				? getDaysRemainingInForecast(existingForecast, currentTime)
				: 0;

			// Calculate how many days we can keep from existing forecast (up to MIN_FORECAST_DAYS)
			const daysToKeep = Math.min(existingDaysRemaining, MIN_FORECAST_DAYS);

			// Calculate start date for new generation (after days we keep)
			const newStartTime = currentTime.clone().add(daysToKeep, 'days');
			const daysToGenerate = 28; // Generate full 28 days, will be spliced after kept days

			// Generate new forecast starting after kept days
			const seed = `${currentArea}-${newStartTime.year()}-${newStartTime.month() + 1}-${newStartTime.date()}`;
			const newForecast = generateForecast({
				climateNormals,
				startDate: {
					year: newStartTime.year(),
					month: newStartTime.month() + 1, // Convert to 1-indexed
					day: newStartTime.date(),
					hour: 0, // Start at midnight for clean day boundary
					minute: 0,
					second: 0,
					dayOfWeek: newStartTime.format('dddd'),
				},
				initialConditions:
					existingForecast && daysToKeep > 0
						? {
								// Use last hour of the last kept day as initial conditions
								temperature:
									existingForecast.days[
										existingForecast
											.days
											.length -
											existingDaysRemaining +
											daysToKeep -
											1
									]?.hourly[23]
										?.temperature ??
									null,
								condition:
									existingForecast.days[
										existingForecast
											.days
											.length -
											existingDaysRemaining +
											daysToKeep -
											1
									]?.dominantCondition ??
									null,
							}
						: null,
				seed,
				days: daysToGenerate,
			});

			// Build final forecast by splicing kept days + new days
			let finalDays = newForecast.days;
			let finalStartDate = newStartTime.format('YYYY-MM-DD');

			if (existingForecast && daysToKeep > 0) {
				// Find the index in existing forecast that corresponds to current time
				const startIdx =
					existingForecast.days.length - existingDaysRemaining;
				const keptDays = existingForecast.days.slice(
					startIdx,
					startIdx + daysToKeep,
				);

				// Splice: kept days + new days (trimmed to ~28 total)
				finalDays = [
					...keptDays,
					...newForecast.days.slice(0, 28 - daysToKeep),
				];
				finalStartDate = currentTime.format('YYYY-MM-DD');

				debugLog(
					`Extending forecast for "${currentArea}": kept ${daysToKeep} days, added ${28 - daysToKeep} new days`,
				);
			}

			// Build the final forecast object
			const forecast = {
				...newForecast,
				startDate: finalStartDate,
				days: finalDays,
			};

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
				`Generated forecast for "${currentArea}" (${mapping.realWorldAnalog || mapping.baseClimateType || 'temperate'})`,
			);

			const event: ForecastGeneratedEvent = {
				id: crypto.randomUUID(),
				source: currentMessage,
				timestamp: Date.now(),
				kind: 'forecast_generated',
				areaName: currentArea,
				startDate: currentTime.format('YYYY-MM-DD'),
				forecast,
			};

			return [event];
		} catch (error) {
			errorLog('Forecast extraction failed:', error);
			return [];
		}
	},
};

// Remove the old climate change extractor - it's been replaced by this
export const climateChangeExtractor = forecastExtractor;
