/**
 * Relationship Attitude Consolidation Prompt (Single Direction)
 *
 * Consolidates feelings and wants lists for one direction of a relationship,
 * removing synonyms and keeping only distinct items (2-5 items per list).
 *
 * IMPORTANT: This prompt handles ONE direction only (e.g., Luna's feelings toward User).
 * It does NOT handle the reverse direction. The extractor calls this twice per pair.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedAttitudeConsolidation } from '../../types/extraction';
import { attitudeConsolidationSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Removing Synonym Mess
INPUT:
Luna's feelings toward User: ["loves", "adores", "cherishes", "devoted to", "infatuated with", "attracted to", "cares for"]

OUTPUT:
{
  "reasoning": "'loves', 'adores', 'cherishes', 'devoted to', 'infatuated with', 'cares for' are all synonyms for romantic love - keep 'loves'. 'attracted to' is distinct (physical vs emotional).",
  "consolidatedFeelings": ["loves", "attracted to"],
  "consolidatedWants": []
}

### Example 2: Resolved Wants
INPUT:
Luna's wants toward User: ["wants to kiss", "wants to confess feelings", "wants to hold hands", "wants to spend time together", "wants their approval"]
Recent messages show: They've started dating, confessed feelings, and kissed

OUTPUT:
{
  "reasoning": "'confess feelings' and 'kiss' are resolved. Keep unresolved active wants.",
  "consolidatedFeelings": [],
  "consolidatedWants": ["wants to spend time together", "wants their approval"]
}

### Example 3: Empty Feelings - Add Reasonable Defaults
INPUT:
Luna's feelings toward User: []
Recent messages show: They just met and had a pleasant conversation

OUTPUT:
{
  "reasoning": "Feelings empty but they had a positive first meeting. Add appropriate initial feelings.",
  "consolidatedFeelings": ["curious about", "friendly toward"],
  "consolidatedWants": []
}

### Example 4: Keep Contradictory but Distinct Feelings
INPUT:
Luna's feelings toward User: ["trusts", "respects", "fears", "resents"]

OUTPUT:
{
  "reasoning": "Complex relationships can have contradictory feelings. These are all DISTINCT - trust, respect, fear, and resentment are different emotional dimensions. Keep all.",
  "consolidatedFeelings": ["trusts", "respects", "fears", "resents"],
  "consolidatedWants": []
}

### Example 5: Mixed Cleanup
INPUT:
Luna's feelings toward User: ["happy around", "enjoys company of", "likes", "fond of", "attracted to"]
Luna's wants toward User: ["wants to date", "wants relationship", "wants romance"]
Recent messages show: Early stages of mutual attraction

OUTPUT:
{
  "reasoning": "'happy around', 'enjoys company of', 'likes', 'fond of' are all ways of saying 'likes' - keep 'fond of' as it's warmest. 'attracted to' is distinct (physical). For wants, 'date', 'relationship', 'romance' overlap - keep 'wants to date' as most immediate.",
  "consolidatedFeelings": ["fond of", "attracted to"],
  "consolidatedWants": ["wants to date", "wants to know them better"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Keeping Synonyms
INPUT:
Feelings: ["loves", "adores", "cherishes", "devoted to"]

WRONG OUTPUT:
{
  "consolidatedFeelings": ["loves", "adores", "cherishes", "devoted to"]
}

WHY WRONG: These are ALL synonyms. Should be just ["loves"] or ["loves", "devoted to"] at most.

### Bad Example 2: Leaving Empty
INPUT:
Wants: ["wants to help"]

WRONG OUTPUT:
{
  "consolidatedWants": ["wants to help"]
}

WHY WRONG: Minimum 2 items. Add another reasonable want based on the relationship context.

### Bad Example 3: Over-Consolidating
INPUT:
Feelings: ["protective of", "worried about", "cares for", "frustrated with"]
Recent messages show: Parent worried about their rebellious teenager

WRONG OUTPUT:
{
  "consolidatedFeelings": ["loves"]
}

WHY WRONG: While "protective", "worried", "cares" relate to love, "frustrated with" is distinct and important to keep. Should be ["protective of", "frustrated with"] at minimum.

### Bad Example 4: Ignoring Context
INPUT:
Feelings: ["suspicious of", "distrusts", "wary of"]
Recent messages show: The character just discovered the other person lied to them

WRONG OUTPUT:
{
  "consolidatedFeelings": ["neutral toward"]
}

WHY WRONG: Context shows trust was broken. Keep the negative feelings that match: ["distrusts", "feels betrayed by"].

### Bad Example 5: Mixing Up Wants and Feelings
INPUT:
Feelings: ["protective"]
Wants: ["wants to protect them"]

WRONG OUTPUT:
{
  "consolidatedFeelings": ["protective", "wants to protect them"],
  "consolidatedWants": []
}

WHY WRONG: "wants to protect them" is a WANT, not a feeling. Keep categories separate.
`;

export const relationshipAttitudeConsolidationPrompt: PromptTemplate<ExtractedAttitudeConsolidation> =
	{
		name: 'relationship_attitude_consolidation',
		description:
			'Consolidate relationship feelings and wants for one direction, removing synonyms',

		placeholders: [
			PLACEHOLDERS.messages,
			PLACEHOLDERS.characterProfiles,
			// Custom placeholders for this prompt - not in PLACEHOLDERS since they're specific to this use case
			{
				name: 'fromCharacter',
				description:
					'The character whose feelings/wants we are consolidating',
				example: 'Luna',
			},
			{
				name: 'towardCharacter',
				description: 'The character they have feelings/wants toward',
				example: 'User',
			},
			{
				name: 'currentFeelings',
				description: 'Current list of feelings',
				example: 'loves, adores, cherishes',
			},
			{
				name: 'currentWants',
				description: 'Current list of wants',
				example: 'wants to kiss, wants to date',
			},
		],

		systemPrompt: `You consolidate relationship feelings and wants lists for ONE DIRECTION, removing synonyms and keeping only distinct items.

## Your Task
You are given ONE character's feelings and wants toward another character. Consolidate them.
Use the recent messages for context to determine which are most relevant RIGHT NOW.

## CRITICAL RULES

### NO SYNONYMS
Each item must be MEANINGFULLY DISTINCT. Do not include:
- Near-synonyms: "loves" + "adores" + "cherishes" -> just "loves"
- Intensity variants: "likes" + "really likes" -> just "likes"
- Redundant wants: "wants to be close" + "wants intimacy" -> pick one

### OUTPUT CONSTRAINTS
- **Minimum 2 items** per list - if empty or only 1, add reasonable feelings/wants based on the relationship
- **Maximum 5 items** per list - consolidate if over this
- Each item must describe something DIFFERENT

## Output Format
{
  "reasoning": "Your analysis",
  "consolidatedFeelings": ["feeling1", ...],  // 2-5 items, NO SYNONYMS
  "consolidatedWants": ["want1", ...]         // 2-5 items, NO SYNONYMS
}

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

		userTemplate: `## Character Profiles
{{characterProfiles}}

## Direction
We are consolidating {{fromCharacter}}'s feelings and wants TOWARD {{towardCharacter}}.

## Current State ({{fromCharacter}} -> {{towardCharacter}})
Feelings: {{currentFeelings}}
Wants: {{currentWants}}

## Recent Messages for Context
{{messages}}

## Task
Consolidate {{fromCharacter}}'s feelings and wants toward {{towardCharacter}}.

Rules:
- Each list must have 2-5 items
- NO SYNONYMS - each item must be meaningfully distinct
- If a list has <2 items, add reasonable feelings/wants based on recent context
- If a list has >5 items, consolidate to the most distinct/relevant ones`,

		responseSchema: attitudeConsolidationSchema,

		defaultTemperature: 0.3,

		parseResponse(response: string): ExtractedAttitudeConsolidation | null {
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
			if (!Array.isArray(parsed.consolidatedFeelings)) return null;
			if (!Array.isArray(parsed.consolidatedWants)) return null;

			// Validate arrays contain strings
			for (const item of parsed.consolidatedFeelings) {
				if (typeof item !== 'string') return null;
			}
			for (const item of parsed.consolidatedWants) {
				if (typeof item !== 'string') return null;
			}

			return {
				reasoning: parsed.reasoning,
				consolidatedFeelings: parsed.consolidatedFeelings as string[],
				consolidatedWants: parsed.consolidatedWants as string[],
			};
		},
	};
