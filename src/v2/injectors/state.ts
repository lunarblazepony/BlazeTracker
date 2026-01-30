/**
 * V2 State Injection
 *
 * Formats v2 Projection state and injects into SillyTavern's prompt system.
 * This is the v2-only injector - no legacy types.
 */

import type {
	Projection,
	RelationshipState,
	CharacterState,
	NarrativeEvent,
} from '../types/snapshot';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { computeNarrativeEvents, computeChapters } from '../narrative';

const EXTENSION_KEY = 'blazetracker';

/**
 * Chapter summary for injection (matches computeChapters return type).
 */
interface ChapterSummary {
	index: number;
	title: string;
	summary: string;
	endReason: string | null;
	eventCount: number;
}

/**
 * Options for state injection.
 */
export interface InjectOptions {
	/** Include time section */
	includeTime?: boolean;
	/** Include location section */
	includeLocation?: boolean;
	/** Include climate section */
	includeClimate?: boolean;
	/** Include characters section */
	includeCharacters?: boolean;
	/** Include relationships section */
	includeRelationships?: boolean;
	/** Include scene (topic/tone/tension) section */
	includeScene?: boolean;
	/** Include chapters/story so far */
	includeChapters?: boolean;
	/** Include recent events */
	includeEvents?: boolean;
	/** Max chapters to include */
	maxChapters?: number;
	/** Max events to include */
	maxEvents?: number;
	/** Include relationship secrets */
	includeSecrets?: boolean;
}

const DEFAULT_OPTIONS: InjectOptions = {
	includeTime: true,
	includeLocation: true,
	includeClimate: true,
	includeCharacters: true,
	includeRelationships: true,
	includeScene: true,
	includeChapters: true,
	includeEvents: true,
	maxChapters: 3,
	maxEvents: 10,
	includeSecrets: true,
};

// ============================================
// Formatting Helpers
// ============================================

/**
 * Format time from projection's moment object.
 * Includes daylight phase (dawn, day, dusk, night) if provided.
 */
function formatTime(time: moment.Moment, daylight?: string): string {
	const formatted = time.format('dddd, MMMM D, YYYY [at] h:mm A');
	if (daylight) {
		return `${formatted} (${daylight})`;
	}
	return formatted;
}

/**
 * Format location for injection.
 */
function formatLocation(location: { area: string; place: string; position: string }): string {
	const parts = [location.area, location.place, location.position].filter(Boolean);
	return parts.join(' - ');
}

/**
 * Format climate for injection.
 */
function formatClimate(climate: {
	conditions: string;
	temperature: number;
	humidity: number;
	windSpeed: number;
	isIndoors: boolean;
}): string {
	const parts = [climate.conditions];

	if (climate.temperature !== undefined) {
		parts.push(`${Math.round(climate.temperature)}°F`);
	}

	if (climate.isIndoors) {
		parts.push('(indoors)');
	} else {
		if (climate.humidity > 70) {
			parts.push('humid');
		}
		if (climate.windSpeed > 15) {
			parts.push(`windy (${Math.round(climate.windSpeed)} mph)`);
		}
	}

	return parts.join(', ');
}

/**
 * Format a character's outfit.
 */
function formatOutfit(outfit: CharacterState['outfit']): string {
	const parts: string[] = [];

	if (outfit.torso) parts.push(outfit.torso);
	else parts.push('topless');

	if (outfit.legs) parts.push(outfit.legs);
	else parts.push('bottomless');

	if (outfit.underwear) parts.push(outfit.underwear);

	// Add accessories
	const accessories = [outfit.head, outfit.neck, outfit.jacket, outfit.back, outfit.footwear]
		.filter(Boolean)
		.join(', ');
	if (accessories) parts.push(accessories);

	return parts.join(', ');
}

/**
 * Format a character for injection.
 */
function formatCharacter(char: CharacterState): string {
	const parts = [`${char.name}: ${char.position || 'present'}`];

	if (char.activity) {
		parts.push(`doing: ${char.activity}`);
	}

	if (char.mood.length > 0) {
		parts.push(`mood: ${char.mood.join(', ')}`);
	}

	if (char.physicalState.length > 0) {
		parts.push(`physical: ${char.physicalState.join(', ')}`);
	}

	parts.push(`wearing: ${formatOutfit(char.outfit)}`);

	return parts.join('; ');
}

