/**
 * Prompt Hook for Context-Aware Injection
 *
 * Hooks into SillyTavern's prompt events to inject chapter summaries,
 * events, and state based on context budget.
 *
 * Supports both:
 * - CHAT_COMPLETION_PROMPT_READY: For chat completion APIs (OpenAI, Claude, etc.)
 * - GENERATE_BEFORE_COMBINE_PROMPTS: For text completion APIs (Kobold, TextGen, etc.)
 */

import type { STContext } from '../../types/st.d';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { getV2Settings } from '../settings';
import { debugLog } from '../../utils/debug';
import { formatPrecomputedChapters } from './chapters';
import { formatOutOfContextEvents } from './events';
import { formatStateForInjection, type InjectOptions } from './state';
import type { Projection } from '../types/snapshot';
import { computeOptimalContext, estimateMessageTokens, type ContextPlan } from './contextBudget';
import { getDefaultTokenCounter, type TokenCounter } from '../utils/tokenCount';

// Track if hooks are registered
let chatCompletionHookRegistered = false;
let textCompletionHookRegistered = false;

// Bridge functions - set by registerBridgeFunctions to avoid circular dependency
let bridgeFunctions: {
	getV2EventStore: () => EventStore | null;
	hasV2InitialSnapshot: () => boolean;
	buildSwipeContext: (stContext: STContext) => SwipeContext;
} | null = null;

/**
 * Register bridge functions from v2Bridge.
 * Must be called before the prompt hook can function.
 */
export function registerBridgeFunctions(functions: {
	getV2EventStore: () => EventStore | null;
	hasV2InitialSnapshot: () => boolean;
	buildSwipeContext: (stContext: STContext) => SwipeContext;
}): void {
	bridgeFunctions = functions;
}

/**
 * Data passed to the CHAT_COMPLETION_PROMPT_READY event handler.
 */
interface ChatCompletionPromptReadyData {
	/** The chat messages array - can be modified */
	chat: Array<{
		role: 'system' | 'user' | 'assistant';
		content: string;
		extra?: { token_count?: number };
	}>;
	/** Whether this is a dry run (token counting) */
	dryRun?: boolean;
}

/**
 * Data passed to the GENERATE_BEFORE_COMBINE_PROMPTS event handler.
 * This is used for text completion APIs (Kobold, TextGen, Novel, etc.)
 */
interface GenerateBeforeCombinePromptsData {
	/** API type being used */
	api: string;
	/** Set this to override the combined prompt entirely */
	combinedPrompt: string | null;
	/** Whether this is a dry run (token counting) */
	dryRun?: boolean;
	/** Character description */
	description: string;
	/** Character personality */
	personality: string;
	/** User persona */
	persona: string;
	/** Scenario text */
	scenario: string;
	/** Character name */
	char: string;
	/** User name */
	user: string;
	/** World info injected before character */
	worldInfoBefore: string;
	/** World info injected after character */
	worldInfoAfter: string;
	/** Anchor content before scenario */
	beforeScenarioAnchor: string;
	/** Anchor content after scenario */
	afterScenarioAnchor: string;
	/** The story/system string (character card, persona, etc.) */
	storyString: string;
	/** Example messages string */
	mesExmString: string;
	/** The chat messages as a combined string */
	mesSendString: string;
	/** Array of message objects with extension prompts */
	finalMesSend: Array<{
		message: string;
		extensionPrompts: unknown[];
	}>;
	/** Generated prompt cache */
	generatedPromptCache: string;
	/** Main prompt */
	main: string;
	/** Jailbreak prompt */
	jailbreak: string;
	/** NAI preamble */
	naiPreamble: string;
}

/**
 * Count tokens for all fixed content in text completion prompt.
 * Fixed content is everything we can't remove - system prompts, world info, etc.
 */
