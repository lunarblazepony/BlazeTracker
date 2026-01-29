// ============================================
// Shared UI Formatters
// ============================================

import type {
	NarrativeDateTime,
	LocationState,
	CharacterOutfit,
	Scene,
	Climate,
	ProceduralClimate,
} from '../types/state';
import { MONTH_NAMES } from './constants';
import { applyTimeFormat, type TimeFormat } from '../utils/timeFormat';
import { formatTemperature } from '../utils/temperatures';
import { isLegacyClimate } from '../weather';
import { getV2Settings } from '../v2/settings';

/**
 * Format a narrative datetime for display.
 */
export function formatTime(time: NarrativeDateTime, timeFormat: TimeFormat = '24h'): string {
	const month = MONTH_NAMES[time.month - 1];
	// "Mon, Jan 15 2024, 14:30"
	return `${time.dayOfWeek.slice(0, 3)}, ${month} ${time.day} ${time.year}, ${applyTimeFormat(time.hour, time.minute, timeFormat)}`;
}

/**
 * Format a location for display.
 */
export function formatLocation(location: LocationState): string {
	const parts = [location.position, location.place, location.area];
	return parts.filter(Boolean).join(' \u00B7 ');
}

/**
 * Format an outfit for display.
 */
export function formatOutfit(outfit: CharacterOutfit): string {
	const outfitParts = [
		outfit.torso || 'topless',
		outfit.legs || 'bottomless',
		outfit.underwear || 'no underwear',
		outfit.head || null,
		outfit.neck || null,
		outfit.jacket || null,
		outfit.back || null,
		outfit.socks || null,
		outfit.footwear || null,
	];
	return outfitParts.filter((v: string | null) => v !== null).join(', ');
}

/**
 * Capitalize the first letter of a string.
 */
export function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format a scene for prompt injection.
 * @param scene - The scene to format
 * @returns Multi-line string with topic, tone, and tension
 */
export function formatScene(scene: Scene): string {
	const tensionParts = [
		scene.tension.type,
		scene.tension.level,
		scene.tension.direction !== 'stable' ? scene.tension.direction : null,
	].filter(Boolean);

	return `Topic: ${scene.topic}
Tone: ${scene.tone}
Tension: ${tensionParts.join(', ')}`;
}

/**
 * Format climate for prompt injection.
 * Handles both legacy and procedural climate formats.
 *
 * @param climate - The climate to format
 * @returns Formatted climate string
 */
export function formatClimate(climate: Climate | ProceduralClimate): string {
	const settings = getV2Settings();

	if (isLegacyClimate(climate)) {
		// Legacy format: simple weather + temperature
		return `${formatTemperature(climate.temperature, settings.v2TemperatureUnit)}, ${climate.weather}`;
	}

	// Procedural format: more detailed
	const parts: string[] = [];

	// Temperature with feels like if significantly different
	const tempStr = formatTemperature(climate.temperature, settings.v2TemperatureUnit);
	if (Math.abs(climate.feelsLike - climate.temperature) > 5) {
		const feelsLikeStr = formatTemperature(
			climate.feelsLike,
			settings.v2TemperatureUnit,
		);
		parts.push(`${tempStr} (feels like ${feelsLikeStr})`);
	} else {
		parts.push(tempStr);
	}

	// Conditions
	parts.push(climate.conditions);

	// Wind if notable
	if (climate.windSpeed >= 15) {
		parts.push(
			`${Math.round(climate.windSpeed)} mph winds from ${climate.windDirection}`,
		);
	}

	// Indoor note
	if (climate.isIndoors && climate.indoorTemperature !== undefined) {
		const outdoorStr = formatTemperature(
			climate.outdoorTemperature,
			settings.v2TemperatureUnit,
		);
		parts.push(`(${outdoorStr} outside)`);
	}

	return parts.join(', ');
}
