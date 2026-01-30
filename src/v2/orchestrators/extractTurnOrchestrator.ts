import type { Generator } from '../generator';
import { SillyTavernGenerator } from '../generator';
import type { EventStore } from '../store';
import type { ExtractionContext, ExtractionSettings, ExtractionResult } from '../extractors/types';
import type { MessageAndSwipe } from '../types';
import { createSnapshotFromProjection } from '../types/snapshot';
import { extractInitialSnapshot } from './extractInitialOrchestrator';
import { extractEvents } from './extractEventsOrchestrator';
import { buildSwipeContextFromExtraction } from '../extractors/utils';
// Card Extensions
import type { CardExtensions } from '../cardExtensions/types';
import type { MacroContext } from '../cardExtensions';
import {
	readAndResolveCardExtensions,
	mergeCardExtensionsIntoSnapshot,
	hasEnabledExtensions,
} from '../cardExtensions';
// Persona Defaults
import { getPersonaDefaults } from '../../ui/cardDefaultsModal';
import { mergePersonaDefaultsIntoSnapshot } from '../cardExtensions/personaMerger';
import { debugLog, debugWarn } from '../../utils/debug';

/**
 * Extract state for the current turn.
 * This is the main entry point for extraction.
 *
 * @param store - The event store (will be modified)
 * @param context - SillyTavern context
 * @param settings - Extraction settings
 * @param setStatus - Optional callback for status updates
 * @param generator - Optional generator (for testing with mocks)
 */
export async function extractTurn(
	store: EventStore,
	context: ExtractionContext,
	settings: ExtractionSettings,
	setStatus?: (status: string) => void,
	generator?: Generator,
	abortSignal?: AbortSignal,
): Promise<ExtractionResult> {
	// Build generator if not provided
	const gen = generator ?? new SillyTavernGenerator({ profileId: settings.profileId ?? '' });

	// Get current message/swipe
	const messageId = context.chat.length - 1;
	const message = context.chat[messageId];
	const swipeId = message?.swipe_id ?? 0;
	const currentMessage: MessageAndSwipe = { messageId, swipeId };

	// Delete existing events for this message (re-extraction)
	store.deleteEventsAtMessage(currentMessage);

	// Check if we need initial extraction
	if (!store.initialSnapshot) {
		setStatus?.('Running initial extraction...');

		// Read card extensions BEFORE extraction
		// - Time/Location: absolute replacement (skip LLM entirely)
		// - Outfit/Relationships: partial replacement (merge after extraction)
		const macroContext: MacroContext = {
			characterName: context.name2,
			userName: context.name1,
		};

		let cardExtensions: CardExtensions | null = null;
		try {
			cardExtensions = readAndResolveCardExtensions(
				macroContext,
				context.characterId,
			);
		} catch (readError) {
			// Card extensions not available - this is fine, continue with extraction
			console.debug('[BlazeTracker] Card extensions not available:', readError);
		}

		// Run extraction, passing card extensions so time/location can be skipped
		const initialResult = await extractInitialSnapshot(
			gen,
			context,
			settings,
			currentMessage,
			setStatus,
			cardExtensions, // Pass for absolute replacements (time, location)
			abortSignal,
		);

		// If aborted, return early without saving
		if (initialResult.aborted) {
			return {
				store,
				newEvents: [],
				chapterEnded: false,
				errors: initialResult.errors,
				aborted: true,
			};
		}

		const { snapshot, errors } = initialResult;

		// Apply partial replacements (outfit, profile, relationships) after extraction
		let finalSnapshot = snapshot;

		// Apply card extensions for {{char}}
		try {
			if (cardExtensions && hasEnabledExtensions(cardExtensions)) {
				// Only merge outfit, profile, and relationships (time/location already handled)
				const partialExtensions: CardExtensions = {
					outfit: cardExtensions.outfit,
					profile: cardExtensions.profile,
					relationships: cardExtensions.relationships,
				};

				if (
					partialExtensions.outfit?.enabled ||
					partialExtensions.profile?.enabled ||
					(partialExtensions.relationships &&
						partialExtensions.relationships.length > 0)
				) {
					setStatus?.('Applying card defaults...');
					finalSnapshot = await mergeCardExtensionsIntoSnapshot(
						finalSnapshot,
						partialExtensions,
						macroContext,
					);
					debugLog(
						'Applied card extensions (outfit/profile/relationships) to initial snapshot',
					);
				}
			}
		} catch (error) {
			debugWarn('Failed to apply card extensions:', error);
			// Continue with unmerged snapshot - extraction still succeeded
		}

		// Apply persona defaults for {{user}}
		try {
			const personaName = getActivePersonaName();
			if (personaName) {
				const personaDefaults = getPersonaDefaults(personaName);
				if (
					personaDefaults.outfit?.enabled ||
					personaDefaults.profile?.enabled
				) {
					setStatus?.('Applying persona defaults...');
					finalSnapshot = await mergePersonaDefaultsIntoSnapshot(
						finalSnapshot,
						personaDefaults,
						personaName,
					);
					debugLog(
						`Applied persona defaults for "${personaName}" to initial snapshot`,
					);
				}
			}
		} catch (error) {
			debugWarn('Failed to apply persona defaults:', error);
			// Continue with unmerged snapshot - extraction still succeeded
		}

		// Store initial snapshot
		store.replaceInitialSnapshot(finalSnapshot);

		return {
			store,
			newEvents: [],
			chapterEnded: false,
			errors,
		};
	}

	// Run event extraction
	const result = await extractEvents(
		gen,
		context,
		settings,
		store,
		currentMessage,
		setStatus,
		abortSignal,
	);

	// If chapter ended, create chapter snapshot
	if (result.chapterEnded) {
		setStatus?.('Creating chapter snapshot...');

		const swipeContext = buildSwipeContextFromExtraction(context);
		const projection = store.projectStateAtMessage(
			currentMessage.messageId,
			swipeContext,
		);
		const chapterSnapshot = createSnapshotFromProjection(
			projection,
			projection.currentChapter,
		);
		store.addChapterSnapshot(chapterSnapshot);
	}

	setStatus?.('Extraction complete');

	return result;
}

