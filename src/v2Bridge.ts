/**
 * V2 Bridge
 *
 * Clean bridge between the old system and v2 extraction.
 * This file does NOT live in v2/ to keep v2 unpolluted.
 */

import type { STContext } from './types/st';
import { getV2Settings } from './v2/settings/manager';
import type { V2Settings } from './v2/settings/types';
import {
	SillyTavernGenerator,
	EventStore as V2EventStore,
	extractTurn,
	type ExtractionContext,
	type ExtractionSettings,
	type ExtractionResult,
	type Projection,
} from './v2';
import { recalculateChapterDescription } from './v2/orchestrators/chapterInvalidationHandler';
import type { SwipeContext } from './v2/store/projection';
import type { MilestoneInfo } from './v2/store/projection';
import { isMilestoneWorthy, type Subject } from './v2/types/subject';
import { EXTENSION_KEY } from './constants';
import {
	setProgressCallback,
	startExtractionRun,
	completeExtractionRun,
	type V2ExtractionProgress,
} from './v2/extractors/progressTracker';
import { st_echo } from 'sillytavern-utils-lib/config';
import { debugLog, debugWarn, errorLog } from './utils/debug';

// Storage key for v2 event store (stored in message 0)
const V2_STORE_KEY = 'v2EventStore';

// ============================================
// Abort Controller Management
// ============================================

let currentAbortController: AbortController | null = null;
let generationWasStopped = false;

/**
 * Get or create an AbortController for the current extraction.
 */
export function getExtractionAbortController(): AbortController {
	if (!currentAbortController) {
		currentAbortController = new AbortController();
	}
	return currentAbortController;
}

/**
 * Abort the current extraction.
 * Called when GENERATION_STOPPED fires.
 */
export function abortExtraction(): void {
	generationWasStopped = true;
	if (currentAbortController) {
		debugLog('Aborting extraction');
		currentAbortController.abort();
	}
}

/**
 * Reset the abort controller (call after extraction completes).
 */
export function resetAbortController(): void {
	currentAbortController = null;
}

/**
 * Check if extraction was aborted.
 * Returns the flag value and resets it to false.
 */
export function wasExtractionAborted(): boolean {
	const wasAborted = generationWasStopped;
	generationWasStopped = false;
	return wasAborted;
}

// ============================================
// Context Conversion
// ============================================

/**
 * Convert SillyTavern context to v2 ExtractionContext.
 */
export function buildExtractionContext(stContext: STContext): ExtractionContext {
	const characters = stContext.characters ?? [];
	const characterId = stContext.characterId ?? 0;

	return {
		chat: stContext.chat.map(msg => ({
			mes: msg.mes,
			is_user: msg.is_user,
			// ST's ChatMessage doesn't have is_system, default to false
			is_system: false,
			name: msg.name,
			swipe_id: msg.swipe_id,
			// ST's ChatMessage doesn't have swipes in our type definition
			swipes: undefined,
			extra: msg.extra,
		})),
		characters: characters.map(char => ({
			name: char.name,
			description: char.description,
			personality: char.personality,
			scenario: char.scenario,
			first_mes: char.first_mes,
		})),
		characterId,
		name1: stContext.name1,
		name2: stContext.name2,
		// Get persona from powerUserSettings
		persona: stContext.powerUserSettings?.persona_description,
		// Groups not available in our STContext type - leave undefined
		groups: undefined,
		groupId: undefined,
	};
}

/**
 * Convert V2 settings to ExtractionSettings.
 * Uses the new V2Settings format with proper per-prompt temperature support.
 */