async function countFixedContentTokens(
	eventData: GenerateBeforeCombinePromptsData,
	tokenCounter: TokenCounter,
): Promise<number> {
	// All the fixed content pieces that exist regardless of our injection
	const fixedPieces = [
		eventData.storyString || '', // Character card, persona, scenario
		eventData.mesExmString || '', // Example messages
		eventData.worldInfoBefore || '', // World info before
		eventData.worldInfoAfter || '', // World info after
		eventData.beforeScenarioAnchor || '', // Anchor before scenario
		eventData.afterScenarioAnchor || '', // Anchor after scenario
		eventData.main || '', // Main/system prompt
		eventData.jailbreak || '', // Jailbreak prompt
		eventData.naiPreamble || '', // NAI preamble
		eventData.generatedPromptCache || '', // Continuation prompt
	];

	// Count tokens for each piece in parallel
	const tokenCounts = await Promise.all(
		fixedPieces.map(piece =>
			piece ? tokenCounter.countTokens(piece) : Promise.resolve(0),
		),
	);

	return tokenCounts.reduce((sum, count) => sum + count, 0);
}

/**
 * Count tokens for all fixed content in chat completion prompt.
 * For chat completion, we count the system message and any non-chat messages.
 */
async function countChatFixedContentTokens(
	chatMessages: ChatCompletionPromptReadyData['chat'],
	tokenCounter: TokenCounter,
): Promise<number> {
	let total = 0;

	// Count system message tokens
	for (const msg of chatMessages) {
		if (msg.role === 'system') {
			total += await tokenCounter.countTokens(msg.content);
		}
	}

	return total;
}

/**
 * Build injection options from V2 settings.
 */
function buildInjectOptions(): InjectOptions {
	const settings = getV2Settings();
	return {
		includeTime: settings.v2Track.time,
		includeLocation: settings.v2Track.location,
		includeClimate: settings.v2Track.climate,
		includeCharacters: settings.v2Track.characters,
		includeRelationships: settings.v2Track.relationships,
		includeScene: settings.v2Track.scene,
		// We handle chapters/events separately in the hook
		includeChapters: false,
		includeEvents: false,
		maxChapters: settings.v2MaxRecentChapters,
		maxEvents: settings.v2MaxRecentEvents,
	};
}

/**
 * Get the store and swipe context.
 * Returns null if not available.
 */
function getStoreAndContext(): {
	store: EventStore;
	swipeContext: SwipeContext;
	stContext: STContext;
} | null {
	// Bridge functions must be registered before use
	if (!bridgeFunctions) {
		return null;
	}

	try {
		const store = bridgeFunctions.getV2EventStore();
		if (!store || !bridgeFunctions.hasV2InitialSnapshot()) {
			return null;
		}
		const stContext = SillyTavern.getContext() as unknown as STContext;
		const swipeContext = bridgeFunctions.buildSwipeContext(stContext);
		return { store, swipeContext, stContext };
	} catch {
		return null;
	}
}

/**
 * Check if BlazeTracker injection is enabled.
 */
function isEnabled(): boolean {
	try {
		const settings = getV2Settings();
		return settings.v2AutoExtract;
	} catch {
		return false;
	}
}

/**
 * Get the available token budget for BlazeTracker injection.
 * This is the total context minus response tokens and existing content.
 */
function getAvailableBudget(stContext: STContext): number {
	const settings = getV2Settings();

	// Use user-configured budget if set, otherwise get from ST
	if (settings.v2InjectionTokenBudget > 0) {
		return settings.v2InjectionTokenBudget;
	}

	try {
		// Get max context from ST - it's exposed as maxContext property
		const contextWithApi = stContext as unknown as {
			maxContext?: number;
		};
		if (
			typeof contextWithApi.maxContext === 'number' &&
			contextWithApi.maxContext > 0
		) {
			const maxContext = contextWithApi.maxContext;
			// Reserve some space for response (estimate 500 tokens)
			// and safety margin (64 tokens)
			return Math.max(0, maxContext - 500 - 64);
		}
	} catch {
		// Fall through
	}

	// Default fallback: 4000 tokens
	return 4000;
}

/**
 * Build the "before messages" injection content from a context plan.
 * This goes after the system prompt but before chat messages.
 */
