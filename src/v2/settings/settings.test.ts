import { describe, it, expect } from 'vitest';
import { createDefaultV2Settings, mergeV2WithDefaults } from './defaults';
import { isV2Settings, enforceTrackDependencies } from './types';
import type { V2Settings, V2TrackSettings } from './types';

describe('V2 Settings', () => {
	describe('createDefaultV2Settings', () => {
		it('creates settings with all required fields', () => {
			const settings = createDefaultV2Settings();

			expect(settings.v2ProfileId).toBe('');
			expect(settings.v2AutoExtract).toBe(true);
			expect(settings.v2MaxTokens).toBe(4096);
			expect(settings.v2DebugLogging).toBe(false);
			expect(settings.v2DisplayPosition).toBe('below');
			expect(settings.v2TemperatureUnit).toBe('fahrenheit');
			expect(settings.v2TimeFormat).toBe('12h');
			expect(settings.v2Track).toBeDefined();
			expect(settings.v2Temperatures).toBeDefined();
			expect(settings.v2CustomPrompts).toEqual({});
			expect(settings.v2PromptTemperatures).toEqual({});
			expect(settings.v2PersonaDefaults).toEqual({});
		});

		it('v2MaxTokens defaults to 4096', () => {
			const settings = createDefaultV2Settings();
			expect(settings.v2MaxTokens).toBe(4096);
		});

		it('creates a new object each time', () => {
			const settings1 = createDefaultV2Settings();
			const settings2 = createDefaultV2Settings();
			expect(settings1).not.toBe(settings2);
			expect(settings1.v2Track).not.toBe(settings2.v2Track);
			expect(settings1.v2Temperatures).not.toBe(settings2.v2Temperatures);
		});

		it('has all track settings enabled by default', () => {
			const settings = createDefaultV2Settings();
			expect(settings.v2Track.time).toBe(true);
			expect(settings.v2Track.location).toBe(true);
			expect(settings.v2Track.props).toBe(true);
			expect(settings.v2Track.climate).toBe(true);
			expect(settings.v2Track.characters).toBe(true);
			expect(settings.v2Track.relationships).toBe(true);
			expect(settings.v2Track.scene).toBe(true);
			expect(settings.v2Track.narrative).toBe(true);
		});
	});

	describe('mergeV2WithDefaults', () => {
		it('returns defaults when given empty object', () => {
			const merged = mergeV2WithDefaults({});
			const defaults = createDefaultV2Settings();

			expect(merged.v2ProfileId).toBe(defaults.v2ProfileId);
			expect(merged.v2AutoExtract).toBe(defaults.v2AutoExtract);
			expect(merged.v2MaxTokens).toBe(defaults.v2MaxTokens);
			expect(merged.v2DebugLogging).toBe(defaults.v2DebugLogging);
		});

		it('preserves v2MaxTokens when provided', () => {
			const merged = mergeV2WithDefaults({ v2MaxTokens: 8192 });
			expect(merged.v2MaxTokens).toBe(8192);
		});

		it('uses default v2MaxTokens when not provided', () => {
			const merged = mergeV2WithDefaults({ v2ProfileId: 'test-profile' });
			expect(merged.v2MaxTokens).toBe(4096);
		});

		it('preserves all provided values', () => {
			const partial: Partial<V2Settings> = {
				v2ProfileId: 'my-profile',
				v2AutoExtract: false,
				v2MaxTokens: 2048,
				v2DebugLogging: true,
				v2DisplayPosition: 'above',
				v2TemperatureUnit: 'celsius',
				v2TimeFormat: '24h',
			};

			const merged = mergeV2WithDefaults(partial);

			expect(merged.v2ProfileId).toBe('my-profile');
			expect(merged.v2AutoExtract).toBe(false);
			expect(merged.v2MaxTokens).toBe(2048);
			expect(merged.v2DebugLogging).toBe(true);
			expect(merged.v2DisplayPosition).toBe('above');
			expect(merged.v2TemperatureUnit).toBe('celsius');
			expect(merged.v2TimeFormat).toBe('24h');
		});

		it('merges nested track settings', () => {
			const merged = mergeV2WithDefaults({
				v2Track: { time: false, location: false } as V2TrackSettings,
			});

			expect(merged.v2Track.time).toBe(false);
			expect(merged.v2Track.location).toBe(false);
			// Others should be true (defaults)
			expect(merged.v2Track.characters).toBe(true);
			expect(merged.v2Track.scene).toBe(true);
		});

		it('merges nested temperature settings', () => {
			const merged = mergeV2WithDefaults({
				v2Temperatures: { time: 0.1, location: 0.9 },
			} as Partial<V2Settings>);

			expect(merged.v2Temperatures.time).toBe(0.1);
			expect(merged.v2Temperatures.location).toBe(0.9);
			// Others should be defaults
			expect(merged.v2Temperatures.characters).toBe(0.5);
		});
	});

	describe('isV2Settings', () => {
		it('returns true for valid settings', () => {
			const settings = createDefaultV2Settings();
			expect(isV2Settings(settings)).toBe(true);
		});

		it('returns true when v2MaxTokens is missing (allows upgrade)', () => {
			const settings = createDefaultV2Settings();
			const partial = { ...settings } as Record<string, unknown>;
			delete partial.v2MaxTokens;
			// Should still be valid since v2MaxTokens can be undefined (for migration)
			expect(isV2Settings(partial)).toBe(true);
		});

		it('returns true when v2MaxTokens is a number', () => {
			const settings = createDefaultV2Settings();
			settings.v2MaxTokens = 8192;
			expect(isV2Settings(settings)).toBe(true);
		});

		it('returns false for null', () => {
			expect(isV2Settings(null)).toBe(false);
		});

		it('returns false for non-object', () => {
			expect(isV2Settings('string')).toBe(false);
			expect(isV2Settings(123)).toBe(false);
			expect(isV2Settings(undefined)).toBe(false);
		});

		it('returns false when required fields are missing', () => {
			expect(isV2Settings({})).toBe(false);
			expect(isV2Settings({ v2ProfileId: 'test' })).toBe(false);
		});

		it('returns false when v2MaxTokens is wrong type', () => {
			const settings = createDefaultV2Settings() as unknown as Record<string, unknown>;
			settings.v2MaxTokens = 'not a number';
			expect(isV2Settings(settings)).toBe(false);
		});
	});

	describe('enforceTrackDependencies', () => {
		it('disables climate when location is disabled', () => {
			const track: V2TrackSettings = {
				time: true,
				location: false,
				props: true,
				climate: true,
				characters: true,
				relationships: true,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced.climate).toBe(false);
		});

		it('disables climate when time is disabled', () => {
			const track: V2TrackSettings = {
				time: false,
				location: true,
				props: true,
				climate: true,
				characters: true,
				relationships: true,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced.climate).toBe(false);
		});

		it('disables props when location is disabled', () => {
			const track: V2TrackSettings = {
				time: true,
				location: false,
				props: true,
				climate: true,
				characters: true,
				relationships: true,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced.props).toBe(false);
		});

		it('disables relationships when characters is disabled', () => {
			const track: V2TrackSettings = {
				time: true,
				location: true,
				props: true,
				climate: true,
				characters: false,
				relationships: true,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced.relationships).toBe(false);
		});

		it('disables narrative when relationships is disabled', () => {
			const track: V2TrackSettings = {
				time: true,
				location: true,
				props: true,
				climate: true,
				characters: true,
				relationships: false,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced.narrative).toBe(false);
		});

		it('disables narrative when scene is disabled', () => {
			const track: V2TrackSettings = {
				time: true,
				location: true,
				props: true,
				climate: true,
				characters: true,
				relationships: true,
				scene: false,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced.narrative).toBe(false);
		});

		it('preserves all enabled when dependencies are met', () => {
			const track: V2TrackSettings = {
				time: true,
				location: true,
				props: true,
				climate: true,
				characters: true,
				relationships: true,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced).toEqual(track);
		});

		it('does not modify the original object', () => {
			const track: V2TrackSettings = {
				time: true,
				location: false,
				props: true,
				climate: true,
				characters: true,
				relationships: true,
				scene: true,
				narrative: true,
			};

			const enforced = enforceTrackDependencies(track);
			expect(enforced).not.toBe(track);
			expect(track.climate).toBe(true); // Original unchanged
			expect(enforced.climate).toBe(false); // New object has enforced value
		});
	});
});