export function buildExtractionSettingsFromV2(settings: V2Settings): ExtractionSettings {
	return {
		profileId: settings.v2ProfileId,
		track: {
			time: settings.v2Track.time,
			location: settings.v2Track.location,
			props: settings.v2Track.props,
			climate: settings.v2Track.climate,
			characters: settings.v2Track.characters,
			relationships: settings.v2Track.relationships,
			scene: settings.v2Track.scene,
			narrative: settings.v2Track.narrative,
			chapters: settings.v2Track.narrative, // Chapters enabled when narrative is enabled
		},
		temperatures: {
			time: settings.v2Temperatures.time,
			location: settings.v2Temperatures.location,
			climate: settings.v2Temperatures.climate,
			characters: settings.v2Temperatures.characters,
			relationships: settings.v2Temperatures.relationships,
			scene: settings.v2Temperatures.scene,
			narrative: settings.v2Temperatures.narrative,
			chapters: settings.v2Temperatures.narrative, // Use narrative temp for chapters
		},
		customPrompts: settings.v2CustomPrompts,
		promptTemperatures: settings.v2PromptTemperatures,
	};
}

// ============================================
// Event Store Management
// ============================================

// In-memory store for the current chat session
let currentEventStore: V2EventStore | null = null;

/**
 * Get or create the v2 EventStore for the current chat.
 */
export function getV2EventStore(): V2EventStore {
	if (!currentEventStore) {
		currentEventStore = new V2EventStore();
	}
	return currentEventStore;
}

/**
 * Reset the event store and load from storage (call on chat change).
 */
export function resetV2EventStore(): void {
	currentEventStore = null;
	// Try to load from storage
	loadV2EventStore();
}

/**
 * Set the event store (for loading from saved state).
 */
export function setV2EventStore(store: V2EventStore): void {
	currentEventStore = store;
}

/**
 * Load the v2 EventStore from chat storage (message 0).
 * Returns true if successfully loaded, false otherwise.
 */
export function loadV2EventStore(): boolean {
	try {
		const context = SillyTavern.getContext() as unknown as STContext;
		const chat = context.chat;

		if (!chat || chat.length === 0) {
			return false;
		}

		const firstMessage = chat[0];
		const storage = firstMessage.extra?.[EXTENSION_KEY] as
			| Record<string, unknown>
			| undefined;

		if (!storage || !storage[V2_STORE_KEY]) {
			return false;
		}

		const serializedData = storage[V2_STORE_KEY];
		const loadedStore = V2EventStore.fromSerialized(serializedData);

		if (loadedStore) {
			currentEventStore = loadedStore;
			debugLog(
				`Loaded v2 EventStore: ${loadedStore.activeEventCount} events, ` +
					`${loadedStore.snapshots.length} snapshots`,
			);
			return true;
		}

		return false;
	} catch (e) {
		debugWarn('Failed to load v2 EventStore:', e);
		return false;
	}
}

/**
 * Save the v2 EventStore to chat storage (message 0).
 * Also persists the chat to disk.
 */
export async function saveV2EventStore(): Promise<void> {
	if (!currentEventStore) {
		return;
	}

	try {
		const context = SillyTavern.getContext() as unknown as STContext;
		const chat = context.chat;

		if (!chat || chat.length === 0) {
			debugWarn('Cannot save v2 EventStore: no chat messages');
			return;
		}

		const firstMessage = chat[0];

		if (!firstMessage.extra) {
			firstMessage.extra = {};
		}

		if (!firstMessage.extra[EXTENSION_KEY]) {
			firstMessage.extra[EXTENSION_KEY] = {};
		}

		// Serialize and save
		const serialized = currentEventStore.serialize();
		(firstMessage.extra[EXTENSION_KEY] as Record<string, unknown>)[V2_STORE_KEY] =
			serialized;

		// Persist to disk
		await context.saveChat();

		debugLog(
			`Saved v2 EventStore: ${currentEventStore.activeEventCount} events, ` +
				`${currentEventStore.snapshots.length} snapshots`,
		);
	} catch (e) {
		errorLog('Failed to save v2 EventStore:', e);
	}
}

/**
 * Clear the v2 EventStore from storage.
 */
