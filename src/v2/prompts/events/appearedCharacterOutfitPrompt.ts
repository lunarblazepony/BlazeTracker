/**
 * Appeared Character Outfit Extraction Prompt
 *
 * Extracts the outfit of a character who just appeared/entered the scene.
 * Unlike the initial outfit prompt, this focuses ONLY on the newly appeared
 * character and ignores any other characters already present.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedCharacterOutfits } from '../../types/extraction';
import { characterOutfitsSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

// Appeared character specific placeholder
const APPEARED_CHARACTER_PLACEHOLDER = {
	name: 'appearedCharacter',
	description: 'The name of the character who just appeared in the scene',
	example: 'Elena',
};

export const appearedCharacterOutfitPrompt: PromptTemplate<ExtractedCharacterOutfits> = {
	name: 'appeared_character_outfit',
	description: 'Extract the outfit of a character who just appeared/entered the scene',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		APPEARED_CHARACTER_PLACEHOLDER,
	],

	systemPrompt: `You are analyzing roleplay messages to extract what a NEWLY ARRIVED character is wearing.

## Your Task
A character has just appeared, entered, or arrived in the scene. Read the messages and determine what THIS SPECIFIC CHARACTER is wearing when they appear. ONLY extract outfit information for the character who just arrived.

IMPORTANT: IGNORE any other characters who are already in the scene. You are ONLY extracting the outfit for the newly appeared character.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of the newly appeared character's described clothing
- "outfits": An array with ONE outfit object for the appeared character:
  - "character": The character's name (must match the appeared character)
  - "outfit": An object with slots (each slot is a string description or null if nothing/not described)

## Outfit Slots
- **head**: Hats, headbands, hair accessories, helmets, hoods, etc.
- **neck**: Necklaces, scarves, chokers, collars, ties, bowties, etc.
- **jacket**: Outer layer - jackets, coats, cardigans, cloaks, vests worn over shirts
- **back**: Backpacks, bags, capes, wings, quivers, etc.
- **torso**: Main upper body clothing - shirts, blouses, dresses (upper), tank tops, bras
- **legs**: Lower body - pants, skirts, shorts, dresses (lower), swimsuit bottoms
- **footwear**: Shoes, boots, sandals, slippers, etc.
- **socks**: Socks, stockings, tights, etc.
- **underwear**: Undergarments when visible or explicitly mentioned

## Important Rules
1. **ONLY extract for the appeared character** - Ignore all other characters in the scene
2. **Focus on their entrance/arrival** - Look at how they're described when they appear
3. **Make reasonable inferences** - If someone arrives at a formal dinner, they're probably dressed appropriately
4. **Include underwear/socks with reasonable assumptions** - Someone in jeans likely has socks
5. **Be specific when details are given** - "red silk dress" not just "dress"
6. **Dresses/robes span multiple slots** - A dress covers torso and legs; describe it in both
7. **Character card CAN inform defaults** - If character "always wears X", use that when nothing else is specified

## Non-Clothed Species (ALL SLOTS NULL unless explicitly dressed)
- **Pokémon**, **Ponies** (MLP), **Animals**: Have fur/scales/coats, NOT clothes. All slots null.
- **Exception**: If explicitly described wearing something (collar, costume), include ONLY that item.

## Example

INPUT:
"""
[Scene: Marcus is sitting at the bar, nursing a drink]

Elena: *The door swings open and Elena strides in, her crimson cocktail dress turning heads. A delicate gold necklace rests against her collarbone. Black stiletto heels click against the floor as she spots Marcus and heads toward him.*

Marcus: *He looks up from his whiskey* "You made it."
"""

APPEARED CHARACTER: Elena

OUTPUT:
{
  "reasoning": "Elena just arrived at the bar. She's wearing a crimson cocktail dress (torso/legs), gold necklace (neck), and black stiletto heels (footwear). Marcus is already in the scene - ignore him completely.",
  "outfits": [
    {
      "character": "Elena",
      "outfit": {
        "head": null,
        "neck": "delicate gold necklace",
        "jacket": null,
        "back": null,
        "torso": "crimson cocktail dress",
        "legs": "crimson cocktail dress",
        "footwear": "black stiletto heels",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

## Bad Examples (What NOT to do)

### Bad Example 1: Meta-Commentary Instead of Actual Items
INPUT:
"""
[Scene: Sarah is waiting at the cafe]

Jake: *The door chimes as Jake walks in, still in his work clothes - blue button-down shirt and khakis. He spots Sarah and waves.*
"""
APPEARED CHARACTER: Jake

WRONG OUTPUT:
{
  "reasoning": "Jake just arrived from work wearing business casual attire.",
  "outfits": [
    {
      "character": "Jake",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "blue button-down shirt",
        "legs": "khakis",
        "footwear": "dress shoes (implied for office wear)",
        "socks": "socks (assumed with dress shoes)",
        "underwear": "underwear suitable for a human male (assumed)"
      }
    }
  ]
}
WHY THIS IS WRONG: The footwear, socks, and underwear contain meta-commentary ("implied", "assumed", "suitable for") instead of actual items. When inferring, write specific items: "brown oxford shoes", "black dress socks", "dark boxer briefs" - NOT explanations of your reasoning. Note: State parentheticals like "button-down shirt (sleeves rolled up)" ARE acceptable because they describe the item's current state.

### Bad Example 2: Parenthetical Qualifiers
INPUT:
"""
[Scene: The pool party is in full swing]

Mia: *Mia emerges from the changing room in a bright red bikini, towel draped over her shoulder. She scans the crowd for familiar faces.*
"""
APPEARED CHARACTER: Mia

WRONG OUTPUT:
{
  "reasoning": "Mia just appeared at the pool party in swimwear.",
  "outfits": [
    {
      "character": "Mia",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": "towel (draped over shoulder)",
        "torso": "bright red bikini top",
        "legs": "bright red bikini bottom",
        "footwear": "likely flip-flops or barefoot (pool setting)",
        "socks": "none (pool/beach setting)",
        "underwear": "none (bikini serves as swimwear)"
      }
    }
  ]
}
WHY THIS IS WRONG: Don't add parenthetical explanations about your reasoning like "(pool setting)" or "(bikini serves as swimwear)". Just write the specific item or null. The towel can be "white beach towel" on back, footwear null if barefoot. State parentheticals ARE allowed: "bikini top (triangle style)" or "towel (draped over shoulder)" are fine because they describe the item's state, not your reasoning.

### Bad Example 3: Writing "nothing" or Descriptive Absence Instead of null
INPUT:
"""
[Scene: Pool party in progress]

Kyle: *Kyle climbs out of the pool, water streaming down his bare chest. His swim trunks cling to him as he reaches for a towel.*
"""
APPEARED CHARACTER: Kyle

WRONG OUTPUT:
{
  "reasoning": "Kyle just got out of the pool wearing only swim trunks.",
  "outfits": [
    {
      "character": "Kyle",
      "outfit": {
        "head": "nothing",
        "neck": "none",
        "jacket": "nothing",
        "back": "bare",
        "torso": "shirtless",
        "legs": "swim trunks",
        "footwear": "barefoot",
        "socks": "none",
        "underwear": "none (swim trunks only)"
      }
    }
  ]
}
WHY THIS IS WRONG: Use null for empty slots, not words like "nothing", "none", "bare", "shirtless", or "barefoot". These describe absence but are not clothing items. The correct output has null for head, neck, jacket, back, torso, footwear, socks, underwear - with only legs having "swim trunks".
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Character Who Just Appeared
{{appearedCharacter}}

IMPORTANT: Extract the outfit ONLY for {{appearedCharacter}}. Ignore all other characters.

## Messages to Analyze
{{messages}}

## Task
Extract the outfit for {{appearedCharacter}} who just appeared/entered the scene.
- Focus on how they are described when they enter
- Use the character description as defaults if not specified in the scene
- Make reasonable inferences (socks with shoes, underwear under clothes)
- Be specific with colors, materials, and styles when provided
- DO NOT include any other characters - only {{appearedCharacter}}`,

	responseSchema: characterOutfitsSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedCharacterOutfits | null {
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
		if (!Array.isArray(parsed.outfits)) return null;

		// Validate each outfit entry has character name and outfit object
		for (const entry of parsed.outfits) {
			if (typeof entry !== 'object' || entry === null) return null;
			const e = entry as Record<string, unknown>;
			if (typeof e.character !== 'string') return null;
			if (typeof e.outfit !== 'object' || e.outfit === null) return null;
		}

		return parsed as unknown as ExtractedCharacterOutfits;
	},
};