/**
 * Format a relationship for injection.
 */
function formatRelationship(rel: RelationshipState, includeSecrets: boolean): string {
	const [a, b] = rel.pair;
	const lines: string[] = [`${a} & ${b}: ${rel.status}`];

	// A's perspective
	const aDetails: string[] = [];
	if (rel.aToB.feelings.length > 0) {
		aDetails.push(`feels ${rel.aToB.feelings.join(', ')}`);
	}
	if (rel.aToB.wants.length > 0) {
		aDetails.push(`wants ${rel.aToB.wants.join(', ')}`);
	}
	if (includeSecrets && rel.aToB.secrets.length > 0) {
		aDetails.push(`hides: ${rel.aToB.secrets.join(', ')}`);
	}
	if (aDetails.length > 0) {
		lines.push(`  ${a} → ${b}: ${aDetails.join('; ')}`);
	}

	// B's perspective
	const bDetails: string[] = [];
	if (rel.bToA.feelings.length > 0) {
		bDetails.push(`feels ${rel.bToA.feelings.join(', ')}`);
	}
	if (rel.bToA.wants.length > 0) {
		bDetails.push(`wants ${rel.bToA.wants.join(', ')}`);
	}
	if (includeSecrets && rel.bToA.secrets.length > 0) {
		bDetails.push(`hides: ${rel.bToA.secrets.join(', ')}`);
	}
	if (bDetails.length > 0) {
		lines.push(`  ${b} → ${a}: ${bDetails.join('; ')}`);
	}

	return lines.join('\n');
}

/**
 * Format chapters for injection (story so far).
 */
function formatChapters(chapters: ChapterSummary[], maxChapters: number): string {
	// Get completed chapters (those with end reason)
	const completedChapters = chapters.filter(ch => ch.endReason !== null);

	if (completedChapters.length === 0) {
		return '';
	}

	// Take the most recent chapters
	const recentChapters = completedChapters.slice(-maxChapters);

	const lines: string[] = [];
	for (const chapter of recentChapters) {
		if (chapter.summary) {
			lines.push(`Chapter ${chapter.index + 1}: ${chapter.title}`);
			lines.push(`  ${chapter.summary}`);
		}
	}

	return lines.join('\n');
}

/**
 * Format narrative events for injection.
 */
function formatEvents(events: NarrativeEvent[], maxEvents: number): string {
	if (events.length === 0) {
		return '';
	}

	// Take most recent events
	const recentEvents = events.slice(-maxEvents);

	return recentEvents.map(e => `- ${e.description}`).join('\n');
}

/**
 * Build knowledge gaps - events that present characters missed.
 */