function buildBeforeMessagesContentFromPlan(plan: ContextPlan): string {
	const sections: string[] = [];

	// 1. Past chapters (Story So Far)
	if (plan.pastChapters.length > 0) {
		const chaptersContent = formatPrecomputedChapters(plan.pastChapters);
		if (chaptersContent) {
			sections.push(`[Story So Far]\n${chaptersContent}\n[/Story So Far]`);
		}
	}

	// 2. Out-of-context events from current chapter
	if (plan.currentChapterEvents.length > 0) {
		const eventsContent = formatOutOfContextEvents(
			plan.currentChapterEvents,
			plan.currentChapterEvents.length,
		);
		if (eventsContent) {
			sections.push(`[Recent Events]\n${eventsContent}\n[/Recent Events]`);
		}
	}

	return sections.join('\n\n');
}

/**
 * Build the "after messages" injection content (current state).
 * This goes after all chat messages.
 */
function buildAfterMessagesContent(
	store: EventStore,
	swipeContext: SwipeContext,
	projection: Projection,
): string {
	const injectOptions = buildInjectOptions();
	return formatStateForInjection(projection, store, swipeContext, injectOptions);
}

/**
 * Map chat completion messages back to ST message indices.
 * The chat array has system messages and other non-chat content mixed in.
 * We need to figure out which messages in the chat array correspond to which ST messages.
 */
function findChatMessageRange(chatMessages: ChatCompletionPromptReadyData['chat']): {
	startIndex: number;
	endIndex: number;
} {
	// Find first non-system message (usually user/assistant)
	let startIndex = 0;
	for (let i = 0; i < chatMessages.length; i++) {
		if (chatMessages[i].role !== 'system') {
			startIndex = i;
			break;
		}
	}

	return { startIndex, endIndex: chatMessages.length };
}

/**
 * Handle the CHAT_COMPLETION_PROMPT_READY event.
 * This is called when ST is about to send a prompt to the LLM.
 */