export async function clearV2EventStore(): Promise<void> {
	currentEventStore = null;

	try {
		const context = SillyTavern.getContext() as unknown as STContext;
		const chat = context.chat;

		if (!chat || chat.length === 0) {
			return;
		}

		const firstMessage = chat[0];
		const storage = firstMessage.extra?.[EXTENSION_KEY] as
			| Record<string, unknown>
			| undefined;

		if (storage && storage[V2_STORE_KEY]) {
			delete storage[V2_STORE_KEY];
			await context.saveChat();
		}
	} catch (e) {
		debugWarn('Failed to clear v2 EventStore:', e);
	}
}

// ============================================
// Progress Tracking
// ============================================

// Re-export V2ExtractionProgress type for UI components
export type { V2ExtractionProgress } from './v2/extractors/progressTracker';

// ============================================
// Main Extraction Function
// ============================================

export interface V2ExtractionOptions {
	/** Progress callback for UI updates */
	onProgress?: (progress: V2ExtractionProgress) => void;
	/** Legacy status callback (string only) */
	onStatus?: (status: string) => void;
	/** Whether this is a manual extraction (vs auto) */
	isManual?: boolean;
	/** Called when extraction starts for a message (for UI updates) */
	onMessageStart?: (messageId: number) => void;
	/** Called when extraction ends for a message (for UI updates) */
	onMessageEnd?: (messageId: number) => void;
}

/**
 * Run v2 extraction for the current turn.
 *
 * @param messageId - The message ID to extract (usually the last message)
 * @param options - Extraction options
 * @returns The extraction result, or null if aborted/failed
 */
export async function runV2Extraction(
	messageId: number,
	options: V2ExtractionOptions = {},
): Promise<ExtractionResult | null> {
	const { onProgress, onStatus, isManual: _isManual = false } = options;

	// Get ST context and V2 settings
	const stContext = SillyTavern.getContext() as unknown as STContext;
	const v2Settings = getV2Settings();

	if (!v2Settings.v2ProfileId) {
		debugWarn('No profile ID configured');
		return null;
	}

	// Build v2 context and settings
	const extractionContext = buildExtractionContext(stContext);
	const extractionSettings = buildExtractionSettingsFromV2(v2Settings);

	// Slice context to only include messages up to messageId
	extractionContext.chat = extractionContext.chat.slice(0, messageId + 1);

	// Get or create event store
	const store = getV2EventStore();

	// Create abort controller and generator
	const abortController = getExtractionAbortController();
	const generator = new SillyTavernGenerator({ profileId: v2Settings.v2ProfileId });

	// Set up progress tracking
	if (onProgress) {
		setProgressCallback(onProgress);
	}

	// Build list of planned sections based on extraction type
	const plannedSections: string[] = [];
	if (!store.hasInitialSnapshot) {
		// Initial extraction - each initial extractor is its own section
		if (extractionSettings.track.time) plannedSections.push('initial_time');
		if (extractionSettings.track.location) plannedSections.push('initial_location');
		if (extractionSettings.track.climate) plannedSections.push('initial_climate');
		if (extractionSettings.track.scene) plannedSections.push('initial_scene');
		if (extractionSettings.track.characters) plannedSections.push('initial_characters');
		if (extractionSettings.track.relationships)
			plannedSections.push('initial_relationships');
		if (extractionSettings.track.props) plannedSections.push('initial_props');
	} else {
		// Event extraction - use sections (phases) that group related extractors
		// Core section: time, location, climate, topic/tone, tension
		if (
			extractionSettings.track.time ||
			extractionSettings.track.location ||
			extractionSettings.track.climate ||
			extractionSettings.track.scene
		) {
			plannedSections.push('core');
		}
		// Character presence section
		if (extractionSettings.track.characters) {
			plannedSections.push('characterPresence');
			plannedSections.push('perCharacter');
		}
		// Props section (after character for outfit integration)
		if (extractionSettings.track.props) {
			plannedSections.push('props');
		}
		// Relationship sections
		if (extractionSettings.track.relationships) {
			plannedSections.push('relationshipSubjects');
			plannedSections.push('perPair');
		}
		// Narrative section
		if (extractionSettings.track.narrative) {
			plannedSections.push('narrative');
		}
		// Chapter section
		if (extractionSettings.track.chapters) {
			plannedSections.push('chapter');
		}
	}

	startExtractionRun(plannedSections);

	// Create status callback (for legacy logging)
	const statusCallback = (status: string) => {
		onStatus?.(status);
	};

	// Show the stop button during extraction
	stContext.deactivateSendButtons();

	try {
		// Run extraction
		const result = await extractTurn(
			store,
			extractionContext,
			extractionSettings,
			statusCallback,
			generator,
			abortController.signal,
		);

		// Check if extraction was aborted
		if (result?.aborted) {
			const msgId = extractionContext.chat.length - 1;
			const swipeId = extractionContext.chat[msgId]?.swipe_id ?? 0;
			st_echo?.(
				'warning',
				`🔥 Extraction aborted for message ${msgId} (swipe ${swipeId})`,
			);
			debugLog('Extraction aborted');
			completeExtractionRun();
			return null;
		}

		// Save the updated store after successful extraction
		if (result) {
			await saveV2EventStore();
		}

		completeExtractionRun();
		return result;
	} catch (error: any) {
		if (error.name === 'AbortError' || abortController.signal.aborted) {
			debugLog('Extraction aborted by error');
			return null;
		}
		throw error;
	} finally {
		// Re-enable send buttons
		stContext.activateSendButtons();
		setProgressCallback(null);
		resetAbortController();
	}
}

