/**
 * Character Activity Change Extraction Prompt
 *
 * Extracts when a character's current activity changes.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedActivityChange } from '../../types/extraction';
import { activityChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Starting A New Activity
INPUT:
"""
Character: Elena
Current activity: nursing a whiskey at the bar

New message:
*Elena sets down her glass and pulls out her phone, scrolling through what looks like a series of encrypted messages. Her brow furrows as she reads.*
"""
OUTPUT:
{
  "reasoning": "Elena stops drinking (sets down glass) and begins a new activity - reading encrypted messages on her phone. Her furrow brow indicates concentration on this new task. Clear activity change from drinking to phone reading.",
  "character": "Elena",
  "changed": true,
  "newActivity": "reading encrypted messages on her phone"
}

### Example 2: Stopping Activity Without Starting Another
INPUT:
"""
Character: Marcus
Current activity: pacing the room anxiously

New message:
*Marcus stops mid-stride, suddenly still. He turns to face the window, staring out at the rain-soaked city below.*
"""
OUTPUT:
{
  "reasoning": "Marcus stops pacing ('stops mid-stride, suddenly still') and is now just standing/staring out the window. The anxious pacing has ended. His new state is more passive - just standing and staring, which is minimal activity.",
  "character": "Marcus",
  "changed": true,
  "newActivity": "staring out the window"
}

### Example 3: No Activity Change - Same Action Continues
INPUT:
"""
Character: Sarah
Current activity: reviewing the case files

New message:
*Sarah turns to the next page in the file, her pen scratching notes in the margin. The coffee beside her grows cold, forgotten.*
"""
OUTPUT:
{
  "reasoning": "Sarah continues reviewing files - turning pages and making notes. This is a continuation of the same activity (reviewing case files), not a change. The cold coffee suggests time passing but not activity changing.",
  "character": "Sarah",
  "changed": false
}

### Example 4: Transitioning From Passive to Active
INPUT:
"""
Character: Jake
Current activity: null (sitting idle)

New message:
*Jake finally breaks the silence. He reaches for his guitar, settling it in his lap, and begins to pick out a melancholy tune.*
"""
OUTPUT:
{
  "reasoning": "Jake transitions from idle sitting to an active activity - playing guitar. He was doing nothing (null activity) and now he's making music. Clear change from passive to active state.",
  "character": "Jake",
  "changed": true,
  "newActivity": "playing a melancholy tune on his guitar"
}

### Example 5: Interrupted Activity
INPUT:
"""
Character: Detective Murphy
Current activity: interviewing the witness

New message:
*Murphy's phone buzzes insistently. She holds up a hand to pause the witness and checks the screen. Her face goes pale.*

"I need to take this," *she says, stepping away from the table.*
"""
OUTPUT:
{
  "reasoning": "Murphy stops the interview (holds up hand to pause) and switches to answering/checking her phone. The interview activity is interrupted and replaced with phone activity.",
  "character": "Detective Murphy",
  "changed": true,
  "newActivity": "taking a phone call"
}

### Example 6: Activity Becomes More Specific
INPUT:
"""
Character: Elena
Current activity: working on her laptop

New message:
*Elena's fingers fly across the keyboard as she compiles the code. Error messages flash red, but she barely pauses, fixing bugs as fast as they appear.*
"""
OUTPUT:
{
  "reasoning": "Elena was generically 'working on her laptop' but now we see she's specifically coding/debugging. This is a refinement - the activity is more specific but fundamentally similar (still working on laptop). Since coding is just a specific form of laptop work, this could go either way. I'll say changed since the activity is now clearly defined as coding/debugging.",
  "character": "Elena",
  "changed": true,
  "newActivity": "coding and fixing bugs"
}

### Example 7: Activity Ends - Character Becomes Idle
INPUT:
"""
Character: Marcus
Current activity: arguing with Elena

New message:
*"Fine." Marcus throws his hands up. "I'm done." He drops into the nearest chair and falls silent, refusing to engage further.*
"""
OUTPUT:
{
  "reasoning": "Marcus explicitly stops arguing ('I'm done') and becomes passive/idle. He sits and refuses to engage. His activity changes from active arguing to passive silence. He's now idle rather than doing something.",
  "character": "Marcus",
  "changed": true,
  "newActivity": null
}

### Example 8: Physical Activity Changes
INPUT:
"""
Character: Sarah
Current activity: running on the treadmill

New message:
*Sarah hits the cooldown button and slows to a walk. Sweat drips down her face as she grabs her water bottle, gulping it down between heaving breaths.*
"""
OUTPUT:
{
  "reasoning": "Sarah transitions from running to walking (cooldown) and then to drinking water. The main activity shift is from active running to the recovery phase - walking and hydrating. The most accurate current activity is walking/cooling down.",
  "character": "Sarah",
  "changed": true,
  "newActivity": "cooling down and drinking water"
}

### Example 9: Mental Activity Change
INPUT:
"""
Character: Dr. Chen
Current activity: explaining the procedure to the patient

New message:
*Dr. Chen pauses mid-sentence, her eyes going distant. Something about the test results doesn't add up. She needs to review them again.*

"Excuse me," *she tells the patient.* "I need to check something."
"""
OUTPUT:
{
  "reasoning": "Dr. Chen stops explaining (pauses mid-sentence) as her mind shifts to analyzing the test results. She's no longer engaged in explanation - she's now thinking/reviewing mentally and preparing to check something. Activity changes from communication to contemplation/analysis.",
  "character": "Dr. Chen",
  "changed": true,
  "newActivity": "mentally reviewing the test results"
}

### Example 10: Conversation Topic Isn't Activity Change
INPUT:
"""
Character: Elena
Current activity: having dinner with Marcus

New message:
*"Tell me about your childhood," Elena says, reaching for her wine glass. "You never talk about it."*

*Marcus shifts uncomfortably.* "There's not much to tell."

*"Humor me." She takes a sip, waiting.*
"""
OUTPUT:
{
  "reasoning": "Elena is still having dinner - the conversation topic changed but the activity (eating and talking over dinner) hasn't. Changing what you're talking about during a conversation doesn't constitute an activity change.",
  "character": "Elena",
  "changed": false
}

### Example 11: Multi-Step Activity - Use Final Activity
INPUT:
"""
Character: Jake
Current activity: watching TV on the couch

New message:
*Jake clicks off the TV and stretches. Time to face the day. He showers, dresses, and grabs a quick breakfast before heading out the door.*
"""
OUTPUT:
{
  "reasoning": "Jake goes through multiple activities: turns off TV, stretches, showers, dresses, eats breakfast, then leaves. The passage covers a sequence. The final/current activity at the end of the message is leaving/heading out. Use the final state.",
  "character": "Jake",
  "changed": true,
  "newActivity": "heading out the door"
}

### Example 12: Activity Pause vs Activity Change
INPUT:
"""
Character: Detective Murphy
Current activity: writing her report

New message:
*Murphy pauses typing, rubbing her tired eyes. She glances at the clock - 2 AM. She should sleep, but the case won't let her rest.*

*With a sigh, she returns her fingers to the keyboard.*
"""
OUTPUT:
{
  "reasoning": "Murphy briefly pauses writing to rub her eyes and check the time, but then returns to typing. This is a momentary pause within the same activity, not an activity change. She's still writing her report.",
  "character": "Detective Murphy",
  "changed": false
}

### Example 13: Subtle Activity Shift
INPUT:
"""
Character: Elena
Current activity: listening to Marcus explain the plan

New message:
*As Marcus drones on, Elena finds her attention wandering. She's no longer hearing his words - she's watching his hands, the way they move when he talks, the confident gestures she's always found attractive.*
"""
OUTPUT:
{
  "reasoning": "Elena's activity shifts from actively listening to Marcus to passively watching him. She's 'no longer hearing his words' - her attention has moved from the content to observation. This is a subtle but real change from engaged listening to distracted observation.",
  "character": "Elena",
  "changed": true,
  "newActivity": "absently watching Marcus's gestures"
}

### Example 14: Forced Activity Change By External Event
INPUT:
"""
Character: Sarah
Current activity: sleeping

New message:
*The explosion shakes the building, throwing Sarah out of bed. She's on her feet before she's fully awake, reaching for the gun on her nightstand.*
"""
OUTPUT:
{
  "reasoning": "Sarah is violently awakened by an explosion. Her activity changes from sleeping to being awake and reaching for her weapon. The external event forces an immediate activity change from passive (sleeping) to alert response.",
  "character": "Sarah",
  "changed": true,
  "newActivity": "reaching for her gun, alert to the explosion"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Position Change With Activity Change
INPUT:
"""
Character: Marcus
Current activity: drinking at the bar

New message:
*Marcus carries his drink to the corner booth and slides in.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus moved to a different location.",
  "character": "Marcus",
  "changed": true,
  "newActivity": "sitting in the corner booth"
}
WHY THIS IS WRONG: "Sitting in the corner booth" is a position, not an activity. Marcus is still drinking - he just moved where he's doing it. The activity (drinking) hasn't changed. Correct: changed: false

### Bad Example 2: Describing Activity Instead Of Change
INPUT:
"""
Character: Elena
Current activity: cooking dinner

New message:
*Elena stirs the sauce, checking the consistency. The pasta water is almost boiling.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is stirring sauce.",
  "character": "Elena",
  "changed": true,
  "newActivity": "stirring the sauce"
}
WHY THIS IS WRONG: "Stirring sauce" is part of "cooking dinner" - it's not a new activity. The activity hasn't changed; this is just a description of ongoing cooking. Correct: changed: false

### Bad Example 3: Wrong Character Attribution
INPUT:
"""
Previous context: Elena and Marcus are in the scene.
Character being analyzed: Elena
Elena's current activity: reading a book

New message:
*Marcus sets down his newspaper with a grunt.* "Nothing but bad news," *he complains.*

*Elena turns a page, not looking up.*
"""
WRONG OUTPUT:
{
  "reasoning": "The newspaper was set down.",
  "character": "Elena",
  "changed": true,
  "newActivity": "setting down the newspaper"
}
WHY THIS IS WRONG: Marcus set down the newspaper, not Elena. Elena is still reading her book and turns a page. Her activity hasn't changed at all. Correct: changed: false

### Bad Example 4: Treating Mood/Emotion As Activity
INPUT:
"""
Character: Sarah
Current activity: waiting in the lobby

New message:
*The minutes tick by. Sarah's anxiety grows with each passing moment. What's taking so long?*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is now feeling anxious.",
  "character": "Sarah",
  "changed": true,
  "newActivity": "being anxious"
}
WHY THIS IS WRONG: "Being anxious" is an emotional state, not an activity. Moods are tracked separately. Sarah is still waiting in the lobby - her activity hasn't changed. Correct: changed: false

### Bad Example 5: Too Detailed/Specific Activity Description
INPUT:
"""
Character: Jake
Current activity: making coffee

New message:
*Jake measures out the beans, grinds them, loads the filter, fills the reservoir, and hits the brew button.*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake is doing multiple coffee-related actions.",
  "character": "Jake",
  "changed": true,
  "newActivity": "measuring beans, then grinding them, then loading filter, then filling reservoir, then pressing button"
}
WHY THIS IS WRONG: This is a blow-by-blow description of the same activity - making coffee. The activity hasn't changed. Even if it had, the description should be concise ("making coffee" or "brewing coffee"). Correct: changed: false

### Bad Example 6: Missing Obvious Activity Change
INPUT:
"""
Character: Detective Murphy
Current activity: reading the case file

New message:
*Murphy closes the file and picks up the phone, dialing a familiar number.*

"We need to talk," *she says when the line connects.*
"""
WRONG OUTPUT:
{
  "reasoning": "Murphy is looking at a case file.",
  "character": "Detective Murphy",
  "changed": false
}
WHY THIS IS WRONG: Murphy explicitly closes the file and makes a phone call. The activity clearly changed from reading to making a phone call. Correct: changed: true, newActivity: "making a phone call"

### Bad Example 7: Inventing Activity Not In Text
INPUT:
"""
Character: Marcus
Current activity: talking to Elena

New message:
*Marcus falls silent, his gaze dropping to the floor.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is now deep in contemplation.",
  "character": "Marcus",
  "changed": true,
  "newActivity": "deeply contemplating his failures and the meaning of life"
}
WHY THIS IS WRONG: The text only says he falls silent and looks down. "Contemplating failures and meaning of life" is invented. The actual change is from talking to being silent/idle. Correct: changed: true, newActivity: null (or "silent, staring at the floor")

### Bad Example 8: Treating Same Activity With Different Object As Change
INPUT:
"""
Character: Sarah
Current activity: reading a novel

New message:
*Sarah reaches the end of the chapter and sets the book down, only to immediately pick up another from her stack.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is now reading a different book.",
  "character": "Sarah",
  "changed": true,
  "newActivity": "reading a different novel"
}
WHY THIS IS WRONG: Reading is reading. Switching which book you're reading isn't an activity change - the activity is still "reading." Correct: changed: false

### Bad Example 9: Phantom Activity Change
INPUT:
"""
Character: Elena
Current activity: working at her desk

New message:
*The office hums with quiet productivity. Keyboards click, phones ring in the distance, and the coffee machine gurgles its protests.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene describes office activity.",
  "character": "Elena",
  "changed": true,
  "newActivity": "hearing office sounds"
}
WHY THIS IS WRONG: This is ambient scene description, not Elena's activity. Nothing in the text says Elena stopped working or started doing something else. "Hearing sounds" isn't an activity. Correct: changed: false

### Bad Example 10: Activity That Hasn't Started Yet
INPUT:
"""
Character: Marcus
Current activity: drinking his morning coffee

New message:
*Marcus checks the time. "Damn, I need to leave soon. The meeting's in an hour."*

*He takes another sip of coffee.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus needs to go to a meeting.",
  "character": "Marcus",
  "changed": true,
  "newActivity": "attending the meeting"
}
WHY THIS IS WRONG: The meeting is in the future. Marcus is still drinking coffee - he explicitly takes another sip. Future activities don't replace current ones until they actually start. Correct: changed: false

### Bad Example 11: Single Word Reasoning
INPUT:
"""
Character: Jake
Current activity: watching TV

New message:
*Jake turns off the TV and heads to bed.*
"""
WRONG OUTPUT:
{
  "reasoning": "TV off.",
  "character": "Jake",
  "changed": true,
  "newActivity": "going to bed"
}
WHY THIS IS WRONG: While the output is correct, the reasoning is too brief. Good reasoning should explain: Jake stops watching TV (turns it off) and transitions to going to bed/sleeping. Clear activity change from passive entertainment to going to sleep.

### Bad Example 12: Treating Dialogue As Activity
INPUT:
"""
Character: Elena
Current activity: interrogating the suspect

New message:
*"Where were you on the night of March 15th?" Elena demands.*

*"I was at home, I swear!"*

*"Can anyone verify that?"*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is now asking about alibis.",
  "character": "Elena",
  "changed": true,
  "newActivity": "asking about alibis"
}
WHY THIS IS WRONG: This is still interrogation. The specific questions asked don't change the activity - she's still interrogating the suspect. Correct: changed: false

### Bad Example 13: Position Descriptor Instead Of Activity
INPUT:
"""
Character: Detective Murphy
Current activity: questioning witnesses

New message:
*Murphy walks to the window and stares out at the street below.*
"""
WRONG OUTPUT:
{
  "reasoning": "Murphy moved to the window.",
  "character": "Detective Murphy",
  "changed": true,
  "newActivity": "at the window"
}
WHY THIS IS WRONG: "At the window" is a position, not an activity. The activity should describe what she's doing: "staring out the window" or "looking out the window" (or arguably null if just passively standing). Correct: newActivity: "staring out the window" or null

### Bad Example 14: Ignoring Explicit Activity Statement
INPUT:
"""
Character: Sarah
Current activity: null (sitting idle)

New message:
*Sarah pulls out her laptop and starts working on the presentation that's due tomorrow.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah has her laptop.",
  "character": "Sarah",
  "changed": false
}
WHY THIS IS WRONG: Sarah goes from idle to actively "working on the presentation." The text explicitly states she "starts working." This is a clear activity change. Correct: changed: true, newActivity: "working on a presentation"
`;

export const activityChangePrompt: PromptTemplate<ExtractedActivityChange> = {
	name: 'activity_change',
	description: 'Extract changes to what a character is currently doing',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to determine changes to a character's current activity.

## Your Task
Compare the character's current activity with the new message to identify:
1. **changed**: Did their activity change? (true/false)
2. **newActivity**: If changed, what is their new activity? (string or null if idle)

## What Is Activity?
Activity = What the character is actively DOING
- Actions being performed (reading, running, cooking, talking)
- Engaged behaviors (listening, watching, waiting)
- NOT position (where they are)
- NOT mood (how they feel)
- NOT physical state (tired, injured)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of whether and how activity changed
- "character": The character's name
- "changed": Boolean - did their activity change?
- "newActivity": (Only if changed is true) The new activity, or null if now idle

## Activity Changes Include:
- Starting a new action (begins reading, starts cooking)
- Stopping an action without starting another (stops pacing, becomes idle)
- Switching from one action to another (stops typing, begins phone call)
- Being interrupted and changing focus
- Transitioning from idle to active

## NOT Activity Changes:
- Changing topics during conversation (still conversing)
- Different steps of same activity (measuring then mixing = still cooking)
- Position changes without activity change (moving while still talking)
- Emotional changes (becoming anxious while still waiting)
- Brief pauses within continued activity

## Activity Description Guidelines:
- Be concise (5-15 words typically)
- Focus on the main action
- Use present participle when appropriate ("reading", "cooking")
- Use null for idle/passive states
- Use final activity if multiple actions occur

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Current Activity
{{targetCharacterState}}

## New Message to Analyze
{{messages}}

## Task
Determine if {{targetCharacter}}'s activity changed in this message.

Remember:
- Activity = what they're doing (not position or mood)
- Use null for idle/passive state
- Conversation topic changes don't change the activity
- Use final activity if multiple actions occur`,

	responseSchema: activityChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedActivityChange | null {
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
		if (typeof parsed.character !== 'string') return null;
		if (typeof parsed.changed !== 'boolean') return null;

		// If changed is true, newActivity should be present (string or null)
		if (parsed.changed) {
			if (parsed.newActivity !== null && typeof parsed.newActivity !== 'string') {
				return null;
			}
		}

		return {
			reasoning: parsed.reasoning as string,
			character: parsed.character as string,
			changed: parsed.changed as boolean,
			newActivity: parsed.changed
				? (parsed.newActivity as string | null)
				: undefined,
		};
	},
};
