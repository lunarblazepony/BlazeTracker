import type { STContext } from './types/st';
import {
	setupExtractionAbortHandler,
	wasGenerationAborted,
	isBatchExtractionInProgress,
} from './extractors/extractState';
import { initSettingsUI } from './ui/settingsUI';
import {
	initStateDisplay,
	injectStyles,
	renderMessageState,
	renderAllStates,
	doExtractState,
	isManualExtractionInProgress,
	unmountAllRoots,
} from './ui/stateDisplay';
import { settingsManager, getSettings } from './settings';
import { updateInjectionFromChat } from './injectors/injectState';
import { EXTENSION_KEY } from './constants';
import { getMessageState } from './utils/messageState';
import { migrateOldTimeFormats } from './migrations/migrateOldTime';
import { registerSlashCommands, runExtractAll } from './commands/slashCommands';
import {
	getNarrativeState,
	getOrInitializeNarrativeState,
	initializeNarrativeState,
	setNarrativeState,
	saveNarrativeState,
} from './state/narrativeState';
import {
	clearEventsForMessage,
	invalidateProjectionsFrom,
	invalidateSnapshotsFrom,
} from './state/eventStore';
import { isUnifiedEventStore } from './types/state';
import { getSwipeId } from './utils/messageState';
import { st_echo } from 'sillytavern-utils-lib/config';
// Debug utilities
import { debugLog, setDebugEnabled } from './utils/debug';
// V2 Settings
import { initializeV2Settings } from './v2/settings';
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
	const context = SillyTavern.getContext() as STContext;
	const message = context.chat[messageId];
	if (!message?.extra?.[EXTENSION_KEY]) return false;

	const extracted = (message.extra[EXTENSION_KEY] as Record<string, unknown>).extractedSwipes;
	if (!Array.isArray(extracted)) return false;

	return extracted.includes(swipeId);
}

