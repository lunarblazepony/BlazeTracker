// ============================================
// Relationship Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const RELATIONSHIP_PROMPTS: Record<string, PromptDefinition> = {
	relationship_initial: {
		key: 'relationship_initial',
		name: 'Relationship - Initial',
		description: 'Extracts initial relationship state between two characters',
		defaultTemperature: 0.6,
		placeholders: [
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze this roleplay scene and extract the relationship between two characters. You must only return valid JSON with no commentary.

<instructions>
<general>
- Determine the current status of the relationship (strangers, acquaintances, friendly, close, intimate, strained, hostile, complicated).
- Extract how each character feels about the other (asymmetric feelings are common and important).
- Note any secrets one character knows that the other doesn't.
- Identify what each character wants from the relationship.
</general>

<status_guidelines>
Status definitions and requirements:

- strangers: Never met or just met, no rapport
- acquaintances: Know each other casually, no strong bond
- friendly: Positive rapport, enjoy each other's company
- close: Deep friendship, trust, confide in each other. Maximum for platonic relationships.
- intimate: ONLY for romantic/sexual relationships with explicit romantic actions (kiss, date, love confession, sex)
- strained: Tension, unresolved conflict, damaged trust
- hostile: Active antagonism, enemies
- complicated: Mixed feelings, unclear relationship

CRITICAL STATUS LIMITS:
- "intimate" REQUIRES romantic actions to have occurred (first kiss, first date, love confession, sexual activity)
- Sharing secrets or emotional vulnerability alone = "close" at most, NOT "intimate"
- Caring about someone or wanting to help them = "friendly" or "close", NOT "intimate"
- "intimate" means ROMANTIC relationship, not just emotional closeness

Examples:
- Characters shared deep secrets, support each other emotionally → "close" (not intimate - no romance)
- Characters had their first kiss → can be "intimate"
- Characters confessed romantic love → can be "intimate"
- Characters care deeply about each other but no romantic actions → "close"
- Characters are suspicious but talking → "strained" or "acquaintances"
</status_guidelines>

<asymmetry>
- Each character's feelings may be very different from the other's.
- One character might be trusting while the other is suspicious.
- One might want romance while the other wants friendship.
- Capture these differences accurately.
</asymmetry>

<output_format>
Return attitudes using actual character names as keys:
{
  "status": "friendly",
  "attitudes": {
    "CharacterName1": {
      "toward": "CharacterName2",
      "feelings": ["trusting", "curious"],
      "secrets": ["knows about their past"],
      "wants": ["friendship"]
    },
    "CharacterName2": {
      "toward": "CharacterName1",
      "feelings": ["grateful", "protective"],
      "secrets": [],
      "wants": ["loyalty"]
    }
  }
}

IMPORTANT: Use the actual character names as keys, NOT "aToB" or "bToA".
The "toward" field clarifies who the feelings are directed at.
</output_format>

<secrets>
- Secrets are things one character knows about the other (or about a situation) that the other doesn't know.
- This is crucial for dramatic irony in the narrative.
- Only include actual secrets, not just information one character hasn't shared yet.
</secrets>
</instructions>`,
		userTemplate: `<character_info>
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

Extract the relationship state as valid JSON:`,
	},
};