async function handlePromptReady(eventData: ChatCompletionPromptReadyData): Promise<void> {
	// Skip dry runs (token counting passes)
	if (eventData.dryRun) {
		debugLog('Skipping dry run in prompt hook');
		return;
	}

	// Check if enabled
	if (!isEnabled()) {
		debugLog('BlazeTracker injection disabled');
		return;
	}

	// Get store and context
	const storeAndContext = getStoreAndContext();
	if (!storeAndContext) {
		debugLog('No event store available for injection');
		return;
	}

	const { store, swipeContext, stContext } = storeAndContext;
	const settings = getV2Settings();

	try {
		// Get the chat messages
		const chatMessages = eventData.chat;

		// Get projection for the last message
		const lastMessageId = stContext.chat.length - 1;
		const projectionMessageId = lastMessageId - 1;
		if (projectionMessageId < 0) {
			debugLog('No messages to project from');
			return;
		}

		let projection: Projection;
		try {
			projection = store.projectStateAtMessage(projectionMessageId, swipeContext);
		} catch (e) {
			debugLog('Failed to project state:', e);
			return;
		}

		const tokenCounter = getDefaultTokenCounter();

		// Get the raw max context budget
		const maxBudget = getAvailableBudget(stContext);

		// Count tokens for fixed content (system message)
		const fixedContentTokens = await countChatFixedContentTokens(
			chatMessages,
			tokenCounter,
		);

		// The budget available for messages + our injection is max minus fixed content
		const availableBudget = Math.max(0, maxBudget - fixedContentTokens);

		debugLog(
			`Budget: max=${maxBudget}, fixed=${fixedContentTokens}, available=${availableBudget}`,
		);

		// Build state content to know its token cost
		const stateContent = buildAfterMessagesContent(store, swipeContext, projection);
		const stateTokens = stateContent ? await tokenCounter.countTokens(stateContent) : 0;

		// Estimate message tokens from ST's chat array
		// Note: ST's chat array has messages in order, but may include system messages
		const { startIndex: chatStartIndex } = findChatMessageRange(chatMessages);
		const chatOnlyMessages = chatMessages.slice(chatStartIndex);

		// Build message token map
		const messageTokens = await estimateMessageTokens(
			chatOnlyMessages.map(m => ({
				mes: m.content,
				extra: m.extra,
			})),
			tokenCounter,
		);

		// Compute optimal context with available budget (after fixed content)
		const plan = await computeOptimalContext({
			budget: availableBudget,
			stateTokens,
			messageTokens,
			store,
			swipeContext,
			maxPastChapters: settings.v2MaxRecentChapters,
			maxEvents: settings.v2MaxRecentEvents,
			totalMessages: chatOnlyMessages.length,
			tokenCounter,
		});

		debugLog(
			`Context plan: firstMessage=${plan.firstMessageInContext}, ` +
				`chapters=${plan.pastChapters.length}, events=${plan.currentChapterEvents.length}, ` +
				`totalTokens=${plan.totalTokens}`,
		);

		// Build content from plan
		const beforeContent = buildBeforeMessagesContentFromPlan(plan);

		if (!beforeContent && !stateContent) {
			debugLog('No injection content generated');
			return;
		}

		// Remove messages that are before firstMessageInContext
		if (plan.firstMessageInContext > 0) {
			// Remove messages from the chat array
			// We need to remove from chatStartIndex + firstMessageInContext
			const messagesToRemove = plan.firstMessageInContext;
			if (
				messagesToRemove > 0 &&
				chatStartIndex + messagesToRemove < chatMessages.length
			) {
				chatMessages.splice(chatStartIndex, messagesToRemove);
				debugLog(`Removed ${messagesToRemove} messages to fit budget`);
			}
		}

		// Find system message index (after potential message removal)
		const systemMessageIndex = chatMessages.findIndex(m => m.role === 'system');

		// Insert state before the last message if it's an assistant message (prefill/continuation)
		// Otherwise insert at the end
		if (stateContent) {
			const lastMessage = chatMessages[chatMessages.length - 1];
			if (lastMessage && lastMessage.role === 'assistant') {
				// Prefill/continuation - insert before the assistant's partial response
				chatMessages.splice(chatMessages.length - 1, 0, {
					role: 'user' as const,
					content: stateContent,
				});
				debugLog('Injected BlazeTracker state before assistant prefill');
			} else {
				// Normal case - append at the end
				chatMessages.push({
					role: 'user' as const,
					content: stateContent,
				});
				debugLog('Injected BlazeTracker state at end of messages');
			}
		}

		// Insert chapters/events after the system message
		if (beforeContent) {
			if (systemMessageIndex >= 0) {
				// Insert new message after system
				chatMessages.splice(systemMessageIndex + 1, 0, {
					role: 'user' as const,
					content: beforeContent,
				});
				debugLog('Injected BlazeTracker context after system message');
			} else {
				// No system message - insert at beginning
				chatMessages.unshift({
					role: 'user' as const,
					content: beforeContent,
				});
				debugLog('Injected BlazeTracker context at beginning');
			}
		}
	} catch (error) {
		debugLog('Error in chat completion prompt hook:', error);
	}
}

/**
 * Handle the GENERATE_BEFORE_COMBINE_PROMPTS event.
 * This is called when ST is about to combine prompts for text completion APIs.
 *
 * Note: For text completion, we cannot easily remove messages since mesSendString
 * is already a combined string. We compute the plan but may not be able to fully
 * enforce the budget. ST's own trimming will handle overflow.
 */
