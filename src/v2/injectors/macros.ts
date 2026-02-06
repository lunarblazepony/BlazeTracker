/**
 * ST Macro Registration for BlazeTracker
 *
 * Registers {{btState}} and {{btNarrative}} macros with SillyTavern's
 * macro system, allowing users to manually place BlazeTracker content
 * anywhere in their prompts.
 */

import type { STContext } from '../../types/st.d';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { getV2Settings } from '../settings';
import { debugLog } from '../../utils/debug';
import { formatStateForInjection } from './state';
import { formatPastChaptersWithTags } from './chapters';
import { getAllCurrentChapterEvents, formatOutOfContextEvents } from './events';

// Bridge functions - set by registerMacroBridgeFunctions to avoid circular dependency
let bridgeFunctions: {
	getV2EventStore: () => EventStore | null;
	hasV2InitialSnapshot: () => boolean;
	buildSwipeContext: (stContext: STContext) => SwipeContext;
} | null = null;

/**
 * Register bridge functions for the macro handlers.
 * Must be called before macros can function.
 */
export function registerMacroBridgeFunctions(
	functions: {
		getV2EventStore: () => EventStore | null;
		hasV2InitialSnapshot: () => boolean;
		buildSwipeContext: (stContext: STContext) => SwipeContext;
	} | null,
): void {
	bridgeFunctions = functions;
}

/**
 * Get the store and swipe context for macro handlers.
 * Returns null if not available.
 */
function getStoreAndContext(): {
	store: EventStore;
	swipeContext: SwipeContext;
	stContext: STContext;
} | null {
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
 * Handler for the {{btState}} macro.
 * Returns formatted scene state (time, location, characters, etc.)
 * without chapters or events.
 */
function btStateHandler(): string {
	const storeAndContext = getStoreAndContext();
	if (!storeAndContext) {
		return '';
	}

	const { store, swipeContext, stContext } = storeAndContext;
	const settings = getV2Settings();

	try {
		const lastMessageId = stContext.chat.length - 1;
		const projectionMessageId = lastMessageId - 1;
		if (projectionMessageId < 0) {
			return '';
		}

		const projection = store.projectStateAtMessage(projectionMessageId, swipeContext);

		return formatStateForInjection(projection, store, swipeContext, {
			includeTime: settings.v2Track.time,
			includeLocation: settings.v2Track.location,
			includeClimate: settings.v2Track.climate,
			includeCharacters: settings.v2Track.characters,
			includeRelationships: settings.v2Track.relationships,
			includeScene: settings.v2Track.scene,
			includeChapters: false,
			includeEvents: false,
		});
	} catch (error) {
		debugLog('Error in btState macro handler:', error);
		return '';
	}
}

/**
 * Handler for the {{btNarrative}} macro.
 * Returns formatted chapter summaries and current chapter events.
 */
function btNarrativeHandler(): string {
	const storeAndContext = getStoreAndContext();
	if (!storeAndContext) {
		return '';
	}

	const { store, swipeContext, stContext } = storeAndContext;
	const settings = getV2Settings();

	try {
		const lastMessageId = stContext.chat.length - 1;
		const projectionMessageId = lastMessageId - 1;
		if (projectionMessageId < 0) {
			return '';
		}

		const projection = store.projectStateAtMessage(projectionMessageId, swipeContext);
		const sections: string[] = [];

		// Past chapters (Story So Far)
		const chaptersContent = formatPastChaptersWithTags(
			store,
			swipeContext,
			settings.v2MaxRecentChapters,
		);
		if (chaptersContent) {
			sections.push(chaptersContent);
		}

		// Current chapter events
		const events = getAllCurrentChapterEvents(
			store,
			swipeContext,
			projection.currentChapter,
		);
		if (events.length > 0) {
			const eventsContent = formatOutOfContextEvents(
				events,
				settings.v2MaxRecentEvents,
			);
			if (eventsContent) {
				sections.push(
					`[Recent Events]\n${eventsContent}\n[/Recent Events]`,
				);
			}
		}

		return sections.join('\n\n');
	} catch (error) {
		debugLog('Error in btNarrative macro handler:', error);
		return '';
	}
}

/**
 * Register BlazeTracker macros with SillyTavern.
 * Call after bridge functions are registered.
 */
export function registerMacros(): void {
	try {
		const context = SillyTavern.getContext() as unknown as STContext;

		context.registerMacro(
			'btState',
			btStateHandler,
			'BlazeTracker scene state (time, location, characters, etc.)',
		);

		context.registerMacro(
			'btNarrative',
			btNarrativeHandler,
			'BlazeTracker narrative context (chapter summaries and events)',
		);

		debugLog('Registered btState and btNarrative macros');
	} catch (error) {
		debugLog('Failed to register macros:', error);
	}
}

/**
 * Unregister BlazeTracker macros from SillyTavern.
 */
export function unregisterMacros(): void {
	try {
		const context = SillyTavern.getContext() as unknown as STContext;
		context.unregisterMacro('btState');
		context.unregisterMacro('btNarrative');
		debugLog('Unregistered btState and btNarrative macros');
	} catch (error) {
		debugLog('Failed to unregister macros:', error);
	}
}
