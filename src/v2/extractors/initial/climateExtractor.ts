/**
 * Initial Climate Extractor
 *
 * Extracts the initial climate (temperature, conditions, isIndoors) from the opening messages of a roleplay.
 */

import type { Generator } from '../../generator';
import type { Snapshot, ClimateForecast } from '../../types';
import type { InitialExtractor, ExtractionContext, ExtractionSettings } from '../types';
import { initialClimatePrompt } from '../../prompts/initial/climatePrompt';
import {
	formatMessages,
	getCharacterDescription,
	buildExtractorPrompt,
	generateAndParse,
	formatLocation,
	getExtractorTemperature,
} from '../utils';
import { createEmptySnapshot, createProjectionFromSnapshot } from '../../types/snapshot';

/**
 * Infer a WeatherCondition from the conditions string.
 */
function inferConditionType(conditions: string): ClimateForecast['conditionType'] {
	const lower = conditions.toLowerCase();

	if (lower.includes('blizzard')) return 'blizzard';
	if (lower.includes('heavy snow')) return 'heavy_snow';
	if (lower.includes('snow')) return 'snow';
	if (lower.includes('sleet')) return 'sleet';
	if (lower.includes('thunderstorm') || lower.includes('thunder')) return 'thunderstorm';
	if (lower.includes('heavy rain') || lower.includes('downpour')) return 'heavy_rain';
	if (lower.includes('rain')) return 'rain';
	if (lower.includes('drizzle')) return 'drizzle';
	if (lower.includes('fog') || lower.includes('mist')) return 'foggy';
	if (lower.includes('overcast') || lower.includes('cloudy sky')) return 'overcast';
	if (lower.includes('partly cloudy') || lower.includes('scattered cloud'))
		return 'partly_cloudy';
	if (lower.includes('sunny') || lower.includes('bright')) return 'sunny';
	if (lower.includes('clear')) return 'clear';
	if (lower.includes('wind')) return 'windy';
	if (lower.includes('hot') || lower.includes('heat')) return 'hot';
	if (lower.includes('cold') || lower.includes('freezing')) return 'cold';
	if (lower.includes('humid') || lower.includes('muggy')) return 'humid';

	// Default to clear if we can't determine
	return 'clear';
}

/**
 * Infer daylight phase from conditions string (if available).
 * Defaults to 'day' if unknown.
 */
function inferDaylightPhase(conditions: string): ClimateForecast['daylight'] {
	const lower = conditions.toLowerCase();

	if (lower.includes('dawn') || lower.includes('sunrise')) return 'dawn';
	if (lower.includes('dusk') || lower.includes('sunset') || lower.includes('evening'))
		return 'dusk';
	if (lower.includes('night') || lower.includes('midnight') || lower.includes('dark'))
		return 'night';

	return 'day';
}

/**
 * Initial climate extractor.
 * Extracts temperature, conditions, and indoor/outdoor status from the opening messages.
 */
export const climateExtractor: InitialExtractor = {
	name: 'initialClimate',
	displayName: 'climate',
	category: 'climate',
	defaultTemperature: 0.3,
	prompt: initialClimatePrompt,

	shouldRun(settings: ExtractionSettings, context: ExtractionContext): boolean {
		return settings.track.climate && context.chat.length > 0;
	},

	async run(
		generator: Generator,
		context: ExtractionContext,
		settings: ExtractionSettings,
		partialSnapshot: Partial<Snapshot>,
	): Promise<Partial<Snapshot>> {
		// Create a projection from partial snapshot for prompt building
		// Include location context if available from a previous extractor
		const emptySnapshot = createEmptySnapshot({ messageId: 0, swipeId: 0 });
		const snapshotWithPartial = { ...emptySnapshot, ...partialSnapshot };
		const projection = createProjectionFromSnapshot(snapshotWithPartial, {
			messageId: 0,
			swipeId: 0,
		});

		// Build placeholder values for the prompt
		// Include location context if available
		const placeholderValues: Record<string, string> = {
			messages: formatMessages(context, 0, context.chat.length - 1),
			characterName: context.name2,
			characterDescription: getCharacterDescription(context),
		};

		// Add location context if available from partial snapshot
		if (partialSnapshot.location) {
			placeholderValues.currentLocation = formatLocation(projection);
		}

		// Build the prompt
		const builtPrompt = buildExtractorPrompt(
			initialClimatePrompt,
			context,
			projection,
			settings,
			0,
			context.chat.length - 1,
		);

		// Get temperature (prompt override → category → default)
		const temperature = getExtractorTemperature(
			settings,
			this.prompt.name,
			'climate',
			this.defaultTemperature,
		);

		// Generate and parse the response
		const result = await generateAndParse(
			generator,
			initialClimatePrompt,
			builtPrompt,
			temperature,
		);

		// Handle parse failure
		if (!result.success || !result.data) {
			console.warn(
				'[BlazeTracker] initialClimate extraction failed, returning empty',
			);
			return {};
		}

		// Build the climate forecast with extracted data and sensible defaults
		const extractedTemp = result.data.temperature;
		const climate: ClimateForecast = {
			temperature: extractedTemp,
			outdoorTemperature: result.data.isIndoors ? extractedTemp : extractedTemp,
			indoorTemperature: result.data.isIndoors ? extractedTemp : undefined,
			feelsLike: extractedTemp, // Default to same as temperature
			humidity: 50, // Default moderate humidity
			precipitation: 0, // Default no precipitation
			cloudCover: 0, // Default clear
			windSpeed: 0, // Default no wind
			windDirection: 'N', // Default north
			conditions: result.data.conditions,
			conditionType: inferConditionType(result.data.conditions),
			uvIndex: result.data.isIndoors ? 0 : 5, // Default moderate UV outdoors, none indoors
			daylight: inferDaylightPhase(result.data.conditions),
			isIndoors: result.data.isIndoors,
		};

		return { climate };
	},
};
