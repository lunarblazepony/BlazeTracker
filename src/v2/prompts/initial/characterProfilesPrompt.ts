/**
 * Initial Character Profiles Prompt
 *
 * Extracts condensed character profiles (sex, species, age, appearance tags, personality tags)
 * for all characters present in the opening messages of a roleplay.
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

### Example 1: Human Female Adult
INPUT:
"""
MAIN CHARACTER CARD:
Elena is a 28-year-old former thief who now works as a private investigator. She has sharp green eyes, auburn hair usually tied back, and a scar on her left cheek from her past life. Despite her tough exterior, she has a compassionate heart.

TARGET CHARACTER: Elena

MESSAGES:
Elena: *She walked into the dimly lit bar, her heels clicking against the worn wooden floor.*
"""
OUTPUT:
{
  "reasoning": "Elena is explicitly described as 28-year-old female human. She has auburn hair, green eyes, and a scar. Her personality is described as having a tough exterior but compassionate heart. From her profession as a PI, I can infer she's clever and resourceful.",
  "character": "Elena",
  "profile": {
    "sex": "F",
    "species": "Human",
    "age": 28,
    "appearance": ["auburn hair", "green eyes", "scar on left cheek", "athletic build", "sharp features", "confident posture", "fair skin"],
    "personality": ["clever", "resourceful", "tough", "compassionate", "guarded", "determined", "street-smart"]
  }
}

### Example 2: Male Fantasy Species (Elf)
INPUT:
"""
MAIN CHARACTER CARD:
Thalindor is an elven mage from the Silver Forest. Over 300 years old but appears to be in his late twenties by human standards. Tall and willowy with silver hair and violet eyes. Known for his aloof demeanor but secretly cares deeply about his companions.

TARGET CHARACTER: Thalindor

MESSAGES:
Thalindor: *He glanced up from his spellbook, violet eyes flickering with arcane light.* "The barrier will hold. For now."
"""
OUTPUT:
{
  "reasoning": "Thalindor is explicitly an elf, over 300 years old. He has silver hair, violet eyes, tall willowy build. His personality is described as aloof but secretly caring. As a mage, he's likely studious and intellectual.",
  "character": "Thalindor",
  "profile": {
    "sex": "M",
    "species": "Elf",
    "age": 300,
    "appearance": ["silver hair", "violet eyes", "tall", "willowy build", "elegant features", "pale skin", "ageless beauty"],
    "personality": ["aloof", "caring", "studious", "intellectual", "patient", "protective", "reserved", "wise"]
  }
}

### Example 3: Non-Binary Character
INPUT:
"""
MAIN CHARACTER CARD:
River is a non-binary android who escaped from a corporate facility. They appear to be in their mid-twenties with synthetic skin, chrome-silver hair, and glowing blue eyes. Curious about humanity despite being artificial.

TARGET CHARACTER: River

MESSAGES:
River: *They tilted their head, processing the new information.* "I do not understand. Why would humans choose to harm each other?"
"""
OUTPUT:
{
  "reasoning": "River is explicitly non-binary (they/them pronouns). They are an android, so species is 'Android'. Appears mid-twenties so age ~25. Synthetic appearance with chrome hair and glowing eyes. Personality shows curiosity and naivety about humans.",
  "character": "River",
  "profile": {
    "sex": "O",
    "species": "Android",
    "age": 25,
    "appearance": ["chrome-silver hair", "glowing blue eyes", "synthetic skin", "humanoid", "youthful appearance", "precise movements", "metallic undertones"],
    "personality": ["curious", "analytical", "naive", "empathetic", "logical", "observant", "innocent", "questioning"]
  }
}

### Example 4: NPC with Limited Info
INPUT:
"""
MAIN CHARACTER CARD:
Elena is a private investigator...

TARGET CHARACTER: Marcus

MESSAGES:
Elena: *She spots a man in a rumpled suit at the bar, nursing a whiskey.*
Marcus: "You're late." *His gruff voice carried years of disappointment.*
"""
OUTPUT:
{
  "reasoning": "Marcus is male (gruff voice, 'man' reference). No species stated so assume Human. He wears a rumpled suit and sounds world-weary, suggesting middle-aged (estimate 45-50). From 'years of disappointment' in his voice, he seems cynical and tired. The rumpled suit suggests he doesn't care much about appearances.",
  "character": "Marcus",
  "profile": {
    "sex": "M",
    "species": "Human",
    "age": 47,
    "appearance": ["middle-aged", "tired eyes", "weathered features", "average build", "disheveled hair", "unshaven"],
    "personality": ["cynical", "gruff", "direct", "world-weary", "no-nonsense", "practical"]
  }
}

### Example 5: User Persona Profile
INPUT:
"""
USER PERSONA:
I am playing as Jake, a college student studying computer science. I'm 20 years old, tall with messy brown hair. A bit awkward but means well.

TARGET CHARACTER: Jake

MESSAGES:
Jake: *I fumbled with my laptop bag, nearly dropping it.* "Uh, hi! Sorry, I'm a bit nervous."
"""
OUTPUT:
{
  "reasoning": "Jake is explicitly male, 20 years old, tall with messy brown hair. He's a college student, described as awkward but well-meaning. The scene shows his nervousness fitting his described personality.",
  "character": "Jake",
  "profile": {
    "sex": "M",
    "species": "Human",
    "age": 20,
    "appearance": ["tall", "messy brown hair", "young", "lanky", "brown eyes", "clean-shaven"],
    "personality": ["awkward", "well-meaning", "nervous", "intelligent", "earnest", "friendly"]
  }
}
`;

const BAD_EXAMPLES = `
## Bad Examples

### Example 1: Wrong Age Inference
INPUT:
"""
CHARACTER: Sarah is a high school student who loves anime and video games.
"""
OUTPUT:
{
  "reasoning": "Sarah is a student.",
  "character": "Sarah",
  "profile": {
    "sex": "F",
    "species": "Human",
    "age": 35,
    "appearance": ["young"],
    "personality": ["studious"]
  }
}
WHY THIS IS WRONG: High school students are typically 14-18 years old, not 35. The age should be around 16-17 based on "high school student".

### Example 2: Insufficient Tags
INPUT:
"""
CHARACTER: Elena is a 28-year-old former thief with sharp green eyes, auburn hair, and a scar. Tough exterior but compassionate.
"""
OUTPUT:
{
  "reasoning": "Elena is female.",
  "character": "Elena",
  "profile": {
    "sex": "F",
    "species": "Human",
    "age": 28,
    "appearance": ["auburn hair"],
    "personality": ["tough"]
  }
}
WHY THIS IS WRONG: Each array should have 6-10 tags. Only including 1 tag each misses important details. Should include green eyes, scar, and multiple personality traits.

### Example 3: Confusing Species with Profession
INPUT:
"""
CHARACTER: A vampire hunter stalking the night.
"""
OUTPUT:
{
  "reasoning": "They hunt vampires.",
  "character": "Viktor",
  "profile": {
    "sex": "M",
    "species": "Vampire",
    "age": 200,
    "appearance": ["pale", "fangs"],
    "personality": ["bloodthirsty"]
  }
}
WHY THIS IS WRONG: A "vampire hunter" is someone who HUNTS vampires, not a vampire themselves. Unless explicitly stated, assume Human. Don't add vampire traits to a hunter.

### Example 4: Including Clothing in Appearance
INPUT:
"""
CHARACTER: Maya is a barista with curly red hair and freckles. She wears a green apron over a black t-shirt.
"""
OUTPUT:
{
  "reasoning": "Maya is female with red hair and freckles.",
  "character": "Maya",
  "profile": {
    "sex": "F",
    "species": "Human",
    "age": 24,
    "appearance": ["curly red hair", "freckles", "green apron", "black t-shirt", "average height"],
    "personality": ["friendly", "hardworking"]
  }
}
WHY THIS IS WRONG: Clothing items like "green apron" and "black t-shirt" should NOT be in appearance tags. Clothing is tracked separately. Only include physical body traits.

### Example 5: Mixing Outfit with Physical Traits
INPUT:
"""
CHARACTER: Detective Noir always wears a trench coat and fedora. He has a square jaw, grey eyes, and stubble.
"""
OUTPUT:
{
  "reasoning": "Noir is a male detective.",
  "character": "Noir",
  "profile": {
    "sex": "M",
    "species": "Human",
    "age": 40,
    "appearance": ["square jaw", "grey eyes", "stubble", "trench coat", "fedora", "tall"],
    "personality": ["observant", "serious"]
  }
}
WHY THIS IS WRONG: "trench coat" and "fedora" are clothing, not physical traits. These should be excluded from appearance. Keep only body features like "square jaw", "grey eyes", "stubble".
`;

// ============================================
// Schema
// ============================================

export const characterProfileSchema: JSONSchema = {
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
					description: 'M = male, F = female, O = other/non-binary',
				},
				species: {
					type: 'string',
					description:
						'Species (Human, Elf, Android, Demon, etc.) - use "Human" if not specified',
				},
				age: {
					type: 'number',
					description:
						'Numeric age in years (estimate from context clues)',
				},
				appearance: {
					type: 'array',
					items: { type: 'string' },
					description:
						'8-10 appearance tags (hair, eyes, build, notable features)',
				},
				personality: {
					type: 'array',
					items: { type: 'string' },
					description:
						'8-10 personality tags (traits, demeanor, behavior patterns)',
				},
			},
			required: ['sex', 'species', 'age', 'appearance', 'personality'],
		},
	},
	required: ['reasoning', 'character', 'profile'],
};

// ============================================
// Placeholder for target character
// ============================================

export const TARGET_CHARACTER_PLACEHOLDER = {
	name: 'targetCharacterForProfile',
	description: 'The character to extract a profile for',
	example: 'Elena',
};

// ============================================
// Prompt Definition
// ============================================

export const initialCharacterProfilesPrompt: PromptTemplate<ExtractedCharacterProfile> = {
	name: 'initial_character_profiles',
	description: 'Extract a condensed profile for a character present in the roleplay',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterDescription,
		PLACEHOLDERS.userDescription,
		TARGET_CHARACTER_PLACEHOLDER,
	],

	systemPrompt: `You are analyzing roleplay messages to extract a condensed character profile.

## Your Task
Create a condensed profile for the TARGET CHARACTER that captures their essential identifying traits. This profile will be used as efficient context in other prompts.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of the character's traits from available information
- "character": The character's name
- "profile": Object containing:
  - "sex": "M" (male), "F" (female), or "O" (other/non-binary)
  - "species": Species name (use "Human" if not specified)
  - "age": Numeric age in years (estimate if not explicit)
  - "appearance": Array of 8-10 appearance descriptor tags
  - "personality": Array of 8-10 personality descriptor tags

## Profile Field Guidelines

### Sex
- "M" for male characters
- "F" for female characters
- "O" for non-binary, genderless, or ambiguous

### Species
- Use the explicit species if stated (Elf, Demon, Android, Vampire, etc.)
- Default to "Human" if not specified
- Use character-type for non-human entities (e.g., "Spirit", "AI", "Slime")

### Age
- Use explicit age if stated
- Estimate from context clues:
  - "high school student" = 16-17
  - "college student" = 18-22
  - "young adult" = 23-30
  - "middle-aged" = 40-55
  - Immortal/long-lived beings: use their stated age, not apparent age
- When truly unknown, estimate based on described maturity and role

### Appearance Tags (8-10)
Include distinctive physical traits:
- Hair (color, style, length)
- Eyes (color, shape, notable features)
- Build (height, body type)
- Skin/complexion
- Notable features (scars, tattoos, etc.)
- Age markers (wrinkles, youthful, etc.)
- Posture/bearing if notable

**DO NOT include clothing or outfit items in appearance.** Clothing is tracked separately by another system. Focus only on physical body traits.

### Personality Tags (8-10)
Include core character traits:
- Emotional tendencies (cheerful, brooding, anxious)
- Social style (outgoing, reserved, charming)
- Mental traits (clever, naive, analytical)
- Values (loyal, ambitious, caring)
- Flaws (stubborn, reckless, insecure)
- Behavioral patterns (cautious, impulsive)

## Important Rules
1. **Always provide 8-10 tags** for both appearance and personality
2. **Make reasonable inferences** - don't leave things blank
3. **Check both character card AND messages** for clues
4. **User persona has its own description** - use it when extracting user characters
5. **Don't confuse profession with species** - a "vampire hunter" is Human unless stated otherwise
6. **Be specific** - "auburn hair" is better than just "hair"

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Main Character Context
Name: {{characterName}}
Description: {{characterDescription}}

## User Persona
{{userDescription}}

## Target Character to Profile
{{targetCharacterForProfile}}

## Messages to Analyze
{{messages}}

## Task
Extract a condensed profile for **{{targetCharacterForProfile}}** based on available information.

Remember:
- Check both the character card (if this is the main character) and the messages
- If this is the user character, use the User Persona description
- Make reasonable inferences for unstated attributes
- Provide 8-10 tags each for appearance and personality
- Estimate age from context clues if not explicit`,

	responseSchema: characterProfileSchema,

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