async function handleTextCompletionPromptReady(
	eventData: GenerateBeforeCombinePromptsData,
): Promise<void> {
	// Skip dry runs (token counting passes)
	if (eventData.dryRun) {
		debugLog('Skipping dry run in text completion prompt hook');
		return;
	}

	// Check if enabled
	if (!isEnabled()) {
		debugLog('BlazeTracker injection disabled');
		return;
	}

	// Get store and context
	const storeAndContext = getStoreAndContext();
	if (!storeAndContext) {
		debugLog('No event store available for injection');
		return;
	}

	const { store, swipeContext, stContext } = storeAndContext;
	const settings = getV2Settings();

	try {
		// Validate finalMesSend is available
		if (!eventData.finalMesSend || eventData.finalMesSend.length === 0) {
			debugLog('No finalMesSend available for injection');
			return;
		}

		// Get projection for the last message
		const lastMessageId = stContext.chat.length - 1;
		const projectionMessageId = lastMessageId - 1;
		if (projectionMessageId < 0) {
			debugLog('No messages to project from');
			return;
		}

		let projection: Projection;
		try {
			projection = store.projectStateAtMessage(projectionMessageId, swipeContext);
		} catch (e) {
			debugLog('Failed to project state:', e);
			return;
		}

		const tokenCounter = getDefaultTokenCounter();

		// Get the raw max context budget
		const maxBudget = getAvailableBudget(stContext);

		// Count tokens for ALL fixed content that we can't remove
		// These are all the prompt components that exist regardless of our injection
		const fixedContentTokens = await countFixedContentTokens(eventData, tokenCounter);

		// The budget available for messages + our injection is max minus fixed content
		const availableBudget = Math.max(0, maxBudget - fixedContentTokens);

		debugLog(
			`Budget: max=${maxBudget}, fixed=${fixedContentTokens}, available=${availableBudget}`,
		);

		// Build state content to know its token cost
		const stateContent = buildAfterMessagesContent(store, swipeContext, projection);
		const stateTokens = stateContent ? await tokenCounter.countTokens(stateContent) : 0;

		// Count tokens for each message in finalMesSend
		// Each entry has: { message: string, extensionPrompts: string[] }
		const messageTokens = new Map<number, number>();
		for (let i = 0; i < eventData.finalMesSend.length; i++) {
			const entry = eventData.finalMesSend[i];
			// Count both the message and any existing extension prompts
			const fullContent =
				(entry.extensionPrompts as string[]).join('') + entry.message;
			const tokens = await tokenCounter.countTokens(fullContent);
			messageTokens.set(i, tokens);
		}

		// Compute optimal context with proper per-message token counts
		// Note: stateTokens is passed separately, and beforeContent tokens
		// are calculated inside computeOptimalContext as part of chapters/events
		const plan = await computeOptimalContext({
			budget: availableBudget,
			stateTokens,
			messageTokens,
			store,
			swipeContext,
			maxPastChapters: settings.v2MaxRecentChapters,
			maxEvents: settings.v2MaxRecentEvents,
			totalMessages: eventData.finalMesSend.length,
			tokenCounter,
		});

		debugLog(
			`Text completion context plan: firstMessage=${plan.firstMessageInContext}, ` +
				`chapters=${plan.pastChapters.length}, events=${plan.currentChapterEvents.length}, ` +
				`totalTokens=${plan.totalTokens}`,
		);

		// Remove messages that are before firstMessageInContext
		if (plan.firstMessageInContext > 0) {
			const messagesToRemove = plan.firstMessageInContext;
			if (messagesToRemove < eventData.finalMesSend.length) {
				eventData.finalMesSend.splice(0, messagesToRemove);
				debugLog(
					`Removed ${messagesToRemove} old messages from finalMesSend to fit budget`,
				);
			}
		}

		// Build content from plan
		const beforeContent = buildBeforeMessagesContentFromPlan(plan);

		if (!beforeContent && !stateContent) {
			debugLog('No injection content generated');
			return;
		}

		// Check if we still have messages after removal
		if (eventData.finalMesSend.length === 0) {
			debugLog('All messages removed - cannot inject');
			return;
		}

		// For text completion, we MUST modify finalMesSend, not mesSendString!
		// The combine() function rebuilds mesSendString from finalMesSend, ignoring
		// any direct modifications to mesSendString.
		//
		// finalMesSend structure: Array<{message: string, extensionPrompts: string[]}>
		// combine() does: finalMesSend.map(e => `${e.extensionPrompts.join('')}${e.message}`).join('')

		// Prepend chapters/events BEFORE all messages
		// We add to the first message's extensionPrompts array
		if (beforeContent) {
			const firstMessage = eventData.finalMesSend[0];
			if (!firstMessage.extensionPrompts) {
				firstMessage.extensionPrompts = [];
			}
			// Add our content at the START of extension prompts (before other extensions)
			(firstMessage.extensionPrompts as string[]).unshift(beforeContent + '\n\n');
			debugLog('Injected BlazeTracker context before messages via finalMesSend');
		}

		// Append state AFTER all messages (or before assistant prefill in continuation mode)
		if (stateContent) {
			const lastChatMessage = stContext.chat[stContext.chat.length - 1];
			const isContinuation = lastChatMessage && !lastChatMessage.is_user;

			if (isContinuation && eventData.finalMesSend.length > 1) {
				// Continuation mode: append state to second-to-last message
				// (the last one is the assistant's prefill)
				const targetMessage =
					eventData.finalMesSend[eventData.finalMesSend.length - 2];
				targetMessage.message =
					targetMessage.message + '\n\n' + stateContent;
				debugLog('Injected BlazeTracker state before assistant prefill');
			} else {
				// Normal mode OR only one message: append to last message
				const lastMessage =
					eventData.finalMesSend[eventData.finalMesSend.length - 1];
				lastMessage.message = lastMessage.message + '\n\n' + stateContent;
				debugLog('Injected BlazeTracker state after messages');
			}
		}
	} catch (error) {
		debugLog('Error in text completion prompt hook:', error);
	}
}

