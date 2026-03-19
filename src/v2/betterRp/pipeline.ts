/**
 * Better RP Pipeline Orchestrator
 *
 * Runs the 4-step pre-flight thinking pipeline sequentially,
 * collecting errors and supporting abort. Each step retries
 * with lower temperature on parse failure.
 */

import type { Generator } from '../generator/Generator';
import { isAbortError } from '../generator/Generator';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import type { Projection } from '../types/snapshot';
import type { STContext } from '../../types/st.d';
import type { V2Settings } from '../settings/types';
import type { BetterRpResult } from './types';
import { buildPromptWithPrefill } from '../generator/types';
import { buildSharedContext } from './context';
import {
	buildContinuityAuditSystemPrompt,
	buildContinuityAuditUserPrompt,
	parseContinuityAuditResponse,
} from './prompts/continuityAudit';
import {
	buildCharacterKnowledgeSystemPrompt,
	buildCharacterKnowledgeUserPrompt,
	parseCharacterKnowledgeResponse,
} from './prompts/characterKnowledge';
import {
	buildTensionSteeringSystemPrompt,
	buildTensionSteeringUserPrompt,
	parseTensionSteeringResponse,
} from './prompts/tensionSteering';
import {
	buildBeatPlanningSystemPrompt,
	buildBeatPlanningUserPrompt,
	parseBeatPlanningResponse,
} from './prompts/beatPlanning';
import { debugLog, debugWarn, errorLog } from '../../utils/debug';
import { isTrainingCaptureEnabled, annotateLastCapture } from '../training';

/** Default number of retries per step */
const MAX_RETRIES = 2;

/** Temperature used on retry attempts (low for deterministic output) */
const RETRY_TEMPERATURE = 0.1;

/** Assistant prefill to force JSON output */
const JSON_PREFILL = '{\n';

/**
 * Parameters for running the Better RP pipeline.
 */
export interface BetterRpPipelineParams {
	generator: Generator;
	store: EventStore;
	stContext: STContext;
	swipeContext: SwipeContext;
	projection: Projection;
	settings: V2Settings;
	shakeupInstruction?: string | null;
	setStatus?: (status: string) => void;
	abortSignal?: AbortSignal;
}

/**
 * Apply prompt prefix/suffix to a user prompt.
 */
function applyPrefixSuffix(userPrompt: string, prefix: string, suffix: string): string {
	const parts: string[] = [];
	if (prefix) parts.push(prefix);
	parts.push(userPrompt);
	if (suffix) parts.push(suffix);
	return parts.join('\n');
}

/**
 * Get NPC names (characters present minus the user character).
 */
function getNpcNames(projection: Projection, userName: string): string[] {
	return projection.charactersPresent.filter(
		name => name.toLowerCase() !== userName.toLowerCase(),
	);
}

/**
 * Generate a response with retry logic.
 * On parse failure, retries with lower temperature.
 * Uses assistant prefill to force JSON output.
 */
async function generateWithRetry<T>(params: {
	generator: Generator;
	systemPrompt: string;
	userPrompt: string;
	promptName: string;
	parser: (response: string) => T | null;
	temperature: number;
	maxTokens: number;
	abortSignal?: AbortSignal;
}): Promise<T | null> {
	const {
		generator,
		systemPrompt,
		userPrompt,
		promptName,
		parser,
		temperature,
		maxTokens,
		abortSignal,
	} = params;

	let lastResponse: string | undefined;

	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		if (abortSignal?.aborted) return null;

		const currentTemp = attempt === 0 ? temperature : RETRY_TEMPERATURE;

		try {
			const prompt = buildPromptWithPrefill(
				systemPrompt,
				userPrompt,
				JSON_PREFILL,
				promptName,
			);

			const response = await generator.generate(prompt, {
				maxTokens,
				temperature: currentTemp,
				abortSignal,
			});

			lastResponse = response;

			// Prepend the prefill back since the LLM continues from it
			const fullResponse = JSON_PREFILL + response;
			const parsed = parser(fullResponse);

			if (parsed !== null) {
				if (isTrainingCaptureEnabled()) {
					annotateLastCapture({
						parsedResult: parsed,
						parseSuccess: true,
					});
				}
				return parsed;
			}

			// Parse failed — annotate and retry
			if (isTrainingCaptureEnabled()) {
				annotateLastCapture({
					parseSuccess: false,
					parseError: 'parseResponse returned null',
				});
			}
			if (attempt < MAX_RETRIES) {
				debugWarn(
					`${promptName} parse failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying with temperature ${RETRY_TEMPERATURE}`,
				);
			}
		} catch (error) {
			// Re-throw abort errors so the pipeline can stop
			if (isAbortError(error)) throw error;
			if (abortSignal?.aborted) throw error;

			const errorMsg = error instanceof Error ? error.message : String(error);
			if (isTrainingCaptureEnabled()) {
				annotateLastCapture({
					parseSuccess: false,
					parseError: errorMsg,
				});
			}

			if (attempt < MAX_RETRIES) {
				debugWarn(
					`${promptName} error (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`,
					error,
				);
			} else {
				throw error;
			}
		}
	}

	// All attempts exhausted
	errorLog(`${promptName} failed after ${MAX_RETRIES + 1} attempts`);
	if (lastResponse) {
		errorLog(`Last response (truncated):`, lastResponse.substring(0, 500));
	}
	return null;
}

