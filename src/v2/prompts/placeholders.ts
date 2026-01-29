/**
 * V2 Placeholder Definitions and Utilities
 *
 * Defines all placeholders used across prompts and provides
 * functions for replacing them in templates.
 */

import type { Placeholder, BuiltPrompt, PromptTemplate, CustomPromptOverrides } from './types';

// ============================================
// Placeholder Definitions
// ============================================

/**
 * All placeholder definitions used across prompts.
 */
export const PLACEHOLDERS: Record<string, Placeholder> = {
	// Message content
	messages: {
		name: 'messages',
		description: 'Recent roleplay messages formatted as "Name: message content"',
		example: 'Elena: *She walked into the dimly lit bar, her heels clicking against the worn wooden floor. The smell of cigarette smoke and cheap whiskey hung heavy in the air.*\n\nMarcus: "You made it." *He didn\'t look up from his drink, the amber liquid swirling as he tilted the glass.*',
	},

	// Character information
	characterName: {
		name: 'characterName',
		description: 'Name of the main character',
		example: 'Elena',
	},
	characterDescription: {
		name: 'characterDescription',
		description: 'Full description of the main character from their card',
		example: 'Elena is a 28-year-old former thief who now works as a private investigator. She has sharp green eyes, auburn hair usually tied back, and a scar on her left cheek from her past life...',
	},
	userName: {
		name: 'userName',
		description: 'Name of the user/persona',
		example: 'Marcus',
	},
	userDescription: {
		name: 'userDescription',
		description: 'Description of the user persona',
		example: 'Marcus is a grizzled detective in his late 40s. Years on the force have left him cynical but not without compassion...',
	},

	// Current state context
	currentTime: {
		name: 'currentTime',
		description: 'Current narrative time as formatted string',
		example: 'Monday, June 15, 2024 at 2:30 PM',
	},
	currentLocation: {
		name: 'currentLocation',
		description: 'Current location summary (area - place - position)',
		example: 'Downtown Seattle - The Rusty Nail bar - Corner booth near the back',
	},
	currentArea: {
		name: 'currentArea',
		description: 'Current area/neighborhood',
		example: 'Downtown Seattle',
	},
	currentPlace: {
		name: 'currentPlace',
		description: 'Current specific place/building',
		example: 'The Rusty Nail bar',
	},
	currentPosition: {
		name: 'currentPosition',
		description: 'Current position within the place',
		example: 'Corner booth near the back',
	},
	currentProps: {
		name: 'currentProps',
		description: 'List of nearby objects/props in the scene',
		example: 'worn leather booth seats, scratched wooden table, half-empty whiskey bottle, overflowing ashtray',
	},
	currentWeather: {
		name: 'currentWeather',
		description: 'Current weather and temperature',
		example: 'Overcast, 58°F, light drizzle',
	},

	// Character state
	charactersPresent: {
		name: 'charactersPresent',
		description: 'Names of characters currently present in the scene',
		example: 'Elena, Marcus, the bartender',
	},
	charactersSummary: {
		name: 'charactersSummary',
		description: 'Summary of characters with their current states',
		example: 'Elena: Position: sitting across from Marcus | Mood: anxious, hopeful | Wearing: black leather jacket, white blouse\nMarcus: Position: slouched in booth | Mood: brooding, suspicious | Wearing: rumpled suit, loosened tie',
	},
	targetCharacter: {
		name: 'targetCharacter',
		description: 'The specific character being analyzed',
		example: 'Elena',
	},
	targetCharacterState: {
		name: 'targetCharacterState',
		description: 'Current state of the target character',
		example: 'Position: sitting across from Marcus\nActivity: nursing a whiskey\nMood: anxious, hopeful\nOutfit: black leather jacket, white blouse, dark jeans, ankle boots',
	},

	// Outfit context
	characterOutfits: {
		name: 'characterOutfits',
		description:
			'Current clothing/accessories worn by characters (should not be extracted as scene props)',
		example: 'Elena: black leather jacket, white blouse, dark jeans, ankle boots\nMarcus: rumpled gray suit, loosened red tie, dress shoes',
	},
	outfitChanges: {
		name: 'outfitChanges',
		description: 'Recent outfit changes - items added (put on) and removed (taken off)',
		example: 'Elena: removed: black leather jacket | added: none\nMarcus: removed: suit jacket, tie | added: none',
	},

	// Scene state
	currentTopic: {
		name: 'currentTopic',
		description: 'Current conversation/scene topic',
		example: 'planning the heist',
	},
	currentTone: {
		name: 'currentTone',
		description: 'Current scene tone',
		example: 'tense but professional',
	},
	currentTension: {
		name: 'currentTension',
		description: 'Current tension state (level, type, direction)',
		example: 'Level: tense | Type: negotiation | Direction: escalating',
	},

	// Relationship context
	characterPairs: {
		name: 'characterPairs',
		description: 'All known character pairs to analyze for relationships',
		example: '- Elena and Marcus\n- Elena and Sofia',
	},
	relationshipPair: {
		name: 'relationshipPair',
		description: 'The two characters in the relationship (single pair)',
		example: 'Elena and Marcus',
	},
	relationshipStatus: {
		name: 'relationshipStatus',
		description: 'Current relationship status',
		example: 'complicated',
	},
	relationshipState: {
		name: 'relationshipState',
		description: 'Full relationship state including feelings, secrets, wants',
		example: 'Status: complicated\nElena toward Marcus: feelings: trusting, attracted | secrets: knows about his past | wants: partnership, romance\nMarcus toward Elena: feelings: protective, conflicted | secrets: hiding his true motives | wants: her skills for the job',
	},

	// Character profile context
	characterProfile: {
		name: 'characterProfile',
		description:
			'Condensed character profile (sex, species, age, appearance tags, personality tags)',
		example: 'Elena (F, Human, 28): Appearance: auburn hair, sharp green eyes, athletic build, scar on left cheek | Personality: clever, guarded, determined, compassionate',
	},
	characterProfiles: {
		name: 'characterProfiles',
		description: 'Profiles for all present characters',
		example: 'Elena (F, Human, 28): Appearance: auburn hair, sharp green eyes | Personality: clever, guarded\nMarcus (M, Human, 47): Appearance: graying hair, tired eyes | Personality: cynical, protective',
	},
	relationshipProfiles: {
		name: 'relationshipProfiles',
		description: 'Profiles for both characters in a relationship pair',
		example: 'Elena (F, Human, 28): Appearance: auburn hair, sharp green eyes | Personality: clever, guarded\nMarcus (M, Human, 47): Appearance: graying hair, tired eyes | Personality: cynical, protective',
	},

	// Chapter/narrative context
	currentChapter: {
		name: 'currentChapter',
		description: 'Current chapter number',
		example: '3',
	},
	chapterSummaries: {
		name: 'chapterSummaries',
		description: 'Summaries of previous chapters',
		example: 'Chapter 1: Elena and Marcus meet at the bar, establishing their uneasy alliance.\nChapter 2: The first reconnaissance mission goes wrong, forcing them to trust each other.',
	},
	recentEvents: {
		name: 'recentEvents',
		description: 'Recent significant events in the narrative',
		example: '- Marcus revealed he used to be a cop\n- Elena shared her real name\n- They agreed to work together on the heist',
	},

	// Schema placeholders
	schema: {
		name: 'schema',
		description: 'JSON schema defining expected output format',
		example: '{ "type": "object", "properties": { ... } }',
	},
	schemaExample: {
		name: 'schemaExample',
		description: 'Example output matching the schema',
		example: '{ "area": "Downtown Seattle", "place": "The Rusty Nail bar", ... }',
	},
};

