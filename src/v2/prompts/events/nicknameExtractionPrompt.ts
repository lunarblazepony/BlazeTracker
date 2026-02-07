/**
 * Nickname Extraction Prompt
 *
 * Extracts pet names, nicknames, shortened names, titles used as names,
 * and aliases from recent RP messages. Runs periodically (every 8 messages)
 * to catch in-RP names that develop over the course of the story.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedNicknames } from '../../types/extraction';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';
import type { JSONSchema } from '../types';

// ============================================
// Examples
// ============================================

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Pet names between characters
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Elena: *She leaned against the doorframe.* "Hey, sunshine. Miss me?"
Marcus: "Always, Lena." *He pulled her close.* "My little troublemaker."
"""
OUTPUT:
{
  "reasoning": "Elena calls Marcus 'sunshine' - this is a pet name FOR Marcus. Marcus calls Elena 'Lena' (shortened name) and 'my little troublemaker' (pet name) - both are FOR Elena.",
  "nicknames": [
    { "character": "Marcus", "names": ["sunshine"] },
    { "character": "Elena", "names": ["Lena", "troublemaker"] }
  ]
}

### Example 2: Fake name / cover identity
INPUT:
"""
CHARACTERS PRESENT: Elena, User

MESSAGES:
Elena: *She adjusted her wig and fake glasses.* "Remember, in there I'm Sarah Mitchell. Don't slip up."
User: "Got it. And I'm...?"
Elena: "You're my husband, David. We're the Mitchells, attending the gala as donors."
"""
OUTPUT:
{
  "reasoning": "Elena is using the cover identity 'Sarah Mitchell' - this alias is FOR Elena. The user is using the cover identity 'David' and 'David Mitchell' - these are FOR User.",
  "nicknames": [
    { "character": "Elena", "names": ["Sarah Mitchell", "Sarah"] },
    { "character": "User", "names": ["David Mitchell", "David"] }
  ]
}

### Example 3: Title used as a name
INPUT:
"""
CHARACTERS PRESENT: Elena, Detective Morrison

MESSAGES:
Elena: "Detective, we need to talk about the case."
Detective Morrison: "Call me Morrison. Or Rick, if you prefer."
Elena: "Fine, Rick. Here's what I found..."
"""
OUTPUT:
{
  "reasoning": "Elena refers to Detective Morrison as 'Detective' (title as name) and 'Rick' (first name). Morrison himself confirms 'Rick' is his first name and says to call him 'Morrison'.",
  "nicknames": [
    { "character": "Detective Morrison", "names": ["Detective", "Rick", "Morrison"] }
  ]
}

### Example 4: Stage name / performer alias
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Marcus: *He pointed at the poster on the wall.* "See that? 'The Crimson Shadow' - that was me, back in my fighting days."
Elena: "Wait, YOU were the Crimson Shadow? I used to watch those matches!"
"""
OUTPUT:
{
  "reasoning": "Marcus reveals his old fighting alias was 'The Crimson Shadow'. This is a name FOR Marcus.",
  "nicknames": [
    { "character": "Marcus", "names": ["The Crimson Shadow", "Crimson Shadow"] }
  ]
}

### Example 5: No nicknames in messages
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Elena: *She set down her bag and looked around the room.* "It's quieter than I expected."
Marcus: "Yeah, the crowd thinned out about an hour ago." *He wiped down the counter.*
Elena: "Good. We can talk freely then."
Marcus: "Pull up a chair."
"""
OUTPUT:
{
  "reasoning": "Neither character uses any nicknames, pet names, or aliases. They address each other normally without using names at all. No nicknames to extract.",
  "nicknames": []
}

### Example 6: Only canonical names used
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Elena: "Marcus, can you hand me that file?"
Marcus: "Sure, Elena." *He slid the folder across the table.* "It's all in there."
Elena: "Thanks, Marcus."
"""
OUTPUT:
{
  "reasoning": "Both characters only use each other's canonical names - 'Marcus' and 'Elena'. These are already tracked names, not nicknames. Nothing new to extract.",
  "nicknames": []
}

### Example 7: Narrative descriptions, not nicknames
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Elena: *The former thief studied the security plans with practiced eyes, her fingers tracing escape routes.*
Marcus: *The veteran detective watched her work, impressed despite himself. The woman who had once been his target was now his most valuable ally.*
"""
OUTPUT:
{
  "reasoning": "'The former thief', 'the veteran detective', 'the woman who had once been his target', and 'his most valuable ally' are all narrative prose descriptions, not names anyone uses to address or refer to the characters. No nicknames to extract.",
  "nicknames": []
}
`;

const BAD_EXAMPLES = `
## Bad Examples

### Example 1: Assigning nickname to wrong character (CRITICAL)
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Elena: "Come on, babe, we're gonna be late."
Marcus: *He grabbed his coat.*
"""
WRONG:
{
  "nicknames": [{ "character": "Elena", "names": ["babe"] }]
}
WHY THIS IS WRONG: Elena SAID "babe" but she's calling MARCUS "babe". The nickname belongs to the character being referred to (Marcus), not the speaker (Elena).

CORRECT:
{
  "nicknames": [{ "character": "Marcus", "names": ["babe"] }]
}

### Example 2: Generic descriptor, not a nickname
INPUT:
"""
CHARACTERS PRESENT: Elena

MESSAGES:
Elena: *She noticed the old man behind the counter watching them.*
"""
WRONG:
{
  "nicknames": [{ "character": "Elena", "names": ["the old man"] }]
}
WHY THIS IS WRONG: "the old man" is a narrative description of an unnamed character, not a nickname for Elena or anyone tracked. If the old man isn't a tracked character, skip it entirely.

### Example 3: One-time narrative description
INPUT:
"""
CHARACTERS PRESENT: Elena

MESSAGES:
Elena: *The woman who had once saved his life stood before him, changed.*
"""
WRONG:
{
  "nicknames": [{ "character": "Elena", "names": ["the woman who saved his life"] }]
}
WHY THIS IS WRONG: This is narrative prose describing Elena, not a nickname anyone uses for her. Only extract names that characters actually USE to address or refer to someone.

### Example 4: Extracting the canonical name
INPUT:
"""
CHARACTERS PRESENT: Elena

MESSAGES:
Marcus: "Elena! Over here!"
"""
WRONG:
{
  "nicknames": [{ "character": "Elena", "names": ["Elena"] }]
}
WHY THIS IS WRONG: "Elena" is already the canonical tracked name. Don't extract names that match what the character is already tracked as.

### Example 5: Extracting when no nicknames exist
INPUT:
"""
CHARACTERS PRESENT: Elena, Marcus

MESSAGES:
Elena: *She walked to the window and looked outside.*
Marcus: *He continued reading his book in silence.*
"""
WRONG:
{
  "nicknames": [{ "character": "Elena", "names": ["she"] }]
}
WHY THIS IS WRONG: Pronouns ("she", "he", "they") are not nicknames. When no nicknames exist in the messages, return an empty array. Don't invent or force nicknames that aren't there.
`;

// ============================================
// Schema
// ============================================

export const nicknameExtractionSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: {
			type: 'string',
			description: 'Analysis of nicknames found in the messages',
		},
		nicknames: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					character: {
						type: 'string',
						description:
							'The character BEING REFERRED TO by the nickname',
					},
					names: {
						type: 'array',
						items: { type: 'string' },
						description: 'Nicknames used for this character',
					},
				},
				required: ['character', 'names'],
			},
			description: 'Nicknames found for each character',
		},
	},
	required: ['reasoning', 'nicknames'],
};

// ============================================
// Prompt Definition
// ============================================

export const nicknameExtractionPrompt: PromptTemplate<ExtractedNicknames> = {
	name: 'nickname_extraction',
	description: 'Extract pet names, nicknames, and aliases from recent messages',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.userName,
		PLACEHOLDERS.characterDescription,
		PLACEHOLDERS.userDescription,
		PLACEHOLDERS.worldinfo,
		PLACEHOLDERS.charactersPresent,
	],

	systemPrompt: `You are analyzing roleplay messages to extract pet names, nicknames, aliases, and alternate names that characters use for each other.

## Your Task
Identify any names used in the messages that are NOT the character's canonical (tracked) name. These include:
- **Pet names**: "sweetheart", "babe", "sunshine", "honey"
- **Shortened names**: "Tommy" for "Thomas", "Lena" for "Elena"
- **Titles used as names**: "Detective" for "Detective Morrison", "Doc" for "Dr. Chen"
- **In-RP given aliases**: cover identities, fake names, code names
- **Stage names / performer aliases**: "The Crimson Shadow", "DJ Pulse"

## CRITICAL RULES

### 1. Assign to the RIGHT character
Nicknames belong to the CHARACTER BEING REFERRED TO, not the one speaking.
- If Elena says "Hey babe" to Marcus → "babe" belongs to MARCUS
- If Marcus calls Elena "Lena" → "Lena" belongs to ELENA

### 2. Only extract names actually USED
Only include names that characters actually use to address or refer to someone in the messages. Do NOT extract:
- Narrative prose descriptions ("the former thief", "his ally")
- Generic descriptors ("the tall man", "the woman", "the stranger")
- Pronouns ("she", "he", "they")
- One-time narrative references ("the woman who saved his life")

### 3. Do NOT extract canonical names
If a character is tracked as "Elena", don't extract "Elena" as a nickname. Only extract names that are DIFFERENT from the canonical name.

### 4. It is COMPLETELY FINE to return empty results
If no nicknames are used in the messages, return an empty array. Many conversations don't contain nicknames. Don't force or invent nicknames that aren't there. An empty result is a correct result when no nicknames exist.

### 5. Use context to distinguish
Use worldinfo and character descriptions to understand whether something is a real nickname vs. narrative description. A "Detective" is a nickname only if someone uses it to address or refer to a character.

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Character: {{characterName}}
{{characterDescription}}

User: {{userName}}
{{userDescription}}

## Worldinfo
{{worldinfo}}

## Characters Present
{{charactersPresent}}

## Recent Messages
{{messages}}

## Task
Extract any pet names, nicknames, shortened names, titles used as names, or aliases from the messages above.

Remember:
- Assign each nickname to the CHARACTER BEING REFERRED TO, not the speaker
- Only include names actually used in the messages, not narrative descriptions
- Do NOT include canonical character names (names already tracked)
- Return an empty nicknames array if no nicknames are found - this is perfectly valid
- Pronouns and generic descriptors are NOT nicknames`,

	responseSchema: nicknameExtractionSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedNicknames | null {
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
		if (!Array.isArray(parsed.nicknames)) return null;

		// Validate and filter nickname entries
		const nicknames: Array<{ character: string; names: string[] }> = [];
		for (const entry of parsed.nicknames) {
			if (typeof entry !== 'object' || entry === null) continue;
			const e = entry as Record<string, unknown>;
			if (typeof e.character !== 'string') continue;
			if (!Array.isArray(e.names)) continue;

			const names = e.names.filter(
				(n): n is string => typeof n === 'string' && n.trim().length > 0,
			);

			// Only include entries with at least one name
			if (names.length > 0) {
				nicknames.push({
					character: e.character,
					names,
				});
			}
		}

		return {
			reasoning: parsed.reasoning,
			nicknames,
		};
	},
};