/**
 * Re-extract from a specific message onward.
 * Used when messages are edited or deleted.
 */
export async function reextractFromMessage(
	store: EventStore,
	context: ExtractionContext,
	settings: ExtractionSettings,
	fromMessageId: number,
	setStatus?: (status: string) => void,
	generator?: Generator,
): Promise<void> {
	// Delete events from this message onward
	for (let msgId = fromMessageId; msgId < context.chat.length; msgId++) {
		const message = context.chat[msgId];
		const swipeId = message?.swipe_id ?? 0;
		store.deleteEventsAtMessage({ messageId: msgId, swipeId });
	}

	// Rebuild snapshots after the deleted message
	const prevMessage =
		fromMessageId > 0
			? {
					messageId: fromMessageId - 1,
					swipeId: context.chat[fromMessageId - 1]?.swipe_id ?? 0,
				}
			: { messageId: 0, swipeId: 0 };
	store.rebuildSnapshotsAfterMessage(prevMessage);

	// Re-extract each message
	for (let msgId = fromMessageId; msgId < context.chat.length; msgId++) {
		setStatus?.(`Re-extracting message ${msgId + 1}/${context.chat.length}...`);

		// Create a subset context up to this message
		const subContext: ExtractionContext = {
			...context,
			chat: context.chat.slice(0, msgId + 1),
		};

		await extractTurn(store, subContext, settings, setStatus, generator);
	}
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get the active persona name from SillyTavern.
 * Returns null if no persona is active or context unavailable.
 */
function getActivePersonaName(): string | null {
	try {
		const ctx = SillyTavern.getContext();
		return ctx.name1 || null;
	} catch {
		return null;
	}
}
