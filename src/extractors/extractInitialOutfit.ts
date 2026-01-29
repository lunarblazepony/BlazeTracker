import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject } from '../utils/json';
import type { CharacterEvent, CharacterOutfit, OutfitSlot } from '../types/state';
import type { LocationState } from './extractLocation';
import { generateUUID } from '../state/eventStore';
import { debugWarn } from '../utils/debug';

// ============================================
// Types
// ============================================

interface NewCharacterInfo {
	name: string;
	initialPosition?: string;
	initialActivity?: string;
}

// ============================================
// Constants
// ============================================

const OUTFIT_SLOTS: OutfitSlot[] = [
	'head',
	'neck',
	'jacket',
	'back',
	'torso',
	'legs',
	'underwear',
	'socks',
	'footwear',
];

// ============================================
// Public API
// ============================================

/**
 * Extracts initial outfits for characters that just appeared in the scene.
 * Returns CharacterEvent[] with subkind 'outfit_changed' for each non-null slot.
 *
 * This uses the same outfit inference rules as characters_initial but only
 * extracts outfits for specific characters that just entered the scene.
 */
export async function extractInitialOutfit(
	messages: string,
	location: LocationState,
	newCharacters: NewCharacterInfo[],
	messageId: number,
	swipeId: number,
	abortSignal?: AbortSignal,
): Promise<CharacterEvent[]> {
	if (newCharacters.length === 0) {
		return [];
	}

	const settings = getSettings();

	const locationStr = `${location.area} - ${location.place} (${location.position})`;

	// Format character info for the prompt
	const charactersStr = newCharacters
		.map(c => {
			const parts = [`Name: ${c.name}`];
			if (c.initialPosition) parts.push(`Position: ${c.initialPosition}`);
			if (c.initialActivity) parts.push(`Activity: ${c.initialActivity}`);
			return parts.join('\n');
		})
		.join('\n\n');

	const promptParts = getPromptParts('characters_initial_outfit');
	const userPrompt = promptParts.user
		.replace('{{characters}}', charactersStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_initial_outfit'),
		abortSignal,
	});

	try {
		const parsed = parseJsonResponse(response, {
			shape: 'object',
			moduleName: 'BlazeTracker/InitialOutfit',
		});

		return convertOutfitsToEvents(parsed, newCharacters, messageId, swipeId);
	} catch (error) {
		debugWarn('Failed to parse initial outfit response:', error);
		return [];
	}
}

// ============================================
// Validation & Conversion
// ============================================

function isValidOutfit(outfit: unknown): outfit is Partial<CharacterOutfit> {
	if (!isObject(outfit)) return false;
	// Check that any present keys are valid outfit slots
	for (const key of Object.keys(outfit as object)) {
		if (!OUTFIT_SLOTS.includes(key as OutfitSlot)) continue;
		const value = (outfit as Record<string, unknown>)[key];
		if (value !== null && typeof value !== 'string') return false;
	}
	return true;
}

function convertOutfitsToEvents(
	data: unknown,
	newCharacters: NewCharacterInfo[],
	messageId: number,
	swipeId: number,
): CharacterEvent[] {
	if (!isObject(data)) {
		debugWarn('Invalid initial outfit response: expected object');
		return [];
	}

	const characters = (data as Record<string, unknown>).characters;
	if (!Array.isArray(characters)) {
		debugWarn('Invalid initial outfit response: expected characters array');
		return [];
	}

	const events: CharacterEvent[] = [];
	const timestamp = Date.now();

	// Create a set of expected character names (case-insensitive)
	const expectedNames = new Set(newCharacters.map(c => c.name.toLowerCase()));

	for (const charData of characters) {
		if (!isObject(charData)) continue;

		const name = (charData as Record<string, unknown>).name;
		if (typeof name !== 'string') continue;

		// Only process characters we asked about
		if (!expectedNames.has(name.toLowerCase())) continue;

		const outfit = (charData as Record<string, unknown>).outfit;
		if (!isValidOutfit(outfit)) continue;

		// Generate an event for each non-null outfit slot
		for (const slot of OUTFIT_SLOTS) {
			const value = (outfit as Partial<CharacterOutfit>)[slot];
			if (value !== null && value !== undefined && typeof value === 'string') {
				events.push({
					id: generateUUID(),
					messageId,
					swipeId,
					timestamp,
					kind: 'character',
					character: name,
					subkind: 'outfit_changed',
					slot,
					newValue: value,
					previousValue: null, // Character just appeared, no previous outfit
				});
			}
		}
	}

	return events;
}
