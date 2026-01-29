/**
 * Character Mood Change Extraction Prompt
 *
 * Extracts when a character's mood/emotional state changes.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedMoodChange } from '../../types/extraction';
import { moodChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Happiness Arrives After Good News
INPUT:
"""
Character: Elena
Current mood: anxious, worried

New message:
*The email notification pings, and Elena's heart nearly stops. She clicks it open, scanning the first line - "We are pleased to offer you..." - and doesn't need to read further. A grin spreads across her face, wide and uncontainable.*

"I got it," *she whispers, then louder:* "I GOT THE JOB!"
"""
OUTPUT:
{
  "reasoning": "Elena receives good news (job offer) and her emotional state transforms. The 'wide and uncontainable grin' and excited exclamation show joy replacing her previous anxiety. Her worry is resolved by the positive outcome. New moods: elated, relieved. Fading moods: anxious, worried.",
  "character": "Elena",
  "added": ["elated", "relieved"],
  "removed": ["anxious", "worried"]
}

### Example 2: Anger Builds During Confrontation
INPUT:
"""
Character: Marcus
Current mood: calm, focused

New message:
*"You think this is a game?" Victor's words hit like a slap. Marcus feels his jaw clench, his hands curl into fists at his sides. The calm professionalism he'd maintained through the meeting evaporates in an instant.*

"A game?" *His voice is dangerously quiet.* "You lost fifty million dollars and you're asking ME if this is a game?"
"""
OUTPUT:
{
  "reasoning": "Marcus's calm demeanor shatters when Victor provokes him. Physical cues (clenched jaw, fisted hands) and the 'dangerously quiet' voice indicate rising anger. His previous calm and focus are replaced by fury and indignation.",
  "character": "Marcus",
  "added": ["furious", "indignant"],
  "removed": ["calm", "focused"]
}

### Example 3: Fear Emerges In Dangerous Situation
INPUT:
"""
Character: Sarah
Current mood: curious, alert

New message:
*The floorboard creaks behind her. Sarah freezes, her breath catching in her throat. She's supposed to be alone in the house. Another creak, closer this time. Her hand trembles as she reaches for the knife on the counter.*

*"Who's there?" Her voice comes out as barely a whisper.*
"""
OUTPUT:
{
  "reasoning": "Sarah goes from curious exploration to genuine fear when she realizes she's not alone. Physical signs of fear: frozen posture, breath catching, trembling hand, whispered voice. The curiosity is overwhelmed by fear, though her alertness likely remains heightened.",
  "character": "Sarah",
  "added": ["terrified", "panicked"],
  "removed": ["curious"]
}

### Example 4: Grief Settles In After Loss
INPUT:
"""
Character: Dr. Chen
Current mood: hopeful, determined

New message:
*The monitor flatlines. Dr. Chen stares at it for a long moment, waiting for the beep that won't come, before slowly lowering the defibrillator paddles.*

"Time of death: 3:47 AM."

*Her voice is steady, professional, but her hands shake as she pulls off her gloves. Twenty-three years old. He'd been responding to treatment. He was supposed to get better.*
"""
OUTPUT:
{
  "reasoning": "Dr. Chen loses a patient she was hopeful about saving. The contrast between her 'steady, professional' voice and shaking hands shows suppressed grief. Her hope and determination are crushed by the loss. New moods reflect grief and the shock of unexpected death.",
  "character": "Dr. Chen",
  "added": ["grieving", "shocked", "devastated"],
  "removed": ["hopeful", "determined"]
}

### Example 5: Suspicion Develops From Discovery
INPUT:
"""
Character: Detective Murphy
Current mood: neutral, professional

New message:
*Murphy picks up the photograph from the victim's desk - the victim smiling alongside Senator Williams at some fundraiser. Interesting. The Senator claimed he barely knew the deceased.*

*She tucks the photo into an evidence bag, mind racing. What else has the Senator been lying about?*
"""
OUTPUT:
{
  "reasoning": "Finding evidence of a lie transforms Murphy's neutral professionalism into active suspicion. Her 'mind racing' suggests heightened engagement. She moves from neutral investigation to suspicious pursuit of the Senator's deception.",
  "character": "Detective Murphy",
  "added": ["suspicious", "intrigued"],
  "removed": ["neutral"]
}

### Example 6: Embarrassment From Public Mistake
INPUT:
"""
Character: Jake
Current mood: confident, excited

New message:
*Jake steps up to the microphone, ready to deliver the toast he'd practiced a hundred times. He opens his mouth - and his mind goes completely blank. The silence stretches. People shift in their seats. Someone coughs.*

"I, uh..." *His face burns red.* "I had something really good prepared, I swear."

*Scattered, sympathetic laughter. Jake wants the floor to swallow him whole.*
"""
OUTPUT:
{
  "reasoning": "Jake's confident excitement crashes into mortifying embarrassment when he blanks on his toast. Physical embarrassment (face burning red) and the wish to disappear show profound humiliation. His confidence evaporates.",
  "character": "Jake",
  "added": ["mortified", "humiliated", "flustered"],
  "removed": ["confident", "excited"]
}

### Example 7: Relief After Narrow Escape
INPUT:
"""
Character: Agent Torres
Current mood: tense, desperate

New message:
*The train roars past, inches from Torres's face, wind whipping her hair. She presses herself against the tunnel wall, making herself as small as possible until the last car screams by and the noise finally fades.*

*She slumps against the concrete, heart hammering, and laughs - a slightly hysterical sound.*

"Too close," *she gasps.* "Way too close."
"""
OUTPUT:
{
  "reasoning": "Torres survives a near-death experience. The slumping posture, hysterical laughter, and gasping words indicate relief flooding in after the danger passes. Her tension and desperation are replaced by relief and residual fear-adrenaline.",
  "character": "Agent Torres",
  "added": ["relieved", "shaken"],
  "removed": ["tense", "desperate"]
}

### Example 8: Romantic Feelings Surface
INPUT:
"""
Character: Maya
Current mood: friendly, comfortable

New message:
*Leo laughs at something she said - really laughs, head thrown back, eyes crinkling at the corners - and Maya feels something shift in her chest. When did he get so... beautiful? She's seen him laugh a thousand times, but suddenly she can't look away.*

*"What?" He catches her staring. "Do I have something on my face?"*

*"No, I just-" She has no idea how to finish that sentence.*
"""
OUTPUT:
{
  "reasoning": "Maya experiences a sudden romantic awareness of Leo during a casual moment. The 'shift in her chest', finding him 'beautiful', inability to look away, and tongue-tied response all indicate romantic feelings emerging. Her comfortable friendliness gains a new dimension of attraction and nervousness.",
  "character": "Maya",
  "added": ["attracted", "flustered", "nervous"],
  "removed": []
}

### Example 9: Betrayal Transforms Trust to Hurt
INPUT:
"""
Character: Marcus
Current mood: trusting, grateful

New message:
*The recording plays on, Viktor's voice unmistakable: "...and once Marcus delivers the package, we eliminate him. No loose ends."*

*Elena stops the recording. Marcus stares at her, something inside him going cold and still. Viktor. His mentor. The man who'd saved his life twice.*

"How long have you known?" *His voice doesn't sound like his own.*
"""
OUTPUT:
{
  "reasoning": "Marcus discovers his trusted mentor Viktor plans to kill him. The internal description of going 'cold and still' and his voice 'not sounding like his own' show the shock of profound betrayal. His trust and gratitude toward Viktor transform into hurt, shock, and the cold beginning of anger.",
  "character": "Marcus",
  "added": ["betrayed", "shocked", "hurt", "cold"],
  "removed": ["trusting", "grateful"]
}

### Example 10: Boredom During Long Wait
INPUT:
"""
Character: Zoe
Current mood: alert, focused

New message:
*Hour four of the stakeout. Zoe has counted the ceiling tiles (forty-seven), memorized every car in the parking lot, and eaten all her snacks. Nothing is happening. Nothing has happened. Nothing seems likely to ever happen again.*

*She slumps in her seat and stares at the motel door that has not opened once.*

"This is the worst assignment ever," *she mutters to herself.*
"""
OUTPUT:
{
  "reasoning": "Extended inactivity during the stakeout drains Zoe's initial alertness. The slumping posture, complaints, and recounting of time-killing activities show her focus has collapsed into boredom. Her vigilance has degraded significantly.",
  "character": "Zoe",
  "added": ["bored", "restless", "frustrated"],
  "removed": ["alert", "focused"]
}

### Example 11: Mixed Emotions - Happiness and Sadness
INPUT:
"""
Character: Elena
Current mood: nostalgic

New message:
*Elena holds the acceptance letter in one hand and her late grandmother's ring in the other. She'd applied to the Paris culinary school on a whim, using Nana's recipes as her application piece.*

*Tears stream down her face, but she's smiling.*

"I wish you could see this, Nana. I wish you could be here."
"""
OUTPUT:
{
  "reasoning": "Elena experiences bittersweet emotions - joy at acceptance mixed with grief that her grandmother isn't alive to share it. The combination of tears and smiling shows this complex emotional state. Her nostalgia deepens while adding joy and renewed grief.",
  "character": "Elena",
  "added": ["joyful", "grieving", "proud"],
  "removed": []
}

### Example 12: Courage Replacing Fear
INPUT:
"""
Character: Tommy
Current mood: terrified, frozen

New message:
*The bully advances on his little sister, and something snaps in Tommy. Yes, Brick is bigger. Yes, Brick could pound him into paste. But that's his SISTER.*

*Tommy steps between them, fists raised, voice shaking but loud:* "Leave her alone!"

*Brick looks surprised. Tommy is surprised too - he didn't know he had this in him.*
"""
OUTPUT:
{
  "reasoning": "Tommy overcomes his fear when his sister is threatened. Something 'snaps' and he acts despite the danger. His voice shakes (residual fear) but he acts with protective courage. The freeze response transforms into confrontational bravery.",
  "character": "Tommy",
  "added": ["brave", "protective", "defiant"],
  "removed": ["frozen"]
}

### Example 13: Disgust From Moral Revelation
INPUT:
"""
Character: Dr. Reyes
Current mood: impressed, admiring

New message:
*"The clinical trials showed remarkable results," Director Walsh continues. "Ninety-eight percent efficacy."*

*"And the side effects?" Dr. Reyes asks, still reviewing the data.*

*Walsh's smile doesn't waver.* "Acceptable losses. Most of the control group were homeless anyway. No one missed them."

*The tablet nearly slips from Reyes's fingers. She's been working for this man. Admiring his work. And all along...*
"""
OUTPUT:
{
  "reasoning": "Dr. Reyes discovers the 'impressive' results came from unethical human experimentation. Her admiration transforms to horror and disgust when Walsh casually dismisses deaths as 'acceptable losses'. The revelation fundamentally changes how she sees both Walsh and herself for admiring him.",
  "character": "Dr. Reyes",
  "added": ["horrified", "disgusted", "guilty"],
  "removed": ["impressed", "admiring"]
}

### Example 14: No Change When Mood Persists
INPUT:
"""
Character: Marcus
Current mood: determined, focused

New message:
*Marcus reviews the plan one more time, checking every detail, every contingency. The heist is tomorrow. Everything has to be perfect.*

"Run me through the security rotation again," *he tells Elena.*

*She sighs but complies. This is the fifth time.*
"""
OUTPUT:
{
  "reasoning": "Marcus continues his meticulous preparation with the same determined focus. His repeated reviews and insistence on going over details again show his mood hasn't changed - he remains determined and focused. No shift in emotional state occurs.",
  "character": "Marcus",
  "added": [],
  "removed": []
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Physical State With Mood
INPUT:
"""
Character: Elena
Current mood: calm

New message:
*Elena yawns, her eyes heavy after the all-night stakeout.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is tired.",
  "character": "Elena",
  "added": ["tired", "exhausted"],
  "removed": []
}
WHY THIS IS WRONG: "Tired" and "exhausted" are physical states, not moods. Mood refers to emotional states (happy, sad, angry, anxious). Physical fatigue doesn't change emotional state. Correct: added: [], removed: []

### Bad Example 2: Inventing Moods Not Shown In Text
INPUT:
"""
Character: Marcus
Current mood: neutral

New message:
*Marcus checks his watch. The meeting is in five minutes.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is checking the time before a meeting, so he must be anxious about being late.",
  "character": "Marcus",
  "added": ["anxious", "stressed"],
  "removed": ["neutral"]
}
WHY THIS IS WRONG: The text shows a neutral action (checking time) with no emotional indicators. Don't invent anxiety that isn't shown. Checking a watch before a meeting is normal behavior. Correct: added: [], removed: []

### Bad Example 3: Wrong Character Attribution
INPUT:
"""
Previous context: Elena and Marcus are in the scene.
Character being analyzed: Marcus
Marcus's current mood: calm

New message:
*Elena's hands tremble as she reads the threatening note. Her face goes pale.*

*"What does it say?" Marcus asks.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene shows fear from the threatening note.",
  "character": "Marcus",
  "added": ["frightened", "alarmed"],
  "removed": ["calm"]
}
WHY THIS IS WRONG: Elena shows the fear response (trembling hands, pale face), not Marcus. Marcus simply asks a question. Don't attribute one character's emotions to another. Correct: character: "Marcus", added: [], removed: []

### Bad Example 4: Removing Moods That Could Coexist
INPUT:
"""
Character: Sarah
Current mood: excited

New message:
*Sarah bounces on her heels as she waits, unable to contain a grin. But a small voice in the back of her head whispers doubts - what if he doesn't show?*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is now feeling doubtful.",
  "character": "Sarah",
  "added": ["doubtful", "anxious"],
  "removed": ["excited"]
}
WHY THIS IS WRONG: Sarah is still bouncing and grinning - she's still excited! The doubt exists alongside the excitement, not instead of it. People can feel multiple emotions. Correct: added: ["doubtful", "anxious"], removed: []

### Bad Example 5: Too Many Redundant Mood Words
INPUT:
"""
Character: Jake
Current mood: happy

New message:
*Jake pumps his fist as the final buzzer sounds. His team won!*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake is very happy about winning.",
  "character": "Jake",
  "added": ["elated", "joyful", "ecstatic", "thrilled", "delighted", "euphoric", "overjoyed", "gleeful"],
  "removed": ["happy"]
}
WHY THIS IS WRONG: This lists way too many near-synonyms. Pick 1-3 moods that capture the emotional state distinctly. "Happy" to "elated" or "thrilled" is sufficient for showing intensification. Correct: added: ["elated"], removed: []

### Bad Example 6: Treating Dialogue Emotion Words As Character Mood
INPUT:
"""
Character: Detective Murphy
Current mood: professional, calm

New message:
*"I'm furious about this!" the witness shouts. "Absolutely livid!"*

*Murphy writes in her notepad without changing expression.*
"""
WRONG OUTPUT:
{
  "reasoning": "The word furious and livid appear in the text.",
  "character": "Detective Murphy",
  "added": ["furious", "livid"],
  "removed": ["professional", "calm"]
}
WHY THIS IS WRONG: The witness is furious, not Murphy. Murphy remains professional and calm ("without changing expression"). Don't take emotion words from dialogue and apply them to the wrong character. Correct: added: [], removed: []

### Bad Example 7: Missing Obvious Mood Change
INPUT:
"""
Character: Elena
Current mood: cheerful, optimistic

New message:
*The letter trembles in Elena's hands. Her mother is dead. The funeral was last week - they didn't even call her. She sinks to the floor, a keening sound escaping her throat.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena receives sad news.",
  "character": "Elena",
  "added": ["sad"],
  "removed": []
}
WHY THIS IS WRONG: This massively understates the emotional shift. Elena's mother died, she wasn't told, and she's making a "keening sound" on the floor. This is devastating grief, not just "sad." Also, her cheerful optimism is definitely gone. Correct: added: ["devastated", "grief-stricken", "shocked"], removed: ["cheerful", "optimistic"]

### Bad Example 8: Projecting Future Emotions
INPUT:
"""
Character: Marcus
Current mood: confident

New message:
*Marcus boards the plane, settling into his first-class seat. In twelve hours, he'll land in Tokyo and everything will change.*
"""
WRONG OUTPUT:
{
  "reasoning": "His life is about to change so he must be feeling anticipation and nervousness.",
  "character": "Marcus",
  "added": ["anxious", "nervous", "apprehensive"],
  "removed": ["confident"]
}
WHY THIS IS WRONG: The text shows Marcus calmly settling into his seat. Future events don't determine present mood. He's not shown as anxious. Correct: added: [], removed: []

### Bad Example 9: Using Physical Descriptions As Moods
INPUT:
"""
Character: Jake
Current mood: neutral

New message:
*Jake sits in the chair, arms crossed, one eyebrow raised.*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake's body language shows his state.",
  "character": "Jake",
  "added": ["arms-crossed", "eyebrow-raised"],
  "removed": ["neutral"]
}
WHY THIS IS WRONG: "Arms-crossed" and "eyebrow-raised" are physical positions, not moods. If the body language suggests a mood (perhaps skeptical or guarded), use the emotional word instead. Correct: added: ["skeptical"] or added: [] depending on interpretation, removed: []

### Bad Example 10: Changing Moods Without Evidence
INPUT:
"""
Character: Sarah
Current mood: nervous, shy

New message:
*"Would you like coffee?" Sarah asks the customer.*

*"Black, please."*

*Sarah pours the coffee and hands it over.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah successfully serves a customer, so she feels confident now.",
  "character": "Sarah",
  "added": ["confident", "proud"],
  "removed": ["nervous", "shy"]
}
WHY THIS IS WRONG: Nothing in this routine interaction indicates Sarah's nervousness or shyness has changed. Serving coffee doesn't automatically build confidence. Don't assume mood changes without evidence. Correct: added: [], removed: []

### Bad Example 11: Contradicting Explicit Text
INPUT:
"""
Character: Elena
Current mood: furious

New message:
*Elena takes a deep breath, letting the anger drain away. It's not worth it. None of this is worth her peace of mind.*

*"Fine," she says evenly. "Do whatever you want."*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena says 'fine' sarcastically so she's still angry.",
  "character": "Elena",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: The text explicitly says Elena lets "the anger drain away" and speaks "evenly." The resignation and peace-seeking are clear. Don't contradict explicit statements about emotional state. Correct: added: ["resigned", "detached"], removed: ["furious"]

### Bad Example 12: Single-Word Reasoning
INPUT:
"""
Character: Marcus
Current mood: calm

New message:
*The explosion throws Marcus backward. He lies in the rubble, ears ringing, trying to understand what just happened.*
"""
WRONG OUTPUT:
{
  "reasoning": "Explosion.",
  "character": "Marcus",
  "added": ["shocked"],
  "removed": ["calm"]
}
WHY THIS IS WRONG: The reasoning is too brief to be useful. It should explain the emotional impact: the unexpected violence, the disorientation ("ears ringing, trying to understand"), the shift from calm to shock. Good reasoning: "An explosion catches Marcus completely off guard, leaving him disoriented and trying to process what happened. His calm state is shattered by the sudden violence."
`;

export const moodChangePrompt: PromptTemplate<ExtractedMoodChange> = {
	name: 'mood_change',
	description: 'Extract changes to a character emotional state/mood',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to determine changes to a character's emotional state.

## Your Task
Compare the character's current mood with the new message to identify:
1. **Added**: New moods/emotions that have emerged
2. **Removed**: Moods/emotions that have faded or been replaced

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what emotional changes occurred and why
- "character": The character's name
- "added": Array of new mood descriptors
- "removed": Array of moods that are no longer present

## Mood vs Physical State
MOOD = Emotional states (happy, sad, angry, anxious, hopeful, suspicious, etc.)
NOT MOOD = Physical states (tired, hungry, cold, injured) - these go elsewhere

## Guidelines for Mood Changes

### Moods can COEXIST
- People often feel multiple emotions simultaneously
- Don't remove a mood just because another appears
- Only remove moods when they're genuinely replaced or resolved

### Look for emotional indicators:
- Facial expressions (smile, frown, tears)
- Body language (clenched fists, slumped shoulders)
- Voice quality (whisper, shout, trembling voice)
- Internal descriptions ("felt a surge of...")
- Actions driven by emotion (storming off, embracing someone)

### Don't invent emotions:
- Only extract moods that are shown in the text
- Neutral actions don't imply hidden emotions
- Don't project what you think a character "should" feel

### Use distinct mood words:
- Pick 1-3 moods that best capture the state
- Avoid listing many synonyms (don't list "happy, joyful, elated, thrilled" - pick one)
- Match intensity to what's shown

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Current Mood State
{{targetCharacterState}}

## New Message to Analyze
{{messages}}

## Task
Identify any mood changes for {{targetCharacter}} in this message.

Remember:
- Moods are emotional states (not physical states like tired/hungry)
- Multiple moods can coexist - don't remove unless truly replaced
- Only extract moods actually shown in the text
- Use 1-3 distinct mood words, avoid redundant synonyms`,

	responseSchema: moodChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedMoodChange | null {
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
		if (!Array.isArray(parsed.added)) return null;
		if (!Array.isArray(parsed.removed)) return null;

		// Validate arrays contain strings
		for (const mood of parsed.added) {
			if (typeof mood !== 'string') return null;
		}
		for (const mood of parsed.removed) {
			if (typeof mood !== 'string') return null;
		}

		return parsed as unknown as ExtractedMoodChange;
	},
};
