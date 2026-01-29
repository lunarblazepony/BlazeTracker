import type {
	TrackedState,
	NarrativeState,
	TimestampedEvent,
	UnifiedEventStore,
} from '../types/state';
import { isUnifiedEventStore } from '../types/state';
import type { STContext } from '../types/st';
import { getMessageState } from '../utils/messageState';
import { getSettings } from '../settings';
import { getNarrativeState } from '../state/narrativeState';
import { formatChaptersForInjection } from '../state/chapters';
import { formatEventsForInjection } from '../state/events';
import { formatRelationshipsForPrompt } from '../state/relationships';
import {
	projectCurrentState,
	convertProjectionToTrackedState,
	getActiveStateEvents,
	getInitialProjection,
} from '../state/eventStore';
import { formatNarrativeDateTime } from '../utils/dateFormat';
import { formatOutfit, formatScene, formatClimate } from '../ui/formatters';

// ============================================
// Helper Functions for Knowledge Gaps
// ============================================

/**
 * Build knowledge gaps - events that present characters missed.
 * Returns formatted strings describing what each present character doesn't know.
 * Only considers events where at least one witness is currently present
 * (events with no present witnesses are irrelevant to the current scene).
 */
function buildKnowledgeGaps(events: TimestampedEvent[], presentCharacters: string[]): string[] {
	const gaps = new Map<string, string[]>();
	const presentSet = new Set(presentCharacters.map(c => c.toLowerCase()));

	// Filter to events where at least one witness is currently present
	const relevantEvents = events.filter(event =>
		event.witnesses.some(w => presentSet.has(w.toLowerCase())),
	);

	// For each present character, find events they weren't witnesses to
	for (const character of presentCharacters) {
		const charLower = character.toLowerCase();
		for (const event of relevantEvents) {
			const witnessLower = event.witnesses.map(w => w.toLowerCase());
			if (!witnessLower.includes(charLower)) {
				if (!gaps.has(character)) {
					gaps.set(character, []);
				}
				gaps.get(character)!.push(event.summary);
			}
		}
	}

	// Format as strings
	const result: string[] = [];
	for (const [character, missedEvents] of gaps) {
		if (missedEvents.length > 0) {
			result.push(`${character} was not present for: ${missedEvents.join('; ')}`);
		}
	}

	return result;
}

const EXTENSION_KEY = 'blazetracker';

import type { ProjectedRelationship } from '../types/state';

export interface InjectionOptions {
	weatherTransition?: string;
	/** Projected relationships from event store (takes precedence over narrativeState.relationships) */
	projectedRelationships?: ProjectedRelationship[];
}

export function formatStateForInjection(
	state: TrackedState,
	narrativeState?: NarrativeState | null,
	options?: InjectionOptions,
): string {
	const settings = getSettings();

	// Check what's enabled AND what data exists
	const hasTime = settings.trackTime !== false && state.time;
	const hasLocation = settings.trackLocation !== false && state.location;
	const hasClimate = settings.trackClimate !== false && state.climate;
	const hasScene = settings.trackScene !== false && state.scene;
	const hasCharacters =
		settings.trackCharacters !== false &&
		state.characters &&
		state.characters.length > 0;
	const hasEvents =
		settings.trackEvents !== false &&
		state.currentEvents &&
		state.currentEvents.length > 0;
	// Use projected relationships if available, otherwise fall back to narrativeState
	const relationshipsToUse =
		options?.projectedRelationships ?? narrativeState?.relationships ?? [];
	const hasRelationships =
		settings.trackRelationships !== false && relationshipsToUse.length > 0;
	const hasChapters = narrativeState && narrativeState.chapters.length > 0;

	// If nothing is tracked/available, return empty
	if (
		!hasTime &&
		!hasLocation &&
		!hasClimate &&
		!hasScene &&
		!hasCharacters &&
		!hasEvents &&
		!hasRelationships &&
		!hasChapters
	) {
		return '';
	}

	const sections: string[] = [];

	// ========================================
	// Previous Chapters (Story So Far)
	// ========================================
	if (hasChapters && narrativeState) {
		const chapterLimit = settings.injectedChapters ?? 3;
		const chaptersStr = formatChaptersForInjection(
			narrativeState.chapters,
			chapterLimit,
		);
		if (chaptersStr !== 'No previous chapters.') {
			sections.push(`[Story So Far]\n${chaptersStr}\n[/Story So Far]`);
		}
	}

	// ========================================
	// Current Scene State
	// ========================================
	let sceneOutput = `[Scene State]`;

	// Scene info first - it's the narrative context
	if (hasScene && state.scene) {
		sceneOutput += `\n${formatScene(state.scene)}`;
	}

	// Time (if enabled and available)
	if (hasTime && state.time) {
		const timeStr = formatNarrativeDateTime(state.time);
		sceneOutput += `\nTime: ${timeStr}`;
	}

	// Location (if enabled and available)
	if (hasLocation && state.location) {
		const location = [
			state.location.area,
			state.location.place,
			state.location.position,
		]
			.filter(Boolean)
			.join(' - ');
		sceneOutput += `\nLocation: ${location}`;

		// Props are part of location
		if (state.location.props && state.location.props.length > 0) {
			const props = state.location.props.join(', ');
			sceneOutput += `\nNearby objects: ${props}`;
		}
	}

	// Climate (if enabled and available)
	if (hasClimate && state.climate) {
		const climate = formatClimate(state.climate);
		sceneOutput += `\nClimate: ${climate}`;
	}

	// Characters (if enabled and available)
	if (hasCharacters && state.characters) {
		const characters = state.characters
			.map(char => {
				const parts = [`${char.name}: ${char.position}`];
				if (char.activity) parts.push(`doing: ${char.activity}`);
				if (char.mood?.length) parts.push(`mood: ${char.mood.join(', ')}`);
				if (char.physicalState?.length)
					parts.push(`physical: ${char.physicalState.join(', ')}`);
				if (char.outfit)
					parts.push(`wearing: ${formatOutfit(char.outfit)}`);
				return parts.join('; ');
			})
			.join('\n');

		sceneOutput += `\nCharacters present:\n${characters}`;
	}

	sceneOutput += `\n[/Scene State]`;
	sections.push(sceneOutput);

	// ========================================
	// Weather Transition (if procedural weather with change)
	// ========================================
	if (
		options?.weatherTransition &&
		settings.useProceduralWeather &&
		settings.injectWeatherTransitions
	) {
		sections.push(`[Weather Change]\n${options.weatherTransition}\n[/Weather Change]`);
	}

	// ========================================
	// Recent Events in Current Chapter
	// ========================================
	if (hasEvents && state.currentEvents) {
		const eventsStr = formatEventsForInjection(state.currentEvents);
		sections.push(`[Recent Events]\n${eventsStr}\n[/Recent Events]`);

		// Add witness absence notes for dramatic irony (if characters are tracked)
		if (hasCharacters && state.characters) {
			const presentCharacters = state.characters.map(c => c.name);
			const knowledgeGaps = buildKnowledgeGaps(
				state.currentEvents,
				presentCharacters,
			);

			if (knowledgeGaps.length > 0) {
				sections.push(
					`[Knowledge Gaps]\n${knowledgeGaps.join('\n')}\n[/Knowledge Gaps]`,
				);
			}
		}
	}

	// ========================================
	// Relationships (filtered for present characters)
	// ========================================
	if (hasRelationships) {
		const presentCharacters =
			hasCharacters && state.characters
				? state.characters.map(c => c.name)
				: undefined;

		const relationshipsStr = formatRelationshipsForPrompt(
			relationshipsToUse,
			presentCharacters,
			settings.includeRelationshipSecrets ?? true,
		);

		if (relationshipsStr !== 'No established relationships yet.') {
			sections.push(`[Relationships]\n${relationshipsStr}\n[/Relationships]`);
		}
	}

	return sections.join('\n\n');
}

