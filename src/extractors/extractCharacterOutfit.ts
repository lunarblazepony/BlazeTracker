import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject, asStringOrNull } from '../utils/json';
import type { CharacterEvent, Character, OutfitSlot } from '../types/state';
import type { LocationState } from './extractLocation';
import { generateUUID } from '../state/eventStore';

// ============================================
// Types
// ============================================

interface OutfitEventRaw {
	subkind: 'outfit_changed';
	character: string;
	slot: string;
	newValue: string | null;
	previousValue?: string | null;
}

// ============================================
// Constants
// ============================================

const VALID_SLOTS: OutfitSlot[] = [
	'head',
	'neck',
	'jacket',
	'back',
	'torso',
	'legs',
	'footwear',
	'socks',
	'underwear',
];

// ============================================
// Public API
// ============================================

/**
 * Tracks clothing changes by slot.
 * Returns CharacterEvent[] with subkind 'outfit_changed'.
 */
export async function extractCharacterOutfit(
	messages: string,
	location: LocationState,
	previousCharacters: Character[],
	messageId: number,
	swipeId: number,
	abortSignal?: AbortSignal,
): Promise<CharacterEvent[]> {
	const settings = getSettings();

	const locationStr = `${location.area} - ${location.place} (${location.position})`;
	const previousStateStr = JSON.stringify(
		previousCharacters.map(c => ({ name: c.name, outfit: c.outfit ?? {} })),
		null,
		2,
	);

	const promptParts = getPromptParts('characters_outfit');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousStateStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_outfit'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/CharacterOutfit',
	});

	return validateAndConvertEvents(parsed, messageId, swipeId);
}

// ============================================
// Validation
// ============================================

function isValidSlot(slot: string): slot is OutfitSlot {
	return VALID_SLOTS.includes(slot as OutfitSlot);
}

function validateAndConvertEvents(
	data: unknown,
	messageId: number,
	swipeId: number,
): CharacterEvent[] {
	if (!isObject(data)) {
		throw new Error('Invalid outfit response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is OutfitEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.character !== 'string') return false;
			if (e.subkind !== 'outfit_changed') return false;
			if (typeof e.slot !== 'string' || !isValidSlot(e.slot)) return false;
			// newValue can be string or null
			if (e.newValue !== null && typeof e.newValue !== 'string') return false;
			return true;
		})
		.map(
			(e): CharacterEvent => ({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'character',
				character: e.character,
				subkind: 'outfit_changed',
				slot: e.slot as OutfitSlot,
				newValue: e.newValue,
				previousValue: asStringOrNull(e.previousValue),
			}),
		);
}
