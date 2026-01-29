// ============================================
// Prompt Types
// ============================================

export type PromptKey =
	| 'time_datetime'
	| 'time_delta'
	| 'location_initial'
	| 'location_update'
	| 'location_props'
	| 'climate_initial'
	| 'climate_update'
	| 'characters_initial'
	| 'characters_initial_outfit'
	| 'characters_presence'
	| 'characters_position'
	| 'characters_activity'
	| 'characters_mood'
	| 'characters_outfit'
	| 'characters_physical'
	| 'scene_initial'
	| 'scene_update'
	| 'event_extract'
	| 'chapter_boundary'
	| 'relationship_initial'
	| 'relationship_feelings'
	| 'relationship_secrets'
	| 'relationship_wants'
	| 'relationship_status'
	| 'milestone_description'
	| 'milestone_confirm';

export interface PromptPlaceholder {
	name: string;
	description: string;
	example: string;
}

export interface PromptDefinition {
	key: PromptKey;
	name: string;
	description: string;
	placeholders: PromptPlaceholder[];
	/**
	 * Static system prompt containing instructions, schema, and examples.
	 * This content gets prefix-cached by the LLM provider.
	 */
	systemPrompt: string;
	/**
	 * Dynamic user template containing only placeholders for variable content.
	 * This is the only part that changes per-request.
	 */
	userTemplate: string;
	defaultTemperature: number;
}

export interface PromptParts {
	system: string;
	user: string;
}

export interface CustomPrompts {
	[key: string]: string;
}
