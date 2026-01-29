/**
 * Build Prompt Utility Tests
 *
 * Tests for prompt building utilities that fill placeholders with context values.
 */

import { describe, it, expect } from 'vitest';
import moment from 'moment';
import {
	formatMessages,
	getCharacterDescription,
	getUserDescription,
	formatLocation,
	formatTime,
	formatCharactersPresent,
	formatCharacterState,
	formatCharactersSummary,
	formatRelationshipPair,
	formatRelationshipState,
	formatTension,
	buildPlaceholderValues,
	buildExtractorPrompt,
} from './buildPrompt';
import type { ExtractionContext, ExtractionSettings } from '../types';
import type { Projection } from '../../types';
import { initialTimePrompt } from '../../prompts/initial/timePrompt';

/**
 * Create a mock extraction context.
 */
function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*Elena walks into the room, her auburn hair catching the light.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: 'Hello Elena, glad you could make it.',
				is_user: true,
				is_system: false,
				name: 'Marcus',
			},
			{
				mes: '*She smiles warmly.* It has been too long.',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
		],
		characters: [
			{
				name: 'Elena',
				description: 'A journalist with auburn hair and green eyes.',
				personality: 'Curious and determined',
				scenario: 'Reuniting after a long absence.',
			},
		],
		characterId: 0,
		name1: 'Marcus',
		name2: 'Elena',
		persona: 'A mysterious figure from the past.',
		...overrides,
	};
}

/**
 * Create a mock projection.
 */
