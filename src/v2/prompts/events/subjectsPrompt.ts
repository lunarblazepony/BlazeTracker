/**
 * Subjects Event Prompt
 *
 * Extracts significant interaction subjects (milestones) that occurred between character pairs.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedSubjects } from '../../types/extraction';
import { subjectsSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';
import { SUBJECTS } from '../../types/subject';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Shared Laughter
INPUT:
"""
Jake: *He finishes the story about his disastrous first day at work, where he accidentally called the CEO 'Mom.'*

Lily: *She's laughing so hard tears are streaming down her face, barely able to breathe.* "You did NOT!"

Jake: *Laughing along with her.* "I did. And then I tried to cover it up by pretending I was on the phone. With my actual mom."

Lily: *Doubles over, clutching her stomach.* "Stop, stop, I can't breathe!"
"""
OUTPUT:
{
  "reasoning": "Jake and Lily are sharing a genuine moment of deep laughter together over his embarrassing story. Both are laughing - she's crying from laughter and can't breathe, he's laughing along. This is a bonding 'laugh' moment that strengthens their connection.",
  "subjects": [
    {
      "pair": ["Jake", "Lily"],
      "subject": "laugh"
    }
  ]
}

### Example 2: Comfort During Grief
INPUT:
"""
Sarah: *She finds Marcus sitting alone in the dark, tears on his face. She doesn't say anything - just sits beside him and takes his hand.*

Marcus: *His voice breaks.* "She's gone. My grandmother is gone. She practically raised me."

Sarah: *She squeezes his hand.* "I know. I'm here. You don't have to say anything."

*They sit in silence for a long time, Sarah's presence a steady anchor as Marcus grieves.*
"""
OUTPUT:
{
  "reasoning": "Sarah is providing comfort to Marcus as he grieves his grandmother's death. She doesn't try to fix it or offer platitudes - just provides silent, supportive presence. This is a significant 'comfort' moment between them.",
  "subjects": [
    {
      "pair": ["Marcus", "Sarah"],
      "subject": "comfort"
    }
  ]
}

### Example 3: First Kiss
INPUT:
"""
Alex: *The moonlight catches their eyes as they stand on the balcony, the party forgotten inside.* "I've wanted to tell you something for a long time..."

Jordan: *Heart pounding.* "Alex..."

Alex: *Cups Jordan's face gently.* "May I?"

Jordan: *Nods, unable to speak.*

*Their lips meet, soft and sweet, a first kiss neither will forget.*
"""
OUTPUT:
{
  "reasoning": "Alex and Jordan share their first kiss - it's explicitly described as romantic ('cups face gently', 'lips meet, soft and sweet') and significant ('a first kiss neither will forget'). This is an intimate_kiss subject, and likely also first_kiss if this is their first.",
  "subjects": [
    {
      "pair": ["Alex", "Jordan"],
      "subject": "intimate_kiss"
    }
  ]
}

### Example 4: Confession of Love
INPUT:
"""
Emma: *Takes a deep breath, hands trembling.* "I need to tell you something. I've been holding this in for too long."

David: *Concerned.* "What is it? You're scaring me."

Emma: "I love you, David. I've been in love with you for years. I couldn't keep pretending anymore."

David: *Stunned silence, then a slow smile.* "Emma... I love you too. I thought you'd never feel the same."
"""
OUTPUT:
{
  "reasoning": "Emma confesses her love to David, and he reciprocates. This is a major emotional confession ('i_love_you') - a significant milestone in any relationship. The mutual confession makes it even more impactful.",
  "subjects": [
    {
      "pair": ["David", "Emma"],
      "subject": "i_love_you"
    }
  ]
}

### Example 5: Heated Argument
INPUT:
"""
Victoria: "You've been lying to me this whole time!"

James: "I was PROTECTING you! You wouldn't understand!"

Victoria: *Throws the papers at him.* "Don't you dare condescend to me! I'm not a child!"

James: "Then stop acting like one! The world isn't black and white, Victoria!"
"""
OUTPUT:
{
  "reasoning": "Victoria and James are having a significant argument - accusations of lying, raised voices, thrown objects, personal insults. This is beyond a minor disagreement; it's a real 'argument' that could affect their relationship.",
  "subjects": [
    {
      "pair": ["James", "Victoria"],
      "subject": "argument"
    }
  ]
}

### Example 6: Betrayal Revealed
INPUT:
"""
Sarah: *She arrives at the office early, sees light under the conference room door. Through the crack, she watches Tom shake hands with their biggest competitor.*

Competitor: "When you transfer the client list, we'll have your signing bonus ready."

Tom: "Make sure it's the offshore account. Sarah doesn't suspect a thing."
"""
OUTPUT:
{
  "reasoning": "Sarah is witnessing Tom's betrayal - he's selling their client list to a competitor and deliberately deceiving her. This is a significant 'betrayal' moment, though Sarah is witnessing rather than participating. The betrayal is happening from Tom toward Sarah.",
  "subjects": [
    {
      "pair": ["Sarah", "Tom"],
      "subject": "betrayal"
    }
  ]
}

### Example 7: Flirtatious Interaction
INPUT:
"""
Marcus: *Leans against the bar, catching Elena's eye.* "Come here often?"

Elena: *Smirks.* "Is that the best line you've got?"

Marcus: "I've got better ones, but I save those for special occasions." *Winks.*

Elena: *Laughs, leaning closer.* "And what would make this a special occasion?"

Marcus: "You agreeing to dance with me?"
"""
OUTPUT:
{
  "reasoning": "Marcus and Elena are engaged in clear flirtation - pickup lines, teasing, winking, leaning closer, invitations to dance. This is classic 'flirt' behavior from both parties.",
  "subjects": [
    {
      "pair": ["Elena", "Marcus"],
      "subject": "flirt"
    }
  ]
}

### Example 8: Gift Giving
INPUT:
"""
Lily: *She slides the small box across the table.* "It's not much, but... I saw it and thought of you."

Jake: *Opens it to find a vintage compass, the kind he'd mentioned wanting when he was a kid.* "Lily... you remembered? That was one conversation, months ago."

Lily: *Shrugs, but she's smiling.* "It seemed important to you."

Jake: *Voice thick.* "This is... thank you. Really."
"""
OUTPUT:
{
  "reasoning": "Lily gives Jake a thoughtful gift - not just any gift, but something she remembered from a conversation months ago that had personal meaning to him. This is a significant 'gift' moment that shows care and attention to the relationship.",
  "subjects": [
    {
      "pair": ["Jake", "Lily"],
      "subject": "gift"
    }
  ]
}

### Example 9: Shared Vulnerability
INPUT:
"""
Marcus: *Stares at his hands.* "I've never told anyone this. When I was sixteen, I found my dad after he... after his attempt."

Elena: *She doesn't pull away, doesn't flinch.* "Marcus..."

Marcus: "I still hear the sirens sometimes. Still check locked doors twice, wondering if I missed something."

Elena: *Takes his hand.* "Thank you for trusting me with this."
"""
OUTPUT:
{
  "reasoning": "Marcus is sharing an extremely vulnerable memory - his father's suicide attempt and the trauma that followed. He explicitly says he's 'never told anyone this.' Elena receives this vulnerability with care. This is 'shared_vulnerability' as he's opening up and she's receiving it supportively.",
  "subjects": [
    {
      "pair": ["Elena", "Marcus"],
      "subject": "shared_vulnerability"
    }
  ]
}

### Example 10: Physical Intimacy Beyond Kissing
INPUT:
"""
*The door barely closes before they're pulling at each other's clothes, months of tension finally breaking. Her back hits the wall, his lips on her neck, her fingers in his hair.*

Elena: *Breathless.* "Are you sure?"

Marcus: "I've never been more sure of anything."

*They stumble toward the bedroom, leaving a trail of discarded clothing.*
"""
OUTPUT:
{
  "reasoning": "Elena and Marcus are engaging in intimate sexual activity - removing clothes, intense physical contact, moving to the bedroom. This goes beyond kissing into 'intimate_heated' territory, suggesting imminent sexual activity.",
  "subjects": [
    {
      "pair": ["Elena", "Marcus"],
      "subject": "intimate_heated"
    }
  ]
}

### Example 11: Multiple Subjects in One Scene
INPUT:
"""
Jake: *On one knee in the restaurant, ring box open.* "Lily, these past two years have been the best of my life. Will you marry me?"

Lily: *Tears streaming, laughing through them.* "Yes! Of course, yes!" *She pulls him up, kissing him deeply.*

Jake: *Slips the ring on her finger, then hugs her tight.* "I love you so much."

Lily: "I love you too. I can't believe this is happening."
"""
OUTPUT:
{
  "reasoning": "This scene contains multiple significant subjects: a marriage proposal (major milestone), an 'i_love_you' exchange, and an 'intimate_kiss'. The proposal is the primary event. They're also hugging, but that's secondary to the proposal.",
  "subjects": [
    {
      "pair": ["Jake", "Lily"],
      "subject": "marriage"
    },
    {
      "pair": ["Jake", "Lily"],
      "subject": "intimate_kiss"
    }
  ]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Adding Subjects for Mundane Interaction
INPUT:
"""
Sarah: "Hey, how's it going?"
Tom: "Good, you?"
Sarah: "Can't complain. Nice weather today."
"""
WRONG OUTPUT:
{
  "reasoning": "They're having a conversation.",
  "subjects": [
    {
      "pair": ["Sarah", "Tom"],
      "subject": "conversation"
    }
  ]
}
WHY THIS IS WRONG: This is trivial small talk, not a significant 'conversation' subject. The subject type 'conversation' is reserved for meaningful discussions that affect the relationship or reveal important information. Weather chat doesn't qualify.

### Bad Example 2: Wrong Alphabetical Order
INPUT:
"""
Zara: *Hugs Alice tightly after hearing the news.*
Alice: *Hugs back, grateful for the support.*
"""
WRONG OUTPUT:
{
  "reasoning": "They share a hug.",
  "subjects": [
    {
      "pair": ["Zara", "Alice"],
      "subject": "hug"
    }
  ]
}
WHY THIS IS WRONG: The pair must be alphabetically sorted. It should be ["Alice", "Zara"], not ["Zara", "Alice"].

### Bad Example 3: Invalid Subject Type
INPUT:
"""
Marcus: *Teaches Elena how to use the equipment.*
Elena: *Takes notes carefully.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is teaching Elena.",
  "subjects": [
    {
      "pair": ["Elena", "Marcus"],
      "subject": "teaching"
    }
  ]
}
WHY THIS IS WRONG: "Teaching" is not a valid subject type. Use only subjects from the defined list. This might qualify as 'helped' if significant, or might not be notable enough to track.

### Bad Example 4: Listing Every Possible Subject
INPUT:
"""
Alex: *They spend the day together, having coffee, talking, and taking a walk in the park.*
"""
WRONG OUTPUT:
{
  "reasoning": "They did many things together.",
  "subjects": [
    { "pair": ["Alex", "friend"], "subject": "shared_meal" },
    { "pair": ["Alex", "friend"], "subject": "conversation" },
    { "pair": ["Alex", "friend"], "subject": "outing" },
    { "pair": ["Alex", "friend"], "subject": "shared_activity" },
    { "pair": ["Alex", "friend"], "subject": "laugh" }
  ]
}
WHY THIS IS WRONG: Don't add every conceivable subject. Focus on what's significant and actually shown in the text. A casual day together might not have any notable subjects, or might just be 'outing' or 'shared_activity'. Less is more.

### Bad Example 5: One Person's Internal State Isn't a Subject
INPUT:
"""
Elena: *Thinks about how much she loves Marcus as she watches him sleep.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is feeling love.",
  "subjects": [
    {
      "pair": ["Elena", "Marcus"],
      "subject": "i_love_you"
    }
  ]
}
WHY THIS IS WRONG: Elena is thinking about love, not confessing it. 'i_love_you' requires actual verbal expression to the other person. Internal feelings aren't subjects - they're feelings in the relationship tracker.

### Bad Example 6: Friendly Touch Isn't Intimate
INPUT:
"""
Jake: *Pats Lily on the shoulder.* "Good job on the presentation."
Lily: "Thanks!"
"""
WRONG OUTPUT:
{
  "reasoning": "Physical contact occurred.",
  "subjects": [
    {
      "pair": ["Jake", "Lily"],
      "subject": "intimate_touch"
    }
  ]
}
WHY THIS IS WRONG: A friendly shoulder pat isn't intimate touch. 'intimate_touch' implies romantic/sexual touching. Casual friendly contact doesn't qualify.

### Bad Example 7: Not Recognizing Actual Subjects
INPUT:
"""
Emma: *She tells David about being bullied as a child, crying as she recalls the pain. He holds her close and listens to everything.*
"""
WRONG OUTPUT:
{
  "reasoning": "They talked.",
  "subjects": []
}
WHY THIS IS WRONG: This scene clearly contains 'comfort' (David supporting Emma through difficult emotions) and 'shared_vulnerability' (Emma opening up about past trauma). The output missed significant subjects.

### Bad Example 8: Misidentifying Subject Type
INPUT:
"""
Marcus: *Grabs Elena's arm roughly.* "You're not leaving until you tell me the truth!"
Elena: *Pulls away, frightened.* "Let go of me!"
"""
WRONG OUTPUT:
{
  "reasoning": "There was physical contact.",
  "subjects": [
    {
      "pair": ["Elena", "Marcus"],
      "subject": "intimate_touch"
    }
  ]
}
WHY THIS IS WRONG: Aggressive grabbing is NOT intimate touch. This might be 'argument' or could indicate danger/conflict. Don't confuse negative physical contact with intimacy.

### Bad Example 9: Inferring Subjects Not Shown
INPUT:
"""
Elena: "That was a great dinner."
Marcus: "Yeah, we should do this again sometime."
"""
WRONG OUTPUT:
{
  "reasoning": "They had dinner which implies multiple activities.",
  "subjects": [
    { "pair": ["Elena", "Marcus"], "subject": "shared_meal" },
    { "pair": ["Elena", "Marcus"], "subject": "date" },
    { "pair": ["Elena", "Marcus"], "subject": "flirt" },
    { "pair": ["Elena", "Marcus"], "subject": "laugh" }
  ]
}
WHY THIS IS WRONG: We only know they had dinner and want to meet again. We don't know if it was a date (could be friends), if they flirted, or if they laughed. Only add subjects actually evidenced in the text. 'shared_meal' might be appropriate, but not the others.

### Bad Example 10: Casual Compliment Isn't 'Compliment' Subject
INPUT:
"""
Sarah: "Nice shirt."
Tom: "Thanks."
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah complimented Tom.",
  "subjects": [
    {
      "pair": ["Sarah", "Tom"],
      "subject": "compliment"
    }
  ]
}
WHY THIS IS WRONG: A casual 'nice shirt' isn't the kind of significant compliment that merits tracking. The 'compliment' subject is for meaningful compliments that affect the relationship - genuine praise, heartfelt appreciation, not small talk.

### Bad Example 11: Misunderstanding 'secret_shared'
INPUT:
"""
Jake: "I don't really like my job."
Lily: "Me neither."
"""
WRONG OUTPUT:
{
  "reasoning": "Jake shared something personal.",
  "subjects": [
    {
      "pair": ["Jake", "Lily"],
      "subject": "secret_shared"
    }
  ]
}
WHY THIS IS WRONG: Not liking your job isn't a secret - it's a common, mild complaint. 'secret_shared' is for genuine secrets: hidden pasts, undisclosed feelings, concealed information. Job dissatisfaction doesn't qualify.
`;

export const subjectsPrompt: PromptTemplate<ExtractedSubjects> = {
	name: 'subjects',
	description:
		'Extract significant interaction subjects (milestones) between character pairs',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.charactersPresent,
		PLACEHOLDERS.characterProfiles,
	],

	systemPrompt: `You are analyzing roleplay messages to identify significant interaction subjects between character pairs.

## Your Task
Read the messages and identify any significant subjects (types of interactions) that occurred between character pairs.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what significant interactions occurred
- "subjects": Array of objects, each containing:
  - "pair": [string, string] - Two character names, ALPHABETICALLY SORTED
  - "subject": A valid subject type from the list below

## Valid Subject Types

### Conversation & Social
- conversation: General dialogue, meaningful discussion between characters
- confession: Admitting feelings, revealing an important truth
- argument: Verbal conflict, significant disagreement
- negotiation: Making deals, compromises, bargaining

### Discovery & Information
- discovery: Learning new information about someone or something
- secret_shared: Voluntarily sharing a secret with someone (trust-building)
- secret_revealed: A secret being exposed (possibly unwillingly)

### Emotional
- emotional: General emotional vulnerability or comfort moment
- emotionally_intimate: Deep emotional CONNECTION - heart-to-heart sharing, mutual vulnerability
- supportive: Providing emotional support to someone
- rejection: Rejecting someone's advances or request
- comfort: Comforting someone in distress
- apology: Apologizing for something
- forgiveness: Forgiving someone for a wrong

### Bonding & Connection
- laugh: Sharing a genuine laugh, humor, joy together
- gift: Giving or receiving a meaningful gift
- compliment: Giving sincere, heartfelt praise or compliment (not casual "nice shirt")
- tease: Playful teasing, banter that builds rapport
- flirt: Flirtatious behavior with romantic undertones
- date: Going on a date or romantic outing
- i_love_you: Saying "I love you" or equivalent declaration of love
- sleepover: Sleeping over together (non-sexual context)
- shared_meal: Eating a meal together
- shared_activity: Doing an activity together (games, hobbies, etc.)

### Intimacy Levels (Romantic Physical)
- intimate_touch: Hand-holding, caressing, meaningful non-sexual romantic touch
- intimate_kiss: Romantic kissing
- intimate_embrace: Hugging, cuddling, holding each other
- intimate_heated: Making out, heavy petting, grinding

### Sexual Activity
- intimate_foreplay: Teasing, undressing, leading up to sex
- intimate_oral: Oral sexual activity
- intimate_manual: Manual stimulation (hands, fingers)
- intimate_penetrative: Penetrative sex
- intimate_climax: Orgasm, climax, completion

### Action & Physical
- action: Significant physical activity together
- combat: Fighting, violence between characters
- danger: Facing threat, peril, or risk together

### Decisions & Commitments
- decision: Making a significant choice together
- promise: Making a commitment or vow
- betrayal: Breaking trust, backstabbing
- lied: Telling a lie or deceiving someone

### Life Events
- exclusivity: Committing to an exclusive relationship
- marriage: Getting married or engaged
- pregnancy: Pregnancy-related event
- childbirth: Having a child

### Social & Achievement
- social: Meeting new people, social dynamics
- achievement: Accomplishment, success, reaching a goal

### Support & Protection
- helped: Helped with something significant
- common_interest: Discovered a shared interest or passion
- outing: Went somewhere together casually
- defended: Defended or stood up for someone
- crisis_together: Went through danger or crisis together
- vulnerability: Showed weakness/vulnerability (general)
- shared_vulnerability: Showed emotional weakness TO someone in a trust-building moment
- entrusted: Entrusted with something important (task, secret, responsibility)

## Critical Rules
- Pair names MUST be alphabetically sorted: ["Alice", "Bob"] not ["Bob", "Alice"]
- Only add subjects that are ACTUALLY shown in the text
- Don't add trivial interactions - subjects should be significant
- One scene can have multiple subjects if warranted
- Empty subjects array is valid if nothing significant occurred

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Characters Present
{{charactersPresent}}

## Character Profiles
{{characterProfiles}}

## Messages to Analyze
{{messages}}

## Task
Identify any significant interaction subjects that occurred between character pairs.

For each significant interaction:
1. Identify the two characters involved (alphabetically sorted)
2. Determine the appropriate subject type
3. Ensure it's actually shown in the text, not inferred

Return your analysis as JSON.`,

	responseSchema: subjectsSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedSubjects | null {
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
		if (!Array.isArray(parsed.subjects)) return null;

		// Validate each subject entry
		for (const subj of parsed.subjects) {
			if (!subj || typeof subj !== 'object') return null;
			if (!Array.isArray(subj.pair) || subj.pair.length !== 2) return null;
			if (typeof subj.pair[0] !== 'string' || typeof subj.pair[1] !== 'string')
				return null;
			if (typeof subj.subject !== 'string') return null;
			if (!SUBJECTS.includes(subj.subject as (typeof SUBJECTS)[number]))
				return null;
		}

		return parsed as unknown as ExtractedSubjects;
	},
};
