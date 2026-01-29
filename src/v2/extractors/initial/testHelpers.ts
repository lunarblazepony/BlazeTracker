/**
 * Test Helpers for Initial Extractors
 *
 * Provides mock factories for testing extractors.
 */

import type { ExtractionContext, ExtractionSettings } from '../types';
import type { Snapshot, CharacterState, RelationshipState, LocationState } from '../../types';

/**
 * Create a mock extraction context for testing.
 */
export function createMockContext(overrides: Partial<ExtractionContext> = {}): ExtractionContext {
	return {
		chat: [
			{
				mes: '*The clock on the wall shows 3:47 PM as Elena enters the coffee shop. November 14th, 2024 - exactly one year since everything changed.*',
				is_user: false,
				is_system: false,
				name: 'Elena',
			},
			{
				mes: '*I wave to Elena from my seat near the window.* Hey, glad you could make it.',
				is_user: true,
				is_system: false,
				name: 'User',
			},
		],
		characters: [
			{
				name: 'Elena',
				description:
					'A young woman with auburn hair and green eyes. She works as a journalist.',
				personality: 'Curious, determined, slightly anxious',
				scenario: 'Meeting at a coffee shop after a year apart.',
			},
		],
		characterId: 0,
		name1: 'User',
		name2: 'Elena',
		persona: 'A mysterious stranger with secrets to share.',
		...overrides,
	};
}

/**
 * Create mock extraction settings.
 */
export function createMockSettings(
	overrides: Partial<ExtractionSettings> = {},
): ExtractionSettings {
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

/**
 * Create a partial snapshot with optional overrides.
 */
export function createPartialSnapshot(overrides: Partial<Snapshot> = {}): Partial<Snapshot> {
	return { ...overrides };
}

/**
 * Create a mock location state.
 */
export function createMockLocation(overrides: Partial<LocationState> = {}): LocationState {
	return {
		area: 'Downtown Seattle',
		place: 'The Starlight Diner',
		position: 'Corner booth',
		props: [],
		locationType: 'heated',
		...overrides,
	};
}

/**
 * Create a mock character state.
 */
export function createMockCharacter(
	name: string,
	overrides: Partial<CharacterState> = {},
): CharacterState {
	return {
		name,
		position: 'standing nearby',
		activity: null,
		mood: [],
		physicalState: [],
		outfit: {
			head: null,
			neck: null,
			jacket: null,
			back: null,
			torso: null,
			legs: null,
			underwear: null,
			socks: null,
			footwear: null,
		},
		...overrides,
	};
}

/**
 * Create a mock relationship state.
 */
export function createMockRelationship(
	pair: [string, string],
	overrides: Partial<RelationshipState> = {},
): RelationshipState {
	return {
		pair,
		status: 'strangers',
		aToB: {
			feelings: [],
			secrets: [],
			wants: [],
		},
		bToA: {
			feelings: [],
			secrets: [],
			wants: [],
		},
		...overrides,
	};
}
