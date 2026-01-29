/**
 * Time Delta Extraction Prompt
 *
 * Extracts how much time has passed in the narrative. ALWAYS returns a delta,
 * even for pure dialogue (which typically takes 1-2 minutes).
 *
 * Based on the v1 approach which worked well.
 */

import type { PromptTemplate, JSONSchema } from '../types';
import type { ExtractedTimeChange } from '../../types/extraction';
import { timeDeltaSchema, reasoningField } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Explicit Time Skip - Clock Shows Time
INPUT:
"""
Previous time: Monday, June 15, 2024 at 2:30 PM

Elena: *She had been staring at the same document for what felt like an eternity. When she finally looked up, the clock on the wall showed 5:45 PM. Three hours had vanished into the maze of financial records.*
"""
OUTPUT:
{
  "reasoning": "The previous time was 2:30 PM. The text explicitly states the clock showed 5:45 PM. From 2:30 PM to 5:45 PM is 3 hours and 15 minutes.",
  "delta": { "days": 0, "hours": 3, "minutes": 15, "seconds": 0 }
}

### Example 2: Overnight Sleep
INPUT:
"""
Previous time: Thursday, September 21, 2023 at 10:30 PM

Luna: *Sleep had come eventually. Luna woke to the sound of birds outside her window, the morning light harsh against her eyes. The bedside clock read 6:42 AM.*
"""
OUTPUT:
{
  "reasoning": "Previous time was Thursday 10:30 PM. She wakes to morning light at 6:42 AM. From 10:30 PM to 6:42 AM the next day is 8 hours and 12 minutes.",
  "delta": { "days": 0, "hours": 8, "minutes": 12, "seconds": 0 }
}

### Example 3: Pure Dialogue - Minimal Time (1-2 minutes)
INPUT:
"""
Previous time: Saturday, December 2, 2023 at 4:15 PM

Alex: *He reached for her hand across the cafe table.* "I've been wanting to tell you something," he said softly.
Maya: *raised an eyebrow, her coffee cup frozen halfway to her lips.*
Alex: "I... I think I'm falling for you."
"""
OUTPUT:
{
  "reasoning": "This is a pure dialogue exchange with no time skip indicators. A brief conversation like this takes approximately 1-2 minutes.",
  "delta": { "days": 0, "hours": 0, "minutes": 1, "seconds": 0 }
}

### Example 4: Walking Somewhere Nearby (5-15 minutes)
INPUT:
"""
Previous time: Tuesday, April 10, 2024 at 3:00 PM

Marcus: *They left the cafe and walked down the street to the park, chatting about nothing in particular.*
Elena: "This is nice," *she said as they found a bench under an old oak tree.*
"""
OUTPUT:
{
  "reasoning": "They walked from a cafe to a nearby park - a short walk that typically takes 5-10 minutes including finding a seat.",
  "delta": { "days": 0, "hours": 0, "minutes": 8, "seconds": 0 }
}

