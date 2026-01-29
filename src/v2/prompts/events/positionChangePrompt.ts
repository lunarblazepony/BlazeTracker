/**
 * Character Position Change Extraction Prompt
 *
 * Extracts when a character's position within the scene changes.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedPositionChange } from '../../types/extraction';
import { positionChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Moving Across Room
INPUT:
"""
Character: Elena
Current position: sitting at the corner booth

New message:
*Elena's phone buzzes. She glances at the screen, frowns, and slides out of the booth. A moment later she's at the bar, leaning in close to speak with the bartender in hushed tones.*
"""
OUTPUT:
{
  "reasoning": "Elena moves from the corner booth to the bar. She slides out of the booth and ends up at the bar, leaning in to talk to the bartender. Clear position change from seated at booth to standing at bar.",
  "character": "Elena",
  "changed": true,
  "newPosition": "at the bar, leaning in close to the bartender"
}

### Example 2: Standing Up
INPUT:
"""
Character: Marcus
Current position: slumped in the armchair

New message:
*The accusation hits like a slap. Marcus is on his feet before he realizes he's moved, looming over Victor.*

"Say that again," *he growls.* "I dare you."
"""
OUTPUT:
{
  "reasoning": "Marcus transitions from slumped in the armchair to standing and looming over Victor. The text explicitly notes he's 'on his feet' and his new position is dominant/threatening over Victor.",
  "character": "Marcus",
  "changed": true,
  "newPosition": "standing, looming over Victor"
}

### Example 3: No Position Change Despite Action
INPUT:
"""
Character: Sarah
Current position: seated at her desk

New message:
*Sarah types furiously, fingers flying across the keyboard. The deadline is in two hours and she's barely halfway done. She pauses only to gulp cold coffee before diving back in.*
"""
OUTPUT:
{
  "reasoning": "Sarah remains at her desk throughout the message. She's typing and drinking coffee but hasn't changed physical location. Her activity changed but her position did not.",
  "character": "Sarah",
  "changed": false
}

### Example 4: Moving To Different Room
INPUT:
"""
Character: Detective Murphy
Current position: in the living room examining the bookshelf

New message:
*Something catches Murphy's eye - a thin line of light under the basement door. She draws her weapon and moves silently down the stairs, each step measured to avoid the creaking boards she'd noted earlier. The basement is dark except for that single bare bulb in the corner.*
"""
OUTPUT:
{
  "reasoning": "Murphy moves from the living room to the basement. She goes through the basement door and down the stairs. Her new position is in the basement, presumably near the stairs or advancing toward the light source.",
  "character": "Detective Murphy",
  "changed": true,
  "newPosition": "in the basement, near the stairs"
}

### Example 5: Falling/Collapsing
INPUT:
"""
Character: Jake
Current position: standing by the window

New message:
*The bullet takes Jake in the shoulder, spinning him around. He crashes into the coffee table, sending magazines and a vase flying, and ends up on the floor, gasping, one hand pressed to the wound.*
"""
OUTPUT:
{
  "reasoning": "Jake is shot and falls from standing by the window to lying on the floor after crashing through the coffee table. His new position is on the ground, wounded.",
  "character": "Jake",
  "changed": true,
  "newPosition": "on the floor near the coffee table, clutching his shoulder wound"
}

### Example 6: Subtle Movement Within Same General Area
INPUT:
"""
Character: Elena
Current position: at the bar

New message:
*Elena shifts down two stools, putting distance between herself and the drunk who won't stop trying to talk to her.*
"""
OUTPUT:
{
  "reasoning": "Elena moves along the bar - still at the bar, but at a different spot. This is a position change within the same general area. She's moved from wherever she was to 'two stools down' from her previous position.",
  "character": "Elena",
  "changed": true,
  "newPosition": "at the bar, two stools away from previous position"
}

### Example 7: Getting Into Vehicle
INPUT:
"""
Character: Marcus
Current position: standing in the parking lot

New message:
*Marcus jogs to his car, keys already in hand. He slides into the driver's seat, starts the engine, and sits for a moment, hands gripping the steering wheel as he considers his next move.*
"""
OUTPUT:
{
  "reasoning": "Marcus moves from standing in the parking lot to sitting inside his car. He jogs to the car and slides into the driver's seat. Clear position change from outside to inside the vehicle.",
  "character": "Marcus",
  "changed": true,
  "newPosition": "in the driver's seat of his car"
}

### Example 8: Lying Down
INPUT:
"""
Character: Sarah
Current position: sitting on the edge of the bed

New message:
*Exhaustion finally wins. Sarah lets herself fall backward onto the mattress, staring at the ceiling. She should undress, get under the covers, set an alarm. She doesn't move.*
"""
OUTPUT:
{
  "reasoning": "Sarah moves from sitting on the edge of the bed to lying on the bed. She falls backward onto the mattress. Though still on the bed, her position has changed from upright sitting to lying flat.",
  "character": "Sarah",
  "changed": true,
  "newPosition": "lying on the bed, staring at the ceiling"
}

### Example 9: Moving Closer to Another Person
INPUT:
"""
Character: Jake
Current position: across the room from Elena

New message:
*Jake crosses the room in three long strides, stopping so close to Elena that she has to tilt her head back to meet his eyes.*

"Tell me the truth," *he demands.* "All of it."
"""
OUTPUT:
{
  "reasoning": "Jake moves from across the room to very close to Elena. His three strides bring him to within intimate distance of her. Position changes from far to close.",
  "character": "Jake",
  "changed": true,
  "newPosition": "standing very close to Elena, almost touching"
}

### Example 10: Position Change Through Dialogue Reference Only
INPUT:
"""
Character: Detective Murphy
Current position: at the crime scene tape

New message:
*"I'm heading back to the precinct," Murphy tells her partner. "Let me know what forensics finds."*

*Thirty minutes later, she's at her desk, staring at the case file.*
"""
OUTPUT:
{
  "reasoning": "The text shows a time skip and location change. Murphy states she's going to the precinct, and then the narrative places her at her desk. Her position has changed from the crime scene to her desk at the precinct.",
  "character": "Detective Murphy",
  "changed": true,
  "newPosition": "at her desk in the precinct"
}

### Example 11: Adjusting Position Without Moving Location
INPUT:
"""
Character: Marcus
Current position: sitting in the chair across from the therapist

New message:
*Marcus shifts in his chair, uncrossing and recrossing his legs. His hands find the armrests, grip them, release.*

"It started three years ago," *he finally says.*
"""
OUTPUT:
{
  "reasoning": "Marcus is fidgeting and adjusting how he's sitting, but he remains in the same chair across from the therapist. This is restless movement within the same position, not a position change.",
  "character": "Marcus",
  "changed": false
}

### Example 12: Being Moved By Someone Else
INPUT:
"""
Character: Elena
Current position: standing in the middle of the ballroom

New message:
*Viktor appears at her elbow and smoothly guides her toward the terrace, his grip on her arm firm but not painful.*

"We need to talk," *he murmurs.* "Privately."

*They're outside before she can object, the cool night air a shock after the stuffy ballroom.*
"""
OUTPUT:
{
  "reasoning": "Elena is guided/moved by Viktor from inside the ballroom to the terrace outside. Though she didn't initiate the movement, her position has changed from inside the ballroom to outside on the terrace.",
  "character": "Elena",
  "changed": true,
  "newPosition": "on the terrace outside the ballroom"
}

### Example 13: Pacing (Multiple Positions But Same Area)
INPUT:
"""
Character: Sarah
Current position: by the window in her office

New message:
*Sarah can't sit still. She paces the length of her office - window to door and back again - mind racing through scenarios. Each one is worse than the last.*
"""
OUTPUT:
{
  "reasoning": "Sarah is pacing throughout her office, not staying at the window. While she's still in the same room, her position has changed from stationary by the window to actively pacing the room. Pacing represents a change from a fixed position.",
  "character": "Sarah",
  "changed": true,
  "newPosition": "pacing the office"
}

### Example 14: Following Another Character
INPUT:
"""
Character: Jake
Current position: at the entrance of the warehouse

New message:
*Marcus moves deeper into the warehouse, and Jake follows, matching his footsteps to mask the sound of his own. They pass rusted machinery and stacked crates until Marcus stops at a door marked 'Office.'*
"""
OUTPUT:
{
  "reasoning": "Jake follows Marcus from the warehouse entrance deeper inside to an office door. His position changes from the entrance to near the office door inside the warehouse.",
  "character": "Jake",
  "changed": true,
  "newPosition": "by the door marked 'Office' inside the warehouse"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Activity Change With Position Change
INPUT:
"""
Character: Elena
Current position: at the bar

New message:
*Elena signals the bartender for another drink. While she waits, she pulls out her phone and starts scrolling through messages.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is doing something different now.",
  "character": "Elena",
  "changed": true,
  "newPosition": "at the bar, on her phone"
}
WHY THIS IS WRONG: Elena's activity changed (now on phone) but her position didn't (still at the bar). Position means physical location/placement in space, not what someone is doing. Correct: changed: false

### Bad Example 2: Missing Obvious Position Change
INPUT:
"""
Character: Marcus
Current position: in bed

New message:
*The alarm screams and Marcus groans. He drags himself up, shuffles to the bathroom, and stares at his haggard reflection in the mirror.*

"Another day," *he mutters.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus wakes up.",
  "character": "Marcus",
  "changed": false
}
WHY THIS IS WRONG: Marcus clearly moves from bed to the bathroom. He "shuffles to the bathroom" and is now at the mirror. This is an obvious position change. Correct: changed: true, newPosition: "in the bathroom, at the mirror"

### Bad Example 3: Wrong Character Attribution
INPUT:
"""
Previous context: Elena and Marcus are in the scene.
Character being analyzed: Marcus
Marcus's current position: seated at the corner booth

New message:
*Elena excuses herself and heads to the restroom, leaving Marcus alone with his thoughts and his drink.*
"""
WRONG OUTPUT:
{
  "reasoning": "Someone went to the restroom.",
  "character": "Marcus",
  "changed": true,
  "newPosition": "in the restroom"
}
WHY THIS IS WRONG: Elena went to the restroom, not Marcus. Marcus remains "at the corner booth" - his position hasn't changed. Correct: character: "Marcus", changed: false

### Bad Example 4: Vague New Position
INPUT:
"""
Character: Detective Murphy
Current position: at the crime scene

New message:
*Murphy walks away from the body, past the forensics team, through the police tape, to her car parked on the street. She sits in the driver's seat and calls her captain.*
"""
WRONG OUTPUT:
{
  "reasoning": "Murphy moves away from the crime scene.",
  "character": "Detective Murphy",
  "changed": true,
  "newPosition": "somewhere else"
}
WHY THIS IS WRONG: "Somewhere else" is too vague. The text clearly indicates she's in her car's driver's seat, parked on the street near the crime scene. Correct: newPosition: "in the driver's seat of her car, parked on the street"

### Bad Example 5: Adding Unmentioned Location Details
INPUT:
"""
Character: Jake
Current position: standing in the hallway

New message:
*Jake opens the apartment door and steps inside.*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake enters the apartment.",
  "character": "Jake",
  "changed": true,
  "newPosition": "standing in the luxurious living room near the grand piano"
}
WHY THIS IS WRONG: The text only says he "steps inside." There's no mention of a living room, luxury, or a piano. Don't invent details. Correct: newPosition: "inside the apartment" or "just inside the apartment door"

### Bad Example 6: Treating Intended Movement As Completed
INPUT:
"""
Character: Elena
Current position: in the conference room

New message:
*Elena glances at her watch.* "I should head to the airport. My flight's in three hours."

*"Before you go," Marcus says, "there's something you need to see."*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena says she's going to the airport.",
  "character": "Elena",
  "changed": true,
  "newPosition": "at the airport"
}
WHY THIS IS WRONG: Elena said she "should" go, but then Marcus stops her with "before you go." She hasn't actually left. Intended movement is not completed movement. Correct: changed: false

### Bad Example 7: Missing Movement When Present In Text
INPUT:
"""
Character: Sarah
Current position: curled up on the couch

New message:
*The doorbell rings. Sarah unfolds herself from the couch and pads to the door, peering through the peephole.*
"""
WRONG OUTPUT:
{
  "reasoning": "The doorbell rang.",
  "character": "Sarah",
  "changed": false
}
WHY THIS IS WRONG: Sarah clearly moves - she "unfolds herself from the couch" and goes "to the door." This is a position change that was completely missed. Correct: changed: true, newPosition: "at the front door"

### Bad Example 8: Position Change For Gesture Only
INPUT:
"""
Character: Marcus
Current position: standing beside the fireplace

New message:
*Marcus gestures expansively with his wine glass, nearly spilling on the carpet.*

"And that's when I knew," *he continues,* "the whole operation was compromised."
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus moves his arm in a gesture.",
  "character": "Marcus",
  "changed": true,
  "newPosition": "standing beside the fireplace, arm extended"
}
WHY THIS IS WRONG: A gesture is not a position change. Marcus is still standing beside the fireplace. Body movements that don't change where you are in space don't count as position changes. Correct: changed: false

### Bad Example 9: Describing Current Position As Change
INPUT:
"""
Character: Elena
Current position: at the bar

New message:
*Elena sits at the bar, nursing her whiskey. The bartender refills her glass without being asked.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is at the bar.",
  "character": "Elena",
  "changed": true,
  "newPosition": "sitting at the bar"
}
WHY THIS IS WRONG: Elena was already at the bar. The text describes her current position, not a change. Adding "sitting" to specify posture doesn't make it a position change when she was already there. Correct: changed: false

### Bad Example 10: Movement Described But Not Completed
INPUT:
"""
Character: Detective Murphy
Current position: interviewing the witness

New message:
*Murphy stands.* "I think we're done here."

*She gathers her notes, retrieves her recorder from the table, checks that she has everything. The witness watches her nervously.*
"""
WRONG OUTPUT:
{
  "reasoning": "Murphy is leaving.",
  "character": "Detective Murphy",
  "changed": true,
  "newPosition": "outside the room"
}
WHY THIS IS WRONG: Murphy stood up and gathered her things, but hasn't actually left the room yet. She's still in the same room with the witness. Correct: changed: true, newPosition: "standing, gathering her things" or similar (acknowledging she stood from sitting)

### Bad Example 11: Ignoring The Character We're Tracking
INPUT:
"""
Previous context: Elena, Marcus, and Viktor are in the warehouse.
Character being analyzed: Elena
Elena's current position: by the east door

New message:
*Viktor grabs Marcus by the collar and drags him toward the loading bay. Marcus struggles but Viktor's grip is iron.*

*Elena watches, frozen, unsure whether to intervene.*
"""
WRONG OUTPUT:
{
  "reasoning": "There's movement happening in the scene.",
  "character": "Elena",
  "changed": true,
  "newPosition": "at the loading bay"
}
WHY THIS IS WRONG: Elena remains "by the east door" and is described as "frozen" - she hasn't moved. Viktor and Marcus moved, but we're tracking Elena. Correct: changed: false

### Bad Example 12: Single-Word/Minimal Reasoning
INPUT:
"""
Character: Sarah
Current position: in the kitchen

New message:
*Sarah carries her coffee to the living room and settles into the couch, pulling a blanket over her legs.*
"""
WRONG OUTPUT:
{
  "reasoning": "Moves.",
  "character": "Sarah",
  "changed": true,
  "newPosition": "living room couch"
}
WHY THIS IS WRONG: The reasoning is too brief. It should explain the movement clearly. Also, the newPosition could be more descriptive. Correct reasoning: "Sarah carries her coffee from the kitchen to the living room and settles onto the couch with a blanket. Clear position change from kitchen to living room couch." Correct newPosition: "settled on the living room couch, under a blanket"
`;

export const positionChangePrompt: PromptTemplate<ExtractedPositionChange> = {
	name: 'position_change',
	description: 'Extract changes to a character physical position in the scene',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to determine changes to a character's physical position.

## Your Task
Compare the character's current position with the new message to identify:
1. **changed**: Did their position change? (true/false)
2. **newPosition**: If changed, what is their new position?

## What Is Position?
Position = Physical location and placement within the scene
- WHERE they are (room, area, relative to objects/people)
- HOW they are placed (standing, sitting, lying down)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of whether and how position changed
- "character": The character's name
- "changed": Boolean - did their position change?
- "newPosition": (Only if changed is true) Their new position

## Position Changes Include:
- Moving to a different location (room to room, spot to spot)
- Standing up or sitting down
- Lying down or getting up
- Moving closer to or away from someone/something
- Being moved by external force (pushed, dragged, carried)
- Following another character
- Entering or exiting vehicles

## NOT Position Changes:
- Gestures (waving, pointing)
- Facial expressions
- Activity changes without movement (starting to read, stopping to think)
- Minor fidgeting in same spot
- Adjusting posture without moving location (crossing legs while seated)
- INTENDED movement that doesn't happen

## Position Description Guidelines:
- Be specific but concise
- Include relative positions when relevant ("standing next to Elena")
- Note posture when significant (sitting, standing, lying)
- Don't invent details not in the text
- Use the character's final position after any movement

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Current Position
{{targetCharacterState}}

## New Message to Analyze
{{messages}}

## Task
Determine if {{targetCharacter}}'s position changed in this message.

Remember:
- Position = physical location and placement
- Activity changes are NOT position changes
- Use final position after any movement
- Be specific but don't invent details`,

	responseSchema: positionChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedPositionChange | null {
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

		// If changed is true, newPosition should be present and be a string
		if (parsed.changed && typeof parsed.newPosition !== 'string') {
			return null;
		}

		return {
			reasoning: parsed.reasoning as string,
			character: parsed.character as string,
			changed: parsed.changed as boolean,
			newPosition: parsed.changed ? (parsed.newPosition as string) : undefined,
		};
	},
};
