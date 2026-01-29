import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asStringOrNull, asStringArray, isObject } from '../utils/json';
import type { Character, CharacterOutfit } from '../types/state';
import type { LocationState } from './extractLocation';

// ============================================
// Schema & Example
// ============================================

export const CHARACTERS_SCHEMA = {
	type: 'array',
	description: 'All characters present in the current scene',
	items: {
		type: 'object',
		additionalProperties: false,
		properties: {
			name: {
				type: 'string',
				description: "Character's name as used in the scene",
			},
			position: {
				type: 'string',
				description:
					"Physical position and where (e.g. 'sitting at the bar', 'leaning against the wall'). Be detailed about who they're facing/interacting with.",
			},
			activity: {
				type: 'string',
				description:
					"Current activity if any (e.g. 'nursing a whiskey', 'texting on phone')",
			},
			mood: {
				type: 'array',
				description: 'Current emotional states',
				minItems: 1,
				maxItems: 5,
				items: { type: 'string' },
			},
			physicalState: {
				type: 'array',
				description: 'Physical conditions affecting the character',
				maxItems: 5,
				items: { type: 'string' },
			},
			outfit: {
				type: 'object',
				description:
					'Clothing items currently worn. Set to null if removed or if species would not wear clothes (pony, Pokémon, etc.)',
				properties: {
					head: {
						type: ['string', 'null'],
						description: 'Headwear (null if none)',
					},
					neck: {
						type: ['string', 'null'],
						description:
							'Neckwear - necklaces, chokers, scarves, ties (null if none)',
					},
					jacket: {
						type: ['string', 'null'],
						description: 'Outer layer (null if none)',
					},
					back: {
						type: ['string', 'null'],
						description:
							'Items worn on back - backpacks, quivers, cloaks, capes (null if none)',
					},
					torso: {
						type: ['string', 'null'],
						description: 'Shirt/top (null if none)',
					},
					legs: {
						type: ['string', 'null'],
						description: 'Pants/skirt (null if none)',
					},
					underwear: {
						type: ['string', 'null'],
						description:
							'Underwear, be descriptive if partially removed',
					},
					socks: {
						type: ['string', 'null'],
						description:
							'Socks/stockings, specify which foot if only one',
					},
					footwear: {
						type: ['string', 'null'],
						description:
							'Shoes/boots, specify which foot if only one',
					},
				},
				required: [
					'head',
					'neck',
					'jacket',
					'back',
					'torso',
					'legs',
					'underwear',
					'socks',
					'footwear',
				],
			},
			dispositions: {
				type: 'object',
				description: 'Feelings toward other characters in the scene',
				additionalProperties: {
					type: 'array',
					maxItems: 5,
					items: { type: 'string' },
				},
			},
		},
		required: [
			'name',
			'position',
			'activity',
			'mood',
			'physicalState',
			'outfit',
			'dispositions',
		],
	},
};

const CHARACTERS_EXAMPLE = JSON.stringify(
	[
		{
			name: 'Elena',
			position: 'Sitting in the booth, facing the entrance',
			activity: 'Watching the door nervously, hands wrapped around a coffee mug',
			mood: ['anxious', 'hopeful'],
			physicalState: ['tired'],
			outfit: {
				head: null,
				neck: 'Silver pendant necklace',
				jacket: null,
				back: null,
				torso: 'Dark red blouse',
				legs: 'Black jeans',
				underwear: 'Black lace bra and matching panties',
				socks: 'Black tights',
				footwear: 'Black ankle boots',
			},
			dispositions: {
				Marcus: ['suspicious', 'curious'],
				Sarah: ['trusting', 'protective'],
			},
		},
	],
	null,
	2,
);

// ============================================
// Public API
// ============================================

/**
 * Extract initial character state from messages.
 * This is ONLY used for the initial projection (first extraction with no prior events).
 * For subsequent messages, use the 6 character event extractors instead:
 * - extractCharacterPresence (appeared/departed)
 * - extractCharacterPosition (position_changed)
 * - extractCharacterActivity (activity_changed)
 * - extractCharacterMood (mood_added/mood_removed)
 * - extractCharacterOutfit (outfit_changed)
 * - extractCharacterPhysical (physical_state_added/physical_state_removed)
 *
 * @param messages - The messages to analyze
 * @param location - Current location state
 * @param userInfo - Information about the user character
 * @param characterInfo - Information about AI characters
 * @param abortSignal - Optional abort signal
 * @returns Array of characters with their initial state
 */
export async function extractCharacters(
	messages: string,
	location: LocationState,
	userInfo: string,
	characterInfo: string,
	abortSignal?: AbortSignal,
): Promise<Character[]> {
	const settings = getSettings();

	const locationStr = `${location.area} - ${location.place} (${location.position})`;
	const schemaStr = JSON.stringify(CHARACTERS_SCHEMA, null, 2);

	const promptParts = getPromptParts('characters_initial');
	const userPrompt = promptParts.user
		.replace('{{userInfo}}', userInfo)
		.replace('{{characterInfo}}', characterInfo)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages)
		.replace('{{schema}}', schemaStr)
		.replace('{{schemaExample}}', CHARACTERS_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_initial'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'array',
		moduleName: 'BlazeTracker/Characters',
	});

	return validateCharacters(parsed);
}

// ============================================
// Validation
// ============================================

function validateCharacters(data: unknown): Character[] {
	if (!Array.isArray(data)) {
		throw new Error('Invalid characters: expected array');
	}

	return data.map(validateCharacter);
}

function validateCharacter(data: unknown): Character {
	if (!isObject(data)) {
		throw new Error('Invalid character: expected object');
	}

	const name = data.name;
	if (!name || typeof name !== 'string') {
		throw new Error('Invalid character: missing name');
	}

	const position = data.position;
	if (!position || typeof position !== 'string') {
		throw new Error(`Invalid character ${name}: missing position`);
	}

	const outfit = validateOutfit(data.outfit);

	return {
		name,
		position,
		activity: typeof data.activity === 'string' ? data.activity : undefined,
		// Note: goals removed in v1.0.0, now tracked in CharacterArc
		mood: Array.isArray(data.mood) ? asStringArray(data.mood, 5) : ['neutral'],
		physicalState: Array.isArray(data.physicalState)
			? asStringArray(data.physicalState, 5)
			: undefined,
		outfit,
		// Note: dispositions removed in v1.0.0, now tracked in Relationship
	};
}

function validateOutfit(data: unknown): CharacterOutfit {
	if (!isObject(data)) {
		return {
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
	}

	return {
		head: asStringOrNull(data.head),
		neck: asStringOrNull(data.neck),
		jacket: asStringOrNull(data.jacket),
		back: asStringOrNull(data.back),
		torso: asStringOrNull(data.torso),
		legs: asStringOrNull(data.legs),
		underwear: asStringOrNull(data.underwear),
		socks: asStringOrNull(data.socks),
		footwear: asStringOrNull(data.footwear),
	};
}
