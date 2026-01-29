import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, asString, isObject } from '../utils/json';
import type { Scene, Character } from '../types/state';
import { calculateTensionDirection } from '../utils/tension';

// ============================================
// Types (re-export for convenience)
// ============================================

export type TensionLevel =
	| 'relaxed'
	| 'aware'
	| 'guarded'
	| 'tense'
	| 'charged'
	| 'volatile'
	| 'explosive';
export type TensionDirection = 'escalating' | 'stable' | 'decreasing';
export type TensionType =
	| 'confrontation'
	| 'intimate'
	| 'vulnerable'
	| 'celebratory'
	| 'negotiation'
	| 'suspense'
	| 'conversation';

// ============================================
// Schema & Example
// ============================================

export const SCENE_SCHEMA = {
	type: 'object',
	description: 'Summary of the current scene state',
	additionalProperties: false,
	properties: {
		topic: {
			type: 'string',
			description:
				'3-5 words describing the main topic(s) of the current interaction',
		},
		tone: {
			type: 'string',
			description: 'Dominant emotional tone of the scene (2-3 words)',
		},
		tension: {
			type: 'object',
			description: 'Current tension level in the scene',
			additionalProperties: false,
			properties: {
				level: {
					type: 'string',
					enum: [
						'relaxed',
						'aware',
						'guarded',
						'tense',
						'charged',
						'volatile',
						'explosive',
					],
				},
				direction: {
					type: 'string',
					enum: ['escalating', 'stable', 'decreasing'],
					description:
						'Set based on comparison with previous level - will be recalculated',
				},
				type: {
					type: 'string',
					enum: [
						'confrontation',
						'intimate',
						'vulnerable',
						'celebratory',
						'negotiation',
						'suspense',
						'conversation',
					],
				},
			},
			required: ['level', 'direction', 'type'],
		},
		// Note: recentEvents removed in v1.0.0, replaced by event extraction
	},
	required: ['topic', 'tone', 'tension'],
};

const SCENE_EXAMPLE = JSON.stringify(
	{
		topic: "Discussing Marcus's heist plans",
		tone: 'Hushed, conspiratorial',
		tension: {
			level: 'tense',
			direction: 'escalating',
			type: 'negotiation',
		},
	},
	null,
	2,
);

// ============================================
// Constants
// ============================================

const VALID_TENSION_LEVELS: readonly TensionLevel[] = [
	'relaxed',
	'aware',
	'guarded',
	'tense',
	'charged',
	'volatile',
	'explosive',
];
const VALID_TENSION_DIRECTIONS: readonly TensionDirection[] = [
	'escalating',
	'stable',
	'decreasing',
];
const VALID_TENSION_TYPES: readonly TensionType[] = [
	'confrontation',
	'intimate',
	'vulnerable',
	'celebratory',
	'negotiation',
	'suspense',
	'conversation',
];

// ============================================
// Public API
// ============================================

export async function extractScene(
	isInitial: boolean,
	messages: string,
	characters: Character[],
	userInfo: string,
	characterInfo: string,
	previousScene: Scene | null,
	abortSignal?: AbortSignal,
): Promise<Scene> {
	const settings = getSettings();

	// Create a brief summary of characters for context
	const charactersSummary = characters
		.map(c => `${c.name}: ${c.mood.join(', ')} - ${c.activity || c.position}`)
		.join('\n');

	const schemaStr = JSON.stringify(SCENE_SCHEMA, null, 2);

	const promptParts = getPromptParts(isInitial ? 'scene_initial' : 'scene_update');
	const userPrompt = isInitial
		? promptParts.user
				.replace('{{userInfo}}', userInfo)
				.replace('{{characterInfo}}', characterInfo)
				.replace('{{charactersSummary}}', charactersSummary)
				.replace('{{messages}}', messages)
				.replace('{{schema}}', schemaStr)
				.replace('{{schemaExample}}', SCENE_EXAMPLE)
		: promptParts.user
				.replace('{{charactersSummary}}', charactersSummary)
				.replace(
					'{{previousState}}',
					JSON.stringify(previousScene, null, 2),
				)
				.replace('{{messages}}', messages)
				.replace('{{schema}}', schemaStr)
				.replace('{{schemaExample}}', SCENE_EXAMPLE);

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature(isInitial ? 'scene_initial' : 'scene_update'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/Scene',
	});

	const scene = validateScene(parsed);

	// Recalculate tension direction based on previous state
	scene.tension.direction = calculateTensionDirection(
		scene.tension.level,
		previousScene?.tension?.level,
	);

	return scene;
}

/**
 * Determine if scene extraction should run for this message.
 * Returns true if this is an assistant message (every 2nd message).
 */
export function shouldExtractScene(_messageId: number, isAssistantMessage: boolean): boolean {
	// Only extract scene after assistant responses
	return isAssistantMessage;
}

// ============================================
// Validation
// ============================================

function validateScene(data: unknown): Scene {
	if (!isObject(data)) {
		throw new Error('Invalid scene: expected object');
	}

	if (!data.topic || typeof data.topic !== 'string') {
		throw new Error('Invalid scene: missing topic');
	}

	// Validate tension
	const tensionData = isObject(data.tension) ? data.tension : {};
	const level = VALID_TENSION_LEVELS.includes(tensionData.level as TensionLevel)
		? (tensionData.level as TensionLevel)
		: 'relaxed';
	const direction = VALID_TENSION_DIRECTIONS.includes(
		tensionData.direction as TensionDirection,
	)
		? (tensionData.direction as TensionDirection)
		: 'stable';
	const type = VALID_TENSION_TYPES.includes(tensionData.type as TensionType)
		? (tensionData.type as TensionType)
		: 'conversation';

	// Note: recentEvents removed in v1.0.0, replaced by currentEvents on TrackedState

	return {
		topic: data.topic,
		tone: asString(data.tone, 'neutral'),
		tension: { level, direction, type },
	};
}