// ============================================
// Placeholder Replacement
// ============================================

/**
 * Replace all {{placeholder}} tokens in a template with their values.
 *
 * @param template - Template string with {{placeholder}} tokens
 * @param values - Map of placeholder names to values
 * @returns Template with placeholders replaced
 * @throws Error if a placeholder is used but not provided
 */
export function replacePlaceholders(template: string, values: Record<string, string>): string {
	return template.replace(/\{\{(\w+)\}\}/g, (match, name) => {
		if (!(name in values)) {
			throw new Error(`Missing placeholder value for {{${name}}}`);
		}
		return values[name];
	});
}

/**
 * Extract all placeholder names from a template.
 *
 * @param template - Template string with {{placeholder}} tokens
 * @returns Array of placeholder names found
 */
export function extractPlaceholders(template: string): string[] {
	const matches = template.matchAll(/\{\{(\w+)\}\}/g);
	const names = new Set<string>();
	for (const match of matches) {
		names.add(match[1]);
	}
	return Array.from(names);
}

/**
 * Validate that all placeholders in a template are documented.
 *
 * @param template - Template string to validate
 * @param documented - Array of documented placeholder names
 * @returns Array of undocumented placeholder names (empty if all valid)
 */
export function validatePlaceholders(template: string, documented: string[]): string[] {
	const used = extractPlaceholders(template);
	const documentedSet = new Set(documented);
	return used.filter(name => !documentedSet.has(name));
}

// ============================================
// Prompt Building
// ============================================

/**
 * Build a prompt by filling in placeholders.
 *
 * @param prompt - The prompt template
 * @param values - Placeholder values
 * @param overrides - Optional custom prompt overrides from settings
 * @returns Built prompt with system and user parts
 */
export function buildPrompt<T>(
	prompt: PromptTemplate<T>,
	values: Record<string, string>,
	overrides?: CustomPromptOverrides,
): BuiltPrompt {
	const override = overrides?.[prompt.name];

	const systemPrompt = override?.systemPrompt ?? prompt.systemPrompt;
	const userTemplate = override?.userTemplate ?? prompt.userTemplate;

	return {
		system: systemPrompt,
		user: replacePlaceholders(userTemplate, values),
	};
}

/**
 * Get all placeholder names that a prompt expects.
 */
export function getPromptPlaceholders<T>(prompt: PromptTemplate<T>): string[] {
	return prompt.placeholders.map(p => p.name);
}
