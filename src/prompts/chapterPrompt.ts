// ============================================
// Chapter Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const CHAPTER_PROMPTS: Record<string, PromptDefinition> = {
	chapter_boundary: {
		key: 'chapter_boundary',
		name: 'Chapter - Boundary Detection',
		description:
			'Determines if a chapter boundary has occurred and generates chapter summary',
		defaultTemperature: 0.5,
		placeholders: [
			COMMON_PLACEHOLDERS.currentEvents,
			COMMON_PLACEHOLDERS.currentRelationships,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `A potential chapter boundary has been detected (location change or time jump). Analyze whether this represents a true narrative chapter break and generate a chapter summary. You must only return valid JSON with no commentary.

<instructions>
<boundary_detection>
- A true chapter boundary marks a significant narrative transition.
- Time jumps of several hours or location changes to new areas often indicate chapters.
- Minor movements within the same scene (e.g., moving to another room in the same building) are NOT chapter boundaries.
- Consider if the narrative tone or focus has shifted significantly.
</boundary_detection>
<summary>
- Write a 2-3 sentence summary of what happened in the chapter.
- Focus on the most important events and character developments.
- Include any relationship changes.
</summary>
<outcomes>
- relationshipChanges: Note any significant shifts in how characters relate to each other.
- secretsRevealed: Any secrets that came to light.
- newComplications: New problems or tensions introduced.
</outcomes>
</instructions>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>`,
		userTemplate: `<chapter_events>
{{currentEvents}}
</chapter_events>

<current_relationships>
{{currentRelationships}}
</current_relationships>

Analyze the chapter boundary and generate summary as valid JSON:`,
	},
};
