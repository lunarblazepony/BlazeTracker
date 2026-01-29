import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject } from '../utils/json';
import type { LocationPropEvent, LocationPropSubkind, CharacterOutfit } from '../types/state';
import type { LocationState } from './extractLocation';
import { generateUUID } from '../state/eventStore';

// ============================================
// Types
// ============================================

interface PropEventRaw {
	subkind: 'prop_added' | 'prop_removed';
	prop: string;
}

interface CharacterOutfitInfo {
	name: string;
	outfit: CharacterOutfit;
}

// ============================================
// Constants
// ============================================

const VALID_SUBKINDS: LocationPropSubkind[] = ['prop_added', 'prop_removed'];

// ============================================
// Public API
// ============================================

/**
 * Extracts location prop changes from messages.
 * Props are physical objects in the environment that can be interacted with.
 *
 * Key rules:
 * - Undressing ADDS props (clothes go on floor/furniture)
 * - Dressing REMOVES props (clothes leave environment, go on body)
 * - Room transitions: ALL old props removed, ALL new props added
 *
 * @param messages - The messages to analyze
 * @param location - Current location state
 * @param previousProps - Props currently in the scene
 * @param characterOutfits - Character outfits to help distinguish outfit vs prop changes
 * @param messageId - Current message ID
 * @param swipeId - Current swipe ID
 * @param abortSignal - Optional abort signal
 * @returns LocationPropEvent[] with subkind 'prop_added' or 'prop_removed'
 */
export async function extractLocationProps(
	messages: string,
	location: LocationState,
	previousProps: string[],
	characterOutfits: CharacterOutfitInfo[],
	messageId: number,
	swipeId: number,
	abortSignal?: AbortSignal,
): Promise<LocationPropEvent[]> {
	const settings = getSettings();

	const locationStr = `${location.area} - ${location.place} (${location.position})`;
	const previousPropsStr = JSON.stringify(previousProps, null, 2);
	const outfitsStr = JSON.stringify(
		characterOutfits.map(c => ({
			name: c.name,
			outfit: c.outfit,
		})),
		null,
		2,
	);

	const promptParts = getPromptParts('location_props');
	const userPrompt = promptParts.user
		.replace('{{previousProps}}', previousPropsStr)
		.replace('{{characterOutfits}}', outfitsStr)
		.replace('{{location}}', locationStr)
		.replace('{{messages}}', messages);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('location_props'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/LocationProps',
	});

	return validateAndConvertEvents(parsed, messageId, swipeId);
}

// ============================================
// Validation
// ============================================

function isValidSubkind(subkind: string): subkind is LocationPropSubkind {
	return VALID_SUBKINDS.includes(subkind as LocationPropSubkind);
}

function validateAndConvertEvents(
	data: unknown,
	messageId: number,
	swipeId: number,
): LocationPropEvent[] {
	if (!isObject(data)) {
		throw new Error('Invalid location props response: expected object');
	}

	const events = (data as Record<string, unknown>).events;
	if (!Array.isArray(events)) {
		return [];
	}

	const timestamp = Date.now();

	return events
		.filter((e): e is PropEventRaw => {
			if (!isObject(e)) return false;
			if (typeof e.subkind !== 'string' || !isValidSubkind(e.subkind))
				return false;
			if (typeof e.prop !== 'string' || e.prop.trim() === '') return false;
			return true;
		})
		.map(
			(e): LocationPropEvent => ({
				id: generateUUID(),
				messageId,
				swipeId,
				timestamp,
				kind: 'location',
				subkind: e.subkind,
				prop: e.prop.trim(),
			}),
		);
}
