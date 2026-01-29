import type { STContext } from './types/st';
import { initSettingsUI } from './ui/settingsUI';
import { EXTENSION_KEY } from './constants';
import { getSwipeId } from './utils/messageState';
import { registerSlashCommands, isBatchExtractionInProgress } from './commands/slashCommands';
// Debug utilities
import { debugLog, setDebugEnabled } from './utils/debug';
// V2 Settings
import { initializeV2Settings, getV2Settings } from './v2/settings';
// V2 Event System Bridge
import {
	resetV2EventStore,
	getV2EventStore,
	buildSwipeContext,
	getProjectionForMessage,
	hasV2InitialSnapshot,
	runV2Extraction,
	deleteV2EventsForMessage,
	deleteV2EventsForSwipe,
	cleanupV2EventsAfterMessage,
	wasExtractionAborted,
	abortExtraction,
} from './v2Bridge';
// V2 Injection
import { injectState as v2InjectState } from './v2';
// V2 Card Extensions
import { clearNameResolutionCache } from './v2/cardExtensions';
// V2 UI Mount Functions
import {
	mountV2ProjectionDisplay,
	mountAllV2ProjectionDisplays,
	unmountV2ProjectionDisplay,
	unmountAllV2ProjectionDisplays,
	setV2ExtractionInProgress,
	updateV2ExtractionProgress,
	injectV2Styles,
} from './v2/ui';
// Card Defaults UI
import { initCardDefaultsButton } from './ui/cardDefaultsButton';
import { openCardDefaultsModal } from './ui/cardDefaultsModal';
import { initPersonaDefaultsButtons } from './ui/personaDefaultsButton';

// Use debugLog instead of local log function
const log = debugLog;

// ============================================
// Extraction Guard (persisted in message.extra)
// ============================================
// Prevents duplicate extractions for the same message/swipe.
// Stores which swipes have been extracted in message.extra.blazetracker.extractedSwipes
// This is more robust than in-memory tracking because GENERATION_ENDED can fire
// after our LLM extraction calls complete.

function hasSwipeBeenExtracted(messageId: number, swipeId: number): boolean {
	const context = SillyTavern.getContext() as unknown as STContext;
	const message = context.chat[messageId];
	if (!message?.extra?.[EXTENSION_KEY]) return false;

	const extracted = (message.extra[EXTENSION_KEY] as Record<string, unknown>).extractedSwipes;
	if (!Array.isArray(extracted)) return false;

	return extracted.includes(swipeId);
}

function markSwipeExtracted(messageId: number, swipeId: number): void {
	const context = SillyTavern.getContext() as unknown as STContext;
	const message = context.chat[messageId];
	if (!message) return;

	if (!message.extra) message.extra = {};
	if (!message.extra[EXTENSION_KEY]) message.extra[EXTENSION_KEY] = {};

	const storage = message.extra[EXTENSION_KEY] as Record<string, unknown>;
	if (!Array.isArray(storage.extractedSwipes)) {
		storage.extractedSwipes = [];
	}

	if (!(storage.extractedSwipes as number[]).includes(swipeId)) {
		(storage.extractedSwipes as number[]).push(swipeId);
	}
}

function clearExtractedSwipes(messageId: number): void {
	const context = SillyTavern.getContext() as unknown as STContext;
	const message = context.chat[messageId];
	if (!message?.extra?.[EXTENSION_KEY]) return;

	const storage = message.extra[EXTENSION_KEY] as Record<string, unknown>;
	delete storage.extractedSwipes;
}

// In-memory guard for extraction currently running (prevents concurrent starts)
const extractionInProgress = new Set<string>();

function isExtractionInProgress(messageId: number, swipeId: number): boolean {
	return extractionInProgress.has(`${messageId}-${swipeId}`);
}

function markExtractionStarted(messageId: number, swipeId: number): void {
	extractionInProgress.add(`${messageId}-${swipeId}`);
}

function markExtractionEnded(messageId: number, swipeId: number): void {
	extractionInProgress.delete(`${messageId}-${swipeId}`);
}

// Track manual extraction state (set by fire button/slash commands)
let manualExtractionInProgress = false;

export function isManualExtractionInProgress(): boolean {
	return manualExtractionInProgress;
}

export function setManualExtractionInProgress(value: boolean): void {
	manualExtractionInProgress = value;
}

