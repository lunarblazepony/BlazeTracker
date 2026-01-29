/**
 * Feelings Change Event Prompt
 *
 * Extracts changes in one character's feelings toward another character.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedFeelingsChange } from '../../types/extraction';
import { feelingsChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Trust Developing After Shared Danger (Bidirectional)
INPUT:
"""
CURRENT RELATIONSHIP:
Status: acquaintances
Elena toward Marcus: feelings: wary, curious, attracted
Marcus toward Elena: feelings: protective, intrigued
---
Marcus: *The warehouse explodes behind them, debris raining down as Marcus throws himself over Elena, shielding her with his body. Glass shards slice into his back, but he doesn't flinch. When the dust settles, he meets her eyes.* "You okay?" *His voice is rough with concern, genuine worry etched into his features. He's bleeding from a cut on his forehead, but he's checking her for injuries first.*

Elena: *She stares up at him, heart pounding from more than just the explosion. He took the hit for her. A man she barely knows just risked his life without hesitation.* "I'm... yeah. Marcus, your back—" *She reaches toward him, her hand trembling. The walls she's spent years building suddenly feel less important than they did ten minutes ago.*
"""
OUTPUT:
{
  "reasoning": "Elena's feelings toward Marcus are shifting significantly after he shielded her from the explosion. Her 'wary' feeling should be removed as she's now seeing him differently - he risked his life for her. New feelings of 'grateful' and 'trusting' are emerging. Marcus's feelings toward Elena intensify - his protective instincts were just proven in action, and seeing her vulnerability likely deepens his emotional investment.",
  "changes": [
    {
      "fromCharacter": "Elena",
      "towardCharacter": "Marcus",
      "added": ["grateful", "trusting"],
      "removed": ["wary"]
    },
    {
      "fromCharacter": "Marcus",
      "towardCharacter": "Elena",
      "added": ["deeply invested"],
      "removed": []
    }
  ]
}

### Example 2: Betrayal Destroying Trust
INPUT:
"""
CURRENT RELATIONSHIP:
Status: intimate
James toward Victoria: feelings: loving, devoted, trusting, comfortable
Victoria toward James: feelings: indifferent, distant
---
Victoria: *She doesn't even look guilty as James stands in the doorway of their bedroom, frozen. The other man scrambles for his clothes while Victoria simply pulls the sheet up, her expression almost bored.* "You're home early." *No apology. No explanation. Just that flat statement, as if he's the one who's done something wrong by returning to his own apartment.*

James: *The world tilts sideways. Fifteen years. Fifteen years of marriage, and she looks at him like he's an inconvenience. His keys slip from numb fingers, clattering against the hardwood floor. The sound seems impossibly loud in the silence.* "How long?" *His voice doesn't sound like his own.*

Victoria: "Does it matter?" *She sighs, actually sighs, like this conversation is tedious.* "James, we both know this marriage has been over for years. I was just the first one honest enough to admit it."
"""
OUTPUT:
{
  "reasoning": "James has just discovered his wife's infidelity. His previous feelings of 'loving', 'devoted', 'trusting', and 'comfortable' are being devastated. He's experiencing shock and betrayal. Victoria's feelings don't change much - she was already indifferent and distant, and her dismissive reaction confirms those feelings. She might feel slightly annoyed at the inconvenience of being caught.",
  "changes": [
    {
      "fromCharacter": "James",
      "towardCharacter": "Victoria",
      "added": ["betrayed", "devastated", "shocked"],
      "removed": ["loving", "devoted", "trusting", "comfortable"]
    },
    {
      "fromCharacter": "Victoria",
      "towardCharacter": "James",
      "added": ["annoyed"],
      "removed": []
    }
  ]
}

### Example 3: Anger Softening Through Understanding
INPUT:
"""
CURRENT RELATIONSHIP:
Sophie toward her mother: feelings: resentful, angry, bitter, abandoned
---
Mother: *The hospital room is small and sterile. Sophie's mother lies in the bed, smaller than Sophie remembers, worn down by illness and years.* "I know you hate me." *Her voice is a whisper.* "I hated myself too, for leaving. But I was sick, Sophie. Not just my body - my mind. I couldn't be a mother when I could barely be a person." *Tears track down her hollow cheeks.* "I thought you'd be better off without someone so broken."

Sophie: *She wants to scream, to rage, to demand explanations that could never be enough. But looking at this fragile woman, she sees the shadows under her eyes, the tremor in her hands. The same tremor Sophie has when her own anxiety takes hold.* "You could have told me." *The words come out softer than she intended.* "I spent years thinking I wasn't enough to make you stay."

Mother: "You were everything. That's why I had to go - so I couldn't hurt you more than I already had."
"""
OUTPUT:
{
  "reasoning": "Sophie's feelings toward her mother are beginning to shift as she learns the truth about her mother's mental illness and motivations. Her 'angry' and 'bitter' feelings are softening as she sees her mother's fragility and vulnerability. She's not fully forgiving yet, but understanding is emerging - 'she sees the shadows under her eyes, the same tremor Sophie has'. Adding 'conflicted' and 'empathetic' as Sophie begins to see her mother as a sick person rather than just an abandoner. The 'resentful' and 'abandoned' feelings remain but are being complicated by this new understanding, so not removing them yet - just the sharp edge of anger.",
  "fromCharacter": "Sophie",
  "towardCharacter": "her mother",
  "added": ["conflicted", "empathetic", "sorrowful"],
  "removed": ["angry", "bitter"]
}

### Example 4: Fear Converting to Hatred
INPUT:
"""
CURRENT RELATIONSHIP:
Mira toward King Aldric: feelings: terrified, submissive, desperate
---
King Aldric: *He gestures lazily to the guards, and they drag Mira's younger brother forward, forcing him to his knees.* "I gave you one simple task." *His voice is pleasant, almost conversational.* "Find the rebels. You failed." *He draws his dagger, examining the blade.* "Let this serve as motivation for your next attempt."

Mira: *She screams as the king cuts her brother's face, a long slash from temple to jaw that will scar forever. Thomas doesn't make a sound, just stares at her with eyes that say 'don't react, don't give him more power.' But something inside her has shifted. The terror is still there, but beneath it, something harder is taking root.*

King Aldric: "You have one week, little spy. Bring me what I want, or I'll take his eyes next." *He wipes the blade on Thomas's shirt and turns away, already bored.* "Clean this up."
"""
OUTPUT:
{
  "reasoning": "Mira's feelings toward King Aldric are undergoing a fundamental transformation. While she remains terrified - the fear is still present and real - something new is emerging beneath it. Watching him casually mutilate her brother while being 'bored' and 'pleasant' has planted seeds of hatred. She's no longer purely 'submissive' - 'something harder is taking root.' The desperation remains but is now mixed with a new resolve. Adding 'hateful' and 'vengeful' as these darker feelings emerge. Removing 'submissive' as her internal stance has shifted even if she must still appear compliant externally.",
  "fromCharacter": "Mira",
  "towardCharacter": "King Aldric",
  "added": ["hateful", "vengeful", "determined"],
  "removed": ["submissive"]
}

### Example 5: Romantic Feelings Awakening
INPUT:
"""
CURRENT RELATIONSHIP:
Lily toward her best friend Jake: feelings: comfortable, affectionate, platonic
---
Jake: *The sunset paints the beach in shades of orange and pink as Jake finishes building their sandcastle, complete with a tiny flag made from a leaf. He looks up at Lily with that goofy grin she's known since kindergarten, sand in his hair and pure joy on his face.* "Your fortress, my lady." *He bows dramatically.*

Lily: *She laughs, the same laugh she's always had around him. But something is different today. Maybe it's the light, or the way his eyes crinkle when he smiles, or the fact that he remembered she always wanted a castle with a moat. She finds herself really looking at him for the first time in years.* "You're such a dork." *The words come out softer than teasing.*

Jake: *He flops down beside her, close enough that their shoulders touch.* "Your dork, though. Twenty years and counting. Nobody else would build you castles." *He says it casually, but there's something in his voice that wasn't there before. Or maybe it was always there, and she's just now hearing it.*
"""
OUTPUT:
{
  "reasoning": "Lily is experiencing the awakening of romantic feelings for her lifelong best friend. The scene captures that pivotal moment of 'really looking at him for the first time in years' - seeing him in a new light. Her words come out 'softer than teasing' and she's noticing physical details like how his eyes crinkle. The phrase 'something is different today' explicitly signals shifting feelings. Adding 'romantically interested' and 'nervous'. Her 'platonic' feeling is being challenged. Adding 'confused' as she navigates this new territory.",
  "fromCharacter": "Lily",
  "towardCharacter": "Jake",
  "added": ["romantically interested", "nervous", "confused"],
  "removed": ["platonic"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Changes Not Supported by Text
INPUT:
"""
CURRENT RELATIONSHIP:
Sarah toward Mike: feelings: friendly, casual, comfortable
---
Mike: "Hey, want to grab coffee after class?"

Sarah: "Sure, sounds good. The usual place?"

Mike: "Yeah, see you there."
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah agrees to coffee with Mike.",
  "fromCharacter": "Sarah",
  "towardCharacter": "Mike",
  "added": ["romantically interested", "attracted", "excited"],
  "removed": ["casual"]
}
WHY THIS IS WRONG: Nothing in this mundane exchange suggests romantic interest or attraction. They're just making casual plans - the same thing friends do constantly. The output invents feelings not supported by the text. CORRECT: {"added": [], "removed": []} - no changes occurred.

### Bad Example 2: Removing Feelings That Should Remain
INPUT:
"""
CURRENT RELATIONSHIP:
Elena toward Marcus: feelings: loving, devoted, trusting, attracted
---
Marcus: *He comes home late again, the third time this week. Elena is waiting in the kitchen, dinner long cold.*

Elena: "Where were you?" *Her voice is tired, not angry anymore. Just tired.*

Marcus: "Work ran late. You know how it is."

Elena: *She does know. She's heard it a hundred times.* "Dinner's in the fridge."
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is frustrated with Marcus coming home late.",
  "fromCharacter": "Elena",
  "towardCharacter": "Marcus",
  "added": ["frustrated", "weary"],
  "removed": ["loving", "devoted", "trusting", "attracted"]
}
WHY THIS IS WRONG: One tired evening doesn't erase love, devotion, trust, and attraction. Elena is frustrated and weary, yes, but the core feelings remain. Removing all positive feelings is a massive overreaction to a common relationship friction. CORRECT: Add "frustrated" and "weary" but don't remove the foundational feelings.

### Bad Example 3: Adding Redundant or Similar Feelings
INPUT:
"""
CURRENT RELATIONSHIP:
James toward Victoria: feelings: attracted
---
Victoria: *She walks into the party in a stunning red dress, and James can't look away. She catches him staring and smiles.*
"""
WRONG OUTPUT:
{
  "reasoning": "James finds Victoria attractive in her dress.",
  "fromCharacter": "James",
  "towardCharacter": "Victoria",
  "added": ["attracted", "drawn to her", "magnetized", "captivated", "mesmerized", "enchanted", "spellbound", "bewitched"],
  "removed": []
}
WHY THIS IS WRONG: These are all basically the same feeling expressed different ways. "Attracted" already captures the core emotion. Adding seven synonyms creates redundancy. Pick 1-2 distinct feelings that add NEW information. Perhaps "dazzled" if emphasizing her appearance, or "emboldened" if he's going to approach her.

### Bad Example 4: Confusing Momentary States with Lasting Feelings
INPUT:
"""
CURRENT RELATIONSHIP:
Anna toward her husband: feelings: loving, comfortable, trusting
---
Anna: *She's exhausted after a long day, and he left his socks on the floor again.* "Really, Mark? The hamper is three feet away."

Mark: "Sorry, habit." *He picks them up.*

Anna: *She sighs.* "It's fine. I'm just tired."
"""
WRONG OUTPUT:
{
  "reasoning": "Anna is irritated at Mark.",
  "fromCharacter": "Anna",
  "towardCharacter": "Mark",
  "added": ["irritated", "frustrated", "questioning the relationship", "resentful"],
  "removed": ["comfortable"]
}
WHY THIS IS WRONG: Being momentarily annoyed about socks is not the same as developing lasting "resentful" feelings or "questioning the relationship." This is a tiny, normal domestic friction that she immediately says is fine. Maybe no changes at all, or at most a temporary "mildly annoyed" that doesn't warrant removing "comfortable."

### Bad Example 5: Missing Obvious Feeling Changes
INPUT:
"""
CURRENT RELATIONSHIP:
Maya toward her captor: feelings: terrified, helpless
---
Captor: *He unlocks the basement door, tossing down a bottle of water and some bread.* "Eat. I need you alive for the ransom call." *He doesn't wait for a response, just locks the door and leaves.*

Maya: *She listens to his footsteps fade, then scrambles for the water. While drinking, she notices the lock didn't click fully - the door is slightly ajar. Her heart pounds.*
"""
WRONG OUTPUT:
{
  "reasoning": "Maya is still scared of her captor.",
  "fromCharacter": "Maya",
  "towardCharacter": "her captor",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: This misses the crucial development - the door is unlocked. Maya now has hope of escape, which would add "hopeful" or "desperately hopeful." Her "helpless" feeling should be challenged by this discovery. The output claims nothing changed when clearly something significant did.
`;

export const feelingsChangePrompt: PromptTemplate<ExtractedFeelingsChange> = {
	name: 'feelings_change',
	description: "Extract changes in one character's feelings toward another character",

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.relationshipPair,
		PLACEHOLDERS.relationshipState,
		PLACEHOLDERS.relationshipProfiles,
	],

	systemPrompt: `You are analyzing roleplay messages to detect changes in one character's emotional feelings toward another character.

## Your Task
Given the current relationship state and new messages, identify any feelings that have been added or removed for the specified directional relationship (from one character toward another).

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what emotional changes occurred and why for BOTH directions
- "changes": Array of changes for each direction (A toward B, and B toward A). Each change object has:
  - "fromCharacter": The character whose feelings are changing
  - "towardCharacter": The character the feelings are directed toward
  - "added": Array of new feelings that have emerged (empty if none)
  - "removed": Array of feelings that have faded or been replaced (empty if none)

IMPORTANT: You must analyze BOTH directions of the relationship and include both in the changes array. If no changes occurred in a direction, include it with empty added/removed arrays.

## What Counts as Feelings
Feelings are emotional states directed toward a person:
- Positive: loving, trusting, attracted, admiring, grateful, protective, fond, comfortable
- Negative: resentful, suspicious, jealous, contemptuous, bitter, hateful, disgusted
- Complex: conflicted, curious, intrigued, fascinated, wary, guarded, longing
- Situational: worried, relieved, proud, disappointed, hurt, betrayed, abandoned

## Key Guidelines
- Only extract changes that are CLEARLY supported by the text
- A character can have multiple simultaneous feelings (even contradictory ones)
- Consider what the character is thinking/feeling, not just saying
- Don't remove feelings unless something specifically contradicts them
- Adding feelings is more common than removing them
- Be specific: "disappointed in their choices" is better than just "disappointed"
- Feelings persist unless something changes them
- Momentary emotions (annoyed for a second) are different from lasting feelings

## Important Rules
- Maintain the exact direction: feelings FROM one character TOWARD another
- Names in the response must match the input exactly
- Each feeling in added/removed should be distinct (no synonyms)
- Empty arrays are valid if no changes occurred
- Reasoning should explain WHY feelings changed, referencing specific text

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Profiles
{{relationshipProfiles}}

## Current Relationship State
{{relationshipState}}

## New Messages
{{messages}}

## Task
Analyze these messages for changes in feelings between {{relationshipPair}}.

For BOTH directions of the relationship, determine:
1. Which feelings have newly emerged?
2. Which feelings have faded or been replaced?
3. Why did these changes occur?

Return your analysis as JSON with a "changes" array containing both directions.`,

	responseSchema: feelingsChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedFeelingsChange | null {
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
		if (!Array.isArray(parsed.changes)) return null;

		// Validate each change in the array
		for (const change of parsed.changes) {
			if (typeof change !== 'object' || change === null) return null;
			const c = change as Record<string, unknown>;
			if (typeof c.fromCharacter !== 'string') return null;
			if (typeof c.towardCharacter !== 'string') return null;
			if (!Array.isArray(c.added)) return null;
			if (!Array.isArray(c.removed)) return null;
			if (!c.added.every((item: unknown) => typeof item === 'string'))
				return null;
			if (!c.removed.every((item: unknown) => typeof item === 'string'))
				return null;
		}

		return parsed as unknown as ExtractedFeelingsChange;
	},
};
