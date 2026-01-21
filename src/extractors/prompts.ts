// ============================================
// Prompt Configuration System
// ============================================

// Adjust this import path based on your project structure:
import { getSettings } from '../settings';

// ============================================
// Prompt Types
// ============================================

export type PromptKey =
	| 'time_datetime'
	| 'time_delta'
	| 'location_initial'
	| 'location_update'
	| 'climate_initial'
	| 'climate_update'
	| 'characters_initial'
	| 'characters_update'
	| 'scene_initial'
	| 'scene_update';

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
	default: string;
	defaultTemperature: number;
}

export interface CustomPrompts {
	[key: string]: string;
}

// ============================================
// Placeholder Documentation
// ============================================

const COMMON_PLACEHOLDERS: Record<string, PromptPlaceholder> = {
	messages: {
		name: '{{messages}}',
		description: 'Recent roleplay messages formatted as "Name: message content"',
		example: 'Elena: *She walked into the bar*\n\nMarcus: "You made it."',
	},
	characterInfo: {
		name: '{{characterInfo}}',
		description: 'Character name and description (only on initial extraction)',
		example: 'Name: Elena\nDescription: A cunning thief with a heart of gold...',
	},
	userInfo: {
		name: '{{userInfo}}',
		description: 'User persona name and description (only on initial extraction)',
		example: 'Name: Marcus\nDescription: A grizzled detective...',
	},
	previousState: {
		name: '{{previousState}}',
		description: 'JSON of the previous state for this extractor',
		example: '{ "area": "Downtown", "place": "Bar", ... }',
	},
	schema: {
		name: '{{schema}}',
		description: 'JSON schema defining the expected output format',
		example: '{ "type": "object", "properties": { ... } }',
	},
	schemaExample: {
		name: '{{schemaExample}}',
		description: 'Example output matching the schema',
		example: '{ "area": "Downtown Seattle", ... }',
	},
	narrativeTime: {
		name: '{{narrativeTime}}',
		description: 'Current narrative time as formatted string',
		example: 'Monday, June 15, 2024 at 2:30 PM',
	},
	location: {
		name: '{{location}}',
		description: 'Current location summary',
		example: 'Downtown Seattle - The Rusty Nail bar (Corner booth)',
	},
	currentTime: {
		name: '{{currentTime}}',
		description: 'Current narrative time for context',
		example: 'Monday, June 15, 2024 at 2:30 PM',
	},
	charactersSummary: {
		name: '{{charactersSummary}}',
		description: 'Brief summary of characters present with moods/activities',
		example: 'Elena: anxious, hopeful - Watching the door\nMarcus: scheming - Drinking wine',
	},
};

// ============================================
// Default Prompts
// ============================================

