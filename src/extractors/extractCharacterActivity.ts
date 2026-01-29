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

interface ActivityEventRaw {
	subkind: 'activity_changed';
	character: string;
	newValue: string | null;
	previousValue?: string | null;
}

// ============================================
// Public API
// ============================================

/**
 * Tracks what characters are doing.
 * Returns CharacterEvent[] with subkind 'activity_changed'.
 */
export async function extractCharacterActivity(
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
		previousCharacters.map(c => ({ name: c.name, activity: c.activity ?? null })),
		null,
		2,
	);

	const promptParts = getPromptParts('characters_activity');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousStateStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_activity'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/CharacterActivity',
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
		throw new Error('Invalid activity response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is ActivityEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.character !== 'string') return false;
			if (e.subkind !== 'activity_changed') return false;
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
				subkind: 'activity_changed',
				newValue: e.newValue,
				previousValue: asStringOrNull(e.previousValue),
			}),
		);
}
