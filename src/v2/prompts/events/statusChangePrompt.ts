/**
 * Status Change Event Prompt
 *
 * Extracts changes in the overall relationship status between two characters.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedStatusChange } from '../../types/extraction';
import { statusChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const VALID_STATUSES = [
	'strangers',
	'acquaintances',
	'friendly',
	'close',
	'intimate',
	'strained',
	'hostile',
	'complicated',
];

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Strangers Becoming Acquaintances
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Elena and Marcus
Status: strangers
---
Elena: *She bumps into him at the coffee shop, spilling her latte.* "Oh god, I'm so sorry!"

Marcus: *He catches her arm to steady her, grabbing napkins from the counter.* "No harm done. Here, let me get you another one." *He signals the barista.* "I'm Marcus, by the way."

Elena: "Elena. And you really don't have to—"

Marcus: "Consider it my good deed for the day. Besides, you look like you need the caffeine."
"""
OUTPUT:
{
  "reasoning": "Elena and Marcus have gone from complete strangers to having introduced themselves and shared a small moment of connection (the coffee incident, his kindness, light banter). They now know each other's names and have had a genuine interaction. This moves them from 'strangers' to 'acquaintances' - they're not friends yet, but they're no longer unknown to each other.",
  "pair": ["Elena", "Marcus"],
  "changed": true,
  "newStatus": "acquaintances"
}

### Example 2: Acquaintances Becoming Friendly
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: James and Victoria
Status: acquaintances
---
James: *They've been working on the project together for weeks now. He brings her coffee the way she likes it without asking.* "Figured you'd need this for the quarterly review."

Victoria: *She takes it gratefully, noticing he remembered no sugar.* "You're a lifesaver, honestly. I don't know how I'd get through these meetings without you."

James: *He settles into the chair beside her.* "That's what partners are for. We've got this."
"""
OUTPUT:
{
  "reasoning": "James and Victoria have developed a comfortable working rapport over weeks. He remembers her coffee preferences, she relies on him for support, and he calls them 'partners.' This has evolved beyond mere acquaintanceship into genuine friendliness - they're comfortable with each other, supportive, and have developed personal knowledge of each other's preferences.",
  "pair": ["James", "Victoria"],
  "changed": true,
  "newStatus": "friendly"
}

### Example 3: Friendly Becoming Close
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Sophie and her mother
Status: friendly
---
Mother: *Tears streaming down her face.* "He was three, Sophie. Thomas. I couldn't talk about him - couldn't bear to say his name. But I've carried him with me every day."

Sophie: *She moves to sit beside her mother, taking her hands.* "Mom... all these years, you've been grieving alone?"

Mother: *She nods, grip tightening.* "I thought protecting you from the pain was better than sharing it."

Sophie: *After a long silence.* "Show me. Show me everything about him. I want to know my brother."
"""
OUTPUT:
{
  "reasoning": "Sophie and her mother are sharing profound vulnerability - a decades-old secret about a dead sibling is being revealed and processed together. Sophie is choosing to move closer rather than away, asking to know her brother's story. This level of emotional intimacy and shared grief moves them from merely friendly to close - they're now sharing the deepest parts of their history.",
  "pair": ["Sophie", "her mother"],
  "changed": true,
  "newStatus": "close"
}

### Example 4: Close Becoming Intimate
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Alex and Jordan
Status: close
---
Alex: *They've talked through the night again, empty wine bottles and the remains of midnight snacks scattered around them. As dawn breaks through the curtains, Alex reaches out, fingers brushing Jordan's cheek.* "I don't want this to end. I don't mean tonight - I mean... us. Whatever this is."

Jordan: *They lean into the touch, eyes meeting Alex's with a vulnerability neither has shown before.* "I've been in love with you for months. I was too scared to say it."

Alex: "Me too. God, me too."
"""
OUTPUT:
{
  "reasoning": "Alex and Jordan have confessed mutual romantic love after being close friends. The scene shows physical intimacy (touch), emotional vulnerability (fear of confession), and mutual declaration of love. This transforms their close friendship into an intimate romantic relationship.",
  "pair": ["Alex", "Jordan"],
  "changed": true,
  "newStatus": "intimate"
}

### Example 5: Any Status Becoming Strained
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Father and Son
Status: close
---
Son: *He sets down the acceptance letter from art school in Paris.* "I'm not taking over the company, Dad."

Father: *His face hardens.* "You're throwing away everything I've built. Everything I did FOR you."

Son: "You did it for yourself. You never asked what I wanted."

Father: *Voice cold.* "Then I suppose we have nothing more to discuss."
"""
OUTPUT:
{
  "reasoning": "A major conflict has erupted between father and son over life direction. The father feels betrayed and the son feels unheard. Their previously close relationship is now under severe strain - the father has shut down communication with 'nothing more to discuss.' This doesn't mean they hate each other (not hostile), but the relationship is now strained by fundamental disagreement and hurt.",
  "pair": ["Father", "Son"],
  "changed": true,
  "newStatus": "strained"
}

### Example 6: Strained Becoming Hostile
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Kira and Maya
Status: strained
---
Kira: *Standing in the prison visiting room.* "They denied your parole. Again. I made sure of it."

Maya: *Through the glass.* "You came all this way just to tell me that? You must miss me more than you admit."

Kira: "I came to see the look on your face. You murdered our parents and let me rot in prison for three years. You're going to die in here. That's a promise."

Maya: *A cold smile.* "I did what I did to protect you, little sister. One day you'll thank me."
"""
OUTPUT:
{
  "reasoning": "Kira is actively working to ensure Maya stays in prison forever - this goes beyond mere strain. She's promising Maya will 'die in here' and deliberately came to gloat about blocking parole. This is active hostility, not just tension or strain. Maya's counter-manipulation doesn't change that Kira views this as war.",
  "pair": ["Kira", "Maya"],
  "changed": true,
  "newStatus": "hostile"
}

### Example 7: Complicated Status
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Elena and Victor
Status: close
---
Victor: *He's late again - an hour this time.* "Sorry, something came up."

Elena: *She's heard this before. Her friends say he only comes around when he needs something, but then he looks at her like that and she forgets why she was upset.* "It's okay. I was worried."

Victor: *He kisses her forehead.* "You're too good to me, you know that?"

Elena: *She knows. That's the problem. But she can't seem to stop.*
"""
OUTPUT:
{
  "reasoning": "This relationship is showing signs of dysfunction - Victor takes her for granted, Elena's friends have concerns, but she keeps forgiving him despite knowing something is wrong. The relationship isn't hostile or strained on the surface, but it's not genuinely healthy either. Elena herself recognizes 'that's the problem' but 'can't seem to stop.' This is the definition of complicated - mixed feelings, unclear dynamics, potential dysfunction.",
  "pair": ["Elena", "Victor"],
  "changed": true,
  "newStatus": "complicated"
}

### Example 8: Hostile Becoming Strained (De-escalation)
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Marcus and his stepfather
Status: hostile
---
Stepfather: *Sitting alone in the garage, tears on his face.* "Your mother's oncologist called. Stage four. They're saying months."

Marcus: *Ten years of hatred, and suddenly none of it matters.* "What do we do?"

Stepfather: "I don't know. I don't know how to do this without her. I've loved her for fifteen years, Marcus. I just wanted to be part of the family she was building."
"""
OUTPUT:
{
  "reasoning": "A hostile relationship is de-escalating in the face of shared grief over Marcus's mother's terminal diagnosis. Marcus's hatred is cracking ('suddenly none of it matters'), and his stepfather is showing vulnerable, genuine emotion. They're not friends now, but the active hostility is giving way to something more complex - strained but not at war. They may have to learn to coexist.",
  "pair": ["Marcus", "his stepfather"],
  "changed": true,
  "newStatus": "strained"
}

### Example 9: No Change Despite Drama
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Detective Rivera and the suspect
Status: hostile
---
Detective: *Slams folder on table.* "We have your fingerprints, your DNA, and three witnesses. This is your last chance."

Suspect: *Smiles calmly.* "I want my lawyer."

Detective: "You're going to spend the rest of your life in prison. I'll make sure of it."

Suspect: "We'll see about that, Detective."
"""
OUTPUT:
{
  "reasoning": "While this is an intense confrontation, it's an interrogation room - they were already hostile (law enforcement vs. suspect). The detective threatening prison and the suspect being smug is standard adversarial interaction. Nothing has changed the fundamental nature of their relationship. They're still hostile, as expected.",
  "pair": ["Detective Rivera", "the suspect"],
  "changed": false
}

### Example 10: Intimate Remaining Intimate Through Conflict
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Alex and Jordan
Status: intimate
---
Alex: *Slams the door.* "I can't believe you told your mother about the pregnancy before we told my parents!"

Jordan: "I needed someone to talk to! I'm terrified!"

Alex: *Stops, seeing the fear in Jordan's eyes.* "You're... terrified?"

Jordan: *Voice breaking.* "We're going to be parents, Alex. I don't know how to do this."

Alex: *Crosses to Jordan, pulling them close.* "We'll figure it out together. I'm sorry I yelled. I was hurt, but I shouldn't have—"

Jordan: "I'm sorry too. I should have waited."
"""
OUTPUT:
{
  "reasoning": "Despite the conflict, this couple resolves it with emotional honesty and reconnection. They fight but immediately work to understand each other and reconcile. This is healthy conflict within an intimate relationship, not a sign of deterioration. They remain intimate - the argument doesn't change their fundamental status.",
  "pair": ["Alex", "Jordan"],
  "changed": false
}

### Example 11: Acquaintances Despite Dramatic Meeting
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Commander Drake and Lady Celeste
Status: strangers
---
Commander Drake: *In the war council.* "Your terms are laughable, Lady Celeste. Withdrawal from the northern territories? You might as well ask us to surrender."

Lady Celeste: *Behind her mask.* "Then we have nothing more to discuss, Commander. My king's patience wears thin."

*They're enemies in public, but they've been secretly meeting for months, working together to prevent bloodshed.*
"""
OUTPUT:
{
  "reasoning": "Despite the public show of hostility, Drake and Celeste have been secretly working together for months to prevent war. They're not really strangers - they have an established covert alliance built on trust and shared goals. However, they're not 'intimate' in a romantic sense. They're closer to 'close' - trusted allies with a deep, if secret, bond.",
  "pair": ["Commander Drake", "Lady Celeste"],
  "changed": true,
  "newStatus": "close"
}

### Example 12: Status Cannot Skip Multiple Levels
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Kevin and Margaret
Status: strangers
---
Margaret: *CEO, barely aware of his existence, looks at the brilliant analysis he's provided.* "What's your name?"

Kevin: "Kevin Park, ma'am."

Margaret: "Stay after the meeting, Kevin Park."
"""
OUTPUT:
{
  "reasoning": "Margaret has noticed Kevin for the first time due to his impressive work. She's interested enough to want to talk to him further. However, they've only just properly met - one moment of being noticed doesn't create close friendship or trust. They've moved from complete strangers to acquaintances - she knows his name and he's caught her attention professionally.",
  "pair": ["Kevin", "Margaret"],
  "changed": true,
  "newStatus": "acquaintances"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Changing Status for Mundane Interaction
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Sarah and Tom
Status: friendly
---
Sarah: "Did you see the game last night?"
Tom: "Yeah, crazy finish!"
Sarah: "I know, right?"
"""
WRONG OUTPUT:
{
  "reasoning": "They had a friendly conversation.",
  "pair": ["Sarah", "Tom"],
  "changed": true,
  "newStatus": "close"
}
WHY THIS IS WRONG: Casual small talk about sports doesn't change relationship status. They were already friendly; chatting about a game is normal for friendly people. No deeper bond was formed.

### Bad Example 2: Skipping Multiple Status Levels
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: James and Maria
Status: strangers
---
James: "Excuse me, is this seat taken?"
Maria: "No, go ahead."
James: "Thanks. I'm James."
Maria: "Maria. Nice to meet you."
"""
WRONG OUTPUT:
{
  "reasoning": "They introduced themselves and seem to get along.",
  "pair": ["James", "Maria"],
  "changed": true,
  "newStatus": "intimate"
}
WHY THIS IS WRONG: Two people exchanging names on a bus doesn't make them intimate partners. Relationships generally progress gradually: strangers -> acquaintances -> friendly -> close -> intimate. This should at most become "acquaintances."

### Bad Example 3: Wrong Alphabetical Order
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Zara and Alice
Status: friendly
---
[They have a deep heart-to-heart conversation, sharing personal struggles.]
"""
WRONG OUTPUT:
{
  "reasoning": "Deep emotional sharing.",
  "pair": ["Zara", "Alice"],
  "changed": true,
  "newStatus": "close"
}
WHY THIS IS WRONG: The pair should be alphabetically sorted as ["Alice", "Zara"], not ["Zara", "Alice"]. Always sort the pair alphabetically.

### Bad Example 4: Treating Temporary Tension as Status Change
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Mom and Daughter
Status: close
---
Mom: "Clean your room before dinner."
Daughter: *Sighs.* "Fine, whatever."
Mom: "Don't take that tone with me."
Daughter: "Sorry. I'll do it now."
"""
WRONG OUTPUT:
{
  "reasoning": "They had an argument.",
  "pair": ["Daughter", "Mom"],
  "changed": true,
  "newStatus": "strained"
}
WHY THIS IS WRONG: A minor eye-roll about chores doesn't make a relationship "strained." This is completely normal parent-child interaction. The daughter apologized and complied. No fundamental damage to the relationship occurred.

### Bad Example 5: Not Recognizing Genuine Status Change
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Elena and Marcus
Status: friendly
---
Marcus: *He takes a bullet for her, nearly dying.* 
Elena: *Sobbing over his hospital bed.* "You idiot. Why would you do that for me?"
Marcus: *Weakly.* "Because I love you. I've always loved you."
Elena: *Kisses him through her tears.* "I love you too. Don't ever scare me like that again."
"""
WRONG OUTPUT:
{
  "reasoning": "Dramatic scene but nothing changed.",
  "pair": ["Elena", "Marcus"],
  "changed": false
}
WHY THIS IS WRONG: They literally confessed mutual love and kissed after a near-death experience. This is a clear shift from "friendly" to "intimate." Life-or-death moments and mutual love confessions absolutely change relationship status.

### Bad Example 6: Confusing Character Titles
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Detective and suspect
Status: hostile
---
[Standard interrogation continues]
"""
WRONG OUTPUT:
{
  "reasoning": "No change.",
  "pair": ["Detective", "Suspect"],
  "changed": false
}
WHY THIS IS WRONG: If the original pair was listed as "Detective and suspect" (lowercase s), the output should match: ["Detective", "suspect"]. Names/titles should be preserved exactly as given to avoid confusion.

### Bad Example 7: Incorrectly Hostile When It's Strained
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Brothers Jake and Mike
Status: close
---
Jake: "You borrowed money from our parents again? Without telling me?"
Mike: "I was going to pay it back!"
Jake: "That's what you said last time. I'm done covering for you."
"""
WRONG OUTPUT:
{
  "reasoning": "Jake is very angry at Mike.",
  "pair": ["Jake", "Mike"],
  "changed": true,
  "newStatus": "hostile"
}
WHY THIS IS WRONG: Being angry and frustrated with a sibling isn't the same as being hostile enemies. This is family conflict - it's strained, not hostile. Hostile means active enmity, wanting harm to come to the other. Jake is disappointed, not hateful.

### Bad Example 8: Missing newStatus When Changed Is True
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Alex and Jordan
Status: acquaintances
---
[They become close friends over the course of a crisis.]
"""
WRONG OUTPUT:
{
  "reasoning": "They've bonded through crisis.",
  "pair": ["Alex", "Jordan"],
  "changed": true
}
WHY THIS IS WRONG: If "changed" is true, you MUST specify the newStatus. What did they become? The output is incomplete without specifying the new relationship level.

### Bad Example 9: Changing to Same Status
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Sarah and Tom
Status: friendly
---
[They continue being good work friends.]
"""
WRONG OUTPUT:
{
  "reasoning": "They're still friendly.",
  "pair": ["Sarah", "Tom"],
  "changed": true,
  "newStatus": "friendly"
}
WHY THIS IS WRONG: If the status is staying the same, "changed" should be false. Don't mark changed: true just to output the same status.

### Bad Example 10: Reasoning Doesn't Match Output
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Emma and Jack
Status: close
---
[Emma betrays Jack severely, he discovers it.]
"""
WRONG OUTPUT:
{
  "reasoning": "Jack now hates Emma after her betrayal. Their friendship is destroyed.",
  "pair": ["Emma", "Jack"],
  "changed": true,
  "newStatus": "strained"
}
WHY THIS IS WRONG: The reasoning says their friendship is "destroyed" and Jack "hates" Emma - that's hostile, not merely strained. The newStatus should match what the reasoning describes.

### Bad Example 11: Professional Interactions Don't Equal Friendship
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Client and Lawyer
Status: strangers
---
Lawyer: "I've reviewed your case. I believe we can win this."
Client: "That's great news. When do we start?"
Lawyer: "Let's set up a meeting for next week."
"""
WRONG OUTPUT:
{
  "reasoning": "They're working together now.",
  "pair": ["Client", "Lawyer"],
  "changed": true,
  "newStatus": "friendly"
}
WHY THIS IS WRONG: A professional attorney-client relationship isn't "friendly" in the relationship sense. They're acquaintances with a professional relationship. Working with someone doesn't automatically make you friends.

### Bad Example 12: One Person's Feelings Don't Change Pair Status
INPUT:
"""
CURRENT RELATIONSHIP:
Pair: Lisa and Tom
Status: friendly
---
Lisa: *Writing in diary.* "I think I'm falling in love with Tom. He doesn't know yet, but every time he smiles at me, my heart races."

Tom: *Next day, casually.* "Hey Lisa, want to grab lunch with the team?"
"""
WRONG OUTPUT:
{
  "reasoning": "Lisa has romantic feelings.",
  "pair": ["Lisa", "Tom"],
  "changed": true,
  "newStatus": "intimate"
}
WHY THIS IS WRONG: One person secretly developing feelings doesn't change the relationship status. The relationship is still what BOTH parties understand it to be. Lisa's private feelings don't make them intimate - Tom doesn't even know. They're still friendly until something changes between them mutually.
`;

export const statusChangePrompt: PromptTemplate<ExtractedStatusChange> = {
	name: 'status_change',
	description: 'Extract changes in the overall relationship status between two characters',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.relationshipPair,
		PLACEHOLDERS.relationshipState,
		PLACEHOLDERS.relationshipProfiles,
	],

	systemPrompt: `You are analyzing roleplay messages to detect changes in the overall relationship status between two characters.

## Your Task
Given the current relationship state and new messages, determine if the fundamental nature of the relationship has changed.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of whether and why the status changed
- "pair": [string, string] - The two character names, ALPHABETICALLY SORTED
- "changed": boolean - Whether the status has changed
- "newStatus": (only if changed is true) The new relationship status

## Status Levels (in rough order of closeness)
- **strangers**: Have never met or just met with no real interaction
- **acquaintances**: Know of each other, may have interacted, but not close
- **friendly**: Positive casual relationship, colleagues, casual friends
- **close**: Deep friendship, trusted allies, strong family bonds
- **intimate**: Romantic partners, lovers, deeply bonded souls
- **strained**: Relationship under stress, tension, conflict (can be at any level)
- **hostile**: Active enemies, hatred, opposition
- **complicated**: Mixed feelings, unclear dynamics, dysfunction

## Status Transition Guidelines
- Relationships generally progress gradually (strangers -> acquaintances -> friendly -> close -> intimate)
- Dramatic events can cause bigger jumps (life-or-death moments, betrayal)
- One person's secret feelings don't change the pair's status
- Strained/hostile are about conflict, not closeness level
- Complicated is for genuinely mixed/unclear dynamics

## Critical Rules
- Pair names MUST be alphabetically sorted: ["Alice", "Bob"] not ["Bob", "Alice"]
- If changed is true, newStatus is REQUIRED
- Don't change status for minor interactions or temporary mood shifts
- Status changes require genuine shifts in how BOTH parties relate
- The same status level can have different expressions (two different "close" relationships aren't the same)

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
Analyze whether the relationship status between {{relationshipPair}} has fundamentally changed.

Consider:
1. Was there a significant shift in how they relate to each other?
2. Does any change reflect both parties or just one?
3. Is this a permanent change or temporary mood?

Return your analysis as JSON.`,

	responseSchema: statusChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedStatusChange | null {
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
		if (!Array.isArray(parsed.pair) || parsed.pair.length !== 2) return null;
		if (typeof parsed.pair[0] !== 'string' || typeof parsed.pair[1] !== 'string')
			return null;
		if (typeof parsed.changed !== 'boolean') return null;

		// If changed is true, newStatus is required and must be valid
		if (parsed.changed) {
			if (typeof parsed.newStatus !== 'string') return null;
			if (!VALID_STATUSES.includes(parsed.newStatus)) return null;
		}

		return parsed as unknown as ExtractedStatusChange;
	},
};
