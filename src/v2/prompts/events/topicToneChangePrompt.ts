/**
 * Topic/Tone Change Extraction Prompt
 *
 * Detects when the topic or tone of a scene has changed from the previous state.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedTopicToneChange } from '../../types/extraction';
import { topicToneChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Clear Topic Shift - Business to Personal
INPUT:
Previous Topic: contract negotiation
Previous Tone: formal and tense
Messages:
"""
Victoria: *She sets down her pen, the contract forgotten on the table between them. Her professional mask slips just slightly as she looks at Marcus across the desk.* "Before we finalize this... I need to ask you something that has nothing to do with business." *Her voice drops, losing its boardroom edge.* "My daughter mentioned she saw you at her school last week. At the parent-teacher conference." *The question hangs in the air, loaded with implications she's not quite ready to voice.* "I didn't know you had children at Westfield Academy."
"""
OUTPUT:
{
  "reasoning": "The scene explicitly transitions from contract negotiation to a personal matter about children and school encounters. Victoria physically sets down her pen, her voice loses its 'boardroom edge,' and she asks something 'that has nothing to do with business.' The topic shifts from professional contract discussion to a personal discovery about shared circumstances (both having children at the same school). The tone shifts from formal business tension to something more personal and vulnerable, with 'loaded implications' suggesting emotional undercurrents.",
  "changed": true,
  "newTopic": "unexpected personal connection",
  "newTone": "personally vulnerable"
}

### Example 2: No Change - Continuation of Same Discussion
INPUT:
Previous Topic: planning the heist
Previous Tone: focused and conspiratorial
Messages:
"""
Reyes: *She traces her finger along the blueprint, highlighting the corridor from the service entrance to the vault.* "The guards rotate every forty-five minutes. That gives us a seventeen-second window here-" *She taps the junction point.* "-where both patrol routes are on the far side of the building." *She looks up at her crew, making sure they're following.* "Chen, you'll need to disable the secondary cameras during that window. Marcus handles the lock. I'll be running interference on the radio channels."
"""
OUTPUT:
{
  "reasoning": "The conversation continues to focus on heist planning - discussing guard rotations, patrol routes, camera systems, and assigning roles. The tone remains focused and tactical, with Reyes methodically walking through the operational details. There's no shift in topic (still planning the heist) or tone (still focused and conspiratorial/professional). This is a continuation of the same scene type, just with more specifics.",
  "changed": false
}

### Example 3: Tone Shift Only - Same Topic, Different Emotional Register
INPUT:
Previous Topic: reunion after years
Previous Tone: bittersweet and hopeful
Messages:
"""
Thomas: *The coffee grows cold between them as the conversation continues, but neither notices. Thomas leans back in his chair, a genuine laugh escaping him for the first time in what feels like years.* "I can't believe you actually kept that terrible poem I wrote you. The one about your eyes being like... what was it?"

Sarah: "Like twin moons over a sea of regret." *She snorts, covering her face with her hands.* "It was absolutely awful. I have it framed in my bathroom."

Thomas: "Your bathroom?! That's even worse!" *He's laughing too now, the tension that had wound through their earlier conversation finally unspooling.* "God, I thought I was so deep back then."
"""
OUTPUT:
{
  "reasoning": "The topic remains their reunion/reconnection - they're still processing their shared history and past relationship. However, the tone has definitively shifted. Where before it was 'bittersweet and hopeful,' now the scene describes 'genuine laugh,' snorting, and tension 'finally unspooling.' The emotional register has moved from melancholic hope to warm playfulness and shared humor about their past. Same subject matter, very different feeling.",
  "changed": true,
  "newTone": "warm and playfully nostalgic"
}

### Example 4: Topic Change Only - Same Tone, Different Subject
INPUT:
Previous Topic: escaping the guards
Previous Tone: tense and urgent
Messages:
"""
Agent Kim: *She slams the panic room door shut behind them, immediately turning to the control panel. Her fingers fly across the keyboard as she pulls up the building's security feeds.* "We're locked in for now, but that won't hold them long." *She switches to a different camera.* "There - the server room. That's where they're keeping it."

Cole: "The prototype?" *He moves closer to the screen, still catching his breath from their sprint.*

Kim: "The weapon. Whatever it is, we need to destroy it before they can move it. Seventeen floors down, east wing." *She starts scanning the ventilation schematics.* "If we can find a route through the maintenance tunnels..."
"""
OUTPUT:
{
  "reasoning": "The immediate crisis of escaping guards is now behind them - they've reached temporary safety in the panic room. However, the urgency and tension remain as they shift to planning their next objective: reaching and destroying a weapon/prototype. The topic changes from 'escape' to 'infiltration/destruction mission,' but the tone stays tense and urgent throughout. Same emotional register, new tactical focus.",
  "changed": true,
  "newTopic": "destroying the weapon"
}

### Example 5: False Alarm - Apparent Change That Isn't
INPUT:
Previous Topic: wedding planning stress
Previous Tone: anxious and overwhelmed
Messages:
"""
Priya: *She throws another rejected invitation design onto the growing pile.* "The fonts are wrong, the colors clash with the venue, and don't even get me started on the RSVP card stock."

Jin: "Maybe we should take a break? Get some food?" *He eyes the stack of samples warily.*

Priya: "Food won't fix the fact that your mother wants traditional invitations and my mother wants modern and they BOTH want gold accents but different kinds of gold and-" *She stops, taking a breath.* "Sorry. I know I'm being crazy. It's just... everything feels like it has to be perfect and nothing is working."
"""
OUTPUT:
{
  "reasoning": "Despite the suggestion to take a break and the moment of self-awareness, the scene remains firmly anchored in wedding planning stress. Priya's anxiety about the invitations, the family expectations, the pressure for perfection - all still present. Jin's suggestion doesn't actually change the topic (they don't take the break) and Priya's brief moment of clarity doesn't shift the overall anxious tone. The scene continues in the same emotional space.",
  "changed": false
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Detecting Change When There Is None
INPUT:
Previous Topic: solving the puzzle
Previous Tone: intellectually engaged
Messages:
"""
Dr. Webb: *She rotates the artifact another quarter turn, examining the newly visible symbols.* "These markings here - they're consistent with the other proto-Sumerian examples we've catalogued." *She adjusts her glasses, leaning closer.* "But this sequence... I've never seen this particular combination before."
"""
WRONG OUTPUT:
{
  "reasoning": "She sees something new she hasn't seen before.",
  "changed": true,
  "newTopic": "new discovery",
  "newTone": "excited"
}
WHY THIS IS WRONG: Dr. Webb is still engaged in solving the puzzle - examining the artifact IS the puzzle. Seeing unfamiliar markings doesn't change the topic from puzzle-solving; it's part of the process. The tone remains intellectually engaged throughout. No actual shift has occurred.

### Bad Example 2: Missing Obvious Topic Change
INPUT:
Previous Topic: restaurant small talk
Previous Tone: pleasant and casual
Messages:
"""
James: "So anyway, that's when the waiter dropped the entire tray of-" *His phone buzzes. He glances at it, and his face goes ashen.* "Oh God."

Maria: "James? What is it?"

James: *His hands are shaking as he shows her the screen.* "It's from the hospital. My mother's condition... she's taken a turn. They're saying I should come now."
"""
WRONG OUTPUT:
{
  "reasoning": "They're still at the restaurant having a conversation.",
  "changed": false
}
WHY THIS IS WRONG: The topic has completely shifted from casual restaurant banter to a medical emergency with his mother. The tone has transformed from pleasant to urgent/distressed. The physical setting being the same doesn't mean the scene hasn't changed.

### Bad Example 3: Missing Tone Shift While Topic Stays Same
INPUT:
Previous Topic: wedding vows
Previous Tone: solemnly romantic
Messages:
"""
Reverend: "Do you, Marcus, take this woman to be your lawfully wedded wife?"

Marcus: *He looks at Sarah, and suddenly his carefully memorized vows desert him entirely.* "I... yes. Obviously yes. But also-" *A nervous laugh escapes him.* "I had this whole speech prepared about destiny and soulmates and I've completely forgotten it because you look so beautiful it broke my brain."

Sarah: *She laughs, tears streaming down her cheeks, and pulls him into a kiss before the reverend can finish.*

Reverend: "I... suppose that's one way to do it."
"""
WRONG OUTPUT:
{
  "reasoning": "Still wedding vows happening.",
  "changed": false
}
WHY THIS IS WRONG: While the topic (wedding vows) technically continues, the tone has shifted dramatically from "solemnly romantic" to something much more spontaneous, humorous, and joyfully chaotic. Marcus forgetting his vows, the nervous laugh, Sarah's impulsive kiss, the reverend's bemused response - this is a clear tone change that should be captured.

### Bad Example 4: Reasoning Doesn't Support the Output
INPUT:
Previous Topic: first day at new job
Previous Tone: nervous and eager
Messages:
"""
Taylor: *She straightens her blazer for the fifteenth time, hovering near the elevator bank.* "Okay. You've got this. Just... be professional. Be confident. Don't spill coffee on anyone." *She takes a deep breath as the elevator dings.* "Here we go."
"""
WRONG OUTPUT:
{
  "reasoning": "Taylor is giving herself a pep talk before her first day, showing nervousness but also determination. She's trying to build confidence.",
  "changed": true,
  "newTopic": "giving pep talk",
  "newTone": "confident"
}
WHY THIS IS WRONG: The reasoning correctly identifies nervousness, but the output claims the tone is "confident" - contradicting the analysis. Self-encouragement before a nervous moment doesn't mean the nervousness has been replaced with confidence. The scene remains "first day at new job" with a "nervous and eager" tone.

### Bad Example 5: Ignoring Clear Signals of Change
INPUT:
Previous Topic: art gallery small talk
Previous Tone: politely superficial
Messages:
"""
Caroline: *She swirls her champagne, eyes still on the abstract painting before them.* "It's derivative, of course, but there's an earnestness to the brushwork that-" *She stops mid-sentence as she recognizes the man who just entered.* "Oh god. Marcus."

Marcus: *He freezes when he sees her, his hand still on his date's arm.* "Caroline. I... I didn't expect..."

Caroline: *Her champagne glass trembles slightly.* "Five years. Five years and you bring her here. To our gallery."
"""
WRONG OUTPUT:
{
  "reasoning": "They're still at an art gallery looking at art.",
  "changed": false
}
WHY THIS IS WRONG: Everything has changed. What was polite art discussion has become a confrontation between exes. "Our gallery" suggests shared history, and the tension is palpable. The topic is now the confrontation/past relationship, and the tone is emotionally charged and tense.
`;

export const topicToneChangePrompt: PromptTemplate<ExtractedTopicToneChange> = {
	name: 'topic_tone_change',
	description: 'Detect whether the topic or tone of a scene has changed from previous state',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentTopic,
		PLACEHOLDERS.currentTone,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to detect whether the topic or tone of a scene has changed.

## Your Task
Given the previous topic and tone, analyze new messages to determine:
1. Has the topic changed? (What the scene is about)
2. Has the tone changed? (The emotional atmosphere)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of whether and how topic/tone have shifted
- "changed": Boolean indicating if either topic or tone has changed
- "newTopic": The new topic if it changed (2-4 words, omit if unchanged)
- "newTone": The new tone if it changed (2-3 words, omit if unchanged)

## What Constitutes a Change

### Topic Changes When:
- The conversation shifts to a different subject matter
- A new event or revelation redirects the scene's focus
- Characters move from one activity/concern to another
- The dramatic question being explored changes

### Topic Does NOT Change When:
- Different aspects of the same subject are discussed
- New details emerge about the current focus
- Natural conversation flow within the same concern
- Physical location changes but purpose remains

### Tone Changes When:
- The emotional atmosphere shifts (tense to relaxed, playful to serious)
- The nature of character interactions changes
- A mood break occurs (humor interrupting drama, crisis interrupting calm)
- Resolution or escalation significantly alters the feeling

### Tone Does NOT Change When:
- Intensity varies slightly within the same register
- Individual emotions fluctuate but overall atmosphere remains
- Weather or setting changes without emotional shift
- Brief moments that don't alter the scene's overall feeling

## Guidelines for Topic (when changed)
- Use 2-4 words describing what the scene is about
- Focus on the conceptual subject, not specific dialogue
- Use action-oriented phrases when possible
- Avoid character names in the topic

## Guidelines for Tone (when changed)
- Use 2-3 words describing emotional atmosphere
- Capture nuance with descriptive combinations
- Consider both surface emotions and undercurrents
- Describe feeling, not physical conditions

## Important Rules
- Only report change if the shift is significant and sustained
- Deflection attempts that fail don't count as changes
- Physical setting changes don't automatically mean topic/tone change
- Reasoning must thoroughly support your determination
- When only topic OR only tone changes, only include that field

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Current Scene State
Topic: {{currentTopic}}
Tone: {{currentTone}}

## New Messages to Analyze
{{messages}}

## Task
Analyze whether these new messages have changed the topic and/or tone of the scene. Consider whether the shift is significant enough to warrant updating the scene state. Provide your answer as JSON.

Remember:
- Topic: 2-4 words describing what the scene is about (only include if changed)
- Tone: 2-3 words describing emotional atmosphere (only include if changed)
- Analyze actual content shifts, not minor variations within the same subject
- Both can change, only one can change, or neither can change`,

	responseSchema: topicToneChangeSchema,

	defaultTemperature: 0.6,

	parseResponse(response: string): ExtractedTopicToneChange | null {
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
		if (typeof parsed.changed !== 'boolean') return null;

		// Validate optional fields when changed is true
		if (parsed.changed) {
			// At least one of newTopic or newTone should be present
			const hasNewTopic =
				typeof parsed.newTopic === 'string' &&
				parsed.newTopic.trim() !== '';
			const hasNewTone =
				typeof parsed.newTone === 'string' && parsed.newTone.trim() !== '';
			if (!hasNewTopic && !hasNewTone) return null;
		}

		return parsed as unknown as ExtractedTopicToneChange;
	},
};
