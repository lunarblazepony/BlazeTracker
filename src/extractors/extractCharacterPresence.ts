import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject, asStringOrNull } from '../utils/json';
import type { CharacterEvent } from '../types/state';
import type { LocationState } from './extractLocation';
import { generateUUID } from '../state/eventStore';

// ============================================
// Types
// ============================================

interface PresenceEventRaw {
	subkind: 'appeared' | 'departed';
	character: string;
	initialPosition?: string;
	initialActivity?: string;
}

// ============================================
// Public API
// ============================================

/**
 * Detects character entrances and exits from the scene.
 * Returns CharacterEvent[] with subkind 'appeared' or 'departed'.
 */
export async function extractCharacterPresence(
	messages: string,
	location: LocationState,
	previousCharacters: string[],
	messageId: number,
	swipeId: number,
	abortSignal?: AbortSignal,
): Promise<CharacterEvent[]> {
	const settings = getSettings();

	const locationStr = `${location.area} - ${location.place} (${location.position})`;
	const previousCharactersStr = JSON.stringify(previousCharacters);

	const promptParts = getPromptParts('characters_presence');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousCharactersStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_presence'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/CharacterPresence',
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
		throw new Error('Invalid presence response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is PresenceEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.character !== 'string') return false;
			if (e.subkind !== 'appeared' && e.subkind !== 'departed') return false;
			return true;
		})
		.map((e): CharacterEvent => {
			const base = {
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'character' as const,
				character: e.character,
				subkind: e.subkind,
			};

			if (e.subkind === 'appeared') {
				return {
					...base,
					subkind: 'appeared',
					initialPosition:
						asStringOrNull(e.initialPosition) ?? undefined,
					initialActivity:
						asStringOrNull(e.initialActivity) ?? undefined,
				};
			}

			return {
				...base,
				subkind: 'departed',
			};
		});
}
