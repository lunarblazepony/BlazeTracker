// ============================================
// Prompt Configuration System
// ============================================

import { getSettings } from '../settings';

// Re-export types
export type {
	PromptKey,
	PromptPlaceholder,
	PromptDefinition,
	CustomPrompts,
	PromptParts,
} from './types';
export { COMMON_PLACEHOLDERS } from './common';

// Import all prompt modules
import { TIME_PROMPTS } from './timePrompt';
import { LOCATION_PROMPTS } from './locationPrompt';
import { CLIMATE_PROMPTS } from './climatePrompt';
import { CHARACTERS_PROMPTS } from './charactersPrompt';
import { SCENE_PROMPTS } from './scenePrompt';
import { EVENT_PROMPTS } from './eventPrompt';
import { CHAPTER_PROMPTS } from './chapterPrompt';
import { RELATIONSHIP_PROMPTS } from './relationshipPrompt';
import { RELATIONSHIP_ATTITUDE_PROMPTS } from './relationshipAttitudePrompt';
import { MILESTONE_PROMPTS } from './milestonePrompt';

import type {
	PromptKey,
	PromptDefinition,
	PromptPlaceholder,
	CustomPrompts,
	PromptParts,
} from './types';

// ============================================
// Aggregate All Prompts
// ============================================

export const DEFAULT_PROMPTS: Record<PromptKey, PromptDefinition> = {
	...TIME_PROMPTS,
	...LOCATION_PROMPTS,
	...CLIMATE_PROMPTS,
	...CHARACTERS_PROMPTS,
	...SCENE_PROMPTS,
	...EVENT_PROMPTS,
	...CHAPTER_PROMPTS,
	...RELATIONSHIP_PROMPTS,
	...RELATIONSHIP_ATTITUDE_PROMPTS,
	...MILESTONE_PROMPTS,
} as Record<PromptKey, PromptDefinition>;

// ============================================
// Public API
// ============================================

/**
 * Get prompt parts (system + user) for optimal LLM caching.
 * System prompt contains static instructions/examples (gets prefix-cached).
 * User template contains only dynamic placeholders.
 *
 * Custom prompts override both parts - they should include the full prompt
 * which will be placed in the user message (legacy behavior).
 */
export function getPromptParts(key: PromptKey): PromptParts {
	const settings = getSettings();
	const customPrompts = settings.customPrompts as CustomPrompts | undefined;

	// Custom prompts use legacy single-string format in user message
	if (customPrompts?.[key]) {
		return {
			system: 'You are an extraction agent. Return only valid JSON.',
			user: customPrompts[key],
		};
	}

	const def = DEFAULT_PROMPTS[key];
	return {
		system: def.systemPrompt,
		user: def.userTemplate,
	};
}

/**
 * @deprecated Use getPromptParts for new code. This returns just the user template
 * for backward compatibility.
 */
export function getPrompt(key: PromptKey): string {
	const settings = getSettings();
	const customPrompts = settings.customPrompts as CustomPrompts | undefined;

	if (customPrompts?.[key]) {
		return customPrompts[key];
	}

	// Return user template for backward compat - extractors should migrate to getPromptParts
	return DEFAULT_PROMPTS[key].userTemplate;
}

/**
 * Get all prompt definitions for UI display.
 */
export function getAllPromptDefinitions(): PromptDefinition[] {
	return Object.values(DEFAULT_PROMPTS);
}

/**
 * Get a specific prompt definition.
 */
export function getPromptDefinition(key: PromptKey): PromptDefinition {
	return DEFAULT_PROMPTS[key];
}

/**
 * Check if a prompt has been customized.
 */
export function isPromptCustomized(key: PromptKey): boolean {
	const settings = getSettings();
	const customPrompts = settings.customPrompts as CustomPrompts | undefined;
	return !!customPrompts?.[key];
}

/**
 * Get placeholder documentation for a prompt.
 */
export function getPlaceholderDocs(key: PromptKey): PromptPlaceholder[] {
	return DEFAULT_PROMPTS[key].placeholders;
}
