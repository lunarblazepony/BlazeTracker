/**
 * Better RP Shared Context Builder
 *
 * Assembles the shared context block used by all 4 pipeline steps.
 * Ordered with stable content first for prefix caching benefits.
 */

import type { STContext } from '../../types/st.d';
import type { Projection } from '../types/snapshot';
import type { EventStore } from '../store/EventStore';
import type { SwipeContext } from '../store/projection';
import { formatCharacterProfiles } from '../extractors/utils/buildPrompt';
import { formatStateForInjection } from '../injectors/state';
import { computeOptimalContext } from '../injectors/contextBudget';
import { formatPrecomputedChapters } from '../injectors/chapters';
import { formatOutOfContextEvents } from '../injectors/events';
import { getDefaultTokenCounter } from '../utils/tokenCount';

/**
 * Parameters for building shared context.
 */
export interface BuildSharedContextParams {
	stContext: STContext;
	projection: Projection;
	store: EventStore;
	swipeContext: SwipeContext;
	includeWorldinfo: boolean;
	worldinfo?: string;
	shakeupInstruction?: string | null;
	injectionTokenBudget: number;
	maxRecentChapters: number;
	maxRecentEvents: number;
}

/**
 * Build the shared context block used by all 4 pipeline steps.
 * Sections are ordered with stable content first for prefix caching.
 */
export async function buildSharedContext(params: BuildSharedContextParams): Promise<string> {
	const {
		stContext,
		projection,
		store,
		swipeContext,
		worldinfo,
		shakeupInstruction,
		injectionTokenBudget,
		maxRecentChapters,
		maxRecentEvents,
	} = params;

	const sections: string[] = [];

	// 1. Character Description (STABLE — from char card)
	const charDescription = getCharacterDescription(stContext);
	if (charDescription) {
		sections.push(
			`[Character Description]\n${charDescription}\n[/Character Description]`,
		);
	}

	// 2. User Character (STABLE — from persona)
	const userDescription = getUserDescription(stContext);
	if (userDescription) {
		sections.push(`[User Character]\n${userDescription}\n[/User Character]`);
	}

	// 3. World Info (STABLE-ish — if enabled)
	if (worldinfo) {
		sections.push(`[World Info]\n${worldinfo}\n[/World Info]`);
	}

	// 4. Character Profiles (STABLE-ish — includes species, sex, age, appearance, personality)
	const profiles = formatCharacterProfiles(projection);
	if (profiles && profiles !== 'No character profiles available') {
		sections.push(`[Character Profiles]\n${profiles}\n[/Character Profiles]`);
	}

	// 5. Relationships (VOLATILE)
	const relationships = formatRelationshipsForContext(projection);
	if (relationships) {
		sections.push(`[Relationships]\n${relationships}\n[/Relationships]`);
	}

	// 6. Current Scene (VOLATILE — time, location, climate, characters, scene)
	const sceneState = formatStateForInjection(projection, store, swipeContext, {
		includeTime: true,
		includeLocation: true,
		includeClimate: true,
		includeCharacters: true,
		includeRelationships: false, // Already included above
		includeScene: true,
		includeChapters: false,
		includeEvents: false,
	});
	if (sceneState) {
		sections.push(`[Current Scene]\n${sceneState}\n[/Current Scene]`);
	}

	// 7. Narrative Context (VOLATILE — chapters + out-of-context events, HALF budget)
	const narrativeContext = await buildNarrativeContext(
		store,
		swipeContext,
		injectionTokenBudget,
		maxRecentChapters,
		maxRecentEvents,
		stContext,
	);
	if (narrativeContext) {
		sections.push(`[Narrative Context]\n${narrativeContext}\n[/Narrative Context]`);
	}

	// 8. Mandatory Scene Event (VOLATILE — only if shakeup triggered)
	if (shakeupInstruction) {
		sections.push(
			`[Mandatory Scene Event]\n${shakeupInstruction}\n[/Mandatory Scene Event]`,
		);
	}

	// 9. Recent Messages (VOLATILE)
	const recentMessages = getRecentMessages(stContext, 5);
	if (recentMessages) {
		sections.push(`[Recent Messages]\n${recentMessages}\n[/Recent Messages]`);
	}

	return sections.join('\n\n');
}

/**
 * Get character description from ST context.
 */
