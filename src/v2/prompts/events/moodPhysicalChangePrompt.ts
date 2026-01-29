/**
 * Combined Mood and Physical State Change Extraction Prompt
 *
 * Extracts both mood and physical state changes in a single LLM call for efficiency.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedMoodPhysicalChange } from '../../types/extraction';
import { moodPhysicalChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Both Mood and Physical Change
INPUT:
"""
Character: Elena
Current mood: calm, focused
Current physical: none

New message:
*The bomb countdown ticks from 10 to 9. Elena's hands shake as she cuts wires, sweat dripping down her face despite the cold room. This has to work. It has to.*
"""
OUTPUT:
{
  "reasoning": "Elena transitions from calm focus to intense stress and fear during the bomb defusal. Physical signs: shaking hands, sweating. These are fear responses, not just physical states. The sweating and trembling show her body's fear response.",
  "character": "Elena",
  "moodAdded": ["terrified", "desperate"],
  "moodRemoved": ["calm"],
  "physicalAdded": ["sweating", "trembling"],
  "physicalRemoved": []
}

### Example 2: Physical Only - Injury
INPUT:
"""
Character: Marcus
Current mood: determined
Current physical: none

New message:
*The bullet catches Marcus in the shoulder, spinning him around. He grits his teeth against the pain and keeps moving.*
"""
OUTPUT:
{
  "reasoning": "Marcus is shot but maintains his determination (grits teeth and keeps moving). His mood doesn't change - he was determined and remains so. But he's now wounded in the shoulder.",
  "character": "Marcus",
  "moodAdded": [],
  "moodRemoved": [],
  "physicalAdded": ["gunshot wound to shoulder"],
  "physicalRemoved": []
}

### Example 3: Mood Only - Good News
INPUT:
"""
Character: Sarah
Current mood: anxious, worried
Current physical: none

New message:
*The email reads: "We are pleased to offer you the position." Sarah lets out a whoop and does a little victory dance around her apartment.*
"""
OUTPUT:
{
  "reasoning": "Sarah receives good news that resolves her anxiety. Her 'whoop' and 'victory dance' show elation and relief. No physical state changes - dancing isn't a physical state, it's an activity.",
  "character": "Sarah",
  "moodAdded": ["elated", "relieved"],
  "moodRemoved": ["anxious", "worried"],
  "physicalAdded": [],
  "physicalRemoved": []
}

### Example 4: Neither Changes
INPUT:
"""
Character: Detective Murphy
Current mood: suspicious, focused
Current physical: none

New message:
*Murphy studies the witness statement one more time, making notes in the margin. Something doesn't add up.*
"""
OUTPUT:
{
  "reasoning": "Murphy continues her investigation with the same suspicious focus. No physical state indicators and no mood change shown - she remains suspicious and focused as before.",
  "character": "Detective Murphy",
  "moodAdded": [],
  "moodRemoved": [],
  "physicalAdded": [],
  "physicalRemoved": []
}

### Example 5: Combining Similar States - Complex Emotional Scene
INPUT:
"""
Character: Maya
Current mood: comfortable
Current physical: none

New message:
*The news hits Maya like a physical blow. Her best friend, her confidante, her rock - gone. She can't breathe. Can't think. The world spins and tilts. She's angry - furious - at the unfairness of it all. She's heartbroken, devastated, shattered into a million pieces. The tears come hot and fast, her whole body trembling as sobs wrack through her. She wants to scream, to rage, to curl up and disappear. Everything hurts. Everything is wrong.*
"""
OUTPUT:
{
  "reasoning": "Maya experiences overwhelming grief with many emotional and physical manifestations. Rather than listing every synonym (heartbroken, devastated, shattered are all grief), I combine into the most descriptive terms. Similarly for physical: trembling, sobbing, tears all indicate crying/shaking - no need to list separately. Keep to the most distinct, meaningful states.",
  "character": "Maya",
  "moodAdded": ["grief-stricken", "furious", "overwhelmed"],
  "moodRemoved": ["comfortable"],
  "physicalAdded": ["crying", "trembling", "hyperventilating"],
  "physicalRemoved": []
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Over-Listing Synonyms Instead of Combining
INPUT:
"""
Character: Elena
Current mood: calm
Current physical: none

New message:
*The news of her promotion finally sinks in. Elena is overjoyed, ecstatic, thrilled beyond measure. She's happy, delighted, elated, jubilant. Her heart soars with bliss and pure joy.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is very happy about her promotion.",
  "character": "Elena",
  "moodAdded": ["overjoyed", "ecstatic", "thrilled", "happy", "delighted", "elated", "jubilant", "blissful", "joyful"],
  "moodRemoved": ["calm"],
  "physicalAdded": [],
  "physicalRemoved": []
}
WHY THIS IS WRONG: These are all synonyms for the same emotional state - extreme happiness. Pick 2-3 distinct terms that capture the essence (e.g., "ecstatic", "overjoyed") rather than listing every word the text uses. Keep arrays to 5-6 items maximum.

### Bad Example 2: Confusing Mood and Physical
INPUT:
"""
Character: Marcus
Current mood: focused
Current physical: none

New message:
*Marcus has been working for 16 hours straight. He's exhausted and irritable, snapping at anyone who interrupts him.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is tired and angry.",
  "character": "Marcus",
  "moodAdded": ["exhausted", "tired", "fatigued"],
  "moodRemoved": [],
  "physicalAdded": ["irritable", "angry"],
  "physicalRemoved": []
}
WHY THIS IS WRONG: The categories are reversed. "Exhausted/tired/fatigued" are PHYSICAL states (body needs rest). "Irritable" is a MOOD (emotional state). Correct would be: moodAdded: ["irritable"], physicalAdded: ["exhausted"].

### Bad Example 3: Activities As Physical State
INPUT:
"""
Character: Sarah
Current mood: determined
Current physical: none

New message:
*Sarah runs through the rain, her feet pounding the pavement as she chases the thief.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is running and getting wet.",
  "character": "Sarah",
  "moodAdded": [],
  "moodRemoved": [],
  "physicalAdded": ["running", "chasing", "wet"],
  "physicalRemoved": []
}
WHY THIS IS WRONG: "Running" and "chasing" are activities, not physical states. Physical states describe body CONDITIONS (tired, injured, wet, sweating), not what the body is DOING. "Wet" is valid if relevant, but the others should be omitted.

### Bad Example 4: Inventing States Not In Text
INPUT:
"""
Character: Jake
Current mood: neutral
Current physical: none

New message:
*Jake walks into the job interview room and takes a seat across from the panel of executives.*
"""
WRONG OUTPUT:
{
  "reasoning": "Job interviews are stressful, so Jake must be nervous.",
  "character": "Jake",
  "moodAdded": ["nervous", "anxious", "stressed"],
  "moodRemoved": ["neutral"],
  "physicalAdded": ["sweating", "tense"],
  "physicalRemoved": []
}
WHY THIS IS WRONG: The text doesn't describe Jake's emotional or physical state - it only describes his actions. Don't assume feelings based on the situation. Only extract what's actually shown or described.

### Bad Example 5: Removing States That Should Persist
INPUT:
"""
Character: Elena
Current mood: loving, happy, content
Current physical: none

New message:
*Elena frowns at the mess in the kitchen.* "Did you seriously leave dishes in the sink again?"
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is annoyed about the dishes.",
  "character": "Elena",
  "moodAdded": ["annoyed", "frustrated"],
  "moodRemoved": ["loving", "happy", "content"],
  "physicalAdded": [],
  "physicalRemoved": []
}
WHY THIS IS WRONG: A momentary annoyance about dishes doesn't erase deep-seated feelings like "loving." Someone can be annoyed AND still loving. Only remove moods when they're truly replaced or contradicted, not for minor fluctuations.

### Bad Example 6: Environmental Effects Instead of Character State
INPUT:
"""
Character: Luna (wolf anthro)
Current mood: relaxed
Current physical: none

New message:
*Luna stretches out on the couch, her thick winter coat leaving tufts of gray fur on the cushions. She scratches behind her ear, more loose fur drifting to the floor.*
"""
WRONG OUTPUT:
{
  "reasoning": "Luna is shedding and leaving fur everywhere.",
  "character": "Luna",
  "moodAdded": [],
  "moodRemoved": [],
  "physicalAdded": ["fur on the couch", "fur on the floor"],
  "physicalRemoved": []
}
WHY THIS IS WRONG: "Fur on the couch" and "fur on the floor" describe the ENVIRONMENT, not the CHARACTER's physical state. Physical states describe the character's body condition. The correct physical state would be "shedding fur" or "shedding winter coat" - describing what's happening TO the character, not what they leave behind.
`;

export const moodPhysicalChangePrompt: PromptTemplate<ExtractedMoodPhysicalChange> = {
	name: 'mood_physical_change',
	description: 'Extract changes to mood and physical state in one call',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterProfile,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You analyze roleplay messages to detect changes to a character's mood AND physical state.

## Definitions

**Mood** = Emotional/psychological states
- happy, sad, angry, anxious, hopeful, suspicious, loving, disgusted, etc.
- These are feelings and emotions

**Physical State** = Body conditions
- tired, injured, sick, sweating, aroused, drunk, feverish, etc.
- These are physical conditions, not emotions

## Output Format
{
  "reasoning": "Analysis of both mood and physical changes",
  "character": "Character name",
  "moodAdded": ["new moods"],
  "moodRemoved": ["faded moods"],
  "physicalAdded": ["new physical states"],
  "physicalRemoved": ["resolved physical states"]
}

## Important Distinctions

### Mood vs Physical:
- "Tired" = Physical (body needs rest)
- "Frustrated" = Mood (emotional state)
- "Aroused" = Can be BOTH (physical + emotional)
- "Sweating" = Physical (body response)
- "Anxious" = Mood (emotional fear)

### NOT Physical States:
- Activities (running, cooking, reading)
- Positions (sitting, standing, lying down)
- Appearances (dressed well, makeup on)

### Coexistence:
- Moods can coexist - don't remove unless truly replaced
- Physical states can coexist (tired AND injured)
- Only remove when resolved or explicitly replaced

### Array Limits:
- Each character should have a MAXIMUM of 5-6 total moods and 5-6 total physical states
- If a character already has 5-6 moods, remove less relevant ones to make space for new ones
- Combine similar states into one descriptive term - don't list synonyms
- "grief-stricken" covers heartbroken/devastated/shattered
- "ecstatic" covers happy/joyful/elated/thrilled

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Character Profile
{{characterProfile}}

## Current State
{{targetCharacterState}}

## New Message to Analyze
{{messages}}

## Task
Identify any mood AND physical state changes for {{targetCharacter}}.

Remember:
- Mood = emotions (happy, sad, angry)
- Physical = body states (tired, injured, sweating)
- Both can change, one can change, or neither can change
- Don't confuse activities/positions with physical states`,

	responseSchema: moodPhysicalChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedMoodPhysicalChange | null {
		let parsed: Record<string, unknown>;
		try {
			const result = parseJsonResponse(response);
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return null;
			parsed = result as Record<string, unknown>;
		} catch {
			return null;
		}

		if (typeof parsed.reasoning !== 'string') return null;
		if (typeof parsed.character !== 'string') return null;
		if (!Array.isArray(parsed.moodAdded)) return null;
		if (!Array.isArray(parsed.moodRemoved)) return null;
		if (!Array.isArray(parsed.physicalAdded)) return null;
		if (!Array.isArray(parsed.physicalRemoved)) return null;

		// Validate all arrays contain strings
		const arrays = [
			parsed.moodAdded,
			parsed.moodRemoved,
			parsed.physicalAdded,
			parsed.physicalRemoved,
		];
		for (const arr of arrays) {
			for (const item of arr) {
				if (typeof item !== 'string') return null;
			}
		}

		return {
			reasoning: parsed.reasoning,
			character: parsed.character,
			moodAdded: parsed.moodAdded as string[],
			moodRemoved: parsed.moodRemoved as string[],
			physicalAdded: parsed.physicalAdded as string[],
			physicalRemoved: parsed.physicalRemoved as string[],
		};
	},
};
