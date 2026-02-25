/**
 * Narrative Description Extraction Prompt
 *
 * Extracts a brief summary of what happened in the last 2 messages.
 * Runs every 2 turns to capture the narrative progression.
 * Witnesses and location are derived from projection state, not extracted.
 */

import type { PromptTemplate, JSONSchema } from '../types';
import type { ExtractedNarrativeDescription } from '../../types/extraction';
import { reasoningField } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const EXAMPLES = `
## Examples

### Example 1: Emotional Confrontation
INPUT:
"""
Elena: *Her hands tremble as she slams the folder onto the desk.* "I found them. All of them. Every picture, every receipt, every lie."

Marcus: *The color drains from his face.* "Elena, I... It's not what you think. Please, let me explain."
"""
OUTPUT:
{
  "reasoning": "Elena confronted Marcus about evidence of his lies. Marcus attempted to explain but she wasn't having it.",
  "description": "Elena confronted Marcus with evidence of his deception; he attempted to explain himself"
}

### Example 2: Discovery and Reaction
INPUT:
"""
Dr. Martinez: *Her hands shake as she reviews the data.* "Wake up Dr. Chen. Wake up the whole team. We need verification."

Assistant Chen: *He rushes to her workstation, eyes widening at the display.* "Dr. Martinez... is this...?" *He can't finish the question.*
"""
OUTPUT:
{
  "reasoning": "Dr. Martinez made a significant discovery and called for her team to verify it. Chen arrived and was stunned by what he saw.",
  "description": "Dr. Martinez discovered something significant in the data and called for team verification; Chen was stunned by the findings"
}

### Example 3: Romantic Moment
INPUT:
"""
Kai: *His hand finds her cheek, brushing away raindrops.* "Tell me to stop. Tell me this isn't what you want."

Mei: *She answers by rising on her toes and closing the distance between them, kissing him softly in the rain.*
"""
OUTPUT:
{
  "reasoning": "Kai and Mei shared a romantic moment culminating in a kiss in the rain.",
  "description": "Kai and Mei shared their first kiss in the rain"
}

### Example 4: Action Sequence
INPUT:
"""
Officer Chen: *The bullet tears through her shoulder and she goes down hard.* "You shouldn't have followed me, cop."

Detective Morrison: *The shot echoes through the warehouse. Morrison's bullet takes the suspect through the chest.* "Chen! Stay with me!"
"""
OUTPUT:
{
  "reasoning": "Chen was shot by the suspect, but Morrison arrived and shot the attacker to save her.",
  "description": "Chen was shot by the suspect; Morrison arrived in time to kill the attacker and save her"
}

### Example 5: Casual Conversation
INPUT:
"""
Mira: *She scrolls through her phone while waiting for her latte.* "Did you see Sarah's vacation photos?"

Barista: *He slides the cup across the counter.* "Oat milk latte for Mira?" *Already turning to the next order.*
"""
OUTPUT:
{
  "reasoning": "Mira got her coffee and made small talk. Nothing particularly dramatic happened.",
  "description": "Mira picked up her latte and chatted briefly with the barista"
}

### Example 6: Revelation
INPUT:
"""
Lord Ashworth: *The solicitor has just left.* "Twenty-three years you let me believe she died giving birth to me."

Lady Ashworth: *She meets Charlotte's eyes.* "We did what we thought was best. Your birth mother... she wasn't suitable."
"""
OUTPUT:
{
  "reasoning": "Charlotte learned she was adopted and her birth mother was hidden from her for 23 years.",
  "description": "Charlotte discovered she was secretly adopted; Lady Ashworth revealed her birth mother was deemed unsuitable"
}

### Example 7: Avoiding Repetition - Continuing Activity
INPUT:
Recent Narratives:
- Kai and Mei shared their first kiss in the rain
- Kai led Mei inside and they continued their passionate embrace
Messages:
"""
Kai: *He pulls back slightly, breathless.* "Stay tonight." *His eyes search hers.* "I don't want this to end."

Mei: *She traces his jawline.* "I'm not going anywhere." *She pulls him toward the bedroom.*
"""
OUTPUT:
{
  "reasoning": "Previous entries already covered the kiss and embrace. What's new here is the decision to spend the night together - the commitment to continue rather than the physical actions themselves.",
  "description": "Kai asked Mei to stay the night; she agreed and led him to the bedroom"
}

### Example 8: Avoiding Repetition - Progressing Scene
INPUT:
Recent Narratives:
- Marcus and Elena argued about his deception
- Elena demanded the truth about Marcus's past
Messages:
"""
Marcus: *He sinks into the chair, all resistance gone.* "Fine. You want the truth?" *He pulls out a faded photograph.* "I was never a businessman. I was an operative. And the people I worked for? They're the ones who killed your sister."

Elena: *The photograph falls from her trembling hands.* "What?"
"""
OUTPUT:
{
  "reasoning": "Previous entries covered the argument and demands for truth. The new development is Marcus's actual confession - his real identity and the bombshell about Elena's sister. Focus on what was revealed, not that they were still arguing.",
  "description": "Marcus confessed he was a former operative and revealed his employers killed Elena's sister"
}
`;

const narrativeDescriptionResponseSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		description: {
			type: 'string',
			description: 'Brief factual description of what happened in the messages',
		},
	},
	required: ['reasoning', 'description'],
};

export const narrativeDescriptionPrompt: PromptTemplate<ExtractedNarrativeDescription> = {
	name: 'narrative_description',
	description: 'Extract a brief summary of what happened in the last 2 messages',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterProfiles,
		PLACEHOLDERS.worldinfo,
		PLACEHOLDERS.recentNarratives,
	],

	systemPrompt: `You are summarizing roleplay messages for a narrative log.

## Your Task
Read the provided roleplay messages and write a brief, factual description of what happened.

## Output Format
Respond with a JSON object containing:
- "reasoning": Brief analysis of what occurred
- "description": One sentence summary of what happened

## Guidelines
- Be concise - one sentence is ideal
- Be factual - describe what happened, not how it felt
- Do not omit details about sexual acts
- Include key actions and reactions
- Use semicolons to separate multiple events in one description
- Don't editorialize or add interpretation

## Avoiding Repetition
You will be given recent narrative descriptions. Your new description MUST:
- Use different phrasing and vocabulary from previous entries
- Focus on what is NEW or DIFFERENT about this moment
- Avoid restating the same actions with minor word changes
- If a similar activity continues, describe the progression or shift, not the activity itself

${EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Character Profiles
{{characterProfiles}}

## Worldinfo/Lorebook Context
{{worldinfo}}

## Recent Narrative Descriptions (avoid repeating these)
{{recentNarratives}}

## Messages to Summarize
{{messages}}

## Task
Write a brief, factual description of what happened in these messages. Use different phrasing from the recent narratives above and focus on what is new or different.`,

	responseSchema: narrativeDescriptionResponseSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedNarrativeDescription | null {
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
		if (typeof parsed.description !== 'string') return null;

		return {
			reasoning: parsed.reasoning,
			description: parsed.description,
		};
	},
};