### Example 5: Memory/Flashback - Time Passes During Reflection
INPUT:
"""
Previous time: Thursday, April 6, 2024 at 3:00 PM

Elena: *She remembered the night they first met - 2 AM at that dive bar downtown. The memory still made her smile. She picked up her coffee and took a sip, then turned back to the case file.*
"""
OUTPUT:
{
  "reasoning": "The 2 AM is from a memory, not current time. The actual scene continues in the present. Elena briefly reminisces while drinking coffee - about 1 minute passes.",
  "delta": { "days": 0, "hours": 0, "minutes": 1, "seconds": 0 }
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Memory Time for Current Time
INPUT:
"""
Previous time: Monday, June 15, 2024 at 2:00 PM

Marcus: *He thought back to their wedding day, June 3rd, 2019 at 4 PM. The memory brought a sad smile to his face as he sipped his afternoon coffee.*
"""
WRONG OUTPUT:
{
  "reasoning": "The wedding was at 4 PM on June 3rd, 2019.",
  "delta": { "days": -1838, "hours": -2, "minutes": 0, "seconds": 0 }
}
WHY THIS IS WRONG: The June 3rd, 2019 date is a memory, not the current time. Marcus is reminiscing in the present. The actual time passed is just the brief moment of sipping coffee (~1 minute).

### Bad Example 2: Future Plans Are Not Time Passage
INPUT:
"""
Previous time: Friday, March 8, 2024 at 9:00 AM

Sarah: "We'll meet at the restaurant at 7 PM tonight," *she said, checking her calendar.* "Don't be late."
"""
WRONG OUTPUT:
{
  "reasoning": "They're meeting at 7 PM, so 10 hours pass.",
  "delta": { "days": 0, "hours": 10, "minutes": 0, "seconds": 0 }
}
WHY THIS IS WRONG: The 7 PM is a future plan, not the current time. The scene hasn't jumped forward to 7 PM - Sarah is just making plans. The actual time passed is ~1 minute for the brief exchange.

### Bad Example 3: Dialogue About Past Events
INPUT:
"""
Previous time: Wednesday, May 22, 2024 at 3:00 PM

Detective: "So you're saying you arrived at 8 AM and left at noon?"
Witness: "That's correct, four hours exactly."
"""
WRONG OUTPUT:
{
  "reasoning": "The witness was there from 8 AM to noon, 4 hours.",
  "delta": { "days": 0, "hours": 4, "minutes": 0, "seconds": 0 }
}
WHY THIS IS WRONG: The witness is describing past events, not current time passage. The interview itself is happening in the present and only takes ~1 minute for this exchange.

### Bad Example 4: Ignoring Explicit Time Indicators
INPUT:
"""
Previous time: Tuesday, April 10, 2024 at 1:00 PM

Elena: *Six hours later, she finally finished the report. Her watch read 7:15 PM.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena finished a report, probably took about an hour.",
  "delta": { "days": 0, "hours": 1, "minutes": 0, "seconds": 0 }
}
WHY THIS IS WRONG: The text explicitly says "Six hours later" and confirms it's 7:15 PM. Don't estimate when explicit time is given. The correct delta is 6 hours and 15 minutes.

### Bad Example 5: Wrong Math When Crossing Midnight
INPUT:
"""
Previous time: Saturday, November 11, 2023 at 11:30 PM

Luna: *The party continued until she finally checked her phone - 2:15 AM.*
"""
WRONG OUTPUT:
{
  "reasoning": "From 11:30 PM to 2:15 AM is about 9 hours.",
  "delta": { "days": 0, "hours": 9, "minutes": 15, "seconds": 0 }
}
WHY THIS IS WRONG: The math is wrong. From 11:30 PM to 2:15 AM is only 2 hours and 45 minutes, not 9 hours. Calculate midnight crossings carefully.
`;

const timeDeltaResponseSchema: JSONSchema = {
	type: 'object',
	properties: {
		reasoning: reasoningField,
		delta: timeDeltaSchema,
	},
	required: ['reasoning', 'delta'],
};

export const timeChangePrompt: PromptTemplate<ExtractedTimeChange> = {
	name: 'time_change',
	description: 'Estimate how much time has passed in the narrative',

	placeholders: [PLACEHOLDERS.messages, PLACEHOLDERS.currentTime, PLACEHOLDERS.characterName],

	systemPrompt: `You are analyzing roleplay messages to estimate how much narrative time has passed.

## Your Task
Read the provided roleplay messages and estimate how much time has passed. ALWAYS return a time delta - even minimal dialogue takes some time.

## Time Estimation Guidelines
Use these estimates based on activity type:

| Activity Type | Time Estimate |
|--------------|---------------|
| Pure dialogue exchange | 1-2 minutes |
| Brief action (pouring drink, sitting down) | 30 seconds - 1 minute |
| Walking somewhere nearby | 5-15 minutes |
| Driving across town | 15-45 minutes |
| Having a meal | 30-60 minutes |
| Watching a movie | 1.5-2.5 hours |
| Napping | 1-3 hours |
| Sleeping overnight | 6-10 hours |
| "A few minutes" | 3-5 minutes |
| "A while" | 15-30 minutes |
| "Some time" | 30-60 minutes |

## Output Format
Always respond with a JSON object containing:
- "reasoning": Your analysis of time clues and activity
- "delta": Object with days, hours, minutes, seconds

## Time Clues to Look For
1. Explicit clock/watch times
2. Time skip phrases ("two hours later", "the next morning")
3. Activity durations (movies, meals, travel)
4. Environmental changes (dawn to dusk, "sun had set")
5. Day/date mentions

## NOT Time Passage (ignore these)
1. Memories and flashbacks ("she remembered when...")
2. Stories being told about the past
3. Future plans or estimates ("we'll be there by 3 PM")
4. Time of death or historical events in exposition

## Delta Calculation Rules
- days: 0 or more
- hours: 0-23
- minutes: 0-59
- seconds: 0-59 (usually 0 unless explicitly stated)
- When crossing midnight, calculate correctly
- Be conservative - if unsure, prefer smaller values

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Previous Time
{{currentTime}}

## Messages to Analyze
{{messages}}

## Task
Estimate how much time has passed. Remember:
- Pure dialogue: 1-2 minutes
- Brief actions: 30 sec - 1 minute
- Look for explicit time clues
- Ignore memories/flashbacks
- Calculate delta as days/hours/minutes/seconds`,

	responseSchema: timeDeltaResponseSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedTimeChange | null {
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
		if (!parsed.delta || typeof parsed.delta !== 'object') return null;

		const delta = parsed.delta as Record<string, unknown>;
		if (typeof delta.days !== 'number' || delta.days < 0) return null;
		if (typeof delta.hours !== 'number' || delta.hours < 0 || delta.hours > 23)
			return null;
		if (typeof delta.minutes !== 'number' || delta.minutes < 0 || delta.minutes > 59)
			return null;
		if (typeof delta.seconds !== 'number' || delta.seconds < 0 || delta.seconds > 59)
			return null;

		// Always return with delta (the new format)
		return {
			reasoning: parsed.reasoning as string,
			changed: true, // For backwards compat, always true since we always have a delta
			delta: delta as {
				days: number;
				hours: number;
				minutes: number;
				seconds: number;
			},
		};
	},
};
