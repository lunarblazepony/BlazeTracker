/**
 * Character Presence Change Extraction Prompt
 *
 * Extracts which characters have appeared or departed from the scene.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedCharacterPresenceChange } from '../../types/extraction';
import { presenceChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Single Character Arrives Through Door
INPUT:
"""
Previous state: Elena and Marcus are sitting at a corner booth in the bar.

New message:
*The door swings open with a gust of cold air, and Viktor strides in. His leather jacket is wet from the rain, and he scans the room with practiced efficiency before spotting them in the corner. He approaches with that predatory grace that makes Elena's hand drift toward her concealed weapon.*

"You're early," *Marcus says, not getting up.*
"""
OUTPUT:
{
  "reasoning": "Viktor enters through the door, crosses the room, and approaches their table. He was not present before - Elena and Marcus were alone. His arrival is clearly described with position (approaching their corner booth) and implied activity (approaching, scanning the room). His leather jacket is wet from rain indicating a physical state. His predatory grace suggests a confident, alert mood.",
  "appeared": [
    {
      "name": "Viktor",
      "position": "approaching the corner booth",
      "activity": "scanning the room",
      "mood": ["alert", "confident"],
      "physicalState": ["wet from rain"]
    }
  ],
  "departed": []
}

### Example 2: Character Explicitly Leaves
INPUT:
"""
Previous state: Dr. Chen, Nurse Martinez, and the patient's wife Maria are in the hospital room.

New message:
*Dr. Chen glances at her pager, frowning.* "I'm needed in the ER. Nurse Martinez will answer any questions." *She hurries out, her white coat disappearing around the corner before Maria can even respond.*

*Nurse Martinez offers Maria a sympathetic smile.* "Can I get you some coffee while we wait?"
"""
OUTPUT:
{
  "reasoning": "Dr. Chen explicitly leaves the room ('hurries out', 'disappearing around the corner'). She was present before and is now gone. Maria and Nurse Martinez remain. No one new arrives.",
  "appeared": [],
  "departed": ["Dr. Chen"]
}

### Example 3: Multiple Arrivals at a Party
INPUT:
"""
Previous state: James is alone at the bar, nursing a drink.

New message:
*The elevator chimes and a group spills into the penthouse. First comes Vanessa in her trademark red dress, already laughing at something. Behind her, her husband Theodore trails with their security detail - two burly men in dark suits who immediately take positions by the door. A moment later, the caterer arrives through the service entrance, pushing a cart of hors d'oeuvres.*

*James raises his glass in greeting.* "Party's starting, I see."
"""
OUTPUT:
{
  "reasoning": "Multiple arrivals: Vanessa enters first, Theodore follows, two security guards take positions by the door, and a caterer arrives through the service entrance. All were absent before - James was alone. Each has a clear position and activity.",
  "appeared": [
    {
      "name": "Vanessa",
      "position": "entering from the elevator",
      "activity": "laughing",
      "mood": ["cheerful", "excited"],
      "physicalState": []
    },
    {
      "name": "Theodore",
      "position": "following behind Vanessa",
      "activity": null,
      "mood": [],
      "physicalState": []
    },
    {
      "name": "security guard 1",
      "position": "by the door",
      "activity": "taking position",
      "mood": ["alert"],
      "physicalState": []
    },
    {
      "name": "security guard 2",
      "position": "by the door",
      "activity": "taking position",
      "mood": ["alert"],
      "physicalState": []
    },
    {
      "name": "the caterer",
      "position": "by the service entrance",
      "activity": "pushing a cart of hors d'oeuvres",
      "mood": [],
      "physicalState": []
    }
  ],
  "departed": []
}

### Example 4: Characters Pass Through - One Arrives, One Leaves
INPUT:
"""
Previous state: The detective is interviewing the suspect Marcus in the interrogation room while his lawyer Diana observes.

New message:
*The door opens and Officer Chen pokes his head in.* "Detective, the captain wants you. It's urgent."

*The detective stands, gathering his notes.* "Don't go anywhere," *he tells Marcus dryly, then follows Chen out. The door closes with a heavy thunk, leaving Marcus alone with Diana.*

"Well," *Diana says, finally speaking,* "that was going poorly."
"""
OUTPUT:
{
  "reasoning": "Officer Chen appears briefly at the door but then leaves with the detective. The detective explicitly leaves ('follows Chen out'). The result is that both Officer Chen and the detective have departed from the room. Marcus and Diana remain. Chen's appearance was momentary so he should be listed as departed since he left with the detective.",
  "appeared": [],
  "departed": ["the detective", "Officer Chen"]
}

### Example 5: Character Returns After Being Away
INPUT:
"""
Previous state: Sarah is alone in the apartment. Her roommate Kate left for work earlier.

New message:
*The front door slams open and Kate storms in, still in her work clothes but with mascara streaked down her face.*

"He fired me," *she announces to the empty room, then spots Sarah on the couch.* "Sarah. Oh god, Sarah, he actually fired me."

*Sarah is already on her feet, arms opening.* "What? Come here, tell me everything."
"""
OUTPUT:
{
  "reasoning": "Kate returns to the apartment - she was previously away at work. She enters through the front door, visibly upset with mascara streaked down her face. Her position is entering/at the front door, and her activity is announcing her firing. Sarah was already present.",
  "appeared": [
    {
      "name": "Kate",
      "position": "at the front door",
      "activity": "announcing her firing",
      "mood": ["upset", "distressed"],
      "physicalState": ["mascara streaked down face"]
    }
  ],
  "departed": []
}

### Example 6: Subtle Departure - Character Slips Away
INPUT:
"""
Previous state: The heist crew - Jack, Marina, Tommy, and Fixer - are in the warehouse going over the plan.

New message:
*Jack traces his finger along the blueprint one more time.* "So we're agreed? Marina takes the east entrance, I go through the roof, and Tommy handles the vault."

*He looks up, expecting Fixer's confirmation, but the chair where the older man had been sitting is empty. The side door is ajar, a cold breeze drifting in.*

"Where the hell did Fixer go?" *Marina asks, voicing everyone's confusion.*
"""
OUTPUT:
{
  "reasoning": "Fixer has departed - his chair is now empty and the side door is ajar, implying he slipped out without announcement. No one new appears. The departure is discovered rather than witnessed, but it's clearly established that he's no longer present.",
  "appeared": [],
  "departed": ["Fixer"]
}

### Example 7: Pet/Animal Arrives
INPUT:
"""
Previous state: Grandma Wilson is knitting alone in her living room.

New message:
*A scratching sound comes from the back door, followed by an insistent meow. Grandma Wilson sighs and sets down her needles.*

"All right, Mr. Whiskers, I'm coming."

*She opens the door and the orange tabby struts in like he owns the place, which, in his mind, he does. He leaps onto his favorite armchair and begins grooming himself with complete disregard for Grandma Wilson's exasperated look.*
"""
OUTPUT:
{
  "reasoning": "Mr. Whiskers the cat enters through the back door. Pets can be tracked as present characters when they're named and relevant to the scene. His position is on the armchair, his activity is grooming himself. His strutting suggests a self-satisfied mood.",
  "appeared": [
    {
      "name": "Mr. Whiskers",
      "position": "on the armchair",
      "activity": "grooming himself",
      "mood": ["self-satisfied"],
      "physicalState": []
    }
  ],
  "departed": []
}

### Example 8: Phone Call Does NOT Make Someone Present
INPUT:
"""
Previous state: Elena is alone in her office.

New message:
*Her phone buzzes and she answers without looking at the caller ID.* "Elena Vasquez."

"It's Marcus." *His voice is rough, tired.* "We need to talk about what happened last night."

*Elena leans back in her chair, pinching the bridge of her nose.* "I'm listening."

*They talk for twenty minutes about the botched job, the missing money, and the very real possibility that someone on the inside sold them out.*
"""
OUTPUT:
{
  "reasoning": "Marcus is communicating via phone, not physically present in Elena's office. Phone calls, video calls, texts, and other remote communication do not constitute physical presence. Elena remains the only character physically in the scene.",
  "appeared": [],
  "departed": []
}

### Example 9: Character Mentioned But Not Present
INPUT:
"""
Previous state: Detective Murphy and Officer Chen are at the crime scene.

New message:
*Murphy crouches beside the body, examining the wound pattern.* "This is definitely the Riverside Killer's work. Same signature cuts, same staging."

*Chen checks his notes.* "That matches what Agent Torres from the FBI said in her briefing. She thinks he's escalating."

"She's right," *Murphy mutters.* "We need to get ahead of him before another body drops."
"""
OUTPUT:
{
  "reasoning": "Agent Torres is mentioned in dialogue as having given a briefing, but she is not physically present at the crime scene. Murphy and Chen are discussing her analysis, not interacting with her. No arrivals or departures occur.",
  "appeared": [],
  "departed": []
}

### Example 10: Character Leaves Temporarily But Scene Follows Them
INPUT:
"""
Previous state: Marcus and Elena are in the living room of the safehouse.

New message:
*Marcus stands abruptly.* "I need some air." *He walks out to the back porch, letting the screen door bang shut behind him.*

*The night air is cool, carrying the smell of pine and distant rain. He grips the railing, knuckles white, trying to slow his breathing. The stars above seem impossibly distant, indifferent to his problems.*

*Inside, he can hear Elena moving around, probably making coffee. She knows better than to follow him when he gets like this.*
"""
OUTPUT:
{
  "reasoning": "Marcus moves to the back porch but the scene follows him there. Elena is mentioned as still inside but is no longer in the same immediate space. From Marcus's perspective on the porch, Elena has effectively departed from his current location. However, this is a tricky case - if the scene considers the entire safehouse as one location, neither has departed. Given the scene follows Marcus to the porch and Elena is 'inside', I'll consider Elena as having departed from the current scene focus while Marcus remains.",
  "appeared": [],
  "departed": ["Elena"]
}

### Example 11: Large Group Arrival - Named vs Unnamed
INPUT:
"""
Previous state: The mayor stands alone at the podium preparing for the press conference.

New message:
*The doors open and the press corps floods in - cameras flashing, recorders held high, voices calling out questions before anyone's even started. Leading the pack is veteran reporter Diana Vance, already positioning herself front and center. Behind her, Jake Morrison from Channel 7 jostles for space with a cameraman. The rest of the journalists fill the remaining seats, a sea of expectant faces.*

*The mayor clears his throat.* "Thank you all for coming. I'll take questions after my statement."
"""
OUTPUT:
{
  "reasoning": "Diana Vance and Jake Morrison are named reporters who arrive and position themselves. The rest of the press corps are an unnamed group ('the rest of the journalists', 'a sea of expectant faces') and shouldn't be tracked as individual characters. Only the specifically named individuals are extracted.",
  "appeared": [
    {
      "name": "Diana Vance",
      "position": "front and center before the podium",
      "activity": "positioning herself",
      "mood": ["eager", "professional"],
      "physicalState": []
    },
    {
      "name": "Jake Morrison",
      "position": "near Diana Vance",
      "activity": "jostling for space",
      "mood": ["competitive"],
      "physicalState": []
    }
  ],
  "departed": []
}

### Example 12: Character Unconscious/Dead - Still Present
INPUT:
"""
Previous state: Dr. Reyes is in the lab alone running experiments.

New message:
*The intruder moves fast - too fast for Reyes to react. One moment she's adjusting the microscope, the next she's on the ground, skull throbbing where she hit the counter. Through blurring vision, she sees black boots approach.*

*The man in the mask crouches beside her.* "Sorry, Doctor. Nothing personal." *Something stings her neck - an injection - and the world starts to fade.*

*When everything goes dark, the last thing she hears is his footsteps retreating, the lab door clicking shut behind him.*
"""
OUTPUT:
{
  "reasoning": "An intruder (the masked man) appeared and attacked Dr. Reyes, then departed ('footsteps retreating', 'lab door clicking shut'). Dr. Reyes is unconscious on the ground but still physically present in the lab - unconscious characters don't depart. The masked man both appeared and departed within this passage.",
  "appeared": [],
  "departed": ["the masked man"]
}

### Example 13: Character Revealed To Have Been Present All Along
INPUT:
"""
Previous state: Victor and Sarah are negotiating in Victor's office.

New message:
*Victor smiles that reptilian smile of his.* "You drive a hard bargain, Ms. Chen. But I think we can come to an arrangement."

*Movement in the corner catches Sarah's eye. A woman unfolds herself from the shadows behind the bookshelf - tall, dark-haired, with a scar running down her left cheek. Sarah hadn't noticed her at all.*

"This is my associate, Natasha," *Victor says casually.* "She'll be handling the... practical details of our agreement."
"""
OUTPUT:
{
  "reasoning": "Natasha was apparently in the room the entire time but hidden in the shadows. From a narrative tracking perspective, she has now 'appeared' because she wasn't previously tracked as present. Her concealment means she functionally wasn't part of the scene until revealed. This counts as an appearance. She has a notable scar as a physical feature.",
  "appeared": [
    {
      "name": "Natasha",
      "position": "by the bookshelf",
      "activity": null,
      "mood": ["composed"],
      "physicalState": ["scar on left cheek"]
    }
  ],
  "departed": []
}

### Example 14: Mass Exodus - Multiple Departures
INPUT:
"""
Previous state: The board meeting includes CEO Franklin, CFO Martinez, board members Thompson, Reyes, and Kim, and secretary Janet.

New message:
*Franklin slams his fist on the table.* "This meeting is adjourned! And if anyone breathes a word of what was discussed here to the press, you'll be hearing from our lawyers."

*The board members file out in stunned silence - first Thompson, then Reyes and Kim together, muttering between themselves. Martinez gathers her documents and follows, shooting Franklin a worried look. Janet quietly collects the coffee cups and slips out the service door.*

*Franklin is left alone, staring at the empty chairs, wondering how everything went so wrong so fast.*
"""
OUTPUT:
{
  "reasoning": "The meeting ends and everyone leaves except Franklin. Thompson, Reyes, Kim, Martinez, and Janet all depart. Franklin remains alone. The narrative explicitly states he's 'left alone' with 'empty chairs'.",
  "appeared": [],
  "departed": ["Thompson", "Reyes", "Kim", "Martinez", "Janet"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Counting Phone/Video Call As Presence
INPUT:
"""
Previous state: Marcus is alone in his apartment.

New message:
*His laptop chimes and Elena's face fills the screen, her apartment visible behind her.*

"Marcus, we have a problem," *she says without preamble.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena appears on the video call.",
  "appeared": [
    { "name": "Elena", "position": "on the video screen", "activity": "talking" }
  ],
  "departed": []
}
WHY THIS IS WRONG: Video calls do not constitute physical presence. Elena is in her own apartment, not in Marcus's apartment. She has not appeared in his physical space. Correct output: appeared: [], departed: []

### Bad Example 2: Missing A Departure
INPUT:
"""
Previous state: Jake and his girlfriend Amy are having dinner at a restaurant.

New message:
*Jake's phone buzzes. He glances at it and his face goes pale.*

"I have to go," *he says, already standing, throwing money on the table.* "Don't wait up."

*He's out the door before Amy can even ask what's wrong. She sits alone, her appetite suddenly gone, staring at the half-eaten meal and wondering what could possibly be so urgent.*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake receives an urgent message.",
  "appeared": [],
  "departed": []
}
WHY THIS IS WRONG: Jake explicitly leaves - "He's out the door" and "She sits alone." The departure is clearly described. Correct output: departed: ["Jake"]

### Bad Example 3: Adding Characters From Memory/Dialogue
INPUT:
"""
Previous state: Sarah is visiting her mother Helen at the nursing home.

New message:
*Helen's eyes drift to the window.* "Your father used to love this view. He'd sit right there," *she points to the chair beside her,* "and watch the birds for hours."

*Sarah follows her gaze.* "I remember. He always said the cardinals were his favorite."

"He was a good man, your father. I miss him every day."
"""
WRONG OUTPUT:
{
  "reasoning": "They're talking about Sarah's father, and Helen points to where he used to sit.",
  "appeared": [
    { "name": "Sarah's father", "position": "by the window", "activity": "watching birds" }
  ],
  "departed": []
}
WHY THIS IS WRONG: Sarah's father is being remembered - he's deceased ("I miss him every day"). Characters from memories, stories, or the past are not physically present. Correct output: appeared: [], departed: []

### Bad Example 4: Wrong Position/Activity For New Arrival
INPUT:
"""
Previous state: The bar is empty except for the bartender Mike.

New message:
*A woman in a red dress pushes through the door, heels clicking on the hardwood. She takes a seat at the far end of the bar, as far from the entrance as possible, and orders a whiskey neat without looking up from her phone.*
"""
WRONG OUTPUT:
{
  "reasoning": "A woman enters and sits at the bar.",
  "appeared": [
    { "name": "woman in red dress", "position": "at the door", "activity": "entering" }
  ],
  "departed": []
}
WHY THIS IS WRONG: The position and activity should reflect where the character ends up, not where they started. She sits "at the far end of the bar" and is ordering a drink and looking at her phone. Correct: { "name": "woman in red dress", "position": "at the far end of the bar", "activity": "ordering a whiskey and checking her phone", "mood": [], "physicalState": [] }

### Bad Example 5: Treating Scene Change As Departure
INPUT:
"""
Previous state: Marcus and Elena are in the warehouse planning the heist.

New message:
*The scene shifts to three hours later.*

*Elena's apartment is quiet, lit only by the glow of her laptop screen. She types furiously, pulling up building schematics, security schedules, anything that might help. The plan Marcus outlined is ambitious. Maybe too ambitious.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene moves to Elena's apartment, so Marcus has departed.",
  "appeared": [],
  "departed": ["Marcus"]
}
WHY THIS IS WRONG: This is a scene change, not a departure. Marcus didn't leave - the narrative jumped to a different time and place. Scene transitions aren't tracked as presence changes. In the new scene, Elena is simply alone in her apartment. The correct approach would be to handle this as an initial extraction for the new scene, not a departure from the old one.

### Bad Example 6: Missing Arrival Because Not Explicitly Named
INPUT:
"""
Previous state: Detective Murphy is alone at the crime scene.

New message:
*"Detective Murphy?" A young officer approaches, notepad in hand. His badge reads 'CHEN.' "I found a witness. Lady across the street says she saw someone running from the building around 2 AM."*

*Murphy turns.* "Good work. Bring her in for a statement."
"""
WRONG OUTPUT:
{
  "reasoning": "A young officer approaches but isn't really named.",
  "appeared": [],
  "departed": []
}
WHY THIS IS WRONG: The officer IS identifiable - his badge reads 'CHEN', so he can be called "Officer Chen." He physically approaches Murphy at the crime scene. Correct: appeared: [{ "name": "Officer Chen", "position": "beside Detective Murphy", "activity": "reporting on a witness", "mood": [], "physicalState": [] }]

### Bad Example 7: Character Visible But Not Present
INPUT:
"""
Previous state: Nathan is watching from the cafe window.

New message:
*Across the street, the woman in the red coat appears at the bus stop. She checks her phone, shivers in the cold, then looks up as the bus approaches. Nathan watches her board, watches the doors close, watches the bus pull away and disappear around the corner. She's gone, and he still doesn't know her name.*
"""
WRONG OUTPUT:
{
  "reasoning": "The woman appears across the street.",
  "appeared": [
    { "name": "woman in red coat", "position": "at the bus stop", "activity": "checking phone" }
  ],
  "departed": ["woman in red coat"]
}
WHY THIS IS WRONG: The woman is across the street, in a completely different location. She's visible from Nathan's location but not present in it. She doesn't appear or depart from Nathan's scene - she was never in the cafe. Correct: appeared: [], departed: []

### Bad Example 8: Inventing Names For Unnamed Characters
INPUT:
"""
Previous state: The CEO is presenting to the board.

New message:
*Three men in suits enter the conference room - the legal team, here for the merger discussion. They take seats along the wall, opening their briefcases in silent synchronization.*
"""
WRONG OUTPUT:
{
  "reasoning": "The legal team arrives.",
  "appeared": [
    { "name": "John Smith", "position": "along the wall", "activity": "opening briefcase" },
    { "name": "Mike Johnson", "position": "along the wall", "activity": "opening briefcase" },
    { "name": "Robert Williams", "position": "along the wall", "activity": "opening briefcase" }
  ],
  "departed": []
}
WHY THIS IS WRONG: The names are completely invented. The legal team members aren't named in the text. Either track them as "the legal team" collectively if appropriate, or as "legal team member 1/2/3" or skip tracking unnamed background characters. Never invent names.

### Bad Example 9: Missing Subtle Arrival
INPUT:
"""
Previous state: The interrogation room contains Detective Blake and the suspect.

New message:
*Blake leans forward.* "One more time. Where were you on the night of-"

*The door opens. Captain Morrison steps in, face grim.* "Blake. A word." *His tone leaves no room for argument.*

*Blake sighs and stands.* "Don't go anywhere," *he tells the suspect, and steps outside with Morrison.*
"""
WRONG OUTPUT:
{
  "reasoning": "Captain Morrison interrupts and Blake leaves to talk to him.",
  "appeared": [],
  "departed": ["Detective Blake"]
}
WHY THIS IS WRONG: Captain Morrison arrives at the door - he "steps in" to the interrogation room. Blake's departure is captured, but Morrison's arrival is missed. Correct: appeared: [{ "name": "Captain Morrison", "position": "at the door", "activity": "summoning Blake", "mood": ["serious"], "physicalState": [] }], departed: ["Detective Blake", "Captain Morrison"]

### Bad Example 10: Including Departed Character Still In Text
INPUT:
"""
Previous state: Marcus, Elena, and Jack are in the warehouse.

New message:
*Jack grabs his jacket.* "I'm out. This whole thing is suicide."

*He storms toward the exit, but Marcus catches his arm.* "Jack, wait. We need you."

*Jack shakes him off.* "You needed me when you decided to take this job without asking. Too late now." *The door slams behind him, leaving Marcus and Elena in heavy silence.*

"Let him go," *Elena says quietly.* "We can do this without him."
"""
WRONG OUTPUT:
{
  "reasoning": "Jack leaves angrily.",
  "appeared": [],
  "departed": []
}
WHY THIS IS WRONG: Jack clearly departs - "The door slams behind him, leaving Marcus and Elena." The interaction before departure doesn't change that he left. Correct: departed: ["Jack"]

### Bad Example 11: Wrong Handling of Character Who Steps Out Briefly
INPUT:
"""
Previous state: The family - Mom, Dad, and teenage daughter Zoe - are having dinner.

New message:
*Dad's phone rings and he frowns at the screen.* "I have to take this. Work emergency." *He steps into the hallway, his voice fading as he closes the door.*

*Mom sighs.* "Again with the work calls during dinner."

*Zoe shrugs, pushing her peas around her plate.* "At least it's quiet."
"""
WRONG OUTPUT:
{
  "reasoning": "Dad stepped out but is still in the house.",
  "appeared": [],
  "departed": []
}
WHY THIS IS WRONG: Dad has left the dinner scene - he's in the hallway with the door closed. For scene tracking purposes, he's departed from the current scene (the dining area). He may be in the house, but he's not in the same room. Correct: departed: ["Dad"]

### Bad Example 12: Double-Counting Same Arrival
INPUT:
"""
Previous state: Elena is alone in her apartment.

New message:
*The doorbell rings. Elena checks the peephole, then opens the door to find Marcus standing there with takeout bags.*

"You sounded like you needed Chinese food," *he says.*

*Elena steps aside to let him in.* "How do you always know?"

*Marcus sets the bags on the kitchen counter and starts unpacking containers.* "I pay attention."
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus arrives at the door and then enters the apartment.",
  "appeared": [
    { "name": "Marcus", "position": "at the door", "activity": "arriving" },
    { "name": "Marcus", "position": "in the kitchen", "activity": "unpacking food" }
  ],
  "departed": []
}
WHY THIS IS WRONG: Marcus is one person making one arrival. Don't track his movement through the space as multiple appearances. Use his final position. Correct: appeared: [{ "name": "Marcus", "position": "in the kitchen", "activity": "unpacking takeout food" }]
`;

export const presenceChangePrompt: PromptTemplate<ExtractedCharacterPresenceChange> = {
	name: 'presence_change',
	description: 'Extract which characters have appeared or departed from the scene',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.charactersPresent,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to determine which characters have appeared or departed from the scene.

## Your Task
Compare the previous character presence state with the new message to identify:
1. **Appeared**: Characters who have newly arrived in the scene
2. **Departed**: Characters who have left the scene

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of presence changes
- "appeared": Array of characters who appeared, each with:
  - "name": The character's name
  - "position": Where they are positioned in the scene
  - "activity": What they're doing (null if idle)
  - "mood": Array of current emotional states (e.g., ["anxious", "determined"])
  - "physicalState": Array of notable physical conditions (e.g., ["wet from rain", "injured"]) - empty if normal
- "departed": Array of character names who left

## Presence Rules

### Characters APPEAR when they:
- Physically enter the scene (through door, window, portal, etc.)
- Are revealed to have been present (hidden character emerges)
- Return after being away
- Arrive at the location where the scene is taking place

### Characters DEPART when they:
- Physically leave (exit through door, walk away, teleport, etc.)
- Move to a different room/area that the scene doesn't follow
- Are explicitly stated to have left
- Slip away unnoticed (but their absence is discovered)

### NOT presence changes:
- Phone/video calls (not physical presence)
- Characters mentioned in dialogue or memory
- Characters in photos, paintings, or recordings
- Scene transitions (that's a new scene, not departure)
- Characters visible at a distance in a different location

## Important Rules
- Only track NAMED or IDENTIFIABLE characters (not "a crowd" or "some people")
- Use final position after movement, not entry point
- Unconscious/dead characters are still physically present
- When someone enters and immediately leaves, they appear in departed only
- Don't invent names for unnamed characters
- Pet/animal characters can be tracked if named and relevant

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Characters Previously Present
{{charactersPresent}}

## New Message to Analyze
{{messages}}

## Task
Determine which characters have appeared or departed based on this new message.

Remember:
- Only physical presence counts (not phone calls, memories, etc.)
- Use final position after any movement
- Include position, activity, mood, and physicalState for arrivals
- Don't invent names for unnamed characters
- mood and physicalState should be arrays (can be empty)`,

	responseSchema: presenceChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedCharacterPresenceChange | null {
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
		if (!Array.isArray(parsed.appeared)) return null;
		if (!Array.isArray(parsed.departed)) return null;

		// Validate appeared characters
		for (const char of parsed.appeared) {
			if (typeof char !== 'object' || char === null) return null;
			const c = char as Record<string, unknown>;
			if (typeof c.name !== 'string') return null;
			if (typeof c.position !== 'string') return null;
			// activity can be string or null

			// Ensure mood and physicalState are arrays (default to empty if missing)
			if (!Array.isArray(c.mood)) {
				c.mood = [];
			}
			if (!Array.isArray(c.physicalState)) {
				c.physicalState = [];
			}
		}

		// Validate departed is array of strings
		for (const name of parsed.departed) {
			if (typeof name !== 'string') return null;
		}

		return parsed as unknown as ExtractedCharacterPresenceChange;
	},
};
