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

interface PhysicalEventRaw {
	subkind: 'physical_state_added' | 'physical_state_removed';
	character: string;
	physicalState: string;
}

// ============================================
// Public API
// ============================================

/**
 * Tracks physical conditions (injuries, exhaustion, etc.).
 * Returns CharacterEvent[] with subkind 'physical_state_added' or 'physical_state_removed'.
 */
export async function extractCharacterPhysical(
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
		previousCharacters.map(c => ({
			name: c.name,
			physicalState: c.physicalState ?? [],
		})),
		null,
		2,
	);

	const promptParts = getPromptParts('characters_physical');
	const userPrompt = promptParts.user
		.replace('{{previousState}}', previousStateStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('characters_physical'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/CharacterPhysical',
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
		throw new Error('Invalid physical state response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is PhysicalEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.character !== 'string') return false;
			if (
				e.subkind !== 'physical_state_added' &&
				e.subkind !== 'physical_state_removed'
			)
				return false;
			if (typeof e.physicalState !== 'string') return false;
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
				physicalState: e.physicalState,
			}),
		);
}