/**
 * Update v2 injection from the current chat state.
 * Projects state BEFORE the target message for injection into the prompt.
 *
 * @param forMessageId - The message ID we're injecting state FOR (the message being extracted/generated).
 */
function updateV2Injection(forMessageId: number): void {
	const stContext = SillyTavern.getContext() as unknown as STContext;
	const store = getV2EventStore();

	if (!store || !hasV2InitialSnapshot()) {
		v2InjectState(null, null, { getCanonicalSwipeId: () => 0 });
		return;
	}

	// Always project to the message BEFORE the one we're extracting for
	const projectionMessageId = forMessageId - 1;

	if (projectionMessageId < 0) {
		v2InjectState(null, null, { getCanonicalSwipeId: () => 0 });
		return;
	}

	const projection = getProjectionForMessage(projectionMessageId);
	const swipeContext = buildSwipeContext(stContext);

	const settings = getV2Settings();
	v2InjectState(projection, store, swipeContext, {
		includeTime: settings.v2Track.time,
		includeLocation: settings.v2Track.location,
		includeClimate: settings.v2Track.climate,
		includeCharacters: settings.v2Track.characters,
		includeRelationships: settings.v2Track.relationships,
		includeScene: settings.v2Track.scene,
		includeChapters: true,
		includeEvents: settings.v2Track.narrative,
	});
}

