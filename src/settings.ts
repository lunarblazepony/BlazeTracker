import { ExtensionSettingsManager } from 'sillytavern-utils-lib';
import { EXTENSION_KEY } from './constants';

export interface CustomPrompts {
	[key: string]: string;
}

export interface CustomTemperatures {
	[key: string]: number;
}

export interface BlazeTrackerSettings {
	profileId: string;
	autoMode: 'none' | 'responses' | 'inputs' | 'both';
	lastXMessages: number;
	maxResponseTokens: number;
	displayPosition: 'above' | 'below';
	// Extraction toggles
	trackTime: boolean;
	trackLocation: boolean;
	trackClimate: boolean;
	trackCharacters: boolean;
	trackScene: boolean;
	trackEvents: boolean;
	trackRelationships: boolean;
	// Weather settings
	useProceduralWeather: boolean;
	injectWeatherTransitions: boolean;
	// Chapter settings
	chapterTimeThreshold: number;
	injectedChapters: number;
	// Relationship settings
	relationshipRefreshInterval: number;
	includeRelationshipSecrets: boolean;
	relationshipUpgradeCooldown: number;
	// Other settings
	leapThresholdMinutes: number;
	temperatureUnit: 'fahrenheit' | 'celsius';
	timeFormat: '12h' | '24h';
	customPrompts: CustomPrompts;
	customTemperatures: CustomTemperatures;
}

export const defaultSettings: BlazeTrackerSettings = {
	profileId: '',
	autoMode: 'both',
	lastXMessages: 10,
	maxResponseTokens: 4000,
	displayPosition: 'below',
	// All extractions enabled by default
	trackTime: true,
	trackLocation: true,
	trackClimate: true,
	trackCharacters: true,
	trackScene: true,
	trackEvents: true,
	trackRelationships: true,
	// Weather settings
	useProceduralWeather: true,
	injectWeatherTransitions: true,
	// Chapter settings
	chapterTimeThreshold: 60,
	injectedChapters: 3,
	// Relationship settings
	relationshipRefreshInterval: 10,
	includeRelationshipSecrets: true,
	relationshipUpgradeCooldown: 4,
	// Other defaults
	leapThresholdMinutes: 20,
	temperatureUnit: 'fahrenheit',
	timeFormat: '24h',
	customPrompts: {},
	customTemperatures: {},
};

// Default temperatures for each extractor prompt
export const defaultTemperatures: Record<string, number> = {
	// Time
	time_datetime: 0.3,
	time_delta: 0.3,
	// Location
	location_initial: 0.5,
	location_update: 0.5,
	location_props: 0.5,
	// Climate
	climate_initial: 0.3,
	climate_update: 0.3,
	// Characters (granular extractors)
	characters_initial: 0.7,
	characters_presence: 0.5,
	characters_position: 0.5,
	characters_activity: 0.6,
	characters_mood: 0.6,
	characters_outfit: 0.5,
	characters_physical: 0.5,
	// Scene
	scene_initial: 0.6,
	scene_update: 0.6,
	// Event
	event_extract: 0.4,
	// Chapter
	chapter_boundary: 0.5,
	// Relationship
	relationship_initial: 0.6,
	// Relationship attitudes (event-sourced)
	relationship_feelings: 0.4,
	relationship_secrets: 0.4,
	relationship_wants: 0.4,
	relationship_status: 0.3,
	// Milestones
	milestone_description: 0.7,
	milestone_confirm: 0.2,
};

/**
 * Get the temperature for a specific prompt key.
 * Returns custom temperature if set, otherwise the default.
 */
export function getTemperature(key: string): number {
	const settings = getSettings();
	if (key in settings.customTemperatures) {
		return settings.customTemperatures[key];
	}
	return defaultTemperatures[key] ?? 0.5;
}

export const settingsManager = new ExtensionSettingsManager<BlazeTrackerSettings>(
	EXTENSION_KEY,
	defaultSettings,
);

export function getSettings(): BlazeTrackerSettings {
	return settingsManager.getSettings();
}

export function updateSetting<K extends keyof BlazeTrackerSettings>(
	key: K,
	value: BlazeTrackerSettings[K],
): void {
	const settings = settingsManager.getSettings();
	settings[key] = value;
	settingsManager.saveSettings();
}
