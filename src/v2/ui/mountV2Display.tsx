/**
 * V2 Mount Functions
 *
 * Functions to mount/unmount ProjectionDisplay components on message elements.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ProjectionDisplay } from './ProjectionDisplay';
import { openV2EventStoreEditor } from './EventStoreEditor';
import { V2EventEditorModal } from './V2EventEditorModal';
import { V2NarrativeModal } from './V2NarrativeModal';
import {
	getProjectionForMessage,
	getV2EventStoreForEditor,
	replaceV2EventStore,
	hasV2InitialSnapshot,
	getMilestonesAtMessage,
	buildSwipeContext,
	hasEventsAtMessage,
	deleteV2EventsForSwipe,
	runV2Extraction,
	getInitialSnapshotMessageId,
	type V2ExtractionProgress,
} from '../../v2Bridge';
import type { STContext } from '../../types/st';
import { getV2Settings } from '../settings';
import { debugLog, debugWarn } from '../../utils/debug';

// Track the event editor modal root
let eventEditorRoot: ReactDOM.Root | null = null;
let eventEditorContainer: HTMLElement | null = null;

// Track the narrative modal root
let narrativeModalRoot: ReactDOM.Root | null = null;
let narrativeModalContainer: HTMLElement | null = null;

// Track React roots so we can unmount/update them
const roots = new Map<number, ReactDOM.Root>();

// Track ongoing extractions
const extractionInProgress = new Set<number>();

// Track current extraction progress
let currentExtractionProgress: V2ExtractionProgress = {
	step: 'idle',
	percentComplete: 0,
	label: 'Ready',
};
let currentExtractionMessageId: number | null = null;

/**
 * Check if extraction is in progress for a message.
 */
export function isV2ExtractionInProgress(messageId: number): boolean {
	return extractionInProgress.has(messageId);
}

/**
 * Set extraction in progress state.
 */
export function setV2ExtractionInProgress(messageId: number, inProgress: boolean): void {
	if (inProgress) {
		extractionInProgress.add(messageId);
		currentExtractionMessageId = messageId;
	} else {
		extractionInProgress.delete(messageId);
		if (currentExtractionMessageId === messageId) {
			currentExtractionMessageId = null;
		}
	}
}

/**
 * Update extraction progress for UI display.
 */
export function updateV2ExtractionProgress(progress: V2ExtractionProgress): void {
	currentExtractionProgress = progress;

	// Re-render the extracting message to show updated step
	if (
		currentExtractionMessageId !== null &&
		extractionInProgress.has(currentExtractionMessageId)
	) {
		mountV2ProjectionDisplay(currentExtractionMessageId);
	}
}

/**
 * Get the temperature unit from v2 settings.
 */
function getTemperatureUnit(): 'F' | 'C' {
	const settings = getV2Settings();
	return settings.v2TemperatureUnit === 'celsius' ? 'C' : 'F';
}

/**
 * Get the time format from v2 settings.
 */
function getTimeFormat(): '12h' | '24h' {
	const settings = getV2Settings();
	return settings.v2TimeFormat;
}

/**
 * Handle opening the narrative modal (full editor).
 */
async function handleOpenEditor(messageId: number, swipeId: number): Promise<void> {
	const store = getV2EventStoreForEditor();
	if (!store) {
		debugWarn('No event store available for editing');
		return;
	}

	const saved = await openV2EventStoreEditor(store, messageId, swipeId, async editedStore => {
		// Replace the store with the edited version
		replaceV2EventStore(editedStore);

		// Re-render all displays to reflect changes
		mountAllV2ProjectionDisplays();
	});

	if (saved) {
		debugLog('Event store edits saved');
	}
}

/**
 * Close the per-message event editor modal.
 */
function closeEventEditorModal(): void {
	if (eventEditorRoot) {
		eventEditorRoot.unmount();
		eventEditorRoot = null;
	}
	if (eventEditorContainer) {
		eventEditorContainer.remove();
		eventEditorContainer = null;
	}
}

/**
 * Close the narrative modal.
 */
