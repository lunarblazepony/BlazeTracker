// ============================================
// BlazeTracker Slash Commands (STScript)
// ============================================

import type { STContext } from '../types/st';
import type { TrackedState, NarrativeDateTime } from '../types/state';
import { EXTENSION_NAME } from '../constants';
import {
	doExtractState,
	renderMessageState,
	renderAllStates,
	unmountAllRoots,
	extractionInProgress,
} from '../ui/stateDisplay';
import { setBatchExtractionInProgress } from '../extractors/extractState';
import { getMessageState, setMessageState } from '../utils/messageState';
import { updateInjectionFromChat } from '../injectors/injectState';
import {
	getOrInitializeNarrativeState,
	saveNarrativeState,
	addChapter,
	getNarrativeState,
	initializeNarrativeState,
	setNarrativeState,
} from '../state/narrativeState';
import { EXTENSION_KEY } from '../constants';
import { extractChapterBoundary } from '../extractors/extractChapter';
import {
	getMostRecentMessageId,
	getStateForMessage,
	countExtractedMessages,
	getLastExtractedMessageId,
} from './helpers';
import {
	clearV2EventStore,
	runV2ExtractionAll,
	runV2Extraction,
	getV2EventStore,
	hasV2InitialSnapshot,
	getExtractionAbortController,
	resetAbortController,
	getV2EventStoreForEditor,
	buildSwipeContext,
	abortExtraction,
} from '../v2Bridge';
import {
	unmountAllV2ProjectionDisplays,
	mountV2ProjectionDisplay,
	setV2ExtractionInProgress,
	updateV2ExtractionProgress,
} from '../v2/ui/mountV2Display';
import { openEventStoreModal } from './eventStoreModal';

// Slash command types are retrieved from SillyTavern context at registration time