async function init() {
	const context = SillyTavern.getContext() as unknown as STContext;

	// Inject V2 CSS
	injectV2Styles();

	// Initialize V2 settings and debug logging
	const v2Settings = await initializeV2Settings();
	setDebugEnabled(v2Settings.v2DebugLogging);

	// Initialize settings UI
	await initSettingsUI();

	// Register slash commands
	registerSlashCommands();

	// Initialize card defaults button for character editor
	initCardDefaultsButton(openCardDefaultsModal);

	// Initialize persona defaults buttons in persona management UI
	initPersonaDefaultsButtons();

	const autoExtract = v2Settings.v2AutoExtract;

	// Hook user messages
	context.eventSource.on(context.event_types.USER_MESSAGE_RENDERED, (async (
		messageId: number,
	) => {
		if (autoExtract) {
			log('Auto-extracting for user message:', messageId);

			// Mark extraction in progress and mount display to show loading
			setV2ExtractionInProgress(messageId, true);
			mountV2ProjectionDisplay(messageId);

			try {
				// Use v2 extraction with progress tracking
				await runV2Extraction(messageId, {
					onProgress: updateV2ExtractionProgress,
				});
			} finally {
				// Mark extraction complete
				setV2ExtractionInProgress(messageId, false);
			}

			// Update v2 displays and injection after extraction
			mountV2ProjectionDisplay(messageId);
			// Set up injection for the NEXT message (the upcoming assistant response)
			updateV2Injection(messageId + 1);
		} else {
			// Just mount v2 display if available
			setTimeout(() => {
				if (hasV2InitialSnapshot()) {
					mountV2ProjectionDisplay(messageId);
				}
			}, 100);
		}
	}) as (...args: unknown[]) => void);

	// Re-extract on message edit
	context.eventSource.on(context.event_types.MESSAGE_EDITED, (async (messageId: number) => {
		const stContext = SillyTavern.getContext() as unknown as STContext;
		const lastIndex = stContext.chat.length - 1;

		// Only re-extract if editing one of the last 2 messages
		if (messageId >= lastIndex - 1 && messageId !== 0) {
			if (autoExtract) {
				const message = stContext.chat[messageId];
				const swipeId = getSwipeId(message);

				// Skip if extraction is already running for this message/swipe
				if (isExtractionInProgress(messageId, swipeId)) {
					log(
						'Skipping MESSAGE_EDITED extraction - already in progress for:',
						messageId,
						swipeId,
					);
					return;
				}

				// Clear the "already extracted" flag so edits can trigger re-extraction
				clearExtractedSwipes(messageId);

				log('Re-extracting for edited message:', messageId);
				markExtractionStarted(messageId, swipeId);

				// Mark extraction in progress and mount display to show loading
				setV2ExtractionInProgress(messageId, true);
				mountV2ProjectionDisplay(messageId);

				try {
					// Use v2 extraction with progress tracking
					const result = await runV2Extraction(messageId, {
						onProgress: updateV2ExtractionProgress,
					});
					// Only mark this swipe as extracted if extraction succeeded (not aborted)
					if (result) {
						markSwipeExtracted(messageId, swipeId);
					}
				} finally {
					// Mark extraction complete (in-memory)
					setV2ExtractionInProgress(messageId, false);
					markExtractionEnded(messageId, swipeId);
				}

				// Update v2 displays and injection after extraction
				// For edits, inject state FOR the edited message (state at messageId - 1)
				mountV2ProjectionDisplay(messageId);
				updateV2Injection(messageId);
			}
		}
	}) as (...args: unknown[]) => void);

	// Handle generation stopped (user clicked stop button)
	context.eventSource.on(context.event_types.GENERATION_STOPPED, (() => {
		debugLog('Generation stopped, aborting any running extraction');
		abortExtraction();
	}) as (...args: unknown[]) => void);

	// Re-render all on generation end (to catch any we missed)
	if (autoExtract) {
		// This ensures the message is fully rendered and DOM is stable
		context.eventSource.on(context.event_types.GENERATION_ENDED, (async (
			_messageId: number,
		) => {
			// Yield to microtask queue - ensures any synchronous
			// GENERATION_STOPPED handlers complete first
			await Promise.resolve();

			// Skip extraction if the generation was aborted
			if (wasExtractionAborted()) {
				log('Generation was aborted, skipping extraction');
				// Still re-mount the display to show the projection for the current swipe
				// (display may have been unmounted by handleSwipe)
				const stContext = SillyTavern.getContext() as unknown as STContext;
				const lastMsgId = stContext.chat.length - 1;
				if (lastMsgId > 0 && hasV2InitialSnapshot()) {
					mountV2ProjectionDisplay(lastMsgId);
				}
				return;
			}

			// Skip if batch extraction is in progress (bt-extract-all)
			if (isBatchExtractionInProgress()) {
				log('Batch extraction in progress, skipping auto-extraction');
				return;
			}

			// Skip if manual extraction is in progress (fire button, slash command)
			if (isManualExtractionInProgress()) {
				log('Manual extraction in progress, skipping auto-extraction');
				return;
			}

			// messageId might not be passed, get the last message
			const stContext = SillyTavern.getContext() as unknown as STContext;
			const lastMessageId = stContext.chat.length - 1;

			if (lastMessageId <= 0) return;

			const message = stContext.chat[lastMessageId];
			// Only extract for AI messages
			if (message.is_user) return;

			const swipeId = getSwipeId(message);

			// Skip if this swipe was already extracted (persisted check)
			// This prevents re-extraction when GENERATION_ENDED fires after our LLM calls
			if (hasSwipeBeenExtracted(lastMessageId, swipeId)) {
				log(
					'Skipping GENERATION_ENDED extraction - swipe already extracted:',
					lastMessageId,
					swipeId,
				);
				return;
			}

			// Skip if extraction is currently running for this message/swipe (in-memory check)
			if (isExtractionInProgress(lastMessageId, swipeId)) {
				log(
					'Skipping GENERATION_ENDED extraction - already in progress for:',
					lastMessageId,
					swipeId,
				);
				return;
			}

			log('Auto-extracting for completed generation:', lastMessageId);
			markExtractionStarted(lastMessageId, swipeId);

			// Mark extraction in progress and mount display to show loading
			setV2ExtractionInProgress(lastMessageId, true);
			mountV2ProjectionDisplay(lastMessageId);

			try {
				// Use v2 extraction with progress tracking
				const result = await runV2Extraction(lastMessageId, {
					onProgress: updateV2ExtractionProgress,
				});
				// Only mark this swipe as extracted if extraction succeeded (not aborted)
				if (result) {
					markSwipeExtracted(lastMessageId, swipeId);
				}
			} finally {
				// Mark extraction complete (in-memory)
				setV2ExtractionInProgress(lastMessageId, false);
				markExtractionEnded(lastMessageId, swipeId);
			}

			// Update v2 displays and injection after extraction
			mountV2ProjectionDisplay(lastMessageId);
			// Set up injection for the next message (after this response)
			updateV2Injection(lastMessageId + 1);
		}) as (...args: unknown[]) => void);
	}

	// Update injection on chat change
	context.eventSource.on(context.event_types.CHAT_CHANGED, (async () => {
		const ctx = SillyTavern.getContext() as unknown as STContext;

		// Reset v2 event store on chat change (loads from storage)
		resetV2EventStore();

		// Clean up events for messages that don't exist in this chat
		// (happens when branching - the branch has fewer messages than the original)
		const lastMessageId = ctx.chat.length - 1;
		if (lastMessageId >= 0 && hasV2InitialSnapshot()) {
			const cleaned = await cleanupV2EventsAfterMessage(lastMessageId);
			if (cleaned) {
				log(
					'Cleaned up v2 events after branch (beyond message',
					lastMessageId,
					')',
				);
			}
		}

		// Clear name resolution cache (user selections don't persist across chats)
		clearNameResolutionCache();

		// Unmount old v2 displays before chat change
		unmountAllV2ProjectionDisplays();

		setTimeout(() => {
			// Mount v2 displays if we have v2 data
			if (hasV2InitialSnapshot()) {
				mountAllV2ProjectionDisplays();
				const lastMsgId = ctx.chat.length - 1;
				// Set up injection for the next message to be generated
				updateV2Injection(lastMsgId + 1);
			}
		}, 100);
	}) as (...args: unknown[]) => void);

	const handleSwipe = async (messageId: number) => {
		log('Swipe detected for message:', messageId);

		const stContext = SillyTavern.getContext() as unknown as STContext;
		const message = stContext.chat[messageId];
		const swipeId = getSwipeId(message);

		log('Current swipe_id for message', messageId, 'is', swipeId);

		if (hasV2InitialSnapshot()) {
			// Unmount and remount to show projection for the new swipe
			unmountV2ProjectionDisplay(messageId);
			mountV2ProjectionDisplay(messageId);
			// For swipes, inject state FOR the swiped message (state at messageId - 1)
			updateV2Injection(messageId);
		}
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
				// Delay to let ST update the swipe data
				setTimeout(() => handleSwipe(messageId), 100);
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
				setTimeout(() => handleSwipe(messageId), 100);
			}
		}) as (...args: unknown[]) => void);
		log('SWIPE_CHANGED handler registered');
	}

	// Handle message deletion
	context.eventSource.on(context.event_types.MESSAGE_DELETED, (async (data: any) => {
		const messageId =
			typeof data === 'number'
				? data
				: (data?.message ?? data?.messageId ?? data?.id);

		if (typeof messageId !== 'number') return;

		log('Message deleted:', messageId);

		// Delete v2 events for this message
		if (hasV2InitialSnapshot()) {
			await deleteV2EventsForMessage(messageId);
			log('Cleared v2 events for deleted message:', messageId);
		}

		// Update v2 displays
		if (hasV2InitialSnapshot()) {
			unmountV2ProjectionDisplay(messageId);
			mountAllV2ProjectionDisplays();
			const stContext = SillyTavern.getContext() as unknown as STContext;
			const lastMsgId = stContext.chat.length - 1;
			// Set up injection for the next message after deletion
			updateV2Injection(lastMsgId + 1);
		}
	}) as (...args: unknown[]) => void);
	log('MESSAGE_DELETED handler registered');

	// Handle swipe deletion
	context.eventSource.on(context.event_types.MESSAGE_SWIPE_DELETED, (async (data: any) => {
		const messageId = data?.message ?? data?.messageId;
		const swipeId = data?.swipe ?? data?.swipeId ?? data?.swipe_id;

		if (typeof messageId !== 'number' || typeof swipeId !== 'number') return;

		log('Swipe deleted:', messageId, swipeId);

		// Delete v2 events for this specific swipe
		if (hasV2InitialSnapshot()) {
			await deleteV2EventsForSwipe(messageId, swipeId);
			log('Cleared v2 events for deleted swipe:', messageId, swipeId);
		}

		// Re-render displays
		if (hasV2InitialSnapshot()) {
			mountV2ProjectionDisplay(messageId);
			const stContext = SillyTavern.getContext() as unknown as STContext;
			const lastMsgId = stContext.chat.length - 1;
			// Set up injection for the next message
			updateV2Injection(lastMsgId + 1);
		}
	}) as (...args: unknown[]) => void);
	log('MESSAGE_SWIPE_DELETED handler registered');

	log('Event hooks registered.');
}

// Wait for DOM/ST to be ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init);
} else {
	init();
}
