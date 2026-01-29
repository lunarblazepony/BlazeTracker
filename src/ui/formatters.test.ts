import { describe, it, expect, vi } from 'vitest';
import { formatOutfit, formatScene, formatClimate, formatLocation, capitalize } from './formatters';
import type {
	CharacterOutfit,
	Scene,
	Climate,
	ProceduralClimate,
	LocationState,
} from '../types/state';

// Mock settings
vi.mock('../settings', () => ({
	getSettings: () => ({
		temperatureUnit: 'fahrenheit',
	}),
}));

describe('formatOutfit', () => {
	it('shows defaults for missing slots', () => {
		const outfit: CharacterOutfit = {
			head: null,
			neck: null,
			jacket: null,
			back: null,
			torso: null,
			legs: null,
			underwear: null,
			socks: null,
			footwear: null,
		};
		expect(formatOutfit(outfit)).toBe('topless, bottomless, no underwear');
	});

	it('includes all specified slots', () => {
		const outfit: CharacterOutfit = {
			head: 'baseball cap',
			neck: null,
			jacket: 'hoodie',
			back: null,
			torso: 't-shirt',
			legs: 'jeans',
			underwear: 'boxers',
			socks: 'white socks',
			footwear: 'sneakers',
		};
		// null values are filtered out
		expect(formatOutfit(outfit)).toBe(
			't-shirt, jeans, boxers, baseball cap, hoodie, white socks, sneakers',
		);
	});

	it('handles partial outfits', () => {
		const outfit: CharacterOutfit = {
			head: null,
			neck: null,
			jacket: null,
			back: null,
			torso: 'blouse',
			legs: 'skirt',
			underwear: null,
			socks: null,
			footwear: null,
		};
		expect(formatOutfit(outfit)).toBe('blouse, skirt, no underwear');
	});
});

describe('formatScene', () => {
	it('formats scene with all tension parts', () => {
		const scene: Scene = {
			topic: 'romantic dinner',
			tone: 'intimate',
			tension: {
				type: 'intimate',
				level: 'charged',
				direction: 'escalating',
			},
		};

		const result = formatScene(scene);
		expect(result).toContain('Topic: romantic dinner');
		expect(result).toContain('Tone: intimate');
		expect(result).toContain('Tension: intimate, charged, escalating');
	});

	it('excludes stable direction from tension', () => {
		const scene: Scene = {
			topic: 'casual conversation',
			tone: 'relaxed',
			tension: {
				type: 'conversation',
				level: 'relaxed',
				direction: 'stable',
			},
		};

		const result = formatScene(scene);
		expect(result).toContain('Tension: conversation, relaxed');
		expect(result).not.toContain('stable');
	});
});

describe('formatClimate', () => {
	describe('legacy format', () => {
		it('formats simple weather and temperature', () => {
			const climate: Climate = {
				weather: 'sunny',
				temperature: 75,
			};

			expect(formatClimate(climate)).toBe('75°F, sunny');
		});
	});

	describe('procedural format', () => {
		it('formats basic procedural climate', () => {
			const climate: ProceduralClimate = {
				temperature: 72,
				outdoorTemperature: 72,
				feelsLike: 72,
				humidity: 50,
				precipitation: 0,
				cloudCover: 30,
				windSpeed: 5,
				windDirection: 'NW',
				conditions: 'partly cloudy',
				conditionType: 'partly_cloudy',
				uvIndex: 5,
				daylight: 'day',
				isIndoors: false,
			};

			expect(formatClimate(climate)).toBe('72°F, partly cloudy');
		});

		it('includes feels like when significantly different', () => {
			const climate: ProceduralClimate = {
				temperature: 85,
				outdoorTemperature: 85,
				feelsLike: 95,
				humidity: 80,
				precipitation: 0,
				cloudCover: 20,
				windSpeed: 5,
				windDirection: 'S',
				conditions: 'humid',
				conditionType: 'humid',
				uvIndex: 8,
				daylight: 'day',
				isIndoors: false,
			};

			expect(formatClimate(climate)).toContain('feels like 95°F');
		});

		it('includes wind when notable', () => {
			const climate: ProceduralClimate = {
				temperature: 60,
				outdoorTemperature: 60,
				feelsLike: 55,
				humidity: 40,
				precipitation: 0,
				cloudCover: 10,
				windSpeed: 25,
				windDirection: 'NE',
				conditions: 'windy',
				conditionType: 'windy',
				uvIndex: 3,
				daylight: 'day',
				isIndoors: false,
			};

			expect(formatClimate(climate)).toContain('25 mph winds from NE');
		});

		it('shows outdoor temperature when indoors', () => {
			const climate: ProceduralClimate = {
				temperature: 70,
				outdoorTemperature: 35,
				indoorTemperature: 70,
				feelsLike: 70,
				humidity: 45,
				precipitation: 0,
				cloudCover: 0,
				windSpeed: 0,
				windDirection: 'N',
				conditions: 'comfortable',
				conditionType: 'clear',
				uvIndex: 0,
				daylight: 'day',
				isIndoors: true,
			};

			expect(formatClimate(climate)).toContain('35°F outside');
		});
	});
});

describe('formatLocation', () => {
	it('joins all parts with separator', () => {
		const location: LocationState = {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'corner booth',
			props: [],
		};

		expect(formatLocation(location)).toBe('corner booth · Coffee Shop · Downtown');
	});

	it('filters out empty parts', () => {
		const location: LocationState = {
			area: 'Park',
			place: '',
			position: 'under oak tree',
			props: [],
		};

		expect(formatLocation(location)).toBe('under oak tree · Park');
	});
});

describe('capitalize', () => {
	it('capitalizes first letter', () => {
		expect(capitalize('hello')).toBe('Hello');
		expect(capitalize('world')).toBe('World');
	});

	it('handles empty string', () => {
		expect(capitalize('')).toBe('');
	});

	it('handles single character', () => {
		expect(capitalize('a')).toBe('A');
	});

	it('preserves rest of string', () => {
		expect(capitalize('hELLO')).toBe('HELLO');
	});
});
