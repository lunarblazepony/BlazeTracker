/**
 * V2 Settings Index
 */

export type { V2Settings, V2TrackSettings, V2TemperatureSettings, V2CustomPrompt } from './types';

export {
	isV2Settings,
	enforceTrackDependencies,
	getTrackDependencyTooltip,
	isTrackDisabled,
} from './types';

export {
	DEFAULT_V2_TRACK,
	DEFAULT_V2_TEMPERATURES,
	createDefaultV2Settings,
	mergeV2WithDefaults,
} from './defaults';

export {
	v2SettingsManager,
	getV2Settings,
	updateV2Setting,
	updateV2Track,
	initializeV2Settings,
} from './manager';

// Re-export for backward compatibility with v2/index.ts
export {
	DEFAULT_V2_TRACK as DEFAULT_TRACK,
	DEFAULT_V2_TEMPERATURES as DEFAULT_TEMPERATURES,
	createDefaultV2Settings as createDefaultSettings,
	mergeV2WithDefaults as mergeWithDefaults,
} from './defaults';