export function injectState(
	state: TrackedState | null,
	narrativeState?: NarrativeState | null,
	options?: InjectionOptions,
) {
	const context = SillyTavern.getContext() as STContext;

	if (!state) {
		context.setExtensionPrompt(EXTENSION_KEY, '', 0, 0);
		return;
	}

	const formatted = formatStateForInjection(state, narrativeState, options);

	// If nothing to inject, clear the prompt
	if (!formatted) {
		context.setExtensionPrompt(EXTENSION_KEY, '', 0, 0);
		return;
	}

	// Inject at depth 0 (with most recent messages), position IN_CHAT
	// Position 1 = after main prompt, before chat
	// Depth 0 = at the end (near most recent messages)
	context.setExtensionPrompt(
		EXTENSION_KEY,
		formatted,
		1, // extension_prompt_types.IN_CHAT or similar
		0, // depth - 0 means at the bottom
	);
}

export function updateInjectionFromChat() {
	const context = SillyTavern.getContext() as STContext;

	// Get narrative state
	const narrativeState = getNarrativeState();
	const store = narrativeState?.eventStore as UnifiedEventStore | undefined;

	// Check if we have projection data from event store
	const hasProjectionData =
		isUnifiedEventStore(store) &&
		(getActiveStateEvents(store).length > 0 || getInitialProjection(store) !== null);

	if (hasProjectionData && isUnifiedEventStore(store)) {
		// Use event-based projection for current state
		const projection = projectCurrentState(store, context.chat);

		// Convert ProjectedState to TrackedState format
		const projectedState = convertProjectionToTrackedState(projection);

		// Find most recent message with non-projected state data (climate, scene, events)
		let nonProjectedState: Partial<TrackedState> = {};
		for (let i = context.chat.length - 1; i >= 0; i--) {
			const message = context.chat[i];
			const stateData = getMessageState(message) as
				| { state?: TrackedState }
				| undefined;
			if (stateData?.state) {
				// Get non-projected fields from stored state
				nonProjectedState = {
					climate: stateData.state.climate,
					scene: stateData.state.scene,
					currentChapter: stateData.state.currentChapter,
					currentEvents: stateData.state.currentEvents,
				};
				break;
			}
		}

		// Merge projected and non-projected state
		const combinedState: TrackedState = {
			...projectedState,
			...nonProjectedState,
		};

		// Get projected relationships from the projection
		const projectedRelationships = Array.from(projection.relationships.values());

		injectState(combinedState, narrativeState, { projectedRelationships });
		return;
	}

	// Fallback: Find most recent tracked state (legacy behavior)
	for (let i = context.chat.length - 1; i >= 0; i--) {
		const message = context.chat[i];
		const stateData = getMessageState(message) as { state?: TrackedState } | undefined;
		if (stateData?.state) {
			injectState(stateData.state, narrativeState);
			return;
		}
	}

	// No state found, clear injection
	injectState(null);
}