/**
 * Run v2 extraction for all messages from a starting point.
 *
 * @param startMessageId - The message ID to start from (inclusive)
 * @param options - Extraction options
 * @returns Count of extracted and failed messages
 */
export async function runV2ExtractionAll(
	startMessageId: number = 1,
	options: V2ExtractionOptions = {},
): Promise<{ extracted: number; failed: number }> {
	const { onStatus, onProgress, onMessageStart, onMessageEnd } = options;

	const stContext = SillyTavern.getContext() as unknown as STContext;
	const totalMessages = stContext.chat.length;

	let extracted = 0;
	let failed = 0;
	let aborted = false;

	for (let msgId = startMessageId; msgId < totalMessages; msgId++) {
		// Capture controller reference before each extraction
		// so we can check abort state after runV2Extraction resets it
		const abortController = getExtractionAbortController();

		try {
			onStatus?.(`Extracting message ${msgId}/${totalMessages - 1}...`);
			onMessageStart?.(msgId);

			const result = await runV2Extraction(msgId, { onStatus, onProgress });

			if (result) {
				extracted++;
			} else {
				// Check if it was aborted (result is null when aborted)
				if (abortController.signal.aborted) {
					aborted = true;
				} else {
					failed++;
				}
			}
		} catch (error) {
			errorLog(`Failed to extract message ${msgId}:`, error);
			failed++;
		} finally {
			onMessageEnd?.(msgId);
		}

		// Check for abort between messages
		if (aborted) {
			break;
		}
	}

	return { extracted, failed };
}

// ============================================
// UI Integration Functions
// ============================================

/**
 * Create a SwipeContext from SillyTavern chat context.
 * Uses the current swipe_id for each message.
 */
export function buildSwipeContext(stContext: STContext): SwipeContext {
	return {
		getCanonicalSwipeId: (messageId: number) => {
			const message = stContext.chat[messageId];
			return message?.swipe_id ?? 0;
		},
	};
}

/**
 * Get projection for a specific message for UI display.
 *
 * @param messageId - The message to project state at
 * @returns The projection, or null if no store/snapshot available
 */
