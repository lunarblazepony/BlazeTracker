/**
 * V2 Settings Types
 *
 * All setting keys use `v2` prefix to prevent migration from v1 settings.
 */

/**
 * Track settings - which extractors are enabled.
 */
export interface V2TrackSettings {
	time: boolean;
	location: boolean;
	props: boolean;
	climate: boolean;
	characters: boolean;
	relationships: boolean;
	scene: boolean;
	narrative: boolean; // Includes chapters
}

/**
 * Temperature settings per extractor category.
 */
export interface V2TemperatureSettings {
	time: number;
	location: number;
	props: number;
	climate: number;
	characters: number;
	relationships: number;
	scene: number;
	narrative: number; // Used for narrative + chapter extractors
}

/**
 * Custom prompt override for an extractor.
 */
export interface V2CustomPrompt {
	systemPrompt?: string;
	userTemplate?: string;
}

/**
 * V2 extension settings.
 * All keys use v2 prefix to avoid conflicts with v1 settings.
 */
export interface V2Settings {
	// Core
	/** Connection profile ID for LLM calls */
	v2ProfileId: string;
	/** Auto-extraction on/off (extractors handle their own run intervals) */
	v2AutoExtract: boolean;

	// Debug & Display
	/** Enable debug logging to console */
	v2DebugLogging: boolean;
	/** State display position relative to message */
	v2DisplayPosition: 'above' | 'below';

	// Format preferences
	/** Temperature display unit */
	v2TemperatureUnit: 'fahrenheit' | 'celsius';
	/** Time display format */
	v2TimeFormat: '12h' | '24h';

	// Track toggles
	/** Which extraction modules are enabled */
	v2Track: V2TrackSettings;

	// LLM temperatures per extractor category
	/** Temperature settings for LLM calls by category */
	v2Temperatures: V2TemperatureSettings;

	// Custom prompts
	/** Custom prompt overrides by extractor key */
	v2CustomPrompts: Record<string, V2CustomPrompt>;

	// Per-prompt temperature overrides
	/** Per-prompt temperature overrides (overrides category temperature) */
	v2PromptTemperatures: Record<string, number>;
}

/**
 * Type guard for V2Settings.
 */
export function isV2Settings(obj: unknown): obj is V2Settings {
	if (typeof obj !== 'object' || obj === null) return false;
	const s = obj as Record<string, unknown>;
	return (
		typeof s.v2ProfileId === 'string' &&
		typeof s.v2AutoExtract === 'boolean' &&
		typeof s.v2DebugLogging === 'boolean' &&
		typeof s.v2DisplayPosition === 'string' &&
		typeof s.v2TemperatureUnit === 'string' &&
		typeof s.v2TimeFormat === 'string' &&
		typeof s.v2Track === 'object' &&
		typeof s.v2Temperatures === 'object' &&
		typeof s.v2CustomPrompts === 'object' &&
		typeof s.v2PromptTemperatures === 'object'
	);
}

/**
 * Track toggle dependency rules.
 * When a parent toggle is disabled, dependent toggles must also be disabled.
 *
 * Dependency Tree:
 * time ──────────────┐
 *                    ├─→ climate
 * location ──────────┤
 *     │              │
 *     └──────────────┼─→ props
 *                    │
 * characters ────────┴─→ relationships ──┐
 *                                        ├─→ narrative (includes chapters)
 * scene ─────────────────────────────────┘
 */
export function enforceTrackDependencies(track: V2TrackSettings): V2TrackSettings {
	const result = { ...track };

	// Climate requires both Location AND Time
	if (!result.location || !result.time) {
		result.climate = false;
	}

	// Props requires Location
	if (!result.location) {
		result.props = false;
	}

	// Relationships requires Characters
	if (!result.characters) {
		result.relationships = false;
	}

	// Narrative requires Relationships (for statuses) and Scene (for tension)
	if (!result.relationships || !result.scene) {
		result.narrative = false;
	}

	return result;
}

/**
 * Get dependency tooltip for a track setting.
 * Returns null if no dependencies or all dependencies are met.
 */
export function getTrackDependencyTooltip(
	key: keyof V2TrackSettings,
	track: V2TrackSettings,
): string | null {
	switch (key) {
		case 'climate':
			if (!track.location && !track.time) {
				return 'Requires Location and Time';
			}
			if (!track.location) {
				return 'Requires Location';
			}
			if (!track.time) {
				return 'Requires Time';
			}
			return null;

		case 'props':
			if (!track.location) {
				return 'Requires Location';
			}
			return null;

		case 'relationships':
			if (!track.characters) {
				return 'Requires Characters';
			}
			return null;

		case 'narrative':
			if (!track.relationships && !track.scene) {
				return 'Requires Relationships and Scene';
			}
			if (!track.relationships) {
				return 'Requires Relationships';
			}
			if (!track.scene) {
				return 'Requires Scene';
			}
			return null;

		default:
			return null;
	}
}

/**
 * Check if a track setting should be disabled (dependencies not met).
 */
export function isTrackDisabled(key: keyof V2TrackSettings, track: V2TrackSettings): boolean {
	return getTrackDependencyTooltip(key, track) !== null;
}