/**
 * Run the 4-step Better RP pre-flight thinking pipeline.
 */
export async function runBetterRpPipeline(params: BetterRpPipelineParams): Promise<BetterRpResult> {
	const {
		generator,
		store,
		stContext,
		swipeContext,
		projection,
		settings,
		shakeupInstruction,
		setStatus,
		abortSignal,
	} = params;

	const result: BetterRpResult = {
		continuityAudit: null,
		characterKnowledge: null,
		tensionSteering: null,
		beatPlanning: null,
		errors: [],
	};

	const userName = stContext.name1;
	const npcNames = getNpcNames(projection, userName);

	if (npcNames.length === 0) {
		debugWarn('Better RP: No NPC characters present, skipping pipeline');
		return result;
	}

	const maxTokens = settings.v2BetterRpMaxTokensPerStep;
	const promptPrefix = settings.v2PromptPrefix || '';
	const promptSuffix = settings.v2PromptSuffix || '';

	// Build shared context once (prefix-cacheable)
	let sharedContext: string;
	try {
		// Fetch worldinfo if enabled
		let worldinfo: string | undefined;
		if (settings.v2IncludeWorldinfo) {
			try {
				const { getWorldinfoForPrompt } =
					await import('../utils/worldinfo');
				const messageTexts = stContext.chat
					.slice(-8)
					.map(m => m.mes)
					.filter(Boolean);
				const wi = await getWorldinfoForPrompt(messageTexts);
				if (wi) worldinfo = wi;
			} catch {
				// Worldinfo fetch failure is non-fatal
			}
		}

		sharedContext = await buildSharedContext({
			stContext,
			projection,
			store,
			swipeContext,
			includeWorldinfo: settings.v2IncludeWorldinfo,
			worldinfo,
			shakeupInstruction,
			injectionTokenBudget: settings.v2InjectionTokenBudget,
			maxRecentChapters: settings.v2MaxRecentChapters,
			maxRecentEvents: settings.v2MaxRecentEvents,
		});
	} catch (error) {
		debugWarn('Better RP: Failed to build shared context:', error);
		result.errors.push({
			step: 'context',
			error: error instanceof Error ? error : new Error(String(error)),
		});
		return result;
	}

	// Step 1: Continuity Audit
	if (abortSignal?.aborted) return result;
	setStatus?.('Auditing continuity... (1/4)');
	debugLog('Better RP: Step 1 — Continuity Audit');

	try {
		result.continuityAudit = await generateWithRetry({
			generator,
			systemPrompt: buildContinuityAuditSystemPrompt(npcNames, userName),
			userPrompt: applyPrefixSuffix(
				buildContinuityAuditUserPrompt(sharedContext),
				promptPrefix,
				promptSuffix,
			),
			promptName: 'betterRp-continuityAudit',
			parser: parseContinuityAuditResponse,
			temperature: 0.4,
			maxTokens,
			abortSignal,
		});

		if (result.continuityAudit) {
			debugLog('Better RP: Step 1 complete', result.continuityAudit);
		} else {
			debugWarn('Better RP: Step 1 failed after retries');
			result.errors.push({
				step: 'continuityAudit',
				error: new Error('Failed to parse response after retries'),
			});
		}
	} catch (error) {
		if (isAbortError(error)) return result;
		debugWarn('Better RP: Step 1 error:', error);
		result.errors.push({
			step: 'continuityAudit',
			error: error instanceof Error ? error : new Error(String(error)),
		});
	}

	// Step 2: Character Knowledge & Intentions
	if (abortSignal?.aborted) return result;
	setStatus?.('Analyzing characters... (2/4)');
	debugLog('Better RP: Step 2 — Character Knowledge');

	try {
		result.characterKnowledge = await generateWithRetry({
			generator,
			systemPrompt: buildCharacterKnowledgeSystemPrompt(npcNames, userName),
			userPrompt: applyPrefixSuffix(
				buildCharacterKnowledgeUserPrompt(
					sharedContext,
					result.continuityAudit,
				),
				promptPrefix,
				promptSuffix,
			),
			promptName: 'betterRp-characterKnowledge',
			parser: parseCharacterKnowledgeResponse,
			temperature: 0.5,
			maxTokens,
			abortSignal,
		});

		if (result.characterKnowledge) {
			debugLog('Better RP: Step 2 complete', result.characterKnowledge);
		} else {
			debugWarn('Better RP: Step 2 failed after retries');
			result.errors.push({
				step: 'characterKnowledge',
				error: new Error('Failed to parse response after retries'),
			});
		}
	} catch (error) {
		if (isAbortError(error)) return result;
		debugWarn('Better RP: Step 2 error:', error);
		result.errors.push({
			step: 'characterKnowledge',
			error: error instanceof Error ? error : new Error(String(error)),
		});
	}

	// Step 3: Tension Steering
	if (abortSignal?.aborted) return result;
	setStatus?.('Planning direction... (3/4)');
	debugLog('Better RP: Step 3 — Tension Steering');

	try {
		result.tensionSteering = await generateWithRetry({
			generator,
			systemPrompt: buildTensionSteeringSystemPrompt(npcNames, userName),
			userPrompt: applyPrefixSuffix(
				buildTensionSteeringUserPrompt(
					sharedContext,
					result.continuityAudit,
					result.characterKnowledge,
				),
				promptPrefix,
				promptSuffix,
			),
			promptName: 'betterRp-tensionSteering',
			parser: parseTensionSteeringResponse,
			temperature: 0.6,
			maxTokens,
			abortSignal,
		});

		if (result.tensionSteering) {
			debugLog('Better RP: Step 3 complete', result.tensionSteering);
		} else {
			debugWarn('Better RP: Step 3 failed after retries');
			result.errors.push({
				step: 'tensionSteering',
				error: new Error('Failed to parse response after retries'),
			});
		}
	} catch (error) {
		if (isAbortError(error)) return result;
		debugWarn('Better RP: Step 3 error:', error);
		result.errors.push({
			step: 'tensionSteering',
			error: error instanceof Error ? error : new Error(String(error)),
		});
	}

	// Step 4: Beat Planning
	if (abortSignal?.aborted) return result;
	setStatus?.('Plotting beats... (4/4)');
	debugLog('Better RP: Step 4 — Beat Planning');

	try {
		result.beatPlanning = await generateWithRetry({
			generator,
			systemPrompt: buildBeatPlanningSystemPrompt(npcNames, userName),
			userPrompt: applyPrefixSuffix(
				buildBeatPlanningUserPrompt(
					sharedContext,
					result.continuityAudit,
					result.characterKnowledge,
					result.tensionSteering,
				),
				promptPrefix,
				promptSuffix,
			),
			promptName: 'betterRp-beatPlanning',
			parser: parseBeatPlanningResponse,
			temperature: 0.7,
			maxTokens,
			abortSignal,
		});

		if (result.beatPlanning) {
			debugLog('Better RP: Step 4 complete', result.beatPlanning);
		} else {
			debugWarn('Better RP: Step 4 failed after retries');
			result.errors.push({
				step: 'beatPlanning',
				error: new Error('Failed to parse response after retries'),
			});
		}
	} catch (error) {
		if (isAbortError(error)) return result;
		debugWarn('Better RP: Step 4 error:', error);
		result.errors.push({
			step: 'beatPlanning',
			error: error instanceof Error ? error : new Error(String(error)),
		});
	}

	return result;
}
