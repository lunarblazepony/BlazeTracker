import { getSettings, getTemperature } from '../settings';
import { getPromptParts } from '../prompts';
import { makeGeneratorRequest, buildExtractionMessages } from '../utils/generator';
import { parseJsonResponse, isObject } from '../utils/json';
import type { MilestoneConfirmResult, EventType } from '../types/state';
import { EVENT_TYPES } from '../types/state';

// ============================================
// Public API
// ============================================

/**
 * Validates a candidate milestone event with 4-way classification.
 * Returns the validation result which can be:
 * - accept: The event and pair are correct
 * - wrong_event: Something happened but it was a different event type
 * - wrong_pair: This event happened but between different characters
 * - reject: The event didn't happen at all
 */
export async function confirmMilestone(
	messages: string,
	candidatePair: [string, string],
	candidateEventType: EventType,
	presentCharacters: string[],
	abortSignal?: AbortSignal,
): Promise<MilestoneConfirmResult> {
	const settings = getSettings();

	const promptParts = getPromptParts('milestone_confirm');
	const userPrompt = promptParts.user
		.replace('{{messages}}', messages)
		.replace('{{candidatePair}}', JSON.stringify(candidatePair))
		.replace('{{candidateEventType}}', candidateEventType)
		.replace('{{presentCharacters}}', JSON.stringify(presentCharacters))
		.replace('{{allEventTypes}}', EVENT_TYPES.join(', '));

	const llmMessages = buildExtractionMessages(promptParts.system, userPrompt);

	const response = await makeGeneratorRequest(llmMessages, {
		profileId: settings.profileId,
		maxTokens: settings.maxResponseTokens,
		temperature: getTemperature('milestone_confirm'),
		abortSignal,
	});

	const parsed = parseJsonResponse(response, {
		shape: 'object',
		moduleName: 'BlazeTracker/MilestoneConfirm',
	});

	return validateResult(parsed);
}

// ============================================
// Validation
// ============================================

function validateResult(data: unknown): MilestoneConfirmResult {
	if (!isObject(data)) {
		throw new Error('Invalid milestone confirm response: expected object');
	}

	const raw = data as Record<string, unknown>;

	// Validate result field
	const validResults = ['accept', 'wrong_event', 'wrong_pair', 'reject'];
	if (typeof raw.result !== 'string' || !validResults.includes(raw.result)) {
		throw new Error(`Invalid result: ${raw.result}`);
	}

	const result = raw.result as MilestoneConfirmResult['result'];

	// Validate reasoning (required)
	if (typeof raw.reasoning !== 'string' || !raw.reasoning) {
		throw new Error('Missing reasoning field');
	}

	const reasoning = raw.reasoning;

	// Build result based on classification
	const base: MilestoneConfirmResult = {
		result,
		reasoning,
	};

	if (result === 'accept') {
		return {
			...base,
			description:
				typeof raw.description === 'string' ? raw.description : undefined,
		};
	}

	if (result === 'wrong_event') {
		if (typeof raw.correct_event !== 'string') {
			throw new Error('wrong_event result requires correct_event field');
		}
		// Validate it's a known event type
		if (!EVENT_TYPES.includes(raw.correct_event as EventType)) {
			throw new Error(`Invalid correct_event: ${raw.correct_event}`);
		}
		return {
			...base,
			correctEvent: raw.correct_event as EventType,
			description:
				typeof raw.description === 'string' ? raw.description : undefined,
		};
	}

	if (result === 'wrong_pair') {
		if (!Array.isArray(raw.correct_pair) || raw.correct_pair.length !== 2) {
			throw new Error(
				'wrong_pair result requires correct_pair array with 2 elements',
			);
		}
		if (
			typeof raw.correct_pair[0] !== 'string' ||
			typeof raw.correct_pair[1] !== 'string'
		) {
			throw new Error('correct_pair must contain two strings');
		}
		return {
			...base,
			correctPair: [raw.correct_pair[0], raw.correct_pair[1]],
			description:
				typeof raw.description === 'string' ? raw.description : undefined,
		};
	}

	// result === 'reject'
	return base;
}