function buildKnowledgeGaps(events: NarrativeEvent[], presentCharacters: string[]): string[] {
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
				gaps.get(character)!.push(event.description);
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

// ============================================
// Main Formatting Function
// ============================================

/**
 * Format projection state for prompt injection.
 * Returns the formatted string to inject.
 */
export function formatStateForInjection(
	projection: Projection,
	store: EventStore,
	swipeContext: SwipeContext,
	options: InjectOptions = {},
): string {
	const opts = { ...DEFAULT_OPTIONS, ...options };
	const sections: string[] = [];

	// ========================================
	// Previous Chapters (Story So Far)
	// ========================================
	if (opts.includeChapters) {
		const chapters = computeChapters(store, swipeContext);
		const chaptersStr = formatChapters(chapters, opts.maxChapters ?? 3);
		if (chaptersStr) {
			sections.push(`[Story So Far]\n${chaptersStr}\n[/Story So Far]`);
		}
	}

	// ========================================
	// Current Scene State
	// ========================================
	const scenePrefix = `[Scene State]`;
	const sceneSuffix = `\n[/Scene State]`;
	let sceneOutput = ``;

	// Scene info first - it's the narrative context
	if (opts.includeScene && projection.scene) {
		const scene = projection.scene;
		sceneOutput += `\nTopic: ${scene.topic}`;
		sceneOutput += `\nTone: ${scene.tone}`;
		sceneOutput += `\nTension: ${scene.tension.level} (${scene.tension.type}, ${scene.tension.direction})`;
	}

	// Time
	if (opts.includeTime && projection.time) {
		sceneOutput += `\nTime: ${formatTime(projection.time, projection.climate?.daylight)}`;
	}

	// Location
	if (opts.includeLocation && projection.location) {
		sceneOutput += `\nLocation: ${formatLocation(projection.location)}`;

		// Props
		if (projection.location.props.length > 0) {
			sceneOutput += `\nNearby objects: ${projection.location.props.join(', ')}`;
		}
	}

	// Climate
	if (opts.includeClimate && projection.climate) {
		sceneOutput += `\nClimate: ${formatClimate(projection.climate)}`;
	}

	// Characters
	if (opts.includeCharacters && projection.charactersPresent.length > 0) {
		const characters = projection.charactersPresent
			.map(name => projection.characters[name])
			.filter(Boolean)
			.map(char => formatCharacter(char))
			.join('\n');

		sceneOutput += `\nCharacters present:\n${characters}`;
	}

	if (sceneOutput !== ``) {
		sections.push(scenePrefix + sceneOutput + sceneSuffix)
	}

	// ========================================
	// Recent Events in Current Chapter
	// ========================================
	if (opts.includeEvents) {
		const allEvents = computeNarrativeEvents(
			store,
			swipeContext,
			projection.currentChapter,
		);
		const eventsStr = formatEvents(allEvents, opts.maxEvents ?? 10);

		if (eventsStr) {
			sections.push(`[Recent Events]\n${eventsStr}\n[/Recent Events]`);

			// Add knowledge gaps for dramatic irony
			if (opts.includeCharacters && projection.charactersPresent.length > 0) {
				const knowledgeGaps = buildKnowledgeGaps(
					allEvents,
					projection.charactersPresent,
				);
				if (knowledgeGaps.length > 0) {
					sections.push(
						`[Knowledge Gaps]\n${knowledgeGaps.join('\n')}\n[/Knowledge Gaps]`,
					);
				}
			}
		}
	}

	// ========================================
	// Relationships (filtered for present characters)
	// ========================================
	if (opts.includeRelationships && Object.keys(projection.relationships).length > 0) {
		const presentSet = new Set(projection.charactersPresent);

		const relevantRelationships = Object.values(projection.relationships).filter(
			rel => presentSet.has(rel.pair[0]) && presentSet.has(rel.pair[1]),
		);

		if (relevantRelationships.length > 0) {
			const relationshipsStr = relevantRelationships
				.map(rel => formatRelationship(rel, opts.includeSecrets ?? true))
				.join('\n\n');

			sections.push(`[Relationships]\n${relationshipsStr}\n[/Relationships]`);
		}
	}

	return sections.join('\n\n');
}

// ============================================
// Injection Functions
// ============================================

/**
 * Inject state into SillyTavern's prompt system.
 *
 * @param projection - The projected state to inject
 * @param store - The event store for chapters/events
 * @param swipeContext - Context for swipe filtering
 * @param options - Injection options
 */
export function injectState(
	projection: Projection | null,
	store: EventStore | null,
	swipeContext: SwipeContext,
	options: InjectOptions = {},
): void {
	const context = SillyTavern.getContext();

	if (!projection || !store) {
		context.setExtensionPrompt(EXTENSION_KEY, '', 0, 0);
		return;
	}

	const formatted = formatStateForInjection(projection, store, swipeContext, options);

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
		1, // extension_prompt_types.IN_CHAT
		0, // depth - 0 means at the bottom
	);
}

/**
 * Clear the injection.
 */
export function clearInjection(): void {
	const context = SillyTavern.getContext();
	context.setExtensionPrompt(EXTENSION_KEY, '', 0, 0);
}

/**
 * Format state as a compact summary (for status display).
 */
export function formatStateSummary(projection: Projection): string {
	const parts: string[] = [];

	if (projection.time) {
		parts.push(projection.time.format('h:mm A'));
	}

	if (projection.location) {
		parts.push(projection.location.place || projection.location.area);
	}

	if (projection.charactersPresent.length > 0) {
		parts.push(`${projection.charactersPresent.length} characters`);
	}

	if (projection.scene) {
		parts.push(`tension: ${projection.scene.tension.level}`);
	}

	return parts.join(' | ');
}