function getCharacterDescription(stContext: STContext): string {
	const char = stContext.characters?.[stContext.characterId];
	if (!char) return '';
	const parts: string[] = [];
	if (char.description) parts.push(char.description);
	if (char.personality) parts.push(`Personality: ${char.personality}`);
	if (char.scenario) parts.push(`Scenario: ${char.scenario}`);
	return parts.join('\n\n');
}

/**
 * Get user description from ST context.
 */
function getUserDescription(stContext: STContext): string {
	return stContext.powerUserSettings?.persona_description || stContext.persona || '';
}

/**
 * Get recent messages as formatted strings.
 * Excludes the last message if it's an assistant message (swipe/regen scenario),
 * since that message is about to be replaced and shouldn't inform the beat plan.
 */
function getRecentMessages(stContext: STContext, count: number): string {
	const chat = stContext.chat;
	if (chat.length === 0) return '';

	// During swipe/regen, the last message is the assistant response being replaced.
	// Exclude it so the pipeline plans based on what the user said, not the old response.
	const lastMsg = chat[chat.length - 1];
	const endIndex = lastMsg && !lastMsg.is_user ? chat.length - 1 : chat.length;

	const messages: string[] = [];
	const start = Math.max(0, endIndex - count);
	for (let i = start; i < endIndex; i++) {
		const msg = chat[i];
		if (msg.mes) {
			messages.push(`${msg.name}: ${msg.mes}`);
		}
	}
	return messages.join('\n\n');
}

/**
 * Format relationships for present characters.
 */
function formatRelationshipsForContext(projection: Projection): string {
	const presentSet = new Set(projection.charactersPresent);
	const formatted: string[] = [];

	for (const rel of Object.values(projection.relationships)) {
		if (presentSet.has(rel.pair[0]) && presentSet.has(rel.pair[1])) {
			const lines: string[] = [`${rel.pair[0]} & ${rel.pair[1]}: ${rel.status}`];

			if (rel.aToB.feelings.length > 0)
				lines.push(
					`  ${rel.pair[0]} → ${rel.pair[1]}: feels ${rel.aToB.feelings.join(', ')}`,
				);
			if (rel.aToB.wants.length > 0)
				lines.push(`  ${rel.pair[0]} wants: ${rel.aToB.wants.join(', ')}`);
			if (rel.aToB.secrets.length > 0)
				lines.push(
					`  ${rel.pair[0]} hides: ${rel.aToB.secrets.join(', ')}`,
				);

			if (rel.bToA.feelings.length > 0)
				lines.push(
					`  ${rel.pair[1]} → ${rel.pair[0]}: feels ${rel.bToA.feelings.join(', ')}`,
				);
			if (rel.bToA.wants.length > 0)
				lines.push(`  ${rel.pair[1]} wants: ${rel.bToA.wants.join(', ')}`);
			if (rel.bToA.secrets.length > 0)
				lines.push(
					`  ${rel.pair[1]} hides: ${rel.bToA.secrets.join(', ')}`,
				);

			formatted.push(lines.join('\n'));
		}
	}

	return formatted.length > 0 ? formatted.join('\n\n') : '';
}

/**
 * Build narrative context with HALF the token budget.
 */
async function buildNarrativeContext(
	store: EventStore,
	swipeContext: SwipeContext,
	injectionTokenBudget: number,
	maxRecentChapters: number,
	maxRecentEvents: number,
	stContext: STContext,
): Promise<string> {
	const tokenCounter = getDefaultTokenCounter();
	const halfBudget = Math.floor((injectionTokenBudget || 4000) / 2);

	try {
		const plan = await computeOptimalContext({
			budget: halfBudget,
			stateTokens: 0,
			messageTokens: new Map(),
			store,
			swipeContext,
			maxPastChapters: maxRecentChapters,
			maxEvents: maxRecentEvents,
			totalMessages: stContext.chat.length,
			tokenCounter,
		});

		const parts: string[] = [];

		if (plan.pastChapters.length > 0) {
			const chapters = formatPrecomputedChapters(plan.pastChapters);
			if (chapters) parts.push(chapters);
		}

		if (plan.currentChapterEvents.length > 0) {
			const events = formatOutOfContextEvents(
				plan.currentChapterEvents,
				plan.currentChapterEvents.length,
			);
			if (events) parts.push(events);
		}

		return parts.join('\n\n');
	} catch {
		return '';
	}
}
