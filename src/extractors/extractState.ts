import type { STContext } from '../types/st';
import type { TrackedState, NarrativeDateTime, Scene } from '../types/state';
import { getSettings } from '../settings';
import { getMessageState } from '../utils/messageState';

// Import extractors
import { extractTime, setTimeTrackerState } from './extractTime';
import { extractLocation } from './extractLocation';
import { extractClimate } from './extractClimate';
import { extractCharacters } from './extractCharacters';
import { extractScene, shouldExtractScene } from './extractScene';
import { setExtractionStep } from './extractionProgress';

// ============================================
// Module State
// ============================================

let currentAbortController: AbortController | null = null;
let extractionCount = 0;

// ============================================
// Types
// ============================================

export interface ExtractionResult {
	state: TrackedState;
	raw: Record<string, string>;
}

export interface ExtractionOptions {
	forceSceneExtraction?: boolean;
}

// ============================================
// Send Button State Management
// ============================================

function setSendButtonState(isGenerating: boolean): void {
	const context = SillyTavern.getContext();
	if (isGenerating) {
		context.deactivateSendButtons();
	} else {
		context.activateSendButtons();
	}
}

// ============================================
// Abort Handling
// ============================================

export function setupExtractionAbortHandler(): void {
	const context = SillyTavern.getContext();

	context.eventSource.on(context.event_types.GENERATION_STOPPED, (() => {
		if (currentAbortController) {
			console.warn('[BlazeTracker] Generation stopped, aborting extraction');
			currentAbortController.abort();
			currentAbortController = null;
		}
	}) as (...args: unknown[]) => void);
}

export function abortCurrentExtraction(): void {
	if (currentAbortController) {
		currentAbortController.abort();
		currentAbortController = null;
	}
}

// ============================================
// Main Extraction Orchestrator
// ============================================

export async function extractState(
	context: STContext,
	messageId: number,
	previousState: TrackedState | null,
	abortSignal?: AbortSignal,
	options: ExtractionOptions = {},
): Promise<ExtractionResult> {
	const settings = getSettings();

	if (!settings.profileId) {
		throw new Error(
			'No connection profile selected. Please configure BlazeTracker in extension settings.',
		);
	}

	// Create and register abort controller
	const abortController = new AbortController();
	currentAbortController = abortController;

	// Link external abort signal if provided
	if (abortSignal) {
		abortSignal.addEventListener('abort', () => abortController.abort());
	}

	// Track active extractions for button state
	extractionCount++;
	if (extractionCount === 1) {
		setSendButtonState(true);
	}

	const rawResponses: Record<string, string> = {};

	try {
		const { lastXMessages } = settings;
		const isInitial = previousState === null;

		// Determine if this is an assistant message (for scene extraction)
		const currentMessage = context.chat[messageId];
		const isAssistantMessage = currentMessage?.is_user === false;
		const shouldRunScene =
			options.forceSceneExtraction ||
			shouldExtractScene(messageId, isAssistantMessage);

		// ========================================
		// STEP 0: Initialize time tracker from previous state
		// ========================================
		if (previousState?.time) {
			setTimeTrackerState(previousState.time);
		}

		// ========================================
		// Get message window for extraction
		// ========================================
		const { formattedMessages, characterInfo, userInfo } = prepareExtractionContext(
			context,
			messageId,
			lastXMessages,
			previousState,
		);

		// ========================================
		// STEP 1: Extract Time
		// ========================================
		setExtractionStep('time', shouldRunScene);

		let narrativeTime: NarrativeDateTime = previousState?.time ?? getDefaultTime();

		if (settings.trackTime !== false) {
			narrativeTime = await extractTime(
				!isInitial,
				formattedMessages,
				abortController.signal,
			);
		}

		// ========================================
		// STEP 2: Extract Location
		// ========================================
		setExtractionStep('location', shouldRunScene);

		const location = await extractLocation(
			isInitial,
			formattedMessages,
			isInitial ? characterInfo : '',
			previousState?.location ?? null,
			abortController.signal,
		);

		// ========================================
		// STEP 3: Extract Climate
		// ========================================
		setExtractionStep('climate', shouldRunScene);

		const climate = await extractClimate(
			isInitial,
			formattedMessages,
			narrativeTime,
			location,
			isInitial ? characterInfo : '',
			previousState?.climate ?? null,
			abortController.signal,
		);

		// ========================================
		// STEP 4: Extract Characters
		// ========================================
		setExtractionStep('characters', shouldRunScene);

		const characters = await extractCharacters(
			isInitial,
			formattedMessages,
			location,
			isInitial ? userInfo : '',
			isInitial ? characterInfo : '',
			previousState?.characters ?? null,
			abortController.signal,
		);

		// ========================================
		// STEP 5: Extract Scene (conditional)
		// ========================================
		let scene: Scene | undefined;

		if (shouldRunScene) {
			setExtractionStep('scene', shouldRunScene);

			// Scene needs at least 2 messages for tension analysis
			const sceneMessages = formatMessagesForScene(
				context,
				messageId,
				lastXMessages,
				previousState,
			);

			const isInitialScene = !previousState?.scene;
			scene = await extractScene(
				isInitialScene,
				sceneMessages,
				characters,
				isInitial ? characterInfo : '',
				previousState?.scene ?? null,
				abortController.signal,
			);
		} else {
			// Carry forward previous scene or create default
			scene = previousState?.scene;
		}

		// ========================================
		// STEP 6: Assemble Final State
		// ========================================
		setExtractionStep('complete', shouldRunScene);

		const state: TrackedState = {
			time: narrativeTime,
			location,
			climate,
			scene,
			characters,
		};

		return { state, raw: rawResponses };
	} finally {
		extractionCount--;
		if (extractionCount === 0) {
			setSendButtonState(false);
			setExtractionStep('idle', true);
		}
		if (currentAbortController === abortController) {
			currentAbortController = null;
		}
	}
}

