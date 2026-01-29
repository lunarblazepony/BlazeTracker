// ============================================
// Time Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const TIME_PROMPTS: Record<string, PromptDefinition> = {
	time_datetime: {
		key: 'time_datetime',
		name: 'Time - Initial DateTime',
		description: 'Extracts the narrative date and time from the scene opening',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze this roleplay scene opening and determine the narrative date and time. You must only return valid JSON with no commentary.

<instructions>
- Determine the date and time when this scene takes place.
- Look for explicit mentions: "Monday morning", "3pm", "June 15th", "winter evening", etc.
- Look for contextual clues: weather, lighting, activities, meals, seasons.
- If the year is not specified, infer from context or use a reasonable modern year.
- If the month is not specified, infer from seasonal/weather clues or use a reasonable default.
- If the day is not specified, use a reasonable default (e.g., 15 for mid-month).
- Always provide complete values for all fields - never omit anything.
- Use 24-hour format for the hour field.
</instructions>

<examples>
<example>
<input>
*The first snow of the season was falling outside the coffee shop window, fat flakes drifting lazily under the streetlights. Elena wrapped her hands around her pumpkin spice latte, watching the evening crowd hurry past with their collars turned up against the cold. It was barely past five, but the sun had already set—one of those November days that made her wish she'd moved somewhere warmer.*

*Her phone buzzed: a text from Marcus saying he was running late, stuck in traffic from the corporate holiday party he'd been dreading all week. She smiled and texted back that she'd order him something warm. The barista had just put up the Christmas decorations—a little early, but Elena didn't mind. The twinkling lights reflected off the dark window, making the shop feel cozy despite the chill creeping in around the door frame.*
</input>
<output>
{
  "year": 2024,
  "month": 11,
  "day": 15,
  "hour": 17,
  "minute": 15,
  "period": "evening",
  "season": "late autumn"
}
</output>
<explanation>
EXPLICIT clues:
- "first snow of the season" + "November days" → month is 11 (November)
- "barely past five, but the sun had already set" → hour is 17 (5 PM), early sunset confirms late autumn
- "evening crowd" → period is "evening"

INFERRED values:
- year: Not specified, use current/reasonable modern year (2024)
- day: Not specified, default to mid-month (15)
- minute: "barely past five" suggests just after the hour (15)
- season: "late autumn" - November with first snow, not quite winter yet

Context clues that CONFIRM the inference:
- Pumpkin spice latte (seasonal fall drink)
- Corporate holiday party (November-December timing)
- Christmas decorations going up early (pre-December)
- Cold weather, collars turned up
</explanation>
</example>

<example>
<input>
*The summer sun blazed overhead as Marcus hauled the last cooler out of the truck bed. It was barely noon, but the Fourth of July heat was already oppressive—had to be pushing ninety-five in the shade, if there'd been any shade to speak of. The beach parking lot shimmered with heat mirages, and he could feel the asphalt burning through his sandals.*

*Down by the water, Elena and the kids had already claimed their spot, the red-white-and-blue umbrella visible even from here. She waved, and he could see Sophie jumping up and down with excitement, probably begging to go in the water before lunch. He checked his phone—12:17—and started the long trudge across the sand.*
</input>
<output>
{
  "year": 2024,
  "month": 7,
  "day": 4,
  "hour": 12,
  "minute": 17,
  "period": "midday",
  "season": "summer"
}
</output>
<explanation>
EXPLICIT clues:
- "Fourth of July" → month: 7, day: 4
- "barely noon" and "12:17" on phone → hour: 12, minute: 17
- "summer sun" → season: "summer"

INFERRED values:
- year: Not specified, use reasonable modern year (2024)
- period: "midday" - noon timeframe

Context clues that CONFIRM:
- Extreme heat (95°F) typical of July
- Beach trip with family (common July 4th activity)
- Patriotic umbrella colors (holiday-appropriate)
</explanation>
</example>

<example>
<input>
*The cherry blossoms were in full bloom along the Potomac, their delicate pink petals drifting down like snow onto the jogging path. Elena stretched her calves against a park bench, watching the early morning runners pass by in the golden dawn light. It was the perfect time of year for this—not too hot yet, the air fresh and cool, the city just starting to wake up.*

*Her fitness tracker showed 6:47 AM and a respectable heart rate after her warm-up. In the distance, she could see the Washington Monument catching the first rays of sunlight, and beyond it, the dome of the Capitol building. A few dog walkers ambled past, coffee cups in hand, taking advantage of the quiet before the tourist crowds arrived.*
</input>
<output>
{
  "year": 2024,
  "month": 4,
  "day": 8,
  "hour": 6,
  "minute": 47,
  "period": "early morning",
  "season": "spring"
}
</output>
<explanation>
EXPLICIT clues:
- "cherry blossoms in full bloom" → late March to mid-April (peak bloom in DC)
- "6:47 AM" on fitness tracker → hour: 6, minute: 47
- "early morning runners" + "golden dawn light" → period: "early morning"

INFERRED values:
- year: Modern year (2024) - Washington Monument, fitness tracker suggest contemporary
- month: 4 (April) - cherry blossom peak season
- day: 8 - mid-peak bloom period, reasonable default
- season: "spring" - cherry blossoms, "not too hot yet," fresh cool air

Location clues (Washington DC) help date the cherry blossoms specifically - they bloom late March through mid-April there.
</explanation>
</example>
</examples>`,
		userTemplate: `<scene_opening>
{{messages}}
</scene_opening>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the narrative date and time as valid JSON:`,
	},

	time_delta: {
		key: 'time_delta',
		name: 'Time - Delta',
		description: 'Determines how much narrative time has passed in the messages',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.currentTime,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze these roleplay messages and determine how much narrative time has passed. You must only return valid JSON with no commentary.

<instructions>
- Determine how much time passes WITHIN these messages based on their actual content.
- The example output below is just showing the JSON format - do NOT copy its values.
- Look for explicit time jumps: "an hour later", "after a few minutes", "the next morning".
- Look for implicit time passage: travel, sleeping, waiting, activities with known durations.
- If the messages are just dialogue or immediate action with no time skip, return small values (0-2 minutes).
- Estimate based on what actually happens in the messages:
  * Pure dialogue exchange: 1-2 minutes
  * Walking somewhere nearby: 5-15 minutes
  * Driving across town: 15-45 minutes
  * Napping: 1-3 hours (consider currentTime)
  * Sleeping overnight: 6-10 hours (consider currentTime)
  * "A few minutes": 3-5 minutes
  * "A while": 15-30 minutes
  * "Some time": 30-60 minutes
- Be conservative - if unsure, prefer smaller time jumps.
- Return 0 for all fields if no time has passed.
</instructions>

<examples>
<example>
<current_time>Tuesday, March 12, 2024 at 10:30 PM</current_time>
<input>
*Elena yawned and stretched, her eyes heavy after the long day. The movie credits were rolling on the TV, but neither of them had really been watching for the last half hour.*

Elena: "I should probably head to bed. Early meeting tomorrow."

Marcus: "Yeah, me too." *He clicked off the TV and stood, offering her a hand.* "I'll lock up."

*They made their way upstairs, taking turns in the bathroom. By the time Elena had finished her skincare routine and climbed into bed, Marcus was already half-asleep, the lamp on his side still on.*

Elena: *turning off the lamp* "Night."

Marcus: *mumbling* "Night..."

*The morning sun streaming through a gap in the curtains woke Elena before her alarm. She blinked at the clock—6:47 AM—and groaned. Still thirteen minutes before she actually needed to be up. Beside her, Marcus was snoring softly, completely dead to the world.*
</input>
<output>
{
  "days": 0,
  "hours": 8,
  "minutes": 17
}
</output>
<explanation>
This is an OVERNIGHT time skip:
- currentTime: 10:30 PM Tuesday
- They went to bed shortly after (maybe 15-20 min for bathroom routine)
- Elena wakes at 6:47 AM
- Total elapsed: approximately 8 hours 17 minutes

The scene explicitly moves from "heading to bed" at night to "morning sun" waking her at 6:47 AM. We calculate from 10:30 PM to 6:47 AM = 8h 17m.

Key indicators of overnight skip:
- Going to bed at night
- "Morning sun streaming through curtains"
- Specific wake-up time given (6:47 AM)
- "Before her alarm" implies morning routine starting
</explanation>
</example>

<example>
<current_time>Saturday, June 8, 2024 at 2:15 PM</current_time>
<input>
*The argument had been building for twenty minutes now, voices rising with each exchange. Elena stood by the window, arms crossed, while Marcus paced the length of the living room.*

Marcus: "I just don't understand why you didn't tell me about the job offer!"

Elena: "Because I knew you'd react exactly like this!"

Marcus: "Like what? Like someone who thought we made decisions together?"

*Elena flinched. That one landed. She turned away from him, staring out at the street below without really seeing it.*

Elena: "I haven't even decided if I'm taking it yet."

Marcus: "But you're considering it. You're considering moving across the country and you didn't think that was worth mentioning?"

*The silence stretched between them, heavy and painful. Finally, Elena spoke, her voice smaller than before.*

Elena: "I was scared. I didn't know how to bring it up."

Marcus: *sighing heavily, running a hand through his hair* "I just... I need a minute." *He grabbed his jacket from the couch.* "I'm going for a walk."

*The door closed behind him with a quiet click that somehow felt louder than all the shouting.*
</input>
<output>
{
  "days": 0,
  "hours": 0,
  "minutes": 25
}
</output>
<explanation>
This is REAL-TIME dialogue with stated duration:
- "The argument had been building for twenty minutes now" establishes base time
- The rest of the exchange takes another ~5 minutes of heated dialogue
- Total: approximately 25 minutes

NO time skip occurs - this is a continuous scene. The time represents:
- 20 minutes of prior argument (mentioned)
- ~5 minutes of the dialogue we see
- Marcus leaving at the end

Key principle: Emotional conversations feel longer but don't actually take much clock time. An intense 5-minute argument can feel like an hour.
</explanation>
</example>

<example>
<current_time>Monday, September 16, 2024 at 9:00 AM</current_time>
<input>
*Elena grabbed her laptop bag and headed for the door, already running late for the presentation.*

Elena: "I'll see you tonight!"

Marcus: *from the kitchen* "Good luck! You've got this!"

*The commute was brutal—an accident on the highway had traffic backed up for miles. Elena spent forty-five minutes crawling along, mentally rehearsing her talking points and trying not to check the clock every thirty seconds. By the time she finally pulled into the parking garage, she had exactly three minutes to get upstairs.*

*She power-walked through the lobby, badge already in hand, and caught the elevator just as the doors were closing. The conference room was on the twelfth floor. She watched the numbers climb with growing anxiety—8, 9, 10, 11, 12—and practically sprinted down the hallway when the doors opened.*

*She slid into the conference room at 9:58 AM, two minutes before her slot. Her boss raised an eyebrow but said nothing. Elena set up her laptop with slightly shaking hands and took a deep breath. She'd made it.*
</input>
<output>
{
  "days": 0,
  "hours": 0,
  "minutes": 58
}
</output>
<explanation>
Time skip with EXPLICIT endpoint:
- Starts: 9:00 AM (currentTime, she's "already running late")
- Ends: 9:58 AM (explicitly stated - "slid into the conference room at 9:58 AM")
- Total: 58 minutes

Breakdown of time passage:
- Brief goodbye at home: 1-2 min
- 45 minutes of commute (explicitly stated)
- Parking, walking, elevator: ~10 min
- Total checks out: 2 + 45 + 10 ≈ 57-58 minutes

When EXACT times are given, use them for precision rather than estimating.
</explanation>
</example>

<bad_example>
<current_time>Tuesday, March 12, 2024 at 10:30 PM</current_time>
<input>
*Elena yawned...* [overnight sleep scene] *...woke at 6:47 AM*
</input>
<output>
{
  "days": 1,
  "hours": 0,
  "minutes": 0
}
</output>
<why_bad>
- Used "days: 1" but only 8 hours passed (10:30 PM to 6:47 AM)
- Should be: days: 0, hours: 8, minutes: 17
- "Next day" doesn't mean 24 hours - calculate actual elapsed time
- Always compute from current_time to the scene's end time
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<current_time>
{{currentTime}}
</current_time>

<messages>
{{messages}}
</messages>

<schema>
{{schema}}
</schema>

<output_format_example>
{{schemaExample}}
</output_format_example>

Based on the actual content of the messages above, extract the time delta as valid JSON:`,
	},
};
