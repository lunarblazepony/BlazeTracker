/**
 * Character State Consolidation Prompt
 *
 * Consolidates mood and physical state lists when they grow too large,
 * removing synonyms and keeping only distinct states (2-5 items per list).
 */

import type { PromptTemplate } from '../types';
import type { ExtractedStateConsolidation } from '../../types/extraction';
import { stateConsolidationSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Removing Synonym Mess
INPUT:
Current physical states: ["tired", "wet smudge on face", "damp paws", "cheeks flushed blue", "increased glisten", "increased dampness", "sensitive", "heightened sensitivity"]
Recent messages show: Character has been crying

OUTPUT:
{
  "reasoning": "'wet smudge', 'damp paws', 'increased glisten', 'increased dampness' are all variations of being damp/wet - consolidate to 'tear-streaked'. 'sensitive' and 'heightened sensitivity' are synonyms - keep 'sensitive'. 'cheeks flushed blue' is distinct. Add tired.",
  "consolidatedMoods": [],
  "consolidatedPhysical": ["tired", "tear-streaked", "flushed cheeks", "sensitive"]
}

### Example 2: Merging Anxiety Synonyms
INPUT:
Current moods: ["nervous", "anxious", "worried", "apprehensive", "uneasy", "tense"]

OUTPUT:
{
  "reasoning": "These are ALL synonyms for anxiety. Pick the most fitting one and add one distinct emotional manifestation.",
  "consolidatedMoods": ["anxious", "tense"],
  "consolidatedPhysical": []
}

### Example 3: Empty Physical State - Add Reasonable Defaults
INPUT:
Current physical states: []
Current moods: ["happy", "excited"]
Recent messages show: Character is at a party, dancing

OUTPUT:
{
  "reasoning": "Physical state is empty but character is dancing at a party. Add reasonable physical states for someone actively dancing.",
  "consolidatedMoods": ["happy", "excited"],
  "consolidatedPhysical": ["energetic", "slightly flushed"]
}

### Example 4: Keeping Distinct States
INPUT:
Current physical states: ["bleeding", "bruised", "limping", "dizzy", "nauseous"]
Recent messages show: Character was just in a fight

OUTPUT:
{
  "reasoning": "These are all DISTINCT injury effects - bleeding, bruising, mobility impairment, disorientation, and stomach upset. Keep all as they describe different things.",
  "consolidatedMoods": [],
  "consolidatedPhysical": ["bleeding", "bruised", "limping", "dizzy", "nauseous"]
}

### Example 5: Mixed Cleanup
INPUT:
Current moods: ["joyful", "happy", "elated", "content", "pleased", "satisfied"]
Current physical states: ["exhausted"]
Recent messages show: Character just accomplished a major goal after much effort

OUTPUT:
{
  "reasoning": "'joyful', 'happy', 'elated' are synonyms for happiness - keep 'elated' as it's strongest. 'content', 'pleased', 'satisfied' are similar - keep 'satisfied'. Physical has only one item, add another based on context (just accomplished goal after effort).",
  "consolidatedMoods": ["elated", "satisfied"],
  "consolidatedPhysical": ["exhausted", "relieved tension"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Keeping Synonyms
INPUT:
Current moods: ["happy", "content", "joyful", "pleased", "satisfied"]

WRONG OUTPUT:
{
  "consolidatedMoods": ["happy", "content", "joyful", "pleased", "satisfied"]
}

WHY WRONG: These are ALL synonyms for happiness. Should be ["happy", "content"] at most - two distinct aspects of positive mood.

### Bad Example 2: Leaving List Empty
INPUT:
Current physical states: ["tired"]
Current moods: ["focused"]
Recent messages show: Character is studying late at night

WRONG OUTPUT:
{
  "consolidatedPhysical": ["tired"]
}

WHY WRONG: Minimum 2 items. For late-night studying, add something like "strained eyes" or "stiff shoulders".

### Bad Example 3: Missing the Synonyms
INPUT:
Current physical states: ["damp", "wet", "moist", "sweating", "perspiring"]

WRONG OUTPUT:
{
  "consolidatedPhysical": ["damp", "wet", "sweating"]
}

WHY WRONG: "damp", "wet", "moist" are synonyms. "sweating" and "perspiring" are synonyms. Should be just ["sweaty"] or ["damp"].

### Bad Example 4: Removing Everything
INPUT:
Current moods: ["angry", "frustrated", "bitter", "resentful"]
Recent messages show: Character just got betrayed by a friend

WRONG OUTPUT:
{
  "consolidatedMoods": ["angry"]
}

WHY WRONG: While these overlap, "angry" and "bitter" can coexist - anger is immediate, bitterness is lingering. Should be ["angry", "bitter"] to capture both the immediate and lasting response.

### Bad Example 5: Over-Consolidating Distinct States
INPUT:
Current physical states: ["bleeding arm", "broken ribs", "concussion"]
Recent messages show: Character was in a car accident

WRONG OUTPUT:
{
  "consolidatedPhysical": ["injured"]
}

WHY WRONG: These are distinct injuries affecting different body parts. Don't over-consolidate - keep ["bleeding arm", "broken ribs", "concussion"] as they're meaningfully different.
`;

export const characterStateConsolidationPrompt: PromptTemplate<ExtractedStateConsolidation> = {
	name: 'character_state_consolidation',
	description: 'Consolidate character mood and physical state lists, removing synonyms',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You consolidate character mood and physical state lists, removing synonyms and keeping only distinct states.

## Your Task
Given a character's current moods and physical states, consolidate them.
Use the recent messages for context to determine which states are most relevant RIGHT NOW.

## CRITICAL RULES

### NO SYNONYMS
Each item in your output must be MEANINGFULLY DISTINCT. Do not include:
- Word variations: "sweaty" + "sweating" + "sweat" -> just "sweaty"
- Intensity variants: "tired" + "very tired" + "exhausted" -> just "exhausted"
- Near-synonyms: "damp" + "wet" + "moist" -> just "damp"
- Redundant descriptions: "sensitive" + "heightened sensitivity" -> just "sensitive"

### OUTPUT CONSTRAINTS
- **Minimum 2 items** per list - if empty or only 1, add reasonable states based on the scene
- **Maximum 5 items** per list - consolidate if over this
- Each item must describe something DIFFERENT

## Output Format
{
  "reasoning": "Your analysis of which states to keep/merge/remove",
  "consolidatedMoods": ["mood1", "mood2", ...],      // 2-5 items, NO SYNONYMS
  "consolidatedPhysical": ["state1", "state2", ...]  // 2-5 items, NO SYNONYMS
}

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Current State
{{targetCharacterState}}

## Recent Messages for Context
{{messages}}

## Task
Consolidate the mood and physical state lists for {{targetCharacter}}.

Rules:
- Each list must have 2-5 items
- NO SYNONYMS - each item must be meaningfully distinct
- If a list has <2 items, add reasonable states based on recent context
- If a list has >5 items, consolidate to the most distinct/relevant ones`,

	responseSchema: stateConsolidationSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedStateConsolidation | null {
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
		if (!Array.isArray(parsed.consolidatedMoods)) return null;
		if (!Array.isArray(parsed.consolidatedPhysical)) return null;

		// Validate arrays contain strings
		for (const item of parsed.consolidatedMoods) {
			if (typeof item !== 'string') return null;
		}
		for (const item of parsed.consolidatedPhysical) {
			if (typeof item !== 'string') return null;
		}

		return {
			reasoning: parsed.reasoning,
			consolidatedMoods: parsed.consolidatedMoods as string[],
			consolidatedPhysical: parsed.consolidatedPhysical as string[],
		};
	},
};
