/**
 * V2 Prompt Registry
 *
 * Centralized registry for all V2 prompts, providing easy access
 * for the settings UI and extractors.
 */

import type { PromptTemplate } from './types';

// Import all initial prompts
import {
	initialTimePrompt,
	initialLocationPrompt,
	initialPropsPrompt,
	initialClimatePrompt,
	initialCharactersPresentPrompt,
	initialCharacterOutfitsPrompt,
	initialRelationshipsPrompt,
	initialTopicTonePrompt,
	initialTensionPrompt,
} from './initial';

// Import all event prompts
import {
	chapterEndedPrompt,
	chapterDescriptionPrompt,
	narrativeDescriptionPrompt,
	milestoneDescriptionPrompt,
	timeChangePrompt,
	locationChangePrompt,
	propsChangePrompt,
	propsConfirmationPrompt,
	climateChangePrompt,
	topicToneChangePrompt,
	tensionChangePrompt,
	presenceChangePrompt,
	positionChangePrompt,
	activityChangePrompt,
	moodChangePrompt,
	outfitChangePrompt,
	feelingsChangePrompt,
	secretsChangePrompt,
	wantsChangePrompt,
	statusChangePrompt,
	subjectsPrompt,
	subjectsConfirmationPrompt,
	appearedCharacterOutfitPrompt,
	positionActivityChangePrompt,
	moodPhysicalChangePrompt,
	characterStateConsolidationPrompt,
	relationshipAttitudeConsolidationPrompt,
} from './events';

/**
 * Registry of all V2 prompts by name.
 */
export const V2_PROMPT_REGISTRY: Record<string, PromptTemplate<unknown>> = {
	// Initial prompts
	[initialTimePrompt.name]: initialTimePrompt,
	[initialLocationPrompt.name]: initialLocationPrompt,
	[initialPropsPrompt.name]: initialPropsPrompt,
	[initialClimatePrompt.name]: initialClimatePrompt,
	[initialCharactersPresentPrompt.name]: initialCharactersPresentPrompt,
	[initialCharacterOutfitsPrompt.name]: initialCharacterOutfitsPrompt,
	[initialRelationshipsPrompt.name]: initialRelationshipsPrompt,
	[initialTopicTonePrompt.name]: initialTopicTonePrompt,
	[initialTensionPrompt.name]: initialTensionPrompt,

	// Event prompts - Chapter/Narrative
	[chapterEndedPrompt.name]: chapterEndedPrompt,
	[chapterDescriptionPrompt.name]: chapterDescriptionPrompt,
	[narrativeDescriptionPrompt.name]: narrativeDescriptionPrompt,
	[milestoneDescriptionPrompt.name]: milestoneDescriptionPrompt,

	// Event prompts - Scene/Environment
	[timeChangePrompt.name]: timeChangePrompt,
	[locationChangePrompt.name]: locationChangePrompt,
	[propsChangePrompt.name]: propsChangePrompt,
	[propsConfirmationPrompt.name]: propsConfirmationPrompt,
	[climateChangePrompt.name]: climateChangePrompt,
	[topicToneChangePrompt.name]: topicToneChangePrompt,
	[tensionChangePrompt.name]: tensionChangePrompt,

	// Event prompts - Character
	[presenceChangePrompt.name]: presenceChangePrompt,
	[positionChangePrompt.name]: positionChangePrompt,
	[activityChangePrompt.name]: activityChangePrompt,
	[moodChangePrompt.name]: moodChangePrompt,
	[outfitChangePrompt.name]: outfitChangePrompt,
	[appearedCharacterOutfitPrompt.name]: appearedCharacterOutfitPrompt,
	[positionActivityChangePrompt.name]: positionActivityChangePrompt,
	[moodPhysicalChangePrompt.name]: moodPhysicalChangePrompt,
	[characterStateConsolidationPrompt.name]: characterStateConsolidationPrompt,

	// Event prompts - Relationship
	[feelingsChangePrompt.name]: feelingsChangePrompt,
	[secretsChangePrompt.name]: secretsChangePrompt,
	[wantsChangePrompt.name]: wantsChangePrompt,
	[statusChangePrompt.name]: statusChangePrompt,
	[subjectsPrompt.name]: subjectsPrompt,
	[subjectsConfirmationPrompt.name]: subjectsConfirmationPrompt,
	[relationshipAttitudeConsolidationPrompt.name]: relationshipAttitudeConsolidationPrompt,
};

/**
 * Get all V2 prompts as an array.
 */
export function getAllV2Prompts(): PromptTemplate<unknown>[] {
	return Object.values(V2_PROMPT_REGISTRY);
}

/**
 * Get a specific V2 prompt by name.
 */
export function getV2Prompt(name: string): PromptTemplate<unknown> | undefined {
	return V2_PROMPT_REGISTRY[name];
}

/**
 * Check if a prompt exists in the registry.
 */
export function hasV2Prompt(name: string): boolean {
	return name in V2_PROMPT_REGISTRY;
}