export function getProjectionForMessage(messageId: number): Projection | null {
	const store = currentEventStore;
	if (!store || !store.hasInitialSnapshot) {
		return null;
	}

	// If the requested message is before the initial snapshot, we can't project there
	// This is expected when injection runs after initial extraction (extraction at N,
	// injection wants state at N-1, but we have no state before the initial extraction)
	if (messageId < store.initialSnapshotMessageId) {
		return null;
	}

	try {
		const stContext = SillyTavern.getContext() as unknown as STContext;
		const swipeContext = buildSwipeContext(stContext);
		return store.projectStateAtMessage(messageId, swipeContext);
	} catch (e) {
		debugWarn('Failed to project state at message', messageId, e);
		return null;
	}
}

/**
 * Replace the current event store (for editor save).
 * This replaces the in-memory store with an edited clone and saves to storage.
 *
 * @param newStore - The edited store to replace the current one
 */
export async function replaceV2EventStore(newStore: V2EventStore): Promise<void> {
	currentEventStore = newStore;
	await saveV2EventStore();
}

/**
 * Get the event store for the editor.
 * Returns null if no store exists yet.
 */
export function getV2EventStoreForEditor(): V2EventStore | null {
	return currentEventStore;
}

/**
 * Check if the v2 event store has been initialized with a snapshot.
 */
export function hasV2InitialSnapshot(): boolean {
	return currentEventStore?.hasInitialSnapshot ?? false;
}

/**
 * Check if a specific message/swipe has any events (has been extracted).
 */
export function hasEventsAtMessage(messageId: number, swipeId: number): boolean {
	if (!currentEventStore) return false;
	const events = currentEventStore.getEventsAtMessage({ messageId, swipeId });
	return events.length > 0;
}

/**
 * Get the message ID where the initial snapshot was created.
 * Returns -1 if no initial snapshot exists.
 */
export function getInitialSnapshotMessageId(): number {
	return currentEventStore?.initialSnapshotMessageId ?? -1;
}

/**
 * Delete all events for a message from the v2 store.
 * Used when a message is deleted.
 */
export async function deleteV2EventsForMessage(messageId: number): Promise<void> {
	if (!currentEventStore) return;

	currentEventStore.deleteAllEventsForMessage(messageId);
	await saveV2EventStore();
}

/**
 * Delete events for a specific message/swipe from the v2 store.
 * Also reindexes swipeIds for remaining swipes (swipe N+1 becomes swipe N, etc.)
 * Used when a swipe is deleted.
 */
export async function deleteV2EventsForSwipe(messageId: number, swipeId: number): Promise<void> {
	if (!currentEventStore) return;

	// Delete events for the deleted swipe
	currentEventStore.deleteEventsAtMessage({ messageId, swipeId });

	// Reindex remaining swipes (swipe N+1 becomes swipe N, etc.)
	currentEventStore.reindexSwipesAfterDeletion(messageId, swipeId);

	await saveV2EventStore();
}

/**
 * Delete events for messages beyond a given messageId.
 * Used after branching to clean up events that don't exist in the branch.
 * @returns true if any events were deleted
 */
export async function cleanupV2EventsAfterMessage(lastValidMessageId: number): Promise<boolean> {
	if (!currentEventStore) return false;

	// Check if there are any events beyond the last valid message
	const hasEventsToDelete = currentEventStore
		.getActiveEvents()
		.some(e => e.source.messageId > lastValidMessageId);

	if (hasEventsToDelete) {
		currentEventStore.deleteEventsAfterMessage(lastValidMessageId);
		await saveV2EventStore();
		return true;
	}

	return false;
}

// Re-export MilestoneInfo from projection module
export type { MilestoneInfo } from './v2/store/projection';

/**
 * Get milestones that occurred at a specific message.
 * Only returns milestone-worthy subjects that are first occurrences.
 *
 * @param messageId - The message to check
 * @returns Array of milestone info for display
 */
