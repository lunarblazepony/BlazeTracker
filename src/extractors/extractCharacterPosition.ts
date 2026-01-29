import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject, asStringOrNull } from '../utils/json';
import type { CharacterEvent, Character } from '../types/state';
import type { LocationState } from './extractLocation';
import { generateUUID } from '../state/eventStore';

// ============================================
// Types
// ============================================

interface PositionEventRaw {
	subkind: 'position_changed';
	character: string;
	newValue: string;
	previousValue: string;
}

// ============================================
// Public API
// ============================================

/**
 * Tracks character movement within the scene.
 * Returns CharacterEvent[] with subkind 'position_changed'.
 */
export async function extractCharacterPosition(
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
		previousCharacters.map(c => ({ name: c.name, position: c.position })),
		null,
		2,
	);

	const promptParts = getPromptParts('characters_position');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousStateStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_position'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/CharacterPosition',
	});

	return validateAndConvertEvents(parsed, messageId, swipeId);
}

// ============================================
// Validation
// ============================================

function validateAndConvertEvents(
	data: unknown,
	messageId: number,
	swipeId: number,
): CharacterEvent[] {
	if (!isObject(data)) {
		throw new Error('Invalid position response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is PositionEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.character !== 'string') return false;
			if (e.subkind !== 'position_changed') return false;
			if (typeof e.newValue !== 'string') return false;
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
				subkind: 'position_changed',
				newValue: e.newValue,
				previousValue: asStringOrNull(e.previousValue) ?? undefined,
			}),
		);
}
