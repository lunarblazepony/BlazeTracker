import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject } from '../utils/json';
import type { CharacterEvent, Character } from '../types/state';
import type { LocationState } from './extractLocation';
import { generateUUID } from '../state/eventStore';

// ============================================
// Types
// ============================================

interface MoodEventRaw {
	subkind: 'mood_added' | 'mood_removed';
	character: string;
	mood: string;
}

// ============================================
// Public API
// ============================================

/**
 * Analyzes character emotional state changes.
 * Returns CharacterEvent[] with subkind 'mood_added' or 'mood_removed'.
 */
export async function extractCharacterMood(
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
		previousCharacters.map(c => ({ name: c.name, mood: c.mood ?? [] })),
		null,
		2,
	);

	const promptParts = getPromptParts('characters_mood');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousStateStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_mood'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/CharacterMood',
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
		throw new Error('Invalid mood response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is MoodEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.character !== 'string') return false;
			if (e.subkind !== 'mood_added' && e.subkind !== 'mood_removed')
				return false;
			if (typeof e.mood !== 'string') return false;
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
				subkind: e.subkind,
				mood: e.mood,
			}),
		);
}