function log(..._args: unknown[]) {
	// Logging disabled for production
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get default time for chapter extraction.
 */
function getDefaultTime(): NarrativeDateTime {
	return {
		year: 2024,
		month: 1,
		day: 1,
		dayOfWeek: 'Monday',
		hour: 12,
		minute: 0,
		second: 0,
	};
}

// ============================================
// Command: /bt-extract (V2)
// ============================================

async function extractCommand(args: Record<string, unknown>, _value: string): Promise<string> {
	const context = SillyTavern.getContext() as STContext;

	// Link ST's abort controller to BlazeTracker's internal abort
	// Note: ST's SlashCommandAbortController fires 'abort' on the controller itself, not on signal
	const stAbortController = args._abortController as
		| { addEventListener: (type: string, listener: () => void) => void }
		| undefined;
	if (stAbortController) {
		stAbortController.addEventListener('abort', () => {
			abortExtraction();
		});
	}

	// Parse message ID from args or use most recent
	let messageId: number;
	const idArg = args.id as string | undefined;
	if (idArg !== undefined && idArg !== '') {
		messageId = parseInt(idArg, 10);
		if (isNaN(messageId) || messageId < 0 || messageId >= context.chat.length) {
			return `Error: Invalid message ID "${idArg}". Valid range: 0-${context.chat.length - 1}`;
		}
	} else {
		messageId = getMostRecentMessageId(context);
	}

	if (messageId <= 0) {
		return 'Error: No messages to extract (chat is empty or only has system message)';
	}

	log('Slash command: V2 extracting state for message', messageId);

	// Mark extraction in progress and mount display to show loading
	setV2ExtractionInProgress(messageId, true);
	mountV2ProjectionDisplay(messageId);

	// Set batch flag to prevent GENERATION_ENDED handler from interfering
	setBatchExtractionInProgress(true);

	try {
		const result = await runV2Extraction(messageId, {
			onProgress: updateV2ExtractionProgress,
			isManual: true,
		});

		if (result) {
			mountV2ProjectionDisplay(messageId);
			return `Successfully extracted state for message ${messageId}`;
		} else {
			return `Extraction returned no result for message ${messageId} (may have been aborted or already in progress)`;
		}
	} catch (e: any) {
		log('Extraction error:', e);
		return `Error extracting state: ${e.message}`;
	} finally {
		setV2ExtractionInProgress(messageId, false);
		mountV2ProjectionDisplay(messageId);
		resetAbortController();
		// Delay clearing batch flag to ensure GENERATION_ENDED handler sees it
		setTimeout(() => setBatchExtractionInProgress(false), 100);
	}
}

// ============================================
// Command: /bt-deprecated-extract (V1)
// ============================================

async function deprecatedExtractCommand(
	args: Record<string, string>,
	_value: string,
): Promise<string> {
	const context = SillyTavern.getContext() as STContext;

	// Parse message ID from args or use most recent
	let messageId: number;
	if (args.id !== undefined && args.id !== '') {
		messageId = parseInt(args.id, 10);
		if (isNaN(messageId) || messageId < 0 || messageId >= context.chat.length) {
			return `Error: Invalid message ID "${args.id}". Valid range: 0-${context.chat.length - 1}`;
		}
	} else {
		messageId = getMostRecentMessageId(context);
	}

	if (messageId <= 0) {
		return 'Error: No messages to extract (chat is empty or only has system message)';
	}

	log('Slash command: extracting state for message', messageId);

	// Note: Milestone clearing for re-extraction happens inside doExtractState
	// so it applies to all extraction triggers (swiping, editing, fire button, etc.)

	try {
		const result = await doExtractState(messageId, { isManual: true });

		if (result) {
			updateInjectionFromChat();
			return `Successfully extracted state for message ${messageId}`;
		} else {
			return `Extraction returned no result for message ${messageId} (may have been aborted or already in progress)`;
		}
	} catch (e: any) {
		log('Extraction error:', e);
		return `Error extracting state: ${e.message}`;
	}
}

// ============================================
// Command: /bt-deprecated-chapter (V1)
// ============================================

async function deprecatedChapterCommand(
	args: Record<string, string>,
	_value: string,
): Promise<string> {
	const context = SillyTavern.getContext() as STContext;
	const lastMessageId = getMostRecentMessageId(context);

	if (lastMessageId <= 0) {
		return 'Error: No messages in chat';
	}

	// Get the current state
	const message = context.chat[lastMessageId];
	let stateData = getMessageState(message);

	// If no state, run extraction first
	if (!stateData?.state) {
		if (extractionInProgress.has(lastMessageId)) {
			return 'Error: Extraction already in progress for this message. Please wait.';
		}

		const extractResult = await doExtractState(lastMessageId, { isManual: true });
		if (!extractResult?.state) {
			return 'Error: Failed to extract state for the most recent message.';
		}
		stateData = extractResult;
	}

	const state = stateData.state;
	const currentEvents = state.currentEvents ?? [];

	if (currentEvents.length === 0) {
		return 'Error: No events in current chapter to finalize. Need at least one event.';
	}

	const narrativeState = getOrInitializeNarrativeState();
	const currentChapter = state.currentChapter ?? 0;

	// Get time range from events
	const startTime = currentEvents[0]?.timestamp ?? state.time ?? getDefaultTime();
	const endTime = state.time ?? getDefaultTime();
	const primaryLocation = state.location
		? `${state.location.area} - ${state.location.place}`
		: 'Unknown';

	log('Slash command: forcing chapter break at chapter', currentChapter);

	try {
		// Extract chapter summary via LLM (force create since this is an explicit command)
		const chapterResult = await extractChapterBoundary({
			events: currentEvents,
			narrativeState,
			chapterIndex: currentChapter,
			startTime,
			endTime,
			primaryLocation,
			forceCreate: true,
		});

		if (!chapterResult.chapter) {
			return 'Error: Failed to generate chapter summary';
		}

		// Allow title override
		if (args.title) {
			chapterResult.chapter.title = args.title;
		}

		// Add chapter to narrative state
		addChapter(narrativeState, chapterResult.chapter);
		await saveNarrativeState(narrativeState);

		// Update the message state - increment chapter, clear events, show chapter ended
		const updatedState: TrackedState = {
			...state,
			currentChapter: currentChapter + 1,
			currentEvents: undefined,
			chapterEnded: {
				index: currentChapter,
				title: chapterResult.chapter.title,
				summary: chapterResult.chapter.summary,
				eventCount: currentEvents.length,
				reason: 'manual',
			},
		};

		const newStateData = {
			state: updatedState,
			extractedAt: new Date().toISOString(),
		};

		setMessageState(message, newStateData);
		await context.saveChat();

		// Re-render the state display with the new state data
		renderMessageState(lastMessageId, newStateData);
		updateInjectionFromChat();

		return `Chapter ${currentChapter + 1} created: "${chapterResult.chapter.title}" (${currentEvents.length} events archived)`;
	} catch (e: any) {
		log('Chapter creation error:', e);
		return `Error creating chapter: ${e.message}`;
	}
}

// ============================================
// Command: /bt-deprecated-extract-all (V1)
// ============================================

async function deprecatedExtractAllCommand(
	_args: Record<string, string>,
	_value: string,
): Promise<string> {
	const context = SillyTavern.getContext() as STContext;

	const totalMessages = context.chat.length;

	if (totalMessages <= 1) {
		return 'Error: No messages to extract (chat is empty or only has system message)';
	}

	// Get current state info for confirmation message
	const currentNarrativeState = getNarrativeState();
	const chapterCount = currentNarrativeState?.chapters.length ?? 0;
	const relationshipCount = currentNarrativeState?.relationships.length ?? 0;

	// Show confirmation popup
	const confirmMessage =
		`This will DELETE all BlazeTracker data FOR THIS CHAT and re-extract from scratch:\n\n` +
		`• ${chapterCount} chapter(s)\n` +
		`• ${relationshipCount} relationship(s) (including all milestones)\n` +
		`• All per-message state data\n\n` +
		`Other chats are not affected. This cannot be undone. Continue?`;

	const confirmed =
		(await (context as any).callGenericPopup?.(confirmMessage, 1 /* CONFIRM */)) ??
		window.confirm(confirmMessage);

	if (!confirmed) {
		return 'Extraction cancelled.';
	}

	log('Slash command: extracting all messages');

	// Unmount all roots first to prevent stale UI during extraction
	unmountAllRoots();

	// Clear all existing state before starting
	log('Clearing all existing BlazeTracker state...');

	// 1. Reset narrative state (chapters, relationships)
	const freshNarrativeState = initializeNarrativeState();
	setNarrativeState(freshNarrativeState);

	// 2. Clear all per-message states
	for (let i = 1; i < totalMessages; i++) {
		const message = context.chat[i];
		if (message.extra && message.extra[EXTENSION_KEY]) {
			delete message.extra[EXTENSION_KEY];
		}
	}

	// Save the cleared state
	await context.saveChat();
	log('All state cleared, starting fresh extraction...');

	let extracted = 0;
	let failed = 0;

	// Set batch flag to prevent GENERATION_ENDED handler from interfering
	setBatchExtractionInProgress(true);

	try {
		// Start from message 1 (skip system message at 0)
		for (let i = 1; i < totalMessages; i++) {
			try {
				// Show progress via toastr if available
				window.toastr?.info(
					`Extracting message ${i}/${totalMessages - 1}...`,
					EXTENSION_NAME,
					{ timeOut: 1000 },
				);

				const result = await doExtractState(i);

				if (result) {
					extracted++;
				} else {
					failed++;
				}
			} catch (e: any) {
				log(`Failed to extract message ${i}:`, e);
				failed++;
			}
		}
	} finally {
		// Always clear the batch flag when done
		setBatchExtractionInProgress(false);
	}

	// Final update
	renderAllStates();
	updateInjectionFromChat();

	const results: string[] = [];
	if (extracted > 0) results.push(`${extracted} extracted`);
	if (failed > 0) results.push(`${failed} failed`);

	return `Extraction complete (full reset): ${results.join(', ')}`;
}

/**
 * Run extraction on all messages (used by legacy data migration).
 * Assumes state has already been cleared/initialized.
 */
export async function runExtractAll(): Promise<{ extracted: number; failed: number }> {
	const context = SillyTavern.getContext() as STContext;
	const totalMessages = context.chat.length;

	let extracted = 0;
	let failed = 0;

	// Set batch flag to prevent GENERATION_ENDED handler from interfering
	setBatchExtractionInProgress(true);

	try {
		// Start from message 1 (skip system message at 0)
		for (let i = 1; i < totalMessages; i++) {
			try {
				window.toastr?.info(
					`Extracting message ${i}/${totalMessages - 1}...`,
					EXTENSION_NAME,
					{ timeOut: 1000 },
				);

				const result = await doExtractState(i);

				if (result) {
					extracted++;
				} else {
					failed++;
				}
			} catch (e: any) {
				log(`Failed to extract message ${i}:`, e);
				failed++;
			}
		}
	} finally {
		setBatchExtractionInProgress(false);
	}

	// Final update
	renderAllStates();
	updateInjectionFromChat();

	return { extracted, failed };
}

// ============================================
// Command: /bt-deprecated-extract-remaining (V1)
// ============================================

async function deprecatedCatchupCommand(
	_args: Record<string, string>,
	_value: string,
): Promise<string> {
	const context = SillyTavern.getContext() as STContext;

	const totalMessages = context.chat.length;

	if (totalMessages <= 1) {
		return 'Error: No messages to extract (chat is empty or only has system message)';
	}

	// Find the last extracted message
	const lastExtractedId = getLastExtractedMessageId(context);

	// Determine starting point
	const startId = lastExtractedId === -1 ? 1 : lastExtractedId + 1;

	// Check if there's anything to extract
	if (startId >= totalMessages) {
		return 'Already caught up! All messages have been extracted.';
	}

	const messagesToExtract = totalMessages - startId;

	log('Slash command: catching up from message', startId);

	let extracted = 0;
	let failed = 0;

	// Set batch flag to prevent GENERATION_ENDED handler from interfering
	setBatchExtractionInProgress(true);

	try {
		for (let i = startId; i < totalMessages; i++) {
			try {
				// Show progress via toastr if available
				window.toastr?.info(
					`Extracting message ${i - startId + 1}/${messagesToExtract}...`,
					EXTENSION_NAME,
					{ timeOut: 1000 },
				);

				const result = await doExtractState(i);

				if (result) {
					extracted++;
				} else {
					failed++;
				}
			} catch (e: any) {
				log(`Failed to extract message ${i}:`, e);
				failed++;
			}
		}
	} finally {
		// Always clear the batch flag when done
		setBatchExtractionInProgress(false);
	}

	// Final update
	renderAllStates();
	updateInjectionFromChat();

	const results: string[] = [];
	if (extracted > 0) results.push(`${extracted} extracted`);
	if (failed > 0) results.push(`${failed} failed`);

	const startInfo = lastExtractedId === -1 ? 'from start' : `from message ${startId}`;
	return `Catchup complete (${startInfo}): ${results.join(', ')}`;
}

// ============================================
// Command: /bt-extract-all (V2)
// ============================================

async function extractAllCommand(args: Record<string, unknown>, _value: string): Promise<string> {
	const context = SillyTavern.getContext() as STContext;

	// Link ST's abort controller to BlazeTracker's internal abort
	// Note: ST's SlashCommandAbortController fires 'abort' on the controller itself, not on signal
	const stAbortController = args._abortController as
		| { addEventListener: (type: string, listener: () => void) => void }
		| undefined;
	if (stAbortController) {
		stAbortController.addEventListener('abort', () => {
			abortExtraction();
		});
	}

	const totalMessages = context.chat.length;

	if (totalMessages <= 1) {
		return 'Error: No messages to extract (chat is empty or only has system message)';
	}

	// Show confirmation popup
	const confirmMessage =
		`This will run extraction on all messages.\n\n` +
		`This will clear any existing state data.\n\n` +
		`Messages: ${totalMessages - 1}\n\n` +
		`Continue?`;

	const confirmed =
		(await (context as any).callGenericPopup?.(confirmMessage, 1 /* CONFIRM */)) ??
		window.confirm(confirmMessage);

	if (!confirmed) {
		return 'Extraction cancelled.';
	}

	log('Slash command: running extraction on all messages');

	// Clear existing v2 state
	await clearV2EventStore();

	// Clear v1 state from all messages and unmount v1 displays
	unmountAllRoots();
	for (let i = 1; i < totalMessages; i++) {
		const message = context.chat[i];
		if (message.extra && message.extra[EXTENSION_KEY]) {
			delete message.extra[EXTENSION_KEY];
		}
	}

	// Clear v1 narrative state
	const freshNarrativeState = initializeNarrativeState();
	setNarrativeState(freshNarrativeState);

	// Save the cleared state
	await context.saveChat();

	// Unmount any existing v2 displays
	unmountAllV2ProjectionDisplays();

	let extracted = 0;
	let failed = 0;
	let aborted = false;

	// Get abort controller for this extraction run
	const abortController = getExtractionAbortController();

	// Set batch flag to prevent GENERATION_ENDED handler from interfering
	setBatchExtractionInProgress(true);

	try {
		const result = await runV2ExtractionAll(1, {
			onProgress: progress => {
				// Update the extraction progress display
				updateV2ExtractionProgress(progress);
			},
			onMessageStart: (messageId: number) => {
				// Set extraction state and mount the loading display
				setV2ExtractionInProgress(messageId, true);
				mountV2ProjectionDisplay(messageId);
			},
			onMessageEnd: (messageId: number) => {
				// Clear extraction state and re-mount with the result
				setV2ExtractionInProgress(messageId, false);
				mountV2ProjectionDisplay(messageId);
			},
		});

		extracted = result.extracted;
		failed = result.failed;

		// Check if aborted
		if (abortController.signal.aborted) {
			aborted = true;
		}
	} catch (e: any) {
		if (e.name === 'AbortError' || abortController.signal.aborted) {
			aborted = true;
		} else {
			log('Extraction error:', e);
			return `Error during extraction: ${e.message}`;
		}
	} finally {
		resetAbortController();
		// Delay clearing batch flag to ensure GENERATION_ENDED handler sees it
		setTimeout(() => setBatchExtractionInProgress(false), 100);
	}

	const results: string[] = [];
	if (extracted > 0) results.push(`${extracted} extracted`);
	if (failed > 0) results.push(`${failed} failed`);
	if (aborted) results.push('aborted');

	return `Extraction complete: ${results.join(', ')}`;
}

// ============================================
// Command: /bt-extract-remaining (V2)
// ============================================

async function extractRemainingCommand(
	args: Record<string, unknown>,
	_value: string,
): Promise<string> {
	const context = SillyTavern.getContext() as STContext;

	// Link ST's abort controller to BlazeTracker's internal abort
	// Note: ST's SlashCommandAbortController fires 'abort' on the controller itself, not on signal
	const stAbortController = args._abortController as
		| { addEventListener: (type: string, listener: () => void) => void }
		| undefined;
	if (stAbortController) {
		stAbortController.addEventListener('abort', () => {
			abortExtraction();
		});
	}

	const totalMessages = context.chat.length;

	if (totalMessages <= 1) {
		return 'Error: No messages to extract (chat is empty or only has system message)';
	}

	// Find the last message with v2 events
	const store = getV2EventStore();
	let lastExtractedId = -1;

	if (hasV2InitialSnapshot()) {
		// Find the highest message ID with events
		const messageIds = store.getMessageIdsWithEvents();
		if (messageIds.length > 0) {
			lastExtractedId = messageIds[messageIds.length - 1];
		}
	}

	// Determine starting point
	const startId = lastExtractedId === -1 ? 1 : lastExtractedId + 1;

	// Check if there's anything to extract
	if (startId >= totalMessages) {
		return 'Already caught up! All messages have been extracted.';
	}

	log('Slash command: extracting remaining messages from', startId);

	let extracted = 0;
	let failed = 0;
	let aborted = false;

	// Get abort controller for this extraction run
	const abortController = getExtractionAbortController();

	// Set batch flag to prevent GENERATION_ENDED handler from interfering
	setBatchExtractionInProgress(true);

	try {
		const result = await runV2ExtractionAll(startId, {
			onProgress: progress => {
				updateV2ExtractionProgress(progress);
			},
			onMessageStart: (messageId: number) => {
				setV2ExtractionInProgress(messageId, true);
				mountV2ProjectionDisplay(messageId);
			},
			onMessageEnd: (messageId: number) => {
				setV2ExtractionInProgress(messageId, false);
				mountV2ProjectionDisplay(messageId);
			},
		});

		extracted = result.extracted;
		failed = result.failed;

		// Check if aborted
		if (abortController.signal.aborted) {
			aborted = true;
		}
	} catch (e: any) {
		if (e.name === 'AbortError' || abortController.signal.aborted) {
			aborted = true;
		} else {
			log('Extraction error:', e);
			return `Error during extraction: ${e.message}`;
		}
	} finally {
		resetAbortController();
		// Delay clearing batch flag to ensure GENERATION_ENDED handler sees it
		setTimeout(() => setBatchExtractionInProgress(false), 100);
	}

	const results: string[] = [];
	if (extracted > 0) results.push(`${extracted} extracted`);
	if (failed > 0) results.push(`${failed} failed`);
	if (aborted) results.push('aborted');

	const startInfo = lastExtractedId === -1 ? 'from start' : `from message ${startId}`;
	return `Extraction complete (${startInfo}): ${results.join(', ')}`;
}

// ============================================
// Command: /bt-event-store
// ============================================

async function eventStoreCommand(_args: Record<string, string>, _value: string): Promise<string> {
	const store = getV2EventStoreForEditor();

	if (!store) {
		return 'Error: No event store available. Run /bt-extract-all first.';
	}

	const context = SillyTavern.getContext() as STContext;
	const swipeContext = buildSwipeContext(context);

	// Open the event store modal
	openEventStoreModal(store, swipeContext);

	return '';
}

// ============================================
// Command: /bt-status
// ============================================

async function statusCommand(_args: Record<string, string>, _value: string): Promise<string> {
	const context = SillyTavern.getContext() as STContext;
	const { extracted, total } = countExtractedMessages(context);
	const narrativeState = getNarrativeState();

	// Build status rows
	const rows: Array<{ label: string; value: string }> = [
		{ label: 'Messages Extracted', value: `${extracted} / ${total}` },
	];

	if (narrativeState) {
		rows.push({ label: 'Chapters', value: String(narrativeState.chapters.length) });
		rows.push({
			label: 'Relationships',
			value: String(narrativeState.relationships.length),
		});
	} else {
		rows.push({ label: 'Narrative State', value: 'Not initialized' });
	}

	// Get current events from most recent state
	const lastMessageId = getMostRecentMessageId(context);
	if (lastMessageId > 0) {
		const state = getStateForMessage(context, lastMessageId);
		if (state?.currentEvents) {
			rows.push({
				label: 'Current Chapter Events',
				value: String(state.currentEvents.length),
			});
		}
	}

	// Create popup content
	const container = document.createElement('div');
	container.innerHTML = `
		<div style="padding: 15px; min-width: 300px;">
			<h3 style="margin: 0 0 15px 0; color: var(--SmartThemeEmColor, #8af);">
				<i class="fa-solid fa-fire" style="margin-right: 8px;"></i>BlazeTracker Status
			</h3>
			<table style="width: 100%; border-collapse: collapse;">
				${rows
					.map(
						row => `
					<tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
						<td style="padding: 8px 12px 8px 0; opacity: 0.8;">${row.label}</td>
						<td style="padding: 8px 0; font-weight: 600; text-align: right;">${row.value}</td>
					</tr>
				`,
					)
					.join('')}
			</table>
		</div>
	`;

	// Show popup
	await context.callGenericPopup(container, context.POPUP_TYPE.TEXT, null, {
		okButton: 'Close',
	});

	return '';
}

// ============================================
// Registration
// ============================================

export function registerSlashCommands(): void {
	try {
		// Get slash command classes from SillyTavern context
		const context = SillyTavern.getContext() as any;
		const SlashCommandParser = context.SlashCommandParser;
		const SlashCommand = context.SlashCommand;
		const SlashCommandNamedArgument = context.SlashCommandNamedArgument;
		const ARGUMENT_TYPE = context.ARGUMENT_TYPE;

		if (!SlashCommandParser || !SlashCommand) {
			console.warn(
				`[${EXTENSION_NAME}] Slash command API not available, skipping registration`,
			);
			return;
		}

		// ========================================
		// V2 Commands (Current)
		// ========================================

		// /bt-extract - Extract state for a message (V2)
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-extract',
				callback: extractCommand,
				namedArgumentList: [
					SlashCommandNamedArgument.fromProps({
						name: 'id',
						description:
							'Message ID to extract (defaults to most recent)',
						typeList: [ARGUMENT_TYPE.NUMBER],
						isRequired: false,
					}),
				],
				helpString: `
				<div>
					Extract BlazeTracker state for a message.
					<br><br>
					<strong>Usage:</strong>
					<ul>
						<li><code>/bt-extract</code> - Extract most recent message</li>
						<li><code>/bt-extract id=5</code> - Extract message #5</li>
					</ul>
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-extract-all - Extract all messages (V2)
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-extract-all',
				callback: extractAllCommand,
				helpString: `
				<div>
					Extract BlazeTracker state for all messages in the chat.
					<br><br>
					<strong>WARNING:</strong> This command clears ALL existing BlazeTracker data
					before starting fresh extraction.
					<br><br>
					<strong>Usage:</strong>
					<ul>
						<li><code>/bt-extract-all</code> - Clear all state and re-extract everything</li>
					</ul>
					<br>
					<em>Note: Click the stop button to abort extraction at any time.</em>
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-extract-remaining - Continue extraction from last extracted message (V2)
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-extract-remaining',
				callback: extractRemainingCommand,
				helpString: `
				<div>
					Continue extracting from where you left off.
					<br><br>
					Finds the last message with extracted state and extracts all messages after it.
					Unlike /bt-extract-all, this preserves existing state and doesn't reset anything.
					<br><br>
					<strong>Usage:</strong>
					<ul>
						<li><code>/bt-extract-remaining</code> - Extract all unextracted messages</li>
					</ul>
					<br>
					<em>Useful after importing a chat or if extraction was interrupted.</em>
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-event-store - View and navigate the event store
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-event-store',
				callback: eventStoreCommand,
				helpString: `
				<div>
					Open the Event Store viewer to browse all events.
					<br><br>
					Shows all events in the event store with their status:
					<ul>
						<li>Canonical events (on the current swipe path)</li>
						<li>Non-canonical events (from alternate swipes)</li>
						<li>Deleted events</li>
					</ul>
					<br>
					<strong>Usage:</strong>
					<ul>
						<li><code>/bt-event-store</code> - Open the event store viewer</li>
					</ul>
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-status - Show BlazeTracker status
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-status',
				callback: statusCommand,
				helpString: `
				<div>
					Show BlazeTracker status for the current chat.
					<br><br>
					Displays:
					<ul>
						<li>Messages extracted vs total</li>
						<li>Number of chapters</li>
						<li>Number of relationships</li>
						<li>Events in current chapter</li>
					</ul>
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// ========================================
		// Deprecated V1 Commands
		// ========================================

		// /bt-deprecated-extract - V1 extraction
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-deprecated-extract',
				callback: deprecatedExtractCommand,
				namedArgumentList: [
					SlashCommandNamedArgument.fromProps({
						name: 'id',
						description:
							'Message ID to extract (defaults to most recent)',
						typeList: [ARGUMENT_TYPE.NUMBER],
						isRequired: false,
					}),
				],
				helpString: `
				<div>
					<strong>DEPRECATED:</strong> Use /bt-extract instead.
					<br><br>
					V1 extraction for backwards compatibility.
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-deprecated-chapter - V1 chapter command
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-deprecated-chapter',
				callback: deprecatedChapterCommand,
				namedArgumentList: [
					SlashCommandNamedArgument.fromProps({
						name: 'title',
						description:
							'Override the auto-generated chapter title',
						typeList: [ARGUMENT_TYPE.STRING],
						isRequired: false,
					}),
				],
				helpString: `
				<div>
					<strong>DEPRECATED:</strong> Chapter breaks are now automatic in V2.
					<br><br>
					V1 chapter command for backwards compatibility.
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-deprecated-extract-all - V1 extract all
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-deprecated-extract-all',
				callback: deprecatedExtractAllCommand,
				helpString: `
				<div>
					<strong>DEPRECATED:</strong> Use /bt-extract-all instead.
					<br><br>
					V1 extract all for backwards compatibility.
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		// /bt-deprecated-extract-remaining - V1 catchup
		SlashCommandParser.addCommandObject(
			SlashCommand.fromProps({
				name: 'bt-deprecated-extract-remaining',
				callback: deprecatedCatchupCommand,
				helpString: `
				<div>
					<strong>DEPRECATED:</strong> Use /bt-extract-remaining instead.
					<br><br>
					V1 catchup command for backwards compatibility.
				</div>
			`,
				returns: ARGUMENT_TYPE.STRING,
			}),
		);

		log(
			'Slash commands registered: /bt-extract, /bt-extract-all, /bt-extract-remaining, /bt-event-store, /bt-status',
		);
	} catch (e) {
		console.error(`[${EXTENSION_NAME}] Failed to register slash commands:`, e);
	}
}
