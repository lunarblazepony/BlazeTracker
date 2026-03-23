import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so mocks are available inside vi.mock factory (which is hoisted)
const { mockGetSettings, mockSaveSettings, mockInitializeSettings } = vi.hoisted(() => ({
	mockGetSettings: vi.fn(),
	mockSaveSettings: vi.fn(),
	mockInitializeSettings: vi.fn(),
}));

vi.mock('sillytavern-utils-lib', () => ({
	ExtensionSettingsManager: vi.fn().mockImplementation(() => ({
		getSettings: mockGetSettings,
		saveSettings: mockSaveSettings,
		initializeSettings: mockInitializeSettings,
	})),
}));

vi.mock('../types/snapshot', () => ({
	sortPair: (a: string, b: string) => (a < b ? [a, b] : [b, a]),
	createEmptySnapshot: vi.fn(),
	createEmptyCharacterState: vi.fn(),
}));

import { getV2Settings, updateV2Setting, updateV2Track, initializeV2Settings } from './manager';
import { createDefaultV2Settings } from './defaults';

beforeEach(() => {
	vi.clearAllMocks();
	mockGetSettings.mockReturnValue(createDefaultV2Settings());
});

describe('getV2Settings', () => {
	it('returns complete settings when stored settings are complete', () => {
		const defaults = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(defaults);

		const result = getV2Settings();

		expect(result).toEqual(defaults);
		expect(mockGetSettings).toHaveBeenCalledOnce();
	});

	it('fills in defaults for missing fields', () => {
		const partial = { v2ProfileId: 'test-profile', v2AutoExtract: false };
		mockGetSettings.mockReturnValue(partial);

		const result = getV2Settings();
		const defaults = createDefaultV2Settings();

		expect(result.v2ProfileId).toBe('test-profile');
		expect(result.v2AutoExtract).toBe(false);
		// All other fields should have defaults
		expect(result.v2MaxTokens).toBe(defaults.v2MaxTokens);
		expect(result.v2DebugLogging).toBe(defaults.v2DebugLogging);
		expect(result.v2DisplayPosition).toBe(defaults.v2DisplayPosition);
		expect(result.v2Track).toEqual(defaults.v2Track);
		expect(result.v2Temperatures).toEqual(defaults.v2Temperatures);
	});

	it('merges nested track settings with defaults', () => {
		mockGetSettings.mockReturnValue({
			v2Track: { time: false },
		});

		const result = getV2Settings();

		expect(result.v2Track.time).toBe(false);
		// Other track settings should be defaults (true)
		expect(result.v2Track.location).toBe(true);
		expect(result.v2Track.characters).toBe(true);
		expect(result.v2Track.scene).toBe(true);
	});

	it('merges nested temperature settings with defaults', () => {
		mockGetSettings.mockReturnValue({
			v2Temperatures: { time: 0.8 },
		});

		const result = getV2Settings();
		const defaults = createDefaultV2Settings();

		expect(result.v2Temperatures.time).toBe(0.8);
		expect(result.v2Temperatures.location).toBe(defaults.v2Temperatures.location);
	});
});

describe('updateV2Setting', () => {
	it('updates the specified key and calls saveSettings', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		updateV2Setting('v2ProfileId', 'new-profile');

		expect(settings.v2ProfileId).toBe('new-profile');
		expect(mockSaveSettings).toHaveBeenCalledOnce();
	});

	it('preserves v2PersonaDefaults when present', () => {
		const settings = createDefaultV2Settings();
		settings.v2PersonaDefaults = { existingKey: 'value' };
		mockGetSettings.mockReturnValue(settings);

		updateV2Setting('v2DebugLogging', true);

		expect(settings.v2PersonaDefaults).toEqual({ existingKey: 'value' });
		expect(settings.v2DebugLogging).toBe(true);
		expect(mockSaveSettings).toHaveBeenCalledOnce();
	});

	it('initializes v2PersonaDefaults if missing from stored settings', () => {
		const settings = createDefaultV2Settings() as unknown as Record<string, unknown>;
		delete settings.v2PersonaDefaults;
		mockGetSettings.mockReturnValue(settings);

		updateV2Setting('v2DebugLogging', true);

		expect(settings.v2PersonaDefaults).toEqual({});
		expect(mockSaveSettings).toHaveBeenCalledOnce();
	});

	it('updates nested objects like v2Track', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const newTrack = { ...settings.v2Track, time: false };
		updateV2Setting('v2Track', newTrack);

		expect(settings.v2Track.time).toBe(false);
		expect(mockSaveSettings).toHaveBeenCalledOnce();
	});
});

describe('updateV2Track', () => {
	it('returns enforced settings and calls updateV2Setting', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track };
		const result = updateV2Track(track);

		expect(result).toEqual(track);
		expect(mockSaveSettings).toHaveBeenCalledOnce();
	});

	it('disabling location forces climate=false and props=false', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track, location: false };
		const result = updateV2Track(track);

		expect(result.location).toBe(false);
		expect(result.climate).toBe(false);
		expect(result.props).toBe(false);
		// Other toggles remain unaffected
		expect(result.time).toBe(true);
		expect(result.characters).toBe(true);
		expect(result.scene).toBe(true);
	});

	it('disabling time forces climate=false', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track, time: false };
		const result = updateV2Track(track);

		expect(result.time).toBe(false);
		expect(result.climate).toBe(false);
		// Location-only dependents remain
		expect(result.props).toBe(true);
		expect(result.location).toBe(true);
	});

	it('disabling characters forces relationships=false', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track, characters: false };
		const result = updateV2Track(track);

		expect(result.characters).toBe(false);
		expect(result.relationships).toBe(false);
	});

	it('disabling characters cascades to narrative=false via relationships', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track, characters: false };
		const result = updateV2Track(track);

		expect(result.characters).toBe(false);
		expect(result.relationships).toBe(false);
		expect(result.narrative).toBe(false);
	});

	it('disabling relationships forces narrative=false', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track, relationships: false };
		const result = updateV2Track(track);

		expect(result.relationships).toBe(false);
		expect(result.narrative).toBe(false);
	});

	it('disabling scene forces narrative=false', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track, scene: false };
		const result = updateV2Track(track);

		expect(result.scene).toBe(false);
		expect(result.narrative).toBe(false);
	});

	it('all enabled produces no enforcement changes', () => {
		const settings = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(settings);

		const track = { ...settings.v2Track };
		const result = updateV2Track(track);

		expect(result).toEqual(settings.v2Track);
	});
});

describe('initializeV2Settings', () => {
	it('calls initializeSettings on the manager and returns settings', async () => {
		mockInitializeSettings.mockResolvedValue(undefined);
		const defaults = createDefaultV2Settings();
		mockGetSettings.mockReturnValue(defaults);

		const result = await initializeV2Settings();

		expect(mockInitializeSettings).toHaveBeenCalledOnce();
		expect(result).toEqual(defaults);
	});

	it('returns merged settings even if stored data is partial', async () => {
		mockInitializeSettings.mockResolvedValue(undefined);
		mockGetSettings.mockReturnValue({ v2ProfileId: 'loaded-profile' });

		const result = await initializeV2Settings();
		const defaults = createDefaultV2Settings();

		expect(result.v2ProfileId).toBe('loaded-profile');
		expect(result.v2MaxTokens).toBe(defaults.v2MaxTokens);
		expect(result.v2Track).toEqual(defaults.v2Track);
	});
});