export function getMilestonesAtMessage(messageId: number): MilestoneInfo[] {
	const store = currentEventStore;
	if (!store) return [];

	const stContext = SillyTavern.getContext() as unknown as STContext;
	const swipeContext = buildSwipeContext(stContext);
	const canonicalSwipeId = swipeContext.getCanonicalSwipeId(messageId);

	const events = store.getActiveEvents();
	const milestones: MilestoneInfo[] = [];

	// Find RelationshipSubjectEvents at this message
	for (const event of events) {
		if (event.source.messageId !== messageId) continue;
		if (event.source.swipeId !== canonicalSwipeId) continue;
		if (event.kind !== 'relationship') continue;
		if (!('subkind' in event) || event.subkind !== 'subject') continue;

		const subjectEvent = event as {
			pair: [string, string];
			subject: Subject;
			milestoneDescription?: string;
		};

		// Only include milestone-worthy subjects
		if (!isMilestoneWorthy(subjectEvent.subject)) continue;

		// Check if this is a first occurrence (milestone)
		const isFirst = isFirstOccurrenceOfSubject(
			store,
			messageId,
			subjectEvent.pair,
			subjectEvent.subject,
			swipeContext,
		);

		if (isFirst) {
			milestones.push({
				pair: subjectEvent.pair,
				subject: subjectEvent.subject,
				description: subjectEvent.milestoneDescription,
				messageId,
			});
		}
	}

	return milestones;
}

/**
 * Check if a subject is the first occurrence for a pair up to (but not including) a message.
 */
function isFirstOccurrenceOfSubject(
	store: V2EventStore,
	beforeMessageId: number,
	pair: [string, string],
	subject: string,
	swipeContext: SwipeContext,
): boolean {
	const events = store.getActiveEvents();

	for (const event of events) {
		if (event.source.messageId >= beforeMessageId) break;

		const canonicalSwipeId = swipeContext.getCanonicalSwipeId(event.source.messageId);
		if (event.source.swipeId !== canonicalSwipeId) continue;

		if (event.kind !== 'relationship') continue;
		if (!('subkind' in event) || event.subkind !== 'subject') continue;

		const subjectEvent = event as { pair: [string, string]; subject: string };
		if (
			subjectEvent.pair[0] === pair[0] &&
			subjectEvent.pair[1] === pair[1] &&
			subjectEvent.subject === subject
		) {
			return false; // Found earlier occurrence
		}
	}

	return true; // This is the first
}

// ============================================
// Chapter Recalculation
// ============================================

/**
 * Recalculate chapter description for a specific chapter.
 * Only regenerates the description and rebuilds the snapshot - does NOT re-run
 * chapter end detection.
 *
 * @param store - The event store to update (will be modified in place)
 * @param chapterIndex - The chapter index to recalculate
 * @param onStatus - Optional status callback
 * @returns The updated store after recalculation
 */
export async function recalculateV2Chapter(
	store: V2EventStore,
	chapterIndex: number,
	onStatus?: (status: string) => void,
): Promise<V2EventStore> {
	const stContext = SillyTavern.getContext() as unknown as STContext;
	const v2Settings = getV2Settings();

	if (!v2Settings.v2ProfileId) {
		debugWarn('No profile ID configured for chapter recalculation');
		return store;
	}

	// Build extraction context and settings
	const extractionContext = buildExtractionContext(stContext);
	const extractionSettings = buildExtractionSettingsFromV2(v2Settings);

	// Create generator
	const generator = new SillyTavernGenerator({ profileId: v2Settings.v2ProfileId });

	// Create abort controller (allow cancellation)
	const abortController = new AbortController();

	try {
		await recalculateChapterDescription(
			generator,
			store,
			extractionContext,
			extractionSettings,
			chapterIndex,
			onStatus,
			abortController.signal,
		);

		debugLog(`Chapter ${chapterIndex} recalculation complete`);
		// Return a deep clone so React detects the state change
		return store.getDeepClone();
	} catch (error) {
		errorLog(`Failed to recalculate chapter ${chapterIndex}:`, error);
		throw error;
	}
}
