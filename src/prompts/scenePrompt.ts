// ============================================
// Scene Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const SCENE_PROMPTS: Record<string, PromptDefinition> = {
	scene_initial: {
		key: 'scene_initial',
		name: 'Scene - Initial',
		description: 'Extracts scene topic, tone, tension, and events from opening',
		defaultTemperature: 0.6,
		placeholders: [
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.charactersSummary,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze this roleplay scene and extract the scene state. You must only return valid JSON with no commentary.

<instructions>
<general>
- Determine the topic, tone, tension, and significant events of the scene.
- Topic should be 3-5 words summarizing the main focus.
- Tone should be 2-3 descriptive words capturing the emotional atmosphere (e.g. "Tense, suspicious" or "Warm, playful").
</general>
<tension>
- Direction will be calculated automatically, but set your best guess.
<levels>
Tension levels form a spectrum of emotional/dramatic intensity (applies to ALL tension types):
- relaxed: Low stakes, comfortable. Casual chat, downtime, nothing pressing.
- aware: Mild interest or attention. Something noted but no real stakes yet.
- guarded: Careful, measured. Testing waters - whether for trust, attraction, or safety.
- tense: Stakes feel real. Could be conflict brewing, unspoken attraction, or difficult truth approaching.
- charged: Intense emotions dominate. Anger before a fight, desire before a kiss, fear before confession.
- volatile: On the edge. One word changes everything - into violence, intimacy, or revelation.
- explosive: The moment itself. Fight breaks out, characters kiss or engage in sex, secret revealed, breakdown happens.
</levels>
<types>
Tension type describes the nature of what's driving the tension:
- conversation: Neutral dialogue, information exchange, casual interaction.
- negotiation: Competing interests seeking agreement. Deals, persuasion, bargaining.
- confrontation: Direct opposition or conflict. Arguments, accusations, standoffs.
- intimate: Emotional/physical closeness. Romance, deep sharing, intimacy, sexual tension.
- vulnerable: Exposure of weakness or secrets. Confessions, emotional risk, asking for help.
- suspense: Uncertainty about outcome. Waiting, anticipation, something about to happen.
- celebratory: Positive excitement. Joy, triumph, celebration, shared happiness.
</types>
</tension>
<recent_events>
- Include significant events that affect the ongoing narrative.
- Events should be consequential: discoveries, relationship changes, injuries, commitments.
- Maximum 5 events, prioritize the most important ones.
</recent_events>
</instructions>

<examples>
<example>
<input>
*The restaurant had finally emptied out, the last of the dinner crowd filtering into the rainy night outside. Elena sat across from Marcus in the corner booth, her wine glass mostly untouched, watching him struggle to find the right words. He'd asked her to dinner with that particular tone in his voice—the one that meant something important was coming—and she'd spent the entire meal waiting for the other shoe to drop.*

*The candles on the table had burned down to stubs, casting flickering shadows across his face. Outside, thunder rumbled in the distance, and the rain intensified against the windows. A waiter hovered near the kitchen door, clearly wanting to close up but too polite to interrupt.*

Elena: "Marcus, whatever it is, just say it. You've been dancing around something all night."

Marcus: *finally meeting her eyes* "I'm leaving. The job in Tokyo—I took it." *He reached across the table, his fingers brushing against hers.* "But I don't want to go without you."

*The words hung in the air between them. Elena felt her heart skip, her mind racing through a thousand implications—her career, her family, everything she'd built here. But looking at him now, vulnerable and hopeful and terrified all at once, she realized the answer wasn't as complicated as she'd thought.*
</input>
<output>
{
  "topic": "Life-changing proposal",
  "tone": "Vulnerable, electric, bittersweet",
  "tension": {"level": "charged", "type": "intimate", "direction": "escalating"}
}
</output>
<explanation>
TOPIC: "Life-changing proposal" - captures the weight of what's being asked (not just "dinner conversation" or "relationship talk"). The proposal isn't marriage, but it IS asking her to change her entire life.

TONE: Three words to capture a complex emotional atmosphere:
- "Vulnerable" - Marcus is exposing himself to rejection, Elena is confronting a huge decision
- "Electric" - the air is charged with anticipation and significance
- "Bittersweet" - whatever the answer, something will be lost (either the opportunity or her current life)

TENSION analysis:
- Level "charged": Intense emotions dominate. This is a pivotal moment—not yet at "volatile" (one word changes everything) but definitely beyond "tense" (stakes feel real)
- Type "intimate": This is about emotional/relational closeness, not conflict. Despite the stakes, they're on the same side
- Direction "escalating": Building toward a decision/revelation. The question has been asked; the answer will raise or resolve tension further

Why NOT other levels:
- Not "explosive" - the moment hasn't broken yet, she hasn't answered
- Not "volatile" - there's no sense it could go violent or completely wrong
- Not "tense" - too understated for this pivotal moment
</explanation>
</example>

<example>
<input>
*The precinct bullpen was chaos—phones ringing, detectives shouting across desks, a suspect being dragged toward booking while screaming about his rights. But Captain Rodriguez's office was an island of deadly calm. Sarah sat in the hard plastic chair across from his desk, hands folded in her lap, expression carefully neutral.*

*Rodriguez hadn't said a word since calling her in. He just sat there, reading through the file in front of him, occasionally making small noises of disapproval. The silence stretched unbearably. On the wall behind him, the clock ticked loud enough to hear—2:47 PM. She'd been sitting here for almost five minutes.*

Rodriguez: *finally looking up* "Detective Chen. Thirteen years on the force. Exemplary record." *He closed the file with a soft thump.* "So explain to me why I have Internal Affairs breathing down my neck about a missing evidence log."

Sarah: "Captain, I filed that log myself three days ago. Whatever discrepancy they found—"

Rodriguez: *holding up a hand* "I've known you a long time, Chen. Which is why I'm giving you exactly one chance to tell me what really happened before this goes any further. Because right now?" *He leaned forward, his voice dropping.* "Right now, it looks like you made something disappear. And I need to know why."

*The accusation landed like a punch. Sarah felt the blood drain from her face, her carefully maintained composure cracking at the edges.*
</input>
<output>
{
  "topic": "Internal affairs accusation",
  "tone": "Ominous, suffocating, accusatory",
  "tension": {"level": "tense", "type": "confrontation", "direction": "escalating"}
}
</output>
<explanation>
TOPIC: "Internal affairs accusation" - specific and consequential. Not just "meeting with captain" or "work trouble." The IA involvement and evidence tampering allegation are the core issue.

TONE: Captures the oppressive atmosphere:
- "Ominous" - the extended silence, the careful reading, the ticking clock all create dread
- "Suffocating" - she's trapped, the room feels small despite the chaos outside, nowhere to go
- "Accusatory" - Rodriguez isn't asking if something happened; he's telling her he knows and demanding explanation

TENSION analysis:
- Level "tense": Stakes feel real—career, reputation, possibly freedom are on the line. The confrontation is direct but still in the "explain yourself" phase
- Type "confrontation": Direct opposition between authority figure and accused. Rodriguez has power; Sarah is defending herself
- Direction "escalating": Building toward a breaking point. Rodriguez is offering "one chance" which implies escalation is coming if she doesn't satisfy him

Why "tense" and not higher:
- Not "charged": That would suggest emotional intensity dominating—this is more controlled, procedural despite the stakes
- Not "volatile": Nobody's about to snap; this is deliberate pressure, not explosive emotion
- Could become "volatile" or "charged" if she confesses or accuses back, but currently it's a calculated confrontation
</explanation>
</example>

<example>
<input>
*The morning sun streamed through the kitchen windows as Elena padded in wearing Marcus's oversized t-shirt, her hair a mess from sleep. Marcus was already at the stove, the smell of bacon and coffee filling the apartment. He looked over his shoulder and grinned at her sleep-rumpled appearance.*

Marcus: "There she is. I was about to send a search party."

Elena: *yawning hugely* "What time is it?"

Marcus: "Almost eleven. You were out cold." *He slid a mug of coffee across the counter toward her.* "I figured you earned it after last night."

*She wrapped her hands around the warm mug, smiling into the steam. Through the window, she could see the city skyline glittering in the sunshine, the storm from last night nothing but a memory. Her phone buzzed on the counter—probably her sister checking in—but she ignored it. The real world could wait.*

Elena: "Is that bacon I smell?"

Marcus: "And pancakes. The good ones, with the chocolate chips." *He turned back to the stove, but not before she caught the soft expression on his face.* "Sit down, I'll bring you a plate."

*She hopped onto one of the bar stools, tucking her bare feet under her, and watched him cook with a contentment she hadn't felt in years.*
</input>
<output>
{
  "topic": "Lazy morning after",
  "tone": "Warm, domestic, contented",
  "tension": {"level": "relaxed", "type": "intimate", "direction": "stable"}
}
</output>
<explanation>
TOPIC: "Lazy morning after" - captures the context (implied intimacy the night before) and current activity (casual, unhurried morning). Specific enough to be useful, not overly clinical.

TONE: All positive, soft emotions:
- "Warm" - physical (sun, coffee, cooking) and emotional (their dynamic)
- "Domestic" - the comfortable ordinariness of the scene, making breakfast together
- "Contented" - no urgency, no worry, just enjoying the moment

TENSION analysis:
- Level "relaxed": Low stakes, comfortable. Nothing pressing, nobody worried, just enjoying each other
- Type "intimate": Despite the low tension, the TYPE is intimate—they're emotionally/physically close (she's wearing his shirt, he's making her favorite breakfast)
- Direction "stable": No building or releasing of tension. The scene could continue like this indefinitely

Key insight: Low tension doesn't mean the scene isn't meaningful or intimate. "Relaxed" + "intimate" captures a loving, comfortable relationship moment. Not every scene needs conflict.

Why NOT other types:
- Not "conversation" - that implies neutral exchange, but there's clear romantic intimacy here
- Not "celebratory" - they're not celebrating anything specific, just enjoying normalcy
</explanation>
</example>

<bad_example>
<output>
{
  "topic": "Dinner",
  "tone": "Romantic",
  "tension": {"level": "moderate", "type": "emotional", "direction": "building"}
}
</output>
<why_bad>
- topic too vague: "Dinner" could be anything. Should capture what makes THIS dinner significant: "Life-changing proposal"
- tone too simple: "Romantic" is one word and doesn't capture the complexity. Use 2-3 descriptive words: "Vulnerable, electric, bittersweet"
- tension level invalid: "moderate" is not a valid level. Must use: relaxed, aware, guarded, tense, charged, volatile, explosive
- tension type invalid: "emotional" is not a valid type. Must use: conversation, negotiation, confrontation, intimate, vulnerable, suspense, celebratory
- direction invalid: "building" is not valid. Must use: escalating, stable, decreasing
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<character_info>
{{userInfo}}

{{characterInfo}}
</character_info>

<characters_present>
{{charactersSummary}}
</characters_present>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the scene state as valid JSON:`,
	},

	scene_update: {
		key: 'scene_update',
		name: 'Scene - Update',
		description: 'Updates scene state based on recent messages',
		defaultTemperature: 0.6,
		placeholders: [
			COMMON_PLACEHOLDERS.charactersSummary,
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze these roleplay messages and update the scene state. You must only return valid JSON with no commentary.

<instructions>
<general>
- Update topic if the focus has shifted.
- Update tone if the emotional atmosphere has changed. Use 2-3 descriptive words (e.g. "Tense, suspicious" or "Warm, playful").
- Consider whether tension has increased, decreased, or remained stable.
</general>
<tension>
- Direction will be recalculated based on level change.
- If previous direction was 'stable', strongly consider whether type or level has changed.
<levels>
Tension levels form a spectrum of emotional/dramatic intensity (applies to ALL tension types):
- relaxed: Low stakes, comfortable. Casual chat, downtime, nothing pressing.
- aware: Mild interest or attention. Something noted but no real stakes yet.
- guarded: Careful, measured. Testing waters - whether for trust, attraction, or safety.
- tense: Stakes feel real. Could be conflict brewing, unspoken attraction, or difficult truth approaching.
- charged: Intense emotions dominate. Anger before a fight, desire before a kiss, fear before confession.
- volatile: On the edge. One word changes everything - into violence, intimacy, or revelation.
- explosive: The moment itself. Fight breaks out, characters kiss or engage in sex, secret revealed, breakdown happens.
</levels>
<types>
Tension type describes the nature of what's driving the tension:
- conversation: Neutral dialogue, information exchange, casual interaction.
- negotiation: Competing interests seeking agreement. Deals, persuasion, bargaining.
- confrontation: Direct opposition or conflict. Arguments, accusations, standoffs.
- intimate: Emotional/physical closeness. Romance, deep sharing, intimacy, sexual tension.
- vulnerable: Exposure of weakness or secrets. Confessions, emotional risk, asking for help.
- suspense: Uncertainty about outcome. Waiting, anticipation, something about to happen.
- celebratory: Positive excitement. Joy, triumph, celebration, shared happiness.
</types>
</tension>
<recent_events>
- Keep events that are still relevant to the ongoing scene.
- Remove events that have been resolved or superseded.
- Add new significant events from the recent messages.
- Maximum 5 events - prune aggressively, keep most salient.
- Even if previous_scene has more than 5 events, return at most 5.
</recent_events>
</instructions>

<examples>
<example>
<input>
*Elena set down her wine glass with deliberate care, her laughter from a moment ago fading as something shifted in her expression. Across the table, Marcus was still chuckling about the ridiculous mishap she'd just described—the time she'd accidentally called her boss "mom" in a board meeting—but Elena wasn't smiling anymore.*

Elena: "Marcus, there's something I need to tell you." *She clasped her hands together on the table, knuckles whitening.* "About that night. The night you found me at the hotel."

*The temperature in the room seemed to drop. Marcus's smile faltered, then disappeared entirely. He'd asked about that night a dozen times over the past six months, and she'd always deflected, always found a way to change the subject. The fact that she was bringing it up now...*

Marcus: "Elena, you don't have to—"

Elena: "Yes, I do." *She finally looked up at him, and he could see the fear there, the vulnerability she usually kept so carefully hidden.* "I wasn't there for a work conference. I was meeting someone. Someone I'd been talking to for months." *Her voice cracked.* "Someone I almost left you for."

*The words hung between them like broken glass.*
</input>
<previous_scene>
{
  "topic": "Sharing embarrassing memories",
  "tone": "Lighthearted, nostalgic, warm",
  "tension": {"level": "relaxed", "type": "conversation", "direction": "stable"}
}
</previous_scene>
<output>
{
  "topic": "Confession of almost-affair",
  "tone": "Heavy, fearful, exposed",
  "tension": {"level": "volatile", "type": "vulnerable", "direction": "escalating"}
}
</output>
<explanation>
DRAMATIC SHIFT in scene state:

TOPIC: "Sharing embarrassing memories" → "Confession of almost-affair"
- The subject matter has completely transformed from light anecdotes to a relationship-threatening revelation
- Topic should reflect what the scene is NOW about, not what it started as

TONE: "Lighthearted, nostalgic, warm" → "Heavy, fearful, exposed"
- Complete tonal reversal - none of the original warmth remains
- "Heavy" - the weight of the confession, the "broken glass" metaphor
- "Fearful" - Elena's visible fear, her vulnerability
- "Exposed" - she's revealing her deepest secret, making herself vulnerable

TENSION changes:
- Level: "relaxed" → "volatile" (jumped multiple levels)
  * This isn't just "tense" - she's confessing to almost ending the relationship
  * "Volatile" = one word changes everything, and her next words could destroy or save them
- Type: "conversation" → "vulnerable"
  * This is about exposure of secrets, emotional risk, not casual exchange
  * She's asking for forgiveness by confessing, putting herself at his mercy
- Direction: "stable" → "escalating"
  * The revelation demands a response; tension is building toward Marcus's reaction

Why "volatile" not "explosive":
- "Explosive" is the moment itself - the fight breaking out, the breakdown happening
- We're AT the edge of explosive, but Marcus hasn't reacted yet
- His response could push it to "explosive" or start de-escalating
</explanation>
</example>

<example>
<input>
*The shouting had finally stopped. Marcus stood by the window, his back to the room, shoulders tight with tension. Elena sat on the edge of the bed where she'd collapsed after their worst fight yet, mascara-streaked tears still drying on her cheeks. Neither of them had spoken in almost five minutes.*

*Finally, Marcus turned around. His expression was unreadable, but when he spoke, his voice was quieter than she'd ever heard it.*

Marcus: "I need to know one thing." *He crossed the room slowly, stopping a few feet from the bed.* "Did you love him?"

Elena: *voice barely a whisper* "No." *She looked up at him, and for the first time tonight, she let him see everything—the regret, the shame, the desperate hope.* "I was lonely, and I was stupid, and I was looking for something I already had. But I never loved him." *She reached out tentatively.* "I love you. I've only ever loved you."

*Marcus stared at her outstretched hand for a long moment. Then, slowly, he took it.*

Marcus: "Then we figure this out." *He sat down beside her, still holding her hand.* "I don't know how yet, but... we figure it out."
</input>
<previous_scene>
{
  "topic": "Confession of almost-affair",
  "tone": "Heavy, fearful, exposed",
  "tension": {"level": "volatile", "type": "vulnerable", "direction": "escalating"}
}
</previous_scene>
<output>
{
  "topic": "Choosing forgiveness",
  "tone": "Raw, fragile, hopeful",
  "tension": {"level": "charged", "type": "vulnerable", "direction": "decreasing"}
}
</output>
<explanation>
RESOLUTION beginning - tension decreasing but still intense:

TOPIC: "Confession of almost-affair" → "Choosing forgiveness"
- The confession has been made; now the scene is about his response
- "Choosing forgiveness" captures that this is an active decision, not passive acceptance

TONE: "Heavy, fearful, exposed" → "Raw, fragile, hopeful"
- Still emotionally intense, but the quality has shifted
- "Raw" - nerves exposed, both vulnerable, the aftermath of emotional upheaval
- "Fragile" - this reconciliation could still shatter; they're being careful
- "Hopeful" - he took her hand, they're going to try

TENSION changes:
- Level: "volatile" → "charged"
  * Still intense emotions, but the immediate danger has passed
  * "Volatile" (one word changes everything) → "charged" (emotions dominate, but there's direction)
  * He's chosen to stay; that decision lowered the stakes
- Type: Still "vulnerable"
  * This remains about emotional exposure and risk
  * She's still exposed; he's now exposed too by choosing forgiveness
- Direction: "escalating" → "decreasing"
  * The worst moment has passed
  * They're moving toward resolution, not away from it
  * Tension is releasing, though slowly

Why not lower than "charged":
- This isn't "tense" (still too raw for that measured feeling)
- Definitely not "guarded" or "relaxed" - they just had their worst fight ever
- The emotions are still overwhelming; they're just now moving in a positive direction
</explanation>
</example>

<example>
<input>
*The apartment was chaos—balloons everywhere, streamers hanging from every surface, the kitchen counter covered in half-assembled party supplies. Elena stood in the middle of it all, hair in a messy bun, wearing an apron covered in frosting stains, looking utterly frazzled.*

Elena: "The cake is lopsided, Marcus. LOPSIDED." *She gestured at the three-tier monstrosity on the counter.* "Sophie's going to be here in two hours and I haven't even started the frosting and the living room still needs—"

Marcus: *catching her by the shoulders* "Hey. Breathe."

Elena: *taking a shaky breath* "I just want it to be perfect. She only turns five once, and after the year she's had with the hospital and everything—"

Marcus: "And she's going to love it." *He pulled her into a hug, despite the flour on her apron.* "She's going to love the lopsided cake and the slightly crooked streamers and the balloons that I definitely did not accidentally pop three of while inflating."

Elena: *laughing despite herself* "Three?!"

Marcus: "They were VERY aggressive balloons." *He kissed her forehead.* "Now put me to work. What needs frosting?"

*Elena finally let some of the tension drain from her shoulders. It wasn't going to be perfect. But watching Marcus gamely attempt to wield a piping bag, she realized it was going to be exactly right.*
</input>
<previous_scene>
{
  "topic": "Birthday party crisis",
  "tone": "Frantic, stressed, anxious",
  "tension": {"level": "tense", "type": "suspense", "direction": "escalating"}
}
</previous_scene>
<output>
{
  "topic": "Party preparation teamwork",
  "tone": "Reassured, warm, playful",
  "tension": {"level": "aware", "type": "conversation", "direction": "decreasing"}
}
</output>
<explanation>
STRESS → REASSURANCE transition:

TOPIC: "Birthday party crisis" → "Party preparation teamwork"
- The "crisis" has been reframed as manageable
- Focus shifted from "everything is going wrong" to "we're doing this together"
- Still party prep, but the framing is completely different

TONE: "Frantic, stressed, anxious" → "Reassured, warm, playful"
- Complete reversal through Marcus's intervention
- "Reassured" - he calmed her down, validated her stress, offered help
- "Warm" - the hug, the kiss, the physical comfort
- "Playful" - the balloon joke, her laughing despite herself

TENSION changes:
- Level: "tense" → "aware"
  * "Tense" = stakes feel real (party pressure, Sophie's health history)
  * "Aware" = mild interest/attention, something noted but manageable
  * Marcus successfully lowered the emotional temperature
- Type: "suspense" → "conversation"
  * "Suspense" was about uncertainty (will the party be okay?)
  * Now it's just two people talking, working together
  * The outcome is no longer in question - it'll be fine
- Direction: "escalating" → "decreasing"
  * She was spiraling; now she's grounded
  * The stress is actively dissipating

This shows how quickly tension can shift through emotional support - one conversation completely changed the scene's energy.
</explanation>
</example>

<bad_example>
<output>
{
  "topic": "Sharing embarrassing memories",
  "tone": "Lighthearted, nostalgic, warm",
  "tension": {"level": "relaxed", "type": "conversation", "direction": "stable"}
}
</output>
<why_bad>
This is just copying the previous_scene without analyzing the new messages!
- The messages show a DRAMATIC confession about an almost-affair
- Topic should change: "Sharing embarrassing memories" → "Confession of almost-affair"
- Tone should change completely: "Lighthearted" → "Heavy, fearful, exposed"
- Tension should jump dramatically: "relaxed" → "volatile", "conversation" → "vulnerable"
- Direction should change: "stable" → "escalating"

Always analyze what ACTUALLY happened in the recent_messages and update accordingly. Never just return the previous state unchanged when significant events occurred.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<characters_present>
{{charactersSummary}}
</characters_present>

<previous_scene>
{{previousState}}
</previous_scene>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the updated scene state as valid JSON:`,
	},
};
