console.log('[BlazeTracker] Script loading...');

import type { STContext } from './types/st';
import { setupExtractionAbortHandler, wasGenerationAborted } from './extractors/extractState';
import { initSettingsUI } from './ui/settingsUI';
import {
	initStateDisplay,
	injectStyles,
	renderMessageState,
	renderAllStates,
	doExtractState,
} from './ui/stateDisplay';
import { settingsManager, getSettings } from './settings';
import { updateInjectionFromChat } from './injectors/injectState';
import { EXTENSION_NAME } from './constants';
import { getMessageState } from './utils/messageState';
import { migrateOldTimeFormats } from './migrations/migrateOldTime';

function log(...args: unknown[]) {
	console.log(`[${EXTENSION_NAME}]`, ...args);
}

async function init() {
	const context = SillyTavern.getContext();

	// Inject CSS first
	injectStyles();

	// Initialize settings
	await settingsManager.initializeSettings();
	await initSettingsUI();

	// Initialize state display (handles chat change)
	initStateDisplay();
	setupExtractionAbortHandler();

	const settings = getSettings();
	const autoExtractResponses =
		settings.autoMode === 'responses' || settings.autoMode === 'both';
	const autoExtractInputs = settings.autoMode === 'inputs' || settings.autoMode === 'both';

	// Hook user messages
	context.eventSource.on(context.event_types.USER_MESSAGE_RENDERED, (async (
		messageId: number,
	) => {
		if (autoExtractInputs) {
			log('Auto-extracting for user message:', messageId);
			await doExtractState(messageId);
			updateInjectionFromChat();
		} else {
			// Just render existing state (or nothing)
			setTimeout(() => renderMessageState(messageId), 100);
		}
	}) as (...args: unknown[]) => void);

	// Re-extract on message edit
	context.eventSource.on(context.event_types.MESSAGE_EDITED, (async (messageId: number) => {
		const lastIndex = context.chat.length - 1;

		// Only re-extract if editing one of the last 2 messages
		if (messageId >= lastIndex - 1 && messageId !== 0) {
			if (autoExtractResponses || autoExtractInputs) {
				log('Re-extracting for edited message:', messageId);
				await doExtractState(messageId);
			}
		}
	}) as (...args: unknown[]) => void);

	// Re-render all on generation end (to catch any we missed)
	if (autoExtractResponses) {
		// This ensures the message is fully rendered and DOM is stable
		context.eventSource.on(context.event_types.GENERATION_ENDED, (async (
			_messageId: number,
		) => {
			// Yield to microtask queue - ensures any synchronous
			// GENERATION_STOPPED handlers complete first
			await Promise.resolve();

			// Skip extraction if the generation was aborted
			if (wasGenerationAborted()) {
				log('Generation was aborted, skipping extraction');
				return;
			}

			// messageId might not be passed, get the last message
			const stContext = SillyTavern.getContext() as STContext;
			const lastMessageId = stContext.chat.length - 1;

			if (lastMessageId <= 0) return;

			const message = stContext.chat[lastMessageId];
			// Only extract for AI messages
			if (message.is_user) return;

			log('Auto-extracting for completed generation:', lastMessageId);
			await doExtractState(lastMessageId);
		}) as (...args: unknown[]) => void);
	}

	// Update injection on chat change
	context.eventSource.on(context.event_types.CHAT_CHANGED, (async () => {
		const ctx = SillyTavern.getContext() as STContext;
		const settings = getSettings();

		// Run migration before rendering
		if (settings.profileId) {
			await migrateOldTimeFormats(ctx, settings.profileId);
		}

		setTimeout(() => {
			renderAllStates();
			updateInjectionFromChat();
		}, 100);
	}) as (...args: unknown[]) => void);

	const handleSwipe = async (messageId: number) => {
		log('Swipe detected for message:', messageId);

		const stContext = SillyTavern.getContext() as STContext;
		const message = stContext.chat[messageId];
		const existingState = getMessageState(message);

		if (existingState) {
			// This swipe already has state, render it
			log('State exists for this swipe');
			renderMessageState(messageId, existingState);
		} else {
			// No state - either new generation in progress or old unextracted swipe
			// Don't auto-extract here - could be mid-generation with wrong content
			// GENERATION_ENDED will handle new generations
			// User can manually extract old swipes if needed
			renderMessageState(messageId, null);
		}

		updateInjectionFromChat();
	};

	// Try MESSAGE_SWIPED event
	if (context.event_types.MESSAGE_SWIPED) {
		context.eventSource.on(context.event_types.MESSAGE_SWIPED, (async (data: any) => {
			// Event data format varies: could be number, { message }, { messageId }, { id }
			const messageId =
				typeof data === 'number'
					? data
					: (data?.message ?? data?.messageId ?? data?.id);

			if (typeof messageId === 'number') {
				// Small delay to let ST update the swipe data
				setTimeout(() => handleSwipe(messageId), 50);
			}
		}) as (...args: unknown[]) => void);
		log('MESSAGE_SWIPED handler registered');
	}

	// Try SWIPE_CHANGED event (alternate name)
	if (context.event_types.SWIPE_CHANGED) {
		context.eventSource.on(context.event_types.SWIPE_CHANGED, (async (data: any) => {
			const messageId =
				typeof data === 'number'
					? data
					: (data?.message ?? data?.messageId ?? data?.id);

			if (typeof messageId === 'number') {
				setTimeout(() => handleSwipe(messageId), 50);
			}
		}) as (...args: unknown[]) => void);
		log('SWIPE_CHANGED handler registered');
	}

	log('Event hooks registered.');
}

// Wait for DOM/ST to be ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