/**
 * Register the prompt hooks with SillyTavern.
 * Should be called once during extension initialization.
 *
 * Registers handlers for both:
 * - CHAT_COMPLETION_PROMPT_READY: Chat completion APIs (OpenAI, Claude, etc.)
 * - GENERATE_BEFORE_COMBINE_PROMPTS: Text completion APIs (Kobold, TextGen, etc.)
 */
export function registerPromptHook(): void {
	const context = SillyTavern.getContext() as unknown as STContext;
	const eventTypes = context.event_types as unknown as Record<string, string>;

	// Register chat completion hook if available
	if (!chatCompletionHookRegistered && eventTypes.CHAT_COMPLETION_PROMPT_READY) {
		context.eventSource.on(
			eventTypes.CHAT_COMPLETION_PROMPT_READY,
			handlePromptReady as (...args: unknown[]) => void,
		);
		chatCompletionHookRegistered = true;
		debugLog('Registered CHAT_COMPLETION_PROMPT_READY hook');
	}

	// Register text completion hook if available
	if (!textCompletionHookRegistered && eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS) {
		context.eventSource.on(
			eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS,
			handleTextCompletionPromptReady as (...args: unknown[]) => void,
		);
		textCompletionHookRegistered = true;
		debugLog('Registered GENERATE_BEFORE_COMBINE_PROMPTS hook');
	}

	if (!chatCompletionHookRegistered && !textCompletionHookRegistered) {
		debugLog('No prompt hooks available - injection will not work');
	}
}

/**
 * Unregister the prompt hooks.
 */
export function unregisterPromptHook(): void {
	const context = SillyTavern.getContext() as unknown as STContext;
	const eventTypes = context.event_types as unknown as Record<string, string>;

	// Unregister chat completion hook
	if (chatCompletionHookRegistered && eventTypes.CHAT_COMPLETION_PROMPT_READY) {
		context.eventSource.off(
			eventTypes.CHAT_COMPLETION_PROMPT_READY,
			handlePromptReady as (...args: unknown[]) => void,
		);
		chatCompletionHookRegistered = false;
		debugLog('Unregistered CHAT_COMPLETION_PROMPT_READY hook');
	}

	// Unregister text completion hook
	if (textCompletionHookRegistered && eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS) {
		context.eventSource.off(
			eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS,
			handleTextCompletionPromptReady as (...args: unknown[]) => void,
		);
		textCompletionHookRegistered = false;
		debugLog('Unregistered GENERATE_BEFORE_COMBINE_PROMPTS hook');
	}
}

/**
 * Check if any prompt hook is available on this version of ST.
 */
export function isPromptHookAvailable(): boolean {
	try {
		const context = SillyTavern.getContext() as unknown as STContext;
		const eventTypes = context.event_types as unknown as Record<string, string>;
		return !!(
			eventTypes.CHAT_COMPLETION_PROMPT_READY ||
			eventTypes.GENERATE_BEFORE_COMBINE_PROMPTS
		);
	} catch {
		return false;
	}
}

/**
 * Check if prompt hooks are currently registered.
 */
export function isPromptHookRegistered(): boolean {
	return chatCompletionHookRegistered || textCompletionHookRegistered;
}

/**
 * Get info about which hooks are registered.
 */
export function getRegisteredHooks(): {
	chatCompletion: boolean;
	textCompletion: boolean;
} {
	return {
		chatCompletion: chatCompletionHookRegistered,
		textCompletion: textCompletionHookRegistered,
	};
}