function markSwipeExtracted(messageId: number, swipeId: number): void {
	const context = SillyTavern.getContext() as STContext;
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
	const context = SillyTavern.getContext() as STContext;
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

/**
 * Update v2 injection from the current chat state.
 * Projects state BEFORE the target message for injection into the prompt.
 *
 * @param forMessageId - The message ID we're injecting state FOR (the message being extracted/generated).
 */
function updateV2Injection(forMessageId: number): void {
	const stContext = SillyTavern.getContext() as STContext;
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

	const settings = getSettings();
	v2InjectState(projection, store, swipeContext, {
		includeTime: settings.trackTime ?? true,
		includeLocation: settings.trackLocation ?? true,
		includeClimate: settings.trackClimate ?? true,
		includeCharacters: settings.trackCharacters ?? true,
		includeRelationships: settings.trackRelationships ?? true,
		includeScene: settings.trackScene ?? true,
		includeChapters: true,
		includeEvents: settings.trackEvents ?? true,
	});
}

/**
 * Check if chat has legacy BlazeTracker data without narrative state.
 * This indicates the ancient format that needs full re-extraction.
 */
function hasLegacyDataWithoutNarrativeState(context: STContext): boolean {
	// If there's already a narrative state, we're good
	const narrativeState = getNarrativeState();
	if (narrativeState) {
		return false;
	}

	// Check if any messages have old BlazeTracker data
	for (const message of context.chat) {
		if (message.extra?.[EXTENSION_KEY]) {
			return true;
		}
	}

	return false;
}

/**
 * Show popup offering migration options when legacy data is detected.
 */
async function showLegacyDataPopup(context: STContext): Promise<void> {
	return new Promise(resolve => {
		const container = document.createElement('div');
		container.innerHTML = `
			<div style="padding: 10px;">
				<p style="margin-bottom: 15px;">
					<strong>🔥 BlazeTracker: Outdated Data Detected</strong>
				</p>
				<p style="margin-bottom: 15px;">
					This chat has tracker data from an older version that is no longer compatible.
				</p>
				<div style="display: flex; flex-direction: column; gap: 10px;">
					<button id="bt-migrate-all" class="menu_button" style="padding: 10px; width: 100%;">
						<strong>Re-extract All State</strong> (slow, accurate)
						<br><small>Rebuild state for every message. Best for important chats.</small>
					</button>
					<button id="bt-migrate-recent" class="menu_button" style="padding: 10px; width: 100%;">
						<strong>Re-extract Recent State</strong> (fast)
						<br><small>Only extract the latest message. Good enough for most cases.</small>
					</button>
					<button id="bt-migrate-empty" class="menu_button" style="padding: 10px; width: 100%;">
						<strong>Initialize Empty State</strong>
						<br><small style="color: #f59e0b;">⚠️ Discards old data. State will build from new messages.</small>
					</button>
				</div>
			</div>
		`;

		// Show as TEXT popup (no buttons) - we provide our own
		context.callGenericPopup(container, context.POPUP_TYPE.TEXT, null, {
			wide: true,
		});

		// Wire up button handlers
		const handleMigrateAll = async () => {
			cleanup();
			log('User chose to re-extract all messages');
			st_echo?.('info', '🔥 Starting full re-extraction...');

			// Unmount all roots first to prevent stale UI
			unmountAllRoots();

			const state = initializeNarrativeState();
			setNarrativeState(state);
			clearAllPerMessageState(context);
			await context.saveChat();

			const { extracted, failed } = await runExtractAll();
			st_echo?.(
				'success',
				`🔥 Re-extraction complete: ${extracted} extracted, ${failed} failed`,
			);
			resolve();
		};

		const handleMigrateRecent = async () => {
			cleanup();
			log('User chose to re-extract recent message only');
			st_echo?.('info', '🔥 Re-extracting recent state...');

			// Unmount all roots first to prevent stale UI
			unmountAllRoots();

			const state = initializeNarrativeState();
			setNarrativeState(state);
			clearAllPerMessageState(context);
			await context.saveChat();

			// Just extract the most recent message
			const lastMessageId = context.chat.length - 1;
			if (lastMessageId > 0) {
				await doExtractState(lastMessageId);
			}

			renderAllStates();
			st_echo?.('success', '🔥 Recent state extracted');
			resolve();
		};

		const handleMigrateEmpty = async () => {
			cleanup();
			log('User chose to initialize empty state');

			// Unmount all roots first to prevent stale UI
			unmountAllRoots();

			const state = initializeNarrativeState();
			setNarrativeState(state);
			// Don't clear per-message state - just let it be ignored
			await context.saveChat();

			renderAllStates();
			st_echo?.('info', '🔥 Initialized with empty state');
			resolve();
		};

		const cleanup = () => {
			// Close the popup
			(document.querySelector('.popup-button-ok') as HTMLElement)?.click();
		};

		// Add event listeners after a tick to ensure DOM is ready
		setTimeout(() => {
			document.getElementById('bt-migrate-all')?.addEventListener(
				'click',
				handleMigrateAll,
			);
			document.getElementById('bt-migrate-recent')?.addEventListener(
				'click',
				handleMigrateRecent,
			);
			document.getElementById('bt-migrate-empty')?.addEventListener(
				'click',
				handleMigrateEmpty,
			);
		}, 0);
	});
}

/**
 * Clear all per-message BlazeTracker state.
 */
function clearAllPerMessageState(context: STContext): void {
	for (let i = 0; i < context.chat.length; i++) {
		const message = context.chat[i];
		if (message.extra && message.extra[EXTENSION_KEY]) {
			delete message.extra[EXTENSION_KEY];
		}
	}
}

async function init() {
	const context = SillyTavern.getContext();

	// Inject CSS first
	injectStyles();

	// Initialize V2 settings and debug logging
	const v2Settings = await initializeV2Settings();
	setDebugEnabled(v2Settings.v2DebugLogging);

	// Initialize V1 settings (for backward compatibility during migration)
	await settingsManager.initializeSettings();
	await initSettingsUI();

	// Initialize state display (handles chat change)
	initStateDisplay();
	setupExtractionAbortHandler();

	// Register slash commands
	registerSlashCommands();

	// Initialize card defaults button for character editor
	initCardDefaultsButton(openCardDefaultsModal);

	// Initialize persona defaults buttons in persona management UI
	initPersonaDefaultsButtons();

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
			// Just render existing state (or nothing)
			setTimeout(() => {
				renderMessageState(messageId);
				// Also mount v2 display if available
				if (hasV2InitialSnapshot()) {
					mountV2ProjectionDisplay(messageId);
				}
			}, 100);
		}
	}) as (...args: unknown[]) => void);

	// Re-extract on message edit
	context.eventSource.on(context.event_types.MESSAGE_EDITED, (async (messageId: number) => {
		const stContext = SillyTavern.getContext() as STContext;
		const lastIndex = stContext.chat.length - 1;

		// Only re-extract if editing one of the last 2 messages
		if (messageId >= lastIndex - 1 && messageId !== 0) {
			if (autoExtractResponses || autoExtractInputs) {
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
				// Still re-mount the display to show the projection for the current swipe
				// (display may have been unmounted by handleSwipe)
				const stContext = SillyTavern.getContext() as STContext;
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
			const stContext = SillyTavern.getContext() as STContext;
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
		const ctx = SillyTavern.getContext() as STContext;
		const settings = getSettings();

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

		// Check for ancient legacy data that needs full re-extraction
		if (hasLegacyDataWithoutNarrativeState(ctx)) {
			log('Detected legacy BlazeTracker data without narrative state');
			// Show popup - don't await, let it run in background
			showLegacyDataPopup(ctx);
		} else {
			// Ensure narrative state is migrated to latest version
			getOrInitializeNarrativeState();
		}

		// Run time format migration
		if (settings.profileId) {
			await migrateOldTimeFormats(ctx, settings.profileId);
		}

		setTimeout(() => {
			// Render legacy state displays
			renderAllStates();
			updateInjectionFromChat();

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

		const stContext = SillyTavern.getContext() as STContext;
		const message = stContext.chat[messageId];
		const swipeId = getSwipeId(message);

		log('Current swipe_id for message', messageId, 'is', swipeId);

		// Handle event store invalidation for unified stores
		const narrativeState = getNarrativeState();
		const store = narrativeState?.eventStore;

		if (narrativeState && isUnifiedEventStore(store)) {
			// Clear events for this message (they belong to the old swipe)
			clearEventsForMessage(store, messageId);

			// Invalidate projections and snapshots from this point onward
			invalidateProjectionsFrom(store, messageId);
			invalidateSnapshotsFrom(store, messageId);

			// Save the updated narrative state
			await saveNarrativeState(narrativeState);

			log('Cleared events for swipe, invalidated projections from', messageId);
		}

		// Re-read the message state after clearing (in case ST has updated)
		const existingState = getMessageState(message);

		if (existingState) {
			// This swipe already has state, render it
			log('State exists for this swipe:', swipeId);
		} else {
			// No state - either new generation in progress or old unextracted swipe
			log('No state for this swipe:', swipeId);
		}

		// Re-render all states to ensure narrative modal gets fresh data
		renderAllStates();
		updateInjectionFromChat();

		// Unmount v2 display for this message on swipe
		// The loading indicator will mount when generation ends and extraction starts
		if (hasV2InitialSnapshot()) {
			unmountV2ProjectionDisplay(messageId);
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

		// Delete v1 events for this message
		const narrativeState = getNarrativeState();
		const store = narrativeState?.eventStore;

		if (narrativeState && isUnifiedEventStore(store)) {
			clearEventsForMessage(store, messageId);
			invalidateProjectionsFrom(store, messageId);
			invalidateSnapshotsFrom(store, messageId);
			await saveNarrativeState(narrativeState);
			log('Cleared v1 events for deleted message:', messageId);
		}

		// Delete v2 events for this message
		if (hasV2InitialSnapshot()) {
			await deleteV2EventsForMessage(messageId);
			log('Cleared v2 events for deleted message:', messageId);
		}

		// Re-render all states
		renderAllStates();
		updateInjectionFromChat();

		// Update v2 displays
		if (hasV2InitialSnapshot()) {
			unmountV2ProjectionDisplay(messageId);
			mountAllV2ProjectionDisplays();
			const stContext = SillyTavern.getContext() as STContext;
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
		renderAllStates();
		updateInjectionFromChat();

		if (hasV2InitialSnapshot()) {
			mountV2ProjectionDisplay(messageId);
			const stContext = SillyTavern.getContext() as STContext;
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
