import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asString, asStringArray } from '../utils/json';
import type { LocationState } from '../types/state';

// Re-export for convenience (maintains backward compatibility)
export type { LocationState };

// ============================================
// Schema & Example
// ============================================

const LOCATION_SCHEMA = {
	type: 'object',
	properties: {
		area: {
			type: 'string',
			description: 'Broad area or region (city, town, region, etc.)',
		},
		place: {
			type: 'string',
			description: 'Specific location within the area (building, landmark, etc.)',
		},
		position: {
			type: 'string',
			description: 'Exact position within the place (room, corner, etc.)',
		},
		props: {
			type: 'array',
			description: 'Notable items or features in the immediate environment',
			items: {
				type: 'string',
				description: 'A nearby item which is part of the scene, detailed',
			},
			maxItems: 10,
		},
	},
	required: ['area', 'place', 'position', 'props'],
};

const LOCATION_EXAMPLE = JSON.stringify(
	{
		area: 'Downtown Seattle',
		place: 'The Rusty Nail Bar',
		position: 'Corner booth',
		props: [
			'Jukebox playing soft rock',
			'Empty beer glasses on the table',
			'Bowl of peanuts',
			'Flickering neon sign above the bar',
		],
	},
	null,
	2,
);

// ============================================
// Public API
// ============================================

export async function extractLocation(
	isInitial: boolean,
	messages: string,
	characterInfo: string,
	previousLocation: LocationState | null,
	abortSignal?: AbortSignal,
): Promise<LocationState> {
	const settings = getSettings();
	const schemaStr = JSON.stringify(LOCATION_SCHEMA, null, 2);

	const promptParts = getPromptParts(isInitial ? 'location_initial' : 'location_update');
	const userPrompt = isInitial
		? promptParts.user
				.replace('{{characterInfo}}', characterInfo)
				.replace('{{messages}}', messages)
				.replace('{{schema}}', schemaStr)
				.replace('{{schemaExample}}', LOCATION_EXAMPLE)
		: promptParts.user
				.replace(
					'{{previousState}}',
					JSON.stringify(previousLocation, null, 2),
				)
				.replace('{{messages}}', messages)
				.replace('{{schema}}', schemaStr)
				.replace('{{schemaExample}}', LOCATION_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature(isInitial ? 'location_initial' : 'location_update'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/Location',
	});

	return validateLocation(parsed);
}

// ============================================
// Validation
// ============================================

function validateLocation(data: unknown): LocationState {
	if (typeof data !== 'object' || data === null) {
		throw new Error('Invalid location: expected object');
	}

	const obj = data as Record<string, unknown>;

	if (!obj.place || typeof obj.place !== 'string') {
		throw new Error('Invalid location: missing or invalid place');
	}

	return {
		area: asString(obj.area, 'Unknown Area'),
		place: obj.place,
		position: asString(obj.position, 'Main area'),
		props: asStringArray(obj.props, 10),
	};
}
