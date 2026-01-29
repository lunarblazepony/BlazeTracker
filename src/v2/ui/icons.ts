/**
 * V2 UI Icons and Colors
 *
 * Icon and color utilities for v2 components.
 */

import type { TensionLevel, TensionType, WeatherCondition } from '../types/common';

/**
 * Font Awesome icons for tension types.
 */
export const TENSION_TYPE_ICONS: Record<TensionType, string> = {
	conversation: 'fa-comments',
	confrontation: 'fa-burst',
	intimate: 'fa-heart',
	suspense: 'fa-clock',
	vulnerable: 'fa-shield-halved',
	celebratory: 'fa-champagne-glasses',
	negotiation: 'fa-handshake',
};

/**
 * Font Awesome icons for tension levels.
 */
export const TENSION_LEVEL_ICONS: Record<TensionLevel, string> = {
	relaxed: 'fa-mug-hot',
	aware: 'fa-eye',
	guarded: 'fa-shield-halved',
	tense: 'fa-face-grimace',
	charged: 'fa-bolt',
	volatile: 'fa-fire',
	explosive: 'fa-explosion',
};

/**
 * Colors for tension types.
 */
export const TENSION_TYPE_COLORS: Record<TensionType, string> = {
	conversation: '#6b7280', // gray-500
	confrontation: '#ef4444', // red-500
	intimate: '#ec4899', // pink-500
	suspense: '#8b5cf6', // violet-500
	vulnerable: '#06b6d4', // cyan-500
	celebratory: '#eab308', // yellow-500
	negotiation: '#f97316', // orange-500
};

/**
 * Colors for tension levels.
 */
export const TENSION_LEVEL_COLORS: Record<TensionLevel, string> = {
	relaxed: '#6b7280', // gray-500
	aware: '#3b82f6', // blue-500
	guarded: '#22c55e', // green-500
	tense: '#f59e0b', // amber-500
	charged: '#f97316', // orange-500
	volatile: '#ef4444', // red-500
	explosive: '#dc2626', // red-600
};

/**
 * Get the icon class for a tension type.
 */
export function getTensionIcon(type: TensionType): string {
	return `fa-solid ${TENSION_TYPE_ICONS[type] || 'fa-circle'}`;
}

/**
 * Get the icon class for a tension level.
 */
export function getTensionLevelIcon(level: TensionLevel): string {
	return `fa-solid ${TENSION_LEVEL_ICONS[level] || 'fa-circle'}`;
}

/**
 * Get the color for a tension type.
 */
export function getTensionTypeColor(type: TensionType): string {
	return TENSION_TYPE_COLORS[type] || '#6b7280';
}

/**
 * Get the color for a tension level.
 */
export function getTensionColor(level: TensionLevel): string {
	return TENSION_LEVEL_COLORS[level] || '#6b7280';
}

/**
 * Day-time weather condition icons.
 */
export const CONDITION_ICONS_DAY: Record<WeatherCondition, string> = {
	clear: 'fa-sun',
	sunny: 'fa-sun',
	partly_cloudy: 'fa-cloud-sun',
	overcast: 'fa-cloud',
	foggy: 'fa-smog',
	drizzle: 'fa-cloud-rain',
	rain: 'fa-cloud-showers-heavy',
	heavy_rain: 'fa-cloud-showers-water',
	thunderstorm: 'fa-cloud-bolt',
	sleet: 'fa-cloud-meatball',
	snow: 'fa-snowflake',
	heavy_snow: 'fa-snowflake',
	blizzard: 'fa-icicles',
	windy: 'fa-wind',
	hot: 'fa-temperature-high',
	cold: 'fa-temperature-low',
	humid: 'fa-droplet',
};

/**
 * Night-time weather condition icons.
 */
export const CONDITION_ICONS_NIGHT: Record<WeatherCondition, string> = {
	clear: 'fa-moon',
	sunny: 'fa-moon',
	partly_cloudy: 'fa-cloud-moon',
	overcast: 'fa-cloud',
	foggy: 'fa-smog',
	drizzle: 'fa-cloud-moon-rain',
	rain: 'fa-cloud-showers-heavy',
	heavy_rain: 'fa-cloud-showers-water',
	thunderstorm: 'fa-cloud-bolt',
	sleet: 'fa-cloud-meatball',
	snow: 'fa-snowflake',
	heavy_snow: 'fa-snowflake',
	blizzard: 'fa-icicles',
	windy: 'fa-wind',
	hot: 'fa-temperature-high',
	cold: 'fa-temperature-low',
	humid: 'fa-droplet',
};

/**
 * Get the icon for a weather condition with day/night awareness.
 */
export function getConditionIconDayNight(condition: WeatherCondition, isNight: boolean): string {
	if (isNight) {
		return CONDITION_ICONS_NIGHT[condition] ?? 'fa-question';
	}
	return CONDITION_ICONS_DAY[condition] ?? 'fa-question';
}