function closeNarrativeModal(): void {
	if (narrativeModalRoot) {
		narrativeModalRoot.unmount();
		narrativeModalRoot = null;
	}
	if (narrativeModalContainer) {
		narrativeModalContainer.remove();
		narrativeModalContainer = null;
	}
}

/**
 * Handle opening the V2 narrative modal (book button).
 */
function handleOpenNarrativeModal(messageId: number): void {
	const store = getV2EventStoreForEditor();
	if (!store) {
		debugWarn('No event store available for narrative modal');
		return;
	}

	const stContext = SillyTavern.getContext() as unknown as STContext;

	// Create container if needed
	if (!narrativeModalContainer) {
		narrativeModalContainer = document.createElement('div');
		narrativeModalContainer.id = 'bt-v2-narrative-modal-container';
		document.body.appendChild(narrativeModalContainer);
	}

	// Create root if needed
	if (!narrativeModalRoot) {
		narrativeModalRoot = ReactDOM.createRoot(narrativeModalContainer);
	}

	// Render the modal
	narrativeModalRoot.render(
		<V2NarrativeModal
			eventStore={store}
			chat={stContext.chat}
			latestMessageId={messageId}
			onClose={closeNarrativeModal}
			onSave={async editedStore => {
				await replaceV2EventStore(editedStore);
				mountAllV2ProjectionDisplays();
				closeNarrativeModal();
			}}
		/>,
	);
}

/**
 * Handle retry extraction for a message.
 * Deletes events for the message/swipe and re-extracts.
 */
async function handleRetryExtraction(messageId: number, swipeId: number): Promise<void> {
	// Delete existing events for this message/swipe
	await deleteV2EventsForSwipe(messageId, swipeId);

	// Set extraction in progress
	setV2ExtractionInProgress(messageId, true);
	mountV2ProjectionDisplay(messageId);

	try {
		// Run extraction
		await runV2Extraction(messageId, {
			onProgress: updateV2ExtractionProgress,
		});
	} finally {
		// Clear extraction state
		setV2ExtractionInProgress(messageId, false);
		mountV2ProjectionDisplay(messageId);
	}
}

/**
 * Handle opening the per-message event editor.
 */
function handleEditEvents(messageId: number, swipeId: number): void {
	const store = getV2EventStoreForEditor();
	if (!store) {
		debugWarn('No event store available for editing');
		return;
	}

	const stContext = SillyTavern.getContext() as unknown as STContext;
	const swipeContext = buildSwipeContext(stContext);

	// Create container if needed
	if (!eventEditorContainer) {
		eventEditorContainer = document.createElement('div');
		eventEditorContainer.id = 'bt-v2-event-editor-container';
		document.body.appendChild(eventEditorContainer);
	}

	// Create root if needed
	if (!eventEditorRoot) {
		eventEditorRoot = ReactDOM.createRoot(eventEditorContainer);
	}

	// Render the modal
	eventEditorRoot.render(
		<V2EventEditorModal
			eventStore={store}
			messageId={messageId}
			swipeId={swipeId}
			swipeContext={swipeContext}
			onSave={async editedStore => {
				await replaceV2EventStore(editedStore);
				mountAllV2ProjectionDisplays();
				closeEventEditorModal();
			}}
			onClose={closeEventEditorModal}
		/>,
	);
}

/**
 * Mount the ProjectionDisplay for a specific message.
 */
