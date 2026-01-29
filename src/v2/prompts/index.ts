/**
 * V2 Prompts Index
 *
 * Re-exports all prompts, types, and utilities.
 */

// Types
export type {
	PromptTemplate,
	JSONSchema,
	Placeholder,
	BuiltPrompt,
	PromptCategory,
	PromptRegistry,
	CustomPromptOverrides,
} from './types';

// Placeholder utilities
export {
	PLACEHOLDERS,
	replacePlaceholders,
	extractPlaceholders,
	validatePlaceholders,
	buildPrompt,
	getPromptPlaceholders,
} from './placeholders';

// Schemas
export * from './schemas';

// Initial extraction prompts
export {
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

// Event extraction prompts
export {
	// Chapter prompts
	chapterEndedPrompt,
	chapterDescriptionPrompt,
	// Narrative prompts
	narrativeDescriptionPrompt,
	milestoneDescriptionPrompt,
	// Scene/Environment change prompts
	timeChangePrompt,
	locationChangePrompt,
	propsChangePrompt,
	propsConfirmationPrompt,
	climateChangePrompt,
	topicToneChangePrompt,
	tensionChangePrompt,
	// Character change prompts
	presenceChangePrompt,
	positionChangePrompt,
	activityChangePrompt,
	moodChangePrompt,
	outfitChangePrompt,
	// Relationship change prompts
	feelingsChangePrompt,
	secretsChangePrompt,
	wantsChangePrompt,
	statusChangePrompt,
	subjectsPrompt,
	subjectsConfirmationPrompt,
} from './events';

// Registry functions for settings UI
export { V2_PROMPT_REGISTRY, getAllV2Prompts, getV2Prompt, hasV2Prompt } from './registry';