export const DEFAULT_PROMPTS: Record<PromptKey, PromptDefinition> = {
	time_datetime: {
		key: 'time_datetime',
		name: 'Time - Initial DateTime',
		description: 'Extracts the narrative date and time from the scene opening',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze this roleplay scene opening and determine the narrative date and time. You must only return valid JSON with no commentary.

<instructions>
- Determine the date and time when this scene takes place.
- Look for explicit mentions: "Monday morning", "3pm", "June 15th", "winter evening", etc.
- Look for contextual clues: weather, lighting, activities, meals, seasons.
- If the year is not specified, infer from context or use a reasonable modern year.
- If the month is not specified, infer from seasonal/weather clues or use a reasonable default.
- If the day is not specified, use a reasonable default (e.g., 15 for mid-month).
- Always provide complete values for all fields - never omit anything.
- Use 24-hour format for the hour field.
</instructions>

<scene_opening>
{{messages}}
</scene_opening>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the narrative date and time as valid JSON:`,
	},

	time_delta: {
		key: 'time_delta',
		name: 'Time - Delta',
		description: 'Determines how much narrative time has passed in the messages',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.currentTime,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze these roleplay messages and determine how much narrative time has passed. You must only return valid JSON with no commentary.

<instructions>
- Determine how much time passes WITHIN these messages based on their actual content.
- The example output below is just showing the JSON format - do NOT copy its values.
- Look for explicit time jumps: "an hour later", "after a few minutes", "the next morning".
- Look for implicit time passage: travel, sleeping, waiting, activities with known durations.
- If the messages are just dialogue or immediate action with no time skip, return small values (0-2 minutes).
- Estimate based on what actually happens in the messages:
  * Pure dialogue exchange: 1-2 minutes
  * Walking somewhere nearby: 5-15 minutes
  * Driving across town: 15-45 minutes
  * Napping: 1-3 hours (consider currentTime)
  * Sleeping overnight: 6-10 hours (consider currentTime)
  * "A few minutes": 3-5 minutes
  * "A while": 15-30 minutes
  * "Some time": 30-60 minutes
- Be conservative - if unsure, prefer smaller time jumps.
- Return 0 for all fields if no time has passed.
</instructions>

<current_time>
{{currentTime}}
</current_time>

<messages>
{{messages}}
</messages>

<schema>
{{schema}}
</schema>

<output_format_example>
{{schemaExample}}
</output_format_example>

Based on the actual content of the messages above, extract the time delta as valid JSON:`,
	},

	location_initial: {
		key: 'location_initial',
		name: 'Location - Initial',
		description: 'Extracts location from the scene opening',
		defaultTemperature: 0.5,
		placeholders: [
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze this roleplay scene and extract the current location. You must only return valid JSON with no commentary.

<instructions>
- Determine where this scene takes place.
- The 'area' should be a town, city or region (e.g. 'Huntsville, AL', 'London, Great Britain', 'Mt. Doom, Middle Earth', 'Ponyville, Equestria')
- The 'place' should be a building or sub-section (e.g. 'John's Warehouse', 'Fleet Street McDonalds', 'Slime-Covered Cave', 'School of Friendship')
- The 'position' should be a location within the place (e.g. 'Manager's Office', 'The Corner Booth', 'Underground River Bed', 'Rarity's Classroom')
- Props are nearby items that affect or could affect the scene - be specific about their state.
- If location is not explicit, infer from context clues: character descriptions, activities, mentioned objects.
</instructions>

<character_info>
{{characterInfo}}
</character_info>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the location as valid JSON:`,
	},

	location_update: {
		key: 'location_update',
		name: 'Location - Update',
		description: 'Updates location based on recent messages',
		defaultTemperature: 0.5,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze these roleplay messages and extract any location changes. You must only return valid JSON with no commentary.

<instructions>
- Determine if the location has changed from the previous state.
- Track any movement: characters entering new rooms, traveling, position changes within a space.
- Update props: new items introduced, items picked up/removed, items changing state.
- If no location change occurred, return the previous location but consider prop changes.
- Be careful to track items that have been picked up (remove from props) or put down (add to props).
- Prune props that are no longer relevant to the scene.
</instructions>

<previous_location>
{{previousState}}
</previous_location>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the current location as valid JSON:`,
	},

	climate_initial: {
		key: 'climate_initial',
		name: 'Climate - Initial',
		description: 'Extracts weather and temperature from scene opening',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.narrativeTime,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze this roleplay scene and determine the current climate/weather. You must only return valid JSON with no commentary.

<instructions>
- Determine the weather and temperature for this scene.
- Consider the narrative time and location to infer season and typical weather.
- Look for explicit weather mentions: rain, snow, sunshine, etc.
- Look for contextual clues: characters wearing coats, sweating, mentioning cold/heat.
- If characters are indoors, weather should be what it is outside, but temperature should be indoor temperature.
- Consider the hemisphere: December is winter in the northern hemisphere, summer in the southern.
- Temperature should be in Fahrenheit.
</instructions>

<narrative_time>
{{narrativeTime}}
</narrative_time>

<location>
{{location}}
</location>

<character_info>
{{characterInfo}}
</character_info>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the climate as valid JSON:`,
	},

	climate_update: {
		key: 'climate_update',
		name: 'Climate - Update',
		description: 'Updates weather/temperature based on recent messages',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.narrativeTime,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze these roleplay messages and determine if the climate has changed. You must only return valid JSON with no commentary.

<instructions>
- Check if weather or temperature has changed since the previous state.
- Weather can change: storm rolling in, rain stopping, etc.
- Temperature can change: moving indoors/outdoors, time passing, heating/AC mentioned.
- Consider the current narrative time when inferring temperature changes.
- If characters moved indoors/outdoors, adjust temperature accordingly.
- Temperature should be in Fahrenheit.
</instructions>

<narrative_time>
{{narrativeTime}}
</narrative_time>

<current_location>
{{location}}
</current_location>

<previous_climate>
{{previousState}}
</previous_climate>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the current climate as valid JSON:`,
	},

	characters_initial: {
		key: 'characters_initial',
		name: 'Characters - Initial',
		description: 'Extracts all character states from scene opening',
		defaultTemperature: 0.7,
		placeholders: [
			COMMON_PLACEHOLDERS.userInfo,
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze this roleplay scene and extract all character states. You must only return valid JSON with no commentary.

<instructions>
<general>
- Extract all characters present in the scene.
- For each character, determine their position, activity, mood, physical state, outfit, and dispositions.
- Make reasonable inferences where information is not explicit.
</general>
<outfit_rules>
- Consider whether the character would usually wear clothes (ponies, Pokémon, animals typically don't).
- For non-clothed species, return null for all outfit slots unless explicitly dressed.
- Be specific: 't-shirt' not 'default top' or 'unspecified top'.
- Include underwear/socks with reasonable assumptions for clothed characters.
- Fur, scales, and other anatomy do NOT count as outfit items.
</outfit_rules>
<dispositions>
- Only include dispositions for characters who know each other exists.
- Feelings should be specific: 'suspicious', 'attracted', 'annoyed', not just 'positive'.
</dispositions>
</instructions>

<character_info>
{{userInfo}}

{{characterInfo}}
</character_info>

<current_location>
{{location}}
</current_location>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract all characters as valid JSON array:`,
	},

	characters_update: {
		key: 'characters_update',
		name: 'Characters - Update',
		description: 'Updates character states based on recent messages',
		defaultTemperature: 0.7,
		placeholders: [
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze these roleplay messages and update character states. You must only return valid JSON with no commentary.

<instructions>
<general>
- Start from the previous state and apply changes from the messages.
- Watch for: characters entering/exiting, position changes, mood shifts, outfit changes.
- Remove characters who have left the scene. Add characters who have entered.
</general>
<outfit_tracking>
- If clothing is removed, set that slot to null.
- Add removed clothing to location props (handled separately, just set slot to null here).
- Do NOT suffix with '(off)', '(removed)' - just set to null.
- Be specific about partially removed items: 'white panties (pulled aside)'.
- Track which foot if only one shoe/sock remains.
</outfit_tracking>
<position_and_mood>
- Update positions as characters move.
- Update moods based on dialogue, reactions, internal thoughts.
- Update dispositions as relationships evolve.
</position_and_mood>
<pruning>
- Update goals as they're achieved or abandoned.
- Clear physical states that have resolved.
- Keep dispositions current - remove outdated feelings, add new ones.
</pruning>
</instructions>

<current_location>
{{location}}
</current_location>

<previous_characters>
{{previousState}}
</previous_characters>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract updated characters as valid JSON array:`,
	},

	scene_initial: {
		key: 'scene_initial',
		name: 'Scene - Initial',
		description: 'Extracts scene topic, tone, tension, and events from opening',
		defaultTemperature: 0.6,
		placeholders: [
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.charactersSummary,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze this roleplay scene and extract the scene state. You must only return valid JSON with no commentary.

<instructions>
<general>
- Determine the topic, tone, tension, and significant events of the scene.
- Topic should be 3-5 words summarizing the main focus.
- Tone should be 2-3 words capturing the emotional atmosphere.
</general>
<tension>
- Direction will be calculated automatically, but set your best guess.
<levels>
Tension levels form a spectrum of emotional/dramatic intensity (applies to ALL tension types):
- relaxed: Low stakes, comfortable. Casual chat, downtime, nothing pressing.
- aware: Mild interest or attention. Something noted but no real stakes yet.
- guarded: Careful, measured. Testing waters - whether for trust, attraction, or safety.
- tense: Stakes feel real. Could be conflict brewing, unspoken attraction, or difficult truth approaching.
- charged: Intense emotions dominate. Anger before a fight, desire before a kiss, fear before confession.
- volatile: On the edge. One word changes everything - into violence, intimacy, or revelation.
- explosive: The moment itself. Fight breaks out, characters kiss or engage in sex, secret revealed, breakdown happens.
</levels>
<types>
Tension type describes the nature of what's driving the tension:
- conversation: Neutral dialogue, information exchange, casual interaction.
- negotiation: Competing interests seeking agreement. Deals, persuasion, bargaining.
- confrontation: Direct opposition or conflict. Arguments, accusations, standoffs.
- intimate: Emotional/physical closeness. Romance, deep sharing, intimacy, sexual tension.
- vulnerable: Exposure of weakness or secrets. Confessions, emotional risk, asking for help.
- suspense: Uncertainty about outcome. Waiting, anticipation, something about to happen.
- celebratory: Positive excitement. Joy, triumph, celebration, shared happiness.
</types>
</tension>
<recent_events>
- Include significant events that affect the ongoing narrative.
- Events should be consequential: discoveries, relationship changes, injuries, commitments.
- Maximum 5 events, prioritize the most important ones.
</recent_events>
</instructions>

<character_info>
{{userInfo}}

{{characterInfo}}
</character_info>

<characters_present>
{{charactersSummary}}
</characters_present>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the scene state as valid JSON:`,
	},

	scene_update: {
		key: 'scene_update',
		name: 'Scene - Update',
		description: 'Updates scene state based on recent messages',
		defaultTemperature: 0.6,
		placeholders: [
			COMMON_PLACEHOLDERS.charactersSummary,
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		default: `Analyze these roleplay messages and update the scene state. You must only return valid JSON with no commentary.

<instructions>
<general>
- Update topic if the focus has shifted.
- Update tone if the emotional atmosphere has changed.
- Consider whether tension has increased, decreased, or remained stable.
</general>
<tension>
- Direction will be recalculated based on level change.
- If previous direction was 'stable', strongly consider whether type or level has changed.
<levels>
Tension levels form a spectrum of emotional/dramatic intensity (applies to ALL tension types):
- relaxed: Low stakes, comfortable. Casual chat, downtime, nothing pressing.
- aware: Mild interest or attention. Something noted but no real stakes yet.
- guarded: Careful, measured. Testing waters - whether for trust, attraction, or safety.
- tense: Stakes feel real. Could be conflict brewing, unspoken attraction, or difficult truth approaching.
- charged: Intense emotions dominate. Anger before a fight, desire before a kiss, fear before confession.
- volatile: On the edge. One word changes everything - into violence, intimacy, or revelation.
- explosive: The moment itself. Fight breaks out, characters kiss or engage in sex, secret revealed, breakdown happens.
</levels>
<types>
Tension type describes the nature of what's driving the tension:
- conversation: Neutral dialogue, information exchange, casual interaction.
- negotiation: Competing interests seeking agreement. Deals, persuasion, bargaining.
- confrontation: Direct opposition or conflict. Arguments, accusations, standoffs.
- intimate: Emotional/physical closeness. Romance, deep sharing, intimacy, sexual tension.
- vulnerable: Exposure of weakness or secrets. Confessions, emotional risk, asking for help.
- suspense: Uncertainty about outcome. Waiting, anticipation, something about to happen.
- celebratory: Positive excitement. Joy, triumph, celebration, shared happiness.
</types>
</tension>
<recent_events>
- Keep events that are still relevant to the ongoing scene.
- Remove events that have been resolved or superseded.
- Add new significant events from the recent messages.
- Maximum 5 events - prune aggressively, keep most salient.
- Even if previous_scene has more than 5 events, return at most 5.
</recent_events>
</instructions>

<characters_present>
{{charactersSummary}}
</characters_present>

<previous_scene>
{{previousState}}
</previous_scene>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the updated scene state as valid JSON:`,
	},
};

// ============================================
// Public API
// ============================================

/**
 * Get a prompt by key, using custom prompt from settings if available.
 */
export function getPrompt(key: PromptKey): string {
	const settings = getSettings();
	const customPrompts = settings.customPrompts as CustomPrompts | undefined;

	if (customPrompts?.[key]) {
		return customPrompts[key];
	}

	return DEFAULT_PROMPTS[key].default;
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