export function mountV2ProjectionDisplay(messageId: number): void {
	const messageElement = document.querySelector(`[mesid="${messageId}"]`);
	if (!messageElement) return;

	const mesBlock = messageElement.querySelector('.mes_block');
	if (!mesBlock) return;

	const settings = getV2Settings();
	const isAbove = settings.v2DisplayPosition === 'above';

	// Get or create container
	let container = messageElement.querySelector('.bt-v2-state-root') as HTMLElement;
	let needsNewRoot = false;

	if (!container) {
		container = document.createElement('div');
		container.className = 'bt-v2-state-root';
		needsNewRoot = true;
	}

	// Update position class
	container.classList.toggle('bt-above', isAbove);

	// Insert in correct position if new
	if (needsNewRoot) {
		const mesText = mesBlock.querySelector('.mes_text');
		if (isAbove && mesText) {
			mesBlock.insertBefore(container, mesText);
		} else {
			mesBlock.appendChild(container);
		}
	}

	// Get or create React root
	let root = roots.get(messageId);
	if (needsNewRoot && root) {
		root.unmount();
		root = undefined;
	}

	if (!root) {
		root = ReactDOM.createRoot(container);
		roots.set(messageId, root);
	}

	// Get projection and state
	const isExtracting = extractionInProgress.has(messageId);
	const projection = isExtracting ? null : getProjectionForMessage(messageId);

	// Get milestones at this message (from raw events, not just narrativeEvents)
	const milestones = isExtracting ? [] : getMilestonesAtMessage(messageId);

	// Get swipe ID for editor
	const context = SillyTavern.getContext() as unknown as STContext;
	const message = context.chat[messageId];
	const swipeId = message?.swipe_id ?? 0;

	// Check if this specific message has been extracted
	const hasEventsAtThisMessage = isExtracting
		? false
		: hasEventsAtMessage(messageId, swipeId);

	// Check if this is the initial snapshot message (don't show "incomplete" for it)
	const initialSnapshotMsgId = getInitialSnapshotMessageId();
	const isInitialSnapshotMessage = messageId === initialSnapshotMsgId;

	// Determine if this is the latest message (for showing retry button)
	const isLatestMessage = messageId === context.chat.length - 1;

	// Render the component
	root.render(
		<ProjectionDisplay
			projection={projection}
			messageId={messageId}
			isExtracting={isExtracting}
			extractionProgress={isExtracting ? currentExtractionProgress : undefined}
			onOpenNarrative={() => handleOpenNarrativeModal(messageId)}
			onOpenEditor={() => handleOpenEditor(messageId, swipeId)}
			onEditEvents={() => handleEditEvents(messageId, swipeId)}
			temperatureUnit={getTemperatureUnit()}
			timeFormat={getTimeFormat()}
			milestones={milestones}
			hasEventsAtThisMessage={hasEventsAtThisMessage}
			isInitialSnapshotMessage={isInitialSnapshotMessage}
			isLatestMessage={isLatestMessage}
			onRetry={() => handleRetryExtraction(messageId, swipeId)}
		/>,
	);
}

/**
 * Mount ProjectionDisplay on all messages.
 */
export function mountAllV2ProjectionDisplays(): void {
	// Only mount if we have v2 data
	if (!hasV2InitialSnapshot()) {
		return;
	}

	const context = SillyTavern.getContext() as unknown as STContext;
	for (let i = 1; i < context.chat.length; i++) {
		mountV2ProjectionDisplay(i);
	}
}

/**
 * Unmount ProjectionDisplay for a specific message.
 */
export function unmountV2ProjectionDisplay(messageId: number): void {
	const root = roots.get(messageId);
	if (root) {
		root.unmount();
		roots.delete(messageId);
	}

	// Also remove the container
	const messageElement = document.querySelector(`[mesid="${messageId}"]`);
	const container = messageElement?.querySelector('.bt-v2-state-root');
	container?.remove();
}

/**
 * Unmount all ProjectionDisplays.
 */
export function unmountAllV2ProjectionDisplays(): void {
	// Remove all DOM containers
	document.querySelectorAll('.bt-v2-state-root').forEach(el => el.remove());

	// Unmount all React roots
	for (const [, root] of roots) {
		root.unmount();
	}
	roots.clear();

	// Clear extraction tracking
	extractionInProgress.clear();
	currentExtractionMessageId = null;
}

/**
 * Re-render a specific message's display.
 */
export function rerenderV2ProjectionDisplay(messageId: number): void {
	if (roots.has(messageId)) {
		mountV2ProjectionDisplay(messageId);
	}
}

/**
 * Check if any v2 displays are mounted.
 */
export function hasV2DisplaysMounted(): boolean {
	return roots.size > 0;
}
