/**
 * V2 Settings Manager
 *
 * Manages V2 settings persistence using SillyTavern's extension settings.
 */

import { ExtensionSettingsManager } from 'sillytavern-utils-lib';
import type { V2Settings, V2TrackSettings } from './types';
import { enforceTrackDependencies } from './types';
import { createDefaultV2Settings, mergeV2WithDefaults } from './defaults';

// Extension key for V2 settings (separate from V1)
const V2_EXTENSION_KEY = 'blazetrackerV2';

/**
 * V2 Settings Manager instance.
 * Uses a separate storage key from V1 to avoid migration issues.
 */
export const v2SettingsManager = new ExtensionSettingsManager<V2Settings>(
	V2_EXTENSION_KEY,
	createDefaultV2Settings(),
);

/**
 * Get the current V2 settings.
 */
export function getV2Settings(): V2Settings {
	const settings = v2SettingsManager.getSettings();
	// Ensure all defaults are present (handles new fields)
	return mergeV2WithDefaults(settings);
}

/**
 * Update a single V2 setting.
 * Ensures v2PersonaDefaults is preserved (managed separately by card defaults modal).
 */
export function updateV2Setting<K extends keyof V2Settings>(key: K, value: V2Settings[K]): void {
	const settings = v2SettingsManager.getSettings();
	// Ensure v2PersonaDefaults exists (may be missing from old stored settings)
	if (!settings.v2PersonaDefaults) {
		settings.v2PersonaDefaults = {};
	}
	settings[key] = value;
	v2SettingsManager.saveSettings();
}

/**
 * Update V2 track settings with dependency enforcement.
 * Returns the enforced track settings.
 */
export function updateV2Track(track: V2TrackSettings): V2TrackSettings {
	const enforced = enforceTrackDependencies(track);
	updateV2Setting('v2Track', enforced);
	return enforced;
}

/**
 * Initialize V2 settings (loads from storage or creates defaults).
 */
export async function initializeV2Settings(): Promise<V2Settings> {
	await v2SettingsManager.initializeSettings();
	return getV2Settings();
}
