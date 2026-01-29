/**
 * Appeared Character Profile Prompt
 *
 * Extracts a condensed profile for a newly appeared character.
 * Does NOT use characterDescription since appeared characters are NPCs, not the main character.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedCharacterProfile } from '../../types/extraction';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';
import type { JSONSchema } from '../types';

// ============================================
// Examples
// ============================================

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: NPC with Context Clues
INPUT:
"""
APPEARED CHARACTER: Derek

MESSAGES:
Elena: *She looked up as the door swung open, revealing a tall man in a police uniform.*
Derek: "Detective Morrison." *His gruff voice carried authority, gray eyes scanning the room.* "We need to talk about the Henderson case."
"""
OUTPUT:
{
  "reasoning": "Derek is addressed as 'Detective Morrison' suggesting a formal law enforcement role. He's described as tall, in a police uniform, with gray eyes and a gruff voice suggesting middle-aged (estimate 45-50). His authority and formality suggest a serious, direct personality.",
  "character": "Derek",
  "profile": {
    "sex": "M",
    "species": "Human",
    "age": 47,
    "appearance": ["tall", "gray eyes", "police uniform", "authoritative bearing", "middle-aged", "stern features"],
    "personality": ["authoritative", "serious", "direct", "professional", "no-nonsense", "determined"]
  }
}

### Example 2: Young NPC
INPUT:
"""
APPEARED CHARACTER: Sophie

MESSAGES:
Marcus: *He heard a knock at the door and opened it to find a young woman in barista attire.*
Sophie: "Your usual, Mr. Chen?" *She smiled brightly, bouncing on her heels.* "I brought an extra cookie today!"
"""
OUTPUT:
{
  "reasoning": "Sophie is a young woman (barista, bouncing, bright smile suggests early 20s). She works at a coffee shop and seems friendly and energetic. Her casual interaction and cheerfulness indicate an upbeat personality.",
  "character": "Sophie",
  "profile": {
    "sex": "F",
    "species": "Human",
    "age": 22,
    "appearance": ["young", "barista uniform", "bright smile", "energetic posture"],
    "personality": ["friendly", "cheerful", "energetic", "thoughtful", "bubbly", "accommodating"]
  }
}

### Example 3: Fantasy NPC
INPUT:
"""
APPEARED CHARACTER: Grimjaw

MESSAGES:
Thalindor: *He heard heavy footsteps and turned to see a massive figure emerge from the shadows.*
Grimjaw: *The orc crossed his scarred arms, tusks glinting.* "The Elders sent me. You need muscle for this job."
"""
OUTPUT:
{
  "reasoning": "Grimjaw is described as an orc (tusks mentioned) who is massive and scarred. Being sent by 'Elders' suggests he's experienced. His direct speech and mention of 'muscle' indicates he's straightforward and combat-oriented. Orcs are typically middle-aged at around 30-40.",
  "character": "Grimjaw",
  "profile": {
    "sex": "M",
    "species": "Orc",
    "age": 35,
    "appearance": ["massive", "scarred", "tusks", "muscular", "imposing", "battle-worn"],
    "personality": ["direct", "loyal", "tough", "straightforward", "combat-ready", "reliable"]
  }
}
`;

const BAD_EXAMPLES = `
## Bad Examples

### Example 1: Assuming Too Much
INPUT:
"""
APPEARED CHARACTER: Alex

MESSAGES:
Elena: *She noticed someone new at the bar.*
Alex: "First time here."
"""
OUTPUT:
{
  "reasoning": "Alex is at a bar.",
  "character": "Alex",
  "profile": {
    "sex": "M",
    "species": "Human",
    "age": 25,
    "appearance": ["brown hair", "blue eyes", "tall", "handsome", "muscular", "well-dressed", "stubble", "athletic"],
    "personality": ["charming", "mysterious", "confident", "dangerous", "smooth", "calculating"]
  }
}
WHY THIS IS WRONG: There's almost no information about Alex. We can't even determine sex from this context. Should use "O" for sex when unknown, and only include generic appearance tags like "unknown build", "nondescript". Don't invent specific details.

### Example 2: Wrong Species Inference
INPUT:
"""
APPEARED CHARACTER: Fang

MESSAGES:
Elena: *The werewolf hunter stepped into the moonlight.*
Fang: "I've been tracking this pack for weeks."
"""
OUTPUT:
{
  "reasoning": "Fang hunts werewolves.",
  "character": "Fang",
  "profile": {
    "sex": "M",
    "species": "Werewolf",
    "age": 200,
    "appearance": ["furry", "claws", "fangs", "yellow eyes"],
    "personality": ["bloodthirsty", "wild", "feral"]
  }
}
WHY THIS IS WRONG: A "werewolf hunter" is Human unless stated otherwise. The name "Fang" doesn't make them a werewolf. Don't confuse occupation with species.
`;

// ============================================
// Schema
// ============================================

export const appearedCharacterProfileSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: {
			type: 'string',
			description: 'Your analysis of the character before providing the profile',
		},
		character: {
			type: 'string',
			description: 'The character name',
		},
		profile: {
			type: 'object',
			properties: {
				sex: {
					type: 'string',
					enum: ['M', 'F', 'O'],
					description: 'M = male, F = female, O = other/unknown',
				},
				species: {
					type: 'string',
					description: 'Species (Human if not specified)',
				},
				age: {
					type: 'number',
					description: 'Numeric age estimate',
				},
				appearance: {
					type: 'array',
					items: { type: 'string' },
					description: '6-10 appearance tags',
				},
				personality: {
					type: 'array',
					items: { type: 'string' },
					description: '6-10 personality tags',
				},
			},
			required: ['sex', 'species', 'age', 'appearance', 'personality'],
		},
	},
	required: ['reasoning', 'character', 'profile'],
};

// ============================================
// Placeholder for appeared character
// ============================================

export const APPEARED_CHARACTER_PLACEHOLDER = {
	name: 'appearedCharacter',
	description: 'The name of the character who just appeared',
	example: 'Derek',
};

// ============================================
// Prompt Definition
// ============================================

export const appearedCharacterProfilePrompt: PromptTemplate<ExtractedCharacterProfile> = {
	name: 'appeared_character_profile',
	description: 'Extract a profile for a newly appeared character',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		APPEARED_CHARACTER_PLACEHOLDER,
	],

	systemPrompt: `You are analyzing roleplay messages to extract a profile for a newly appeared character.

## Your Task
Create a condensed profile for the APPEARED CHARACTER based only on information in the messages. This character is likely an NPC, so you must work with limited information.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what can be inferred about the character
- "character": The character's name
- "profile": Object containing:
  - "sex": "M" (male), "F" (female), or "O" (other/unknown)
  - "species": Species name (use "Human" if not specified)
  - "age": Numeric age estimate
  - "appearance": Array of 6-10 appearance tags
  - "personality": Array of 6-10 personality tags

## Guidelines for Limited Information

### Sex
- Use pronouns if available (he/him = M, she/her = F, they/them = O)
- Voice descriptions can help (gruff, deep = likely M; soft, high = likely F)
- Names can suggest (though be careful with ambiguous names)
- Use "O" if truly unclear - don't guess randomly

### Species
- Look for explicit mentions (orc, elf, robot, etc.)
- Check for physical descriptors (tusks = orc, pointed ears = elf)
- Default to "Human" when nothing indicates otherwise

### Age
- Occupation can indicate: students (16-22), professionals (25-55), retirees (65+)
- Descriptors: "young" (18-25), "middle-aged" (40-55), "elderly" (70+)
- Authority/experience suggests older
- When truly unknown, estimate based on role (30s is a reasonable default for adult NPCs)

### Appearance (6-10 tags)
- Include only what's described or strongly implied
- Use generic tags when specific details are missing: "average build", "nondescript features"
- Include clothing/uniform if mentioned
- Don't invent specific details (hair color, eye color) unless stated

### Personality (6-10 tags)
- Infer from dialogue style and actions
- Consider their role/occupation
- Include observable traits, not assumptions
- A single line of dialogue can still suggest multiple traits

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Character Who Just Appeared
{{appearedCharacter}}

## Recent Messages
{{messages}}

## Task
Extract a profile for **{{appearedCharacter}}** based on how they appear and act in these messages.

Remember:
- Only use information present in the messages
- Use "O" for sex if gender is unclear
- Default to "Human" for species unless indicated otherwise
- Estimate age from context clues
- Don't invent specific physical details not mentioned
- Infer personality from dialogue and actions`,

	responseSchema: appearedCharacterProfileSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedCharacterProfile | null {
		let parsed: Record<string, unknown>;
		try {
			const result = parseJsonResponse(response);
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return null;
			parsed = result as Record<string, unknown>;
		} catch {
			return null;
		}

		// Validate required fields
		if (typeof parsed.reasoning !== 'string') return null;
		if (typeof parsed.character !== 'string') return null;
		if (typeof parsed.profile !== 'object' || parsed.profile === null) return null;

		const profile = parsed.profile as Record<string, unknown>;

		// Validate profile fields
		if (!['M', 'F', 'O'].includes(profile.sex as string)) return null;
		if (typeof profile.species !== 'string') return null;
		if (typeof profile.age !== 'number') return null;
		if (!Array.isArray(profile.appearance)) return null;
		if (!Array.isArray(profile.personality)) return null;

		return {
			reasoning: parsed.reasoning,
			character: parsed.character,
			profile: {
				sex: profile.sex as 'M' | 'F' | 'O',
				species: profile.species,
				age: profile.age,
				appearance: profile.appearance.filter(
					(tag): tag is string => typeof tag === 'string',
				),
				personality: profile.personality.filter(
					(tag): tag is string => typeof tag === 'string',
				),
			},
		};
	},
};