function createMockProjection(overrides: Partial<Projection> = {}): Projection {
	return {
		source: { messageId: 0, swipeId: 0 },
		time: moment('2024-11-14T15:30:00'),
		location: {
			area: 'Downtown',
			place: 'Coffee Shop',
			position: 'near the window',
			props: ['menu', 'coffee cup', 'newspaper'],
			locationType: 'heated',
		},
		forecasts: {},
		climate: {
			temperature: 15,
			outdoorTemperature: 15,
			feelsLike: 14,
			humidity: 60,
			precipitation: 0,
			cloudCover: 50,
			windSpeed: 10,
			windDirection: 'NW',
			conditions: 'Partly cloudy',
			conditionType: 'partly_cloudy',
			uvIndex: 3,
			daylight: 'day',
			isIndoors: true,
		},
		charactersPresent: ['Elena', 'Marcus'],
		characters: {
			Elena: {
				name: 'Elena',
				position: 'sitting at the table',
				activity: 'talking',
				mood: ['happy', 'nostalgic'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'white blouse',
					legs: 'black skirt',
					footwear: 'heels',
					socks: null,
					underwear: null,
				},
			},
			Marcus: {
				name: 'Marcus',
				position: 'standing nearby',
				activity: 'listening',
				mood: ['curious'],
				physicalState: [],
				outfit: {
					head: null,
					neck: null,
					jacket: null,
					back: null,
					torso: 'blue shirt',
					legs: 'jeans',
					footwear: 'sneakers',
					socks: null,
					underwear: null,
				},
			},
		},
		relationships: {
			'Elena|Marcus': {
				pair: ['Elena', 'Marcus'],
				status: 'close',
				aToB: {
					feelings: ['trust', 'affection'],
					secrets: ['knows about his past'],
					wants: ['reconnect'],
				},
				bToA: {
					feelings: ['curiosity', 'warmth'],
					secrets: [],
					wants: ['understand what happened'],
				},
			},
		},
		scene: {
			topic: 'Reunion',
			tone: 'Nostalgic',
			tension: {
				level: 'guarded',
				type: 'intimate',
				direction: 'stable',
			},
		},
		currentChapter: 0,
		narrativeEvents: [],
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
function createMockSettings(overrides: Partial<ExtractionSettings> = {}): ExtractionSettings {
	return {
		profileId: 'test-profile',
		track: {
			time: true,
			location: true,
			props: true,
			climate: true,
			characters: true,
			relationships: true,
			scene: true,
			narrative: true,
			chapters: true,
		},
		temperatures: {
			time: 0.3,
			location: 0.5,
			climate: 0.3,
			characters: 0.7,
			relationships: 0.6,
			scene: 0.6,
			narrative: 0.7,
			chapters: 0.5,
		},
		customPrompts: {},
		...overrides,
	};
}

describe('formatMessages', () => {
	it('formats messages with character names', () => {
		const context = createMockContext();
		const result = formatMessages(context, 0, 2);

		expect(result).toContain('Elena:');
		expect(result).toContain('Marcus:');
		expect(result).toContain('auburn hair');
		expect(result).toContain('Hello Elena');
	});

	it('respects start and end indices', () => {
		const context = createMockContext();
		const result = formatMessages(context, 1, 1);

		expect(result).not.toContain('auburn hair');
		expect(result).toContain('Hello Elena');
		expect(result).not.toContain('too long');
	});

	it('skips system messages', () => {
		const context = createMockContext({
			chat: [
				{
					mes: 'System notice',
					is_user: false,
					is_system: true,
					name: 'System',
				},
				{
					mes: 'Regular message',
					is_user: false,
					is_system: false,
					name: 'Elena',
				},
			],
		});
		const result = formatMessages(context, 0, 1);

		expect(result).not.toContain('System notice');
		expect(result).toContain('Regular message');
	});

	it('handles empty message range', () => {
		const context = createMockContext();
		const result = formatMessages(context, 5, 10);

		expect(result).toBe('');
	});
});

describe('getCharacterDescription', () => {
	it('combines description, personality, and scenario', () => {
		const context = createMockContext();
		const result = getCharacterDescription(context);

		expect(result).toContain('journalist with auburn hair');
		expect(result).toContain('Personality: Curious and determined');
		expect(result).toContain('Scenario: Reuniting');
	});

	it('handles missing character gracefully', () => {
		const context = createMockContext({ characterId: 99 });
		const result = getCharacterDescription(context);

		expect(result).toBe('');
	});

	it('handles character with only description', () => {
		const context = createMockContext({
			characters: [{ name: 'Test', description: 'A test character' }],
		});
		const result = getCharacterDescription(context);

		expect(result).toBe('A test character');
	});
});

describe('getUserDescription', () => {
	it('returns persona', () => {
		const context = createMockContext();
		const result = getUserDescription(context);

		expect(result).toBe('A mysterious figure from the past.');
	});

	it('returns empty string when no persona', () => {
		const context = createMockContext({ persona: undefined });
		const result = getUserDescription(context);

		expect(result).toBe('');
	});
});

describe('formatLocation', () => {
	it('formats full location', () => {
		const projection = createMockProjection();
		const result = formatLocation(projection);

		expect(result).toBe('Downtown - Coffee Shop - near the window');
	});

	it('handles partial location', () => {
		const projection = createMockProjection({
			location: {
				area: 'Downtown',
				place: '',
				position: '',
				props: [],
				locationType: 'outdoor',
			},
		});
		const result = formatLocation(projection);

		expect(result).toBe('Downtown');
	});

	it('returns Unknown for missing location', () => {
		const projection = createMockProjection({ location: undefined });
		const result = formatLocation(projection);

		expect(result).toBe('Unknown');
	});
});

describe('formatTime', () => {
	it('formats time correctly', () => {
		const projection = createMockProjection();
		const result = formatTime(projection);

		expect(result).toContain('2024');
		expect(result).toContain('November');
		expect(result).toContain('14');
		expect(result).toContain('3:30 PM');
	});

	it('returns Unknown for missing time', () => {
		const projection = createMockProjection({ time: undefined });
		const result = formatTime(projection);

		expect(result).toBe('Unknown');
	});
});

describe('formatCharactersPresent', () => {
	it('formats character list', () => {
		const projection = createMockProjection();
		const result = formatCharactersPresent(projection);

		expect(result).toBe('Elena, Marcus');
	});

	it('returns None for empty list', () => {
		const projection = createMockProjection({ charactersPresent: [] });
		const result = formatCharactersPresent(projection);

		expect(result).toBe('None');
	});
});

describe('formatCharacterState', () => {
	it('formats character state with all fields', () => {
		const projection = createMockProjection();
		const result = formatCharacterState(projection, 'Elena');

		expect(result).toContain('Position: sitting at the table');
		expect(result).toContain('Activity: talking');
		expect(result).toContain('Mood: happy, nostalgic');
		expect(result).toContain('Outfit:');
		expect(result).toContain('torso: white blouse');
	});

	it('returns Unknown for missing character', () => {
		const projection = createMockProjection();
		const result = formatCharacterState(projection, 'Unknown Character');

		expect(result).toBe('Unknown');
	});
});

describe('formatCharactersSummary', () => {
	it('formats summary for all present characters', () => {
		const projection = createMockProjection();
		const result = formatCharactersSummary(projection);

		expect(result).toContain('Elena:');
		expect(result).toContain('Marcus:');
		expect(result).toContain('Position:');
		expect(result).toContain('Mood:');
	});

	it('returns message when no characters present', () => {
		const projection = createMockProjection({ charactersPresent: [] });
		const result = formatCharactersSummary(projection);

		expect(result).toBe('No characters present');
	});
});

describe('formatRelationshipPair', () => {
	it('formats pair correctly', () => {
		const result = formatRelationshipPair(['Elena', 'Marcus']);

		expect(result).toBe('Elena and Marcus');
	});
});

describe('formatRelationshipState', () => {
	it('formats full relationship state', () => {
		const projection = createMockProjection();
		const result = formatRelationshipState(projection, ['Elena', 'Marcus']);

		expect(result).toContain('Status: close');
		expect(result).toContain('Elena toward Marcus:');
		expect(result).toContain('Feelings: trust, affection');
		expect(result).toContain('Secrets: knows about his past');
		expect(result).toContain('Marcus toward Elena:');
	});

	it('returns message for missing relationship', () => {
		const projection = createMockProjection();
		const result = formatRelationshipState(projection, ['Elena', 'Unknown']);

		expect(result).toBe('No established relationship');
	});
});

describe('formatTension', () => {
	it('formats tension state', () => {
		const projection = createMockProjection();
		const result = formatTension(projection);

		expect(result).toContain('Level: guarded');
		expect(result).toContain('Type: intimate');
		expect(result).toContain('Direction: stable');
	});

	it('returns Unknown for missing scene', () => {
		const projection = createMockProjection({ scene: undefined });
		const result = formatTension(projection);

		expect(result).toBe('Unknown');
	});
});

describe('buildPlaceholderValues', () => {
	it('builds all placeholder values', () => {
		const context = createMockContext();
		const projection = createMockProjection();
		const values = buildPlaceholderValues(context, projection, 0, 2);

		expect(values.messages).toContain('Elena:');
		expect(values.characterName).toBe('Elena');
		expect(values.characterDescription).toContain('journalist');
		expect(values.userName).toBe('Marcus');
		expect(values.userDescription).toContain('mysterious figure');
		expect(values.currentTime).toContain('2024');
		expect(values.currentLocation).toContain('Downtown');
		expect(values.currentArea).toBe('Downtown');
		expect(values.currentPlace).toBe('Coffee Shop');
		expect(values.currentPosition).toBe('near the window');
		expect(values.currentProps).toContain('menu');
		expect(values.currentWeather).toBe('Partly cloudy');
		expect(values.charactersPresent).toBe('Elena, Marcus');
		expect(values.currentTopic).toBe('Reunion');
		expect(values.currentTone).toBe('Nostalgic');
		expect(values.currentTension).toContain('Level: guarded');
	});

	it('adds target character values when specified', () => {
		const context = createMockContext();
		const projection = createMockProjection();
		const values = buildPlaceholderValues(context, projection, 0, 2, {
			targetCharacter: 'Elena',
		});

		expect(values.targetCharacter).toBe('Elena');
		expect(values.targetCharacterState).toContain('sitting at the table');
	});

	it('adds relationship pair values when specified', () => {
		const context = createMockContext();
		const projection = createMockProjection();
		const values = buildPlaceholderValues(context, projection, 0, 2, {
			relationshipPair: ['Elena', 'Marcus'],
		});

		expect(values.relationshipPair).toBe('Elena and Marcus');
		expect(values.relationshipState).toContain('close');
	});
});

describe('buildExtractorPrompt', () => {
	it('fills placeholders in the prompt', () => {
		const context = createMockContext();
		const projection = createMockProjection();
		const settings = createMockSettings();

		const result = buildExtractorPrompt(
			initialTimePrompt,
			context,
			projection,
			settings,
			0,
			2,
		);

		// Check that placeholders were replaced
		expect(result.user).toContain('Elena');
		// Note: characterDescription was removed from initialTimePrompt in the refactor
		expect(result.user).not.toContain('{{characterName}}');
		expect(result.user).not.toContain('{{messages}}');
	});

	it('applies custom prompt overrides', () => {
		const context = createMockContext();
		const projection = createMockProjection();
		const settings = createMockSettings({
			customPrompts: {
				initial_time: {
					systemPrompt: 'Custom system prompt for time extraction',
				},
			},
		});

		const result = buildExtractorPrompt(
			initialTimePrompt,
			context,
			projection,
			settings,
			0,
			2,
		);

		expect(result.system).toBe('Custom system prompt for time extraction');
	});

	it('includes messages from specified range', () => {
		const context = createMockContext();
		const projection = createMockProjection();
		const settings = createMockSettings();

		const result = buildExtractorPrompt(
			initialTimePrompt,
			context,
			projection,
			settings,
			0,
			0, // Only first message
		);

		expect(result.user).toContain('auburn hair');
		expect(result.user).not.toContain('Hello Elena');
	});
});