// ============================================
// Helper Functions
// ============================================

interface ExtractionContext {
	formattedMessages: string;
	characterInfo: string;
	userInfo: string;
}

/**
 * Format messages for scene extraction with a minimum of 2 messages.
 * This ensures we have both sides of the conversation for tension analysis.
 */
function formatMessagesForScene(
	context: STContext,
	messageId: number,
	lastXMessages: number,
	previousState: TrackedState | null,
): string {
	const MIN_SCENE_MESSAGES = 2;

	// Find where previous state was stored
	let stateIdx = -1;
	if (previousState) {
		for (let i = messageId - 1; i >= 0; i--) {
			const msg = context.chat[i];
			const stored = getMessageState(msg);
			if (stored?.state) {
				stateIdx = i;
				break;
			}
		}
	}

	// Calculate start: we want at least MIN_SCENE_MESSAGES, but also respect lastXMessages
	// and include all messages since last state
	const minStart = Math.max(0, messageId - MIN_SCENE_MESSAGES + 1);
	const stateStart = stateIdx >= 0 ? stateIdx + 1 : 0;
	const limitStart = messageId - lastXMessages;

	// Take the earliest of: minimum messages needed, or messages since state
	// But don't go earlier than lastXMessages limit
	const effectiveStart = Math.max(limitStart, Math.min(minStart, stateStart));

	const chatMessages = context.chat.slice(effectiveStart, messageId + 1);

	return chatMessages.map(msg => `${msg.name}: ${msg.mes}`).join('\n\n');
}

function prepareExtractionContext(
	context: STContext,
	messageId: number,
	lastXMessages: number,
	previousState: TrackedState | null,
): ExtractionContext {
	// Find where to start reading messages
	let startIdx = 0;
	if (previousState) {
		for (let i = messageId - 1; i >= 0; i--) {
			const msg = context.chat[i];
			const stored = getMessageState(msg);
			if (stored?.state) {
				startIdx = i + 1; // Start from message AFTER the one with state
				break;
			}
		}
	}

	// Get only new messages (but respect lastXMessages limit)
	const effectiveStart = Math.max(startIdx, messageId - lastXMessages);
	const chatMessages = context.chat.slice(effectiveStart, messageId + 1);

	// Format messages for prompts
	const formattedMessages = chatMessages.map(msg => `${msg.name}: ${msg.mes}`).join('\n\n');

	// Get user persona info
	const userPersona = context.powerUserSettings?.persona_description || '';
	const userInfo = userPersona
		? `Name: ${context.name1}\nDescription: ${userPersona
			.replace(/\{\{user\}\}/gi, context.name1)
			.replace(/\{\{char\}\}/gi, context.name2)}`
		: `Name: ${context.name1}`;

	// Get character info
	const character = context.characters?.[context.characterId];
	const charDescription = (character?.description || 'No description')
		.replace(/\{\{char\}\}/gi, context.name2)
		.replace(/\{\{user\}\}/gi, context.name1);
	const characterInfo = `Name: ${context.name2}\nDescription: ${charDescription}`;

	return { formattedMessages, characterInfo, userInfo };
}

function getDefaultTime(): NarrativeDateTime {
	return {
		year: new Date().getFullYear(),
		month: 6,
		day: 15,
		hour: 12,
		minute: 0,
		second: 0,
		dayOfWeek: 'Monday',
	};
}

function getDefaultScene(): Scene {
	return {
		topic: 'Scene in progress',
		tone: 'neutral',
		tension: {
			level: 'relaxed',
			direction: 'stable',
			type: 'conversation',
		},
		recentEvents: ['Scene beginning'],
	};
}
