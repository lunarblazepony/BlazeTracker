/**
 * V2 Settings Defaults
 */

import type { V2Settings, V2TrackSettings, V2TemperatureSettings } from './types';

/**
 * Default track settings (all enabled).
 */
export const DEFAULT_V2_TRACK: V2TrackSettings = {
	time: true,
	location: true,
	props: true,
	climate: true,
	characters: true,
	relationships: true,
	scene: true,
	narrative: true, // Includes chapters
};

/**
 * Default temperature settings per category.
 */
export const DEFAULT_V2_TEMPERATURES: V2TemperatureSettings = {
	time: 0.3,
	location: 0.5,
	props: 0.5,
	climate: 0.3,
	characters: 0.5,
	relationships: 0.6,
	scene: 0.5,
	narrative: 0.6, // Used for narrative + chapter extractors
};

/**
 * Create default V2Settings.
 */
export function createDefaultV2Settings(): V2Settings {
	return {
		// Core
		v2ProfileId: '',
		v2AutoExtract: true,

		// Debug & Display
		v2DebugLogging: false,
		v2DisplayPosition: 'below',

		// Format preferences
		v2TemperatureUnit: 'fahrenheit',
		v2TimeFormat: '12h',

		// Track toggles
		v2Track: { ...DEFAULT_V2_TRACK },

		// Temperatures
		v2Temperatures: { ...DEFAULT_V2_TEMPERATURES },

		// Custom prompts
		v2CustomPrompts: {},

		// Per-prompt temperature overrides
		v2PromptTemperatures: {},
	};
}

/**
 * Merge partial settings with defaults.
 */
export function mergeV2WithDefaults(partial: Partial<V2Settings>): V2Settings {
	const defaults = createDefaultV2Settings();
	return {
		// Core
		v2ProfileId: partial.v2ProfileId ?? defaults.v2ProfileId,
		v2AutoExtract: partial.v2AutoExtract ?? defaults.v2AutoExtract,

		// Debug & Display
		v2DebugLogging: partial.v2DebugLogging ?? defaults.v2DebugLogging,
		v2DisplayPosition: partial.v2DisplayPosition ?? defaults.v2DisplayPosition,

		// Format preferences
		v2TemperatureUnit: partial.v2TemperatureUnit ?? defaults.v2TemperatureUnit,
		v2TimeFormat: partial.v2TimeFormat ?? defaults.v2TimeFormat,

		// Track - merge nested object
		v2Track: {
			...defaults.v2Track,
			...partial.v2Track,
		},

		// Temperatures - merge nested object
		v2Temperatures: {
			...defaults.v2Temperatures,
			...partial.v2Temperatures,
		},

		// Custom prompts - merge nested object
		v2CustomPrompts: {
			...defaults.v2CustomPrompts,
			...partial.v2CustomPrompts,
		},

		// Per-prompt temperature overrides - merge nested object
		v2PromptTemperatures: {
			...defaults.v2PromptTemperatures,
			...partial.v2PromptTemperatures,
		},
	};
}
