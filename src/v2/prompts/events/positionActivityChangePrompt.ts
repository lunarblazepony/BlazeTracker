/**
 * Combined Position and Activity Change Extraction Prompt
 *
 * Extracts both position and activity changes in a single LLM call for efficiency.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedPositionActivityChange } from '../../types/extraction';
import { positionActivityChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Both Position and Activity Change
INPUT:
"""
Character: Elena
Current position: at the bar
Current activity: nursing a whiskey

New message:
*Elena sets down her glass and crosses to the corner booth, sliding in across from Marcus. She pulls out her phone and starts scrolling through encrypted messages.*
"""
OUTPUT:
{
  "reasoning": "Elena moves from the bar to the corner booth (position change) and switches from drinking to reading encrypted messages on her phone (activity change).",
  "character": "Elena",
  "positionChanged": true,
  "newPosition": "in the corner booth across from Marcus",
  "activityChanged": true,
  "newActivity": "reading encrypted messages on her phone"
}

### Example 2: Position Change Only
INPUT:
"""
Character: Marcus
Current position: standing by the window
Current activity: talking on the phone

New message:
*Marcus paces across the room, still arguing into the phone.* "No, that's not what I agreed to..."
"""
OUTPUT:
{
  "reasoning": "Marcus moves from the window to pacing the room (position change) but is still on the phone arguing (same activity).",
  "character": "Marcus",
  "positionChanged": true,
  "newPosition": "pacing the room",
  "activityChanged": false
}

### Example 3: Activity Change Only
INPUT:
"""
Character: Sarah
Current position: at her desk
Current activity: typing a report

New message:
*Sarah pushes back from the keyboard and picks up her coffee, staring at the ceiling as she thinks through the problem.*
"""
OUTPUT:
{
  "reasoning": "Sarah stops typing and starts thinking/drinking coffee (activity change) but remains at her desk (no position change).",
  "character": "Sarah",
  "positionChanged": false,
  "activityChanged": true,
  "newActivity": "thinking while drinking coffee"
}

### Example 4: Neither Changes
INPUT:
"""
Character: Jake
Current position: on the couch
Current activity: watching TV

New message:
*The action movie reaches its climax. Jake leans forward, eyes glued to the screen as the hero makes his final stand.*
"""
OUTPUT:
{
  "reasoning": "Jake is still on the couch (leaning forward is minor adjustment, not position change) and still watching TV (same activity). Neither has changed.",
  "character": "Jake",
  "positionChanged": false,
  "activityChanged": false
}

### Example 5: Activity Becomes Idle
INPUT:
"""
Character: Detective Murphy
Current position: standing at the crime scene
Current activity: examining the body

New message:
*Murphy straightens up and steps back, her work done. She waits silently for the medical examiner to arrive.*
"""
OUTPUT:
{
  "reasoning": "Murphy steps back (minor position adjustment within same area) and stops examining to wait - transitioning from active examination to idle waiting.",
  "character": "Detective Murphy",
  "positionChanged": false,
  "activityChanged": true,
  "newActivity": null
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Position With Activity
INPUT:
"""
Character: Elena
Current position: standing by the door
Current activity: none

New message:
*Elena sits down in the corner booth and opens her laptop.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena moved and started using her laptop.",
  "character": "Elena",
  "positionChanged": true,
  "newPosition": "using her laptop",
  "activityChanged": true,
  "newActivity": "in the corner booth"
}
WHY THIS IS WRONG: Position and activity are swapped. "Using her laptop" is an activity, "in the corner booth" is a position. CORRECT: newPosition should be "in the corner booth", newActivity should be "working on her laptop".

### Bad Example 2: Treating Minor Adjustments As Position Change
INPUT:
"""
Character: Marcus
Current position: sitting at the conference table
Current activity: listening to the presentation

New message:
*Marcus leans back in his chair, crossing his arms. He shifts his weight and adjusts his tie.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus leaned back and shifted.",
  "character": "Marcus",
  "positionChanged": true,
  "newPosition": "leaning back at the conference table with crossed arms",
  "activityChanged": false
}
WHY THIS IS WRONG: Leaning, crossing arms, and adjusting posture are minor adjustments, not position changes. Position changes require moving to a different location/area or significantly changing body placement (standing up, sitting down, lying down). CORRECT: positionChanged should be false.

### Bad Example 3: Same Activity With Different Details
INPUT:
"""
Character: Sarah
Current position: in the kitchen
Current activity: cooking dinner

New message:
*Sarah stirs the sauce, then checks on the roast in the oven. She chops some herbs and tosses them into the pot.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah did multiple cooking tasks.",
  "character": "Sarah",
  "positionChanged": false,
  "activityChanged": true,
  "newActivity": "stirring sauce and checking roast"
}
WHY THIS IS WRONG: Stirring, checking the oven, and chopping are all sub-tasks of "cooking dinner" - the core activity hasn't changed. Don't change the activity just because different steps are being performed. CORRECT: activityChanged should be false.

### Bad Example 4: Intended Movement Not Completed
INPUT:
"""
Character: Jake
Current position: on the couch
Current activity: watching TV

New message:
Jake: *He stretches and yawns.* "I should probably go to bed." *He keeps watching as the next episode starts.*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake said he should go to bed.",
  "character": "Jake",
  "positionChanged": true,
  "newPosition": "in bed",
  "activityChanged": true,
  "newActivity": "sleeping"
}
WHY THIS IS WRONG: Jake said he should go to bed but didn't actually move - he kept watching TV. Only report changes that actually happened, not intentions or plans. CORRECT: Both positionChanged and activityChanged should be false.

### Bad Example 5: Activities as Physical States
INPUT:
"""
Character: Elena
Current position: in the hallway
Current activity: walking to the meeting room

New message:
*Elena reaches the meeting room and enters, finding a seat near the back.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena arrived and sat down.",
  "character": "Elena",
  "positionChanged": true,
  "newPosition": "seated near the back of the meeting room",
  "activityChanged": true,
  "newActivity": "sitting"
}
WHY THIS IS WRONG: "Sitting" is not an activity - it's part of the position description. When someone sits down with no specific task, the activity becomes null (idle). CORRECT: newActivity should be null, and "seated" should be part of the position.
`;

export const positionActivityChangePrompt: PromptTemplate<ExtractedPositionActivityChange> = {
	name: 'position_activity_change',
	description: 'Extract changes to character position and activity in one call',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterProfile,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You analyze roleplay messages to detect changes to a character's position AND activity.

## Definitions

**Position** = Physical location and placement
- WHERE they are (room, area, relative to objects/people)
- HOW they are placed (standing, sitting, lying down)

**Activity** = What they are actively DOING
- Actions being performed (reading, cooking, talking)
- Use null for idle/passive states

## Output Format
{
  "reasoning": "Analysis of both position and activity",
  "character": "Character name",
  "positionChanged": true/false,
  "newPosition": "New position (only if positionChanged)",
  "activityChanged": true/false,
  "newActivity": "New activity or null (only if activityChanged)"
}

## Position Changes Include:
- Moving to different location (room to room, spot to spot)
- Standing up, sitting down, lying down
- Moving closer to or away from someone/something

## NOT Position Changes:
- Gestures, facial expressions
- Minor fidgeting in same spot
- Adjusting posture without moving location

## Activity Changes Include:
- Starting a new action
- Stopping an action (becomes null)
- Switching from one action to another

## NOT Activity Changes:
- Different steps of same activity (measuring then mixing = still cooking)
- Changing conversation topics (still conversing)
- Emotional changes (becoming anxious while still waiting)

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Character Profile
{{characterProfile}}

## Current State
{{targetCharacterState}}

## New Message to Analyze
{{messages}}

## Task
Determine if {{targetCharacter}}'s position AND/OR activity changed.

Remember:
- Position = physical location/placement
- Activity = what they're doing (null if idle)
- Both can change, one can change, or neither can change`,

	responseSchema: positionActivityChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedPositionActivityChange | null {
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
		if (typeof parsed.positionChanged !== 'boolean') return null;
		if (typeof parsed.activityChanged !== 'boolean') return null;

		// If positionChanged, newPosition should be present
		if (parsed.positionChanged && typeof parsed.newPosition !== 'string') {
			return null;
		}

		// If activityChanged, newActivity should be present (string or null)
		if (parsed.activityChanged) {
			if (parsed.newActivity !== null && typeof parsed.newActivity !== 'string') {
				return null;
			}
		}

		return {
			reasoning: parsed.reasoning,
			character: parsed.character,
			positionChanged: parsed.positionChanged,
			newPosition: parsed.positionChanged
				? (parsed.newPosition as string)
				: undefined,
			activityChanged: parsed.activityChanged,
			newActivity: parsed.activityChanged
				? (parsed.newActivity as string | null)
				: undefined,
		};
	},
};
