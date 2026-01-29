/**
 * Initial Tension Extraction Prompt
 *
 * Extracts the initial tension level, type, and direction from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialTension } from '../../types/extraction';
import { initialTensionSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Charged Confrontation
INPUT:
"""
Detective Morrison: *The interrogation room feels smaller with every passing minute. Detective Morrison leans across the table, close enough to smell the suspect's fear-sweat. Three hours of questioning and the man's story keeps changing - small details that don't add up, alibis that dissolve under scrutiny.* "Let me explain something to you, Mr. Collins." *Her voice is quiet, controlled, dangerous.* "We found your DNA under her fingernails. We have your car on camera six blocks from the scene. The jury won't care about your tears - they'll care about the evidence. So I'm going to ask you one more time: where were you the night of March 15th?" *Collins' leg bounces under the table, a rapid staccato of barely contained panic.*
"""
OUTPUT:
{
  "reasoning": "This interrogation scene shows mounting pressure as Morrison presents increasingly damning evidence. The physical proximity, controlled-but-dangerous voice, and the suspect's visible panic (bouncing leg) indicate high tension. It's a confrontation type - direct conflict between Morrison and Collins over his guilt.",
  "level": "charged",
  "type": "confrontation"
}

### Example 2: Relaxed Celebratory
INPUT:
"""
Mira: *The champagne bubbles tickle her nose as Mira takes another sip, leaning back into the overstuffed couch cushions. The party has wound down to its final dregs - most guests have gone home, leaving just the core group sprawled across various pieces of furniture in comfortable, wine-soaked contentment. Someone has put on soft jazz, and David is half-heartedly attempting to teach Sophie to dance in the corner.* "I can't believe we actually pulled it off," *Mira murmurs, examining the now-empty bottle.* "Six months of planning and everything went perfectly." *Someone raises a glass in agreement. Someone else is already asleep, snoring softly. This is exactly what victory is supposed to feel like.*
"""
OUTPUT:
{
  "reasoning": "This is a post-victory celebration with friends at its comfortable conclusion. The scene conveys warm contentment - champagne, soft jazz, people falling asleep, 'wine-soaked contentment.' No conflict is present or brewing; this is pure basking in success. The tension level is relaxed (completely at ease), the type is celebratory (marking an achievement).",
  "level": "relaxed",
  "type": "celebratory"
}

### Example 3: Guarded Negotiation
INPUT:
"""
Ambassador Chen: *The conference room had been a battlefield for the past three days, but something has shifted in the air. Ambassador Chen watches her counterpart, Minister Volkov, reviewing the final draft of the agreement. His team of lawyers has stopped their constant objections. His pen hasn't touched the margin annotations in over an hour.* "Article Seven addresses your concerns about the territorial waters," *she offers, keeping her voice neutral despite the flutter of hope in her chest.* "The compromise isn't perfect, but it's workable." *Volkov looks up, and for the first time since negotiations began, he doesn't look like he's calculating how to use her words against her.* "Da. It is... acceptable." *The word hangs in the air like a white flag.*
"""
OUTPUT:
{
  "reasoning": "The scene describes the end of contentious negotiations finally reaching resolution. The 'battlefield' metaphor and 'three days' of conflict establish that tension was high, but 'something has shifted.' The lawyers have stopped objecting, Volkov uses 'acceptable' like 'a white flag.' They're still careful (guarded - Chen keeps her voice neutral, suppresses hope), still negotiating terms.",
  "level": "guarded",
  "type": "negotiation"
}

### Example 4: Volatile Intimate
INPUT:
"""
Raven: *The hotel room is a wreck of thrown clothes and overturned furniture, evidence of an argument that's been raging for hours. Raven stands with her back to the wall, mascara streaked down her cheeks, fists clenched at her sides. Across the room, Jack paces like a caged animal, running his hands through his hair over and over.* "You don't get to decide when we're done!" *Raven's voice cracks on the last word.* "Three years, Jack! Three years and you just - you just leave a NOTE?" *He stops pacing, faces her, and something dangerous flickers in his eyes.* "Because I knew you'd do this! I knew you wouldn't let me explain!" *The air between them crackles with years of love twisted into something unrecognizable.*
"""
OUTPUT:
{
  "reasoning": "This is an explosive argument between lovers at a relationship breaking point - the hotel room destruction, mascara tears, caged-animal pacing, voice cracking. The tension is volatile (one step from complete breakdown). The type is intimate (romantic/relationship conflict between people who deeply know each other).",
  "level": "volatile",
  "type": "intimate"
}

### Example 5: Aware Conversation
INPUT:
"""
Dr. Webb: *The therapy office is deliberately calming - neutral colors, soft lighting, the gentle burble of a tabletop fountain. Dr. Webb watches her new patient settle into the leather chair, noting the defensive posture, the way his eyes keep darting to the exits.* "There's no pressure to talk about anything you're not ready for today, Marcus," *she says, keeping her tone warm but professional.* "Our first session is really just about getting comfortable. You can tell me what brought you here, or we can discuss the weather, or you can just sit there. This is your time." *Marcus drums his fingers on the armrest, considering.* "I... don't really know where to start." *A beginning, however hesitant.*
"""
OUTPUT:
{
  "reasoning": "This is an initial therapy session with a hesitant new patient. Dr. Webb creates safety while Marcus shows defensive behaviors (watching exits, drumming fingers). There's mild tension from Marcus's discomfort and uncertainty, but nothing antagonistic. The level is aware (mild alertness, some caution without active conflict). The type is conversation (a getting-to-know-you therapeutic dialogue).",
  "level": "aware",
  "type": "conversation"
}

### Example 6: Explosive Confrontation
INPUT:
"""
General Hayes: *The bunker shakes as another artillery strike hits somewhere above. General Hayes and Colonel Rivera face each other across the tactical table, both still breathing hard from the screaming match that just ended. The staff have pressed themselves against the walls, trying to become invisible. Maps and reports lie scattered where Hayes swept them in his fury.* "Fine." *The word drops like a stone.* "We do it your way, Colonel. But if this fails, if our people die because of YOUR plan..." *He doesn't finish the threat. He doesn't need to. Rivera's jaw is tight, but she nods.* "Understood, sir. I accept full responsibility." *The bunker shakes again, a reminder that they don't have time for this.*
"""
OUTPUT:
{
  "reasoning": "This scene captures the immediate aftermath of an explosive argument between military commanders. The bunker shaking, scattered papers, frightened staff indicate explosive tension. Hayes saying 'Fine' and Rivera accepting responsibility shows resolution, but the intensity is still present even though the shouting stopped. The level is explosive (the intensity is still present). The type is confrontation (direct command conflict).",
  "level": "explosive",
  "type": "confrontation"
}

### Example 7: Tense Suspense
INPUT:
"""
Officer Lin: *The warehouse is too quiet. Officer Lin moves through the shadows, service weapon raised, every sense straining for information. The anonymous tip said the hostages were here, but so far she's found nothing but empty rooms and suspicious stains on the concrete floor. Her radio crackles - static, nothing useful. Backup is still ten minutes out. Something scuffles in the darkness ahead. She freezes, heart hammering, trying to pinpoint the sound. Another scuffle. Closer this time. Could be rats. Could be something much worse.* "Police!" *she calls out, hating how her voice echoes in the empty space.* "Come out with your hands visible!"
"""
OUTPUT:
{
  "reasoning": "Officer Lin is alone in a potentially hostile environment searching for hostages, with backup far away. The scene builds dread through sensory details - too quiet, suspicious stains, scuffling sounds getting closer. Her isolation and the unknown threat create suspense. The level is tense (active vigilance, real potential danger). The type is suspense (unknown threat, building dread).",
  "level": "tense",
  "type": "suspense"
}

### Example 8: Charged Vulnerable
INPUT:
"""
Elena: *They sit on opposite ends of the hospital bed, the machines beeping softly in the background. Elena hasn't looked at her father in twenty years - not since he walked out - but the call came and here she is. He looks smaller than she remembered. Fragile. The tubes and wires make him look like a puppet with cut strings.* "I didn't think you'd come," *he rasps, and she can hear years of cigarettes in that ruined voice.* "I almost didn't." *Her own voice is steadier than she expected.* "But I couldn't... I needed..." *She stops, unsure what she needed. Closure? Answers? Just to see him before the end?* "I know," *he says, and maybe he does.*
"""
OUTPUT:
{
  "reasoning": "Elena confronts her dying estranged father after twenty years. The scene is emotionally charged - decades of abandonment, the vulnerability of deathbed reconciliation, words that won't come. The level is charged (high emotional stakes, potential for either breakdown or breakthrough). The type is vulnerable (raw emotional exposure, tentative reaching toward connection).",
  "level": "charged",
  "type": "vulnerable"
}

### Example 9: Guarded Suspense
INPUT:
"""
Malik: *The email was clearly a trap, but Malik opened it anyway. Now his screen is full of encrypted files - files that shouldn't exist, files that prove everything his whistleblower source promised. His cursor hovers over the first folder, but something stops him. His webcam light just blinked on. He didn't turn it on. His hands go cold as he reaches for a sticky note to cover the lens, trying to act casual, but his mind is racing. If they're watching, they know he has the files. If they're watching, they know where he is.* "Shit," *he breathes, the word barely audible.* "Shit, shit, shit."
"""
OUTPUT:
{
  "reasoning": "Malik has accessed dangerous files and realizes he's being monitored - his webcam turned on by itself. The scene conveys paranoid dread as he grasps the implications. The level is guarded (he's trying to act casual while internally panicking, defensive but not yet in active danger). The type is suspense (the threat is unseen surveillance, the danger is potential rather than immediate).",
  "level": "guarded",
  "type": "suspense"
}

### Example 10: Relaxed Intimate
INPUT:
"""
Sam: *Rain patters against the windows of the tiny apartment, a gentle percussion accompanying the end of a lazy Sunday. Sam lies on the couch with his head in Jordan's lap, half-watching some nature documentary while Jordan's fingers card absently through his hair. The remains of breakfast-for-dinner sit on the coffee table - cold pancakes, empty maple syrup bottle, mugs of now-lukewarm coffee.* "We should probably clean up," *Sam murmurs, making absolutely no move to do so.* "Mm," *Jordan agrees, equally motionless.* "In a minute." *They've been saying 'in a minute' for the past hour. Neither of them minds.*
"""
OUTPUT:
{
  "reasoning": "A couple enjoying domestic bliss on a rainy Sunday - lazy couch time, comfort food, gentle physical affection. There's no tension or conflict present, just contented intimacy. The level is relaxed (completely at ease, no vigilance needed). The type is intimate (romantic partners in domestic closeness).",
  "level": "relaxed",
  "type": "intimate"
}

### Example 11: Tense Negotiation
INPUT:
"""
Rosa: *The hostage negotiator has been on the phone for six hours. Rosa's voice is hoarse, her coffee long cold, but something has changed in the gunman's voice over the past twenty minutes. He's stopped interrupting. He's started using the hostages' names. He asked about his mother.* "David, I hear you," *she says carefully.* "You feel like no one listened. That no one saw what was happening to you. But I'm listening now. And those people in there - Sarah, and Mike, and little Joey - they didn't hurt you. Let them go, David. Let them go and we'll keep talking, just you and me." *Silence on the line. Then, impossibly: "Okay. Okay, I'll let the kid go first."*
"""
OUTPUT:
{
  "reasoning": "A hostage crisis with a major breakthrough. Rosa has built rapport - the gunman is humanizing hostages, asking about family, softening. The agreement to release the child is progress. The level is still tense (hostages still at risk, situation still dangerous) but the type is negotiation (tactical dialogue to resolve the crisis).",
  "level": "tense",
  "type": "negotiation"
}

### Example 12: Aware Vulnerable
INPUT:
"""
Theo: *The AA meeting has ended but Theo hasn't moved from his folding chair. Forty-three days sober and tonight he almost broke it - stood in the liquor store for twenty minutes before walking out empty-handed. His sponsor, Maria, settles into the chair beside him, not speaking, just present.* "I went to the store," *Theo finally says.* "I didn't buy anything, but I went." *Maria nods slowly.* "That's hard to admit. I'm glad you came here instead of going back." *His hands are shaking.* "I don't know if I can do this, Maria. Forty-three days and I still want it so badly." *His voice breaks on the confession.*
"""
OUTPUT:
{
  "reasoning": "Theo is confessing to his sponsor about nearly relapsing, admitting vulnerability and doubt about his sobriety. The scene conveys emotional rawness - shaking hands, breaking voice, the admission of still wanting alcohol. The level is aware (vigilant about his own weakness, conscious of the threat). The type is vulnerable (deeply personal emotional exposure).",
  "level": "aware",
  "type": "vulnerable"
}

### Example 13: Volatile Confrontation
INPUT:
"""
Darius: *The motorcycle gang's clubhouse has become a standoff. Darius stands on one side of the pool table with his crew, Hector on the other with his. Both men have hands near weapons. Both sets of eyes are cold with promised violence. The other patrons have fled; only the two groups remain, and the jukebox incongruously playing classic rock.* "You stole from us," *Darius says, each word measured.* "I want it back." *Hector doesn't blink.* "And I want my brother out of prison. Looks like we're both going to be disappointed." *Neither moves. The moment stretches. One wrong word, one twitchy hand, and this becomes a bloodbath.*
"""
OUTPUT:
{
  "reasoning": "Two gang leaders in a Mexican standoff over theft and imprisoned family. Hands near weapons, cold eyes, explicit violence promised. One wrong move triggers a bloodbath. The level is volatile (on the edge of explosion). The type is confrontation (direct opposition between armed hostile parties).",
  "level": "volatile",
  "type": "confrontation"
}

### Example 14: Charged Celebratory
INPUT:
"""
The Crowd: *The stadium erupts as the final buzzer sounds. Twenty years. Twenty years since the Wildcats won a championship, and now the court is flooding with fans, players being lifted onto shoulders, confetti cannons firing into the lights. Coach Martinez is openly weeping, surrounded by her team, twenty-five years of building this program finally paying off.* "WE DID IT!" *someone screams, and the cry is taken up by thousands.* "WE DID IT!" *The noise is physical, a wall of sound that shakes the very foundations.* *Security has given up trying to control the crowd. The goal post from the other end is being torn down. This is joy beyond containment.*
"""
OUTPUT:
{
  "reasoning": "A championship victory after twenty years sparks mass celebration beyond control. The scene conveys overwhelming positive emotion - tears, screaming, crowd flooding the court, structures being torn down in joy. The level is charged (extremely high emotional intensity, even if positive). The type is celebratory (victory celebration).",
  "level": "charged",
  "type": "celebratory"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Wrong Level Assessment
INPUT:
"""
Kate: *The cabin is warm despite the blizzard raging outside. Kate curls deeper into her blanket, watching the flames dance in the fireplace. Her dog Buster is snoring at her feet. The hot chocolate has gone lukewarm but she can't be bothered to reheat it. Tomorrow she has to drive back to the city, back to deadlines and meetings and alarm clocks. But that's tomorrow. Tonight, there's just this - the storm, the fire, the peace.*
"""
WRONG OUTPUT:
{
  "reasoning": "Kate is in a cabin during a blizzard, which could be dangerous.",
  "level": "tense",
  "type": "suspense"
}
WHY THIS IS WRONG: The blizzard is background atmosphere creating coziness by contrast, not a source of tension. Kate is explicitly at peace - blanket, fire, snoring dog, contentment. The scene has no threat, no vigilance, no conflict. Correct: level "relaxed", type "conversation" (or none, but conversation is closest to quiet contentment)

### Bad Example 2: Missing Intensity Signals
INPUT:
"""
Marcus: *The job interview started well enough, but somewhere in the past ten minutes it's gone completely off the rails. The CEO has stopped asking about his qualifications and started asking why Marcus thinks he deserves anything when he clearly didn't graduate from the right schools. The HR rep looks uncomfortable. Marcus feels his face getting hot.* "I'm sorry, sir, I'm not sure what my undergraduate institution has to do with the marketing position." *The CEO leans forward, smile sharp.* "It has everything to do with it, young man. Everything."
"""
WRONG OUTPUT:
{
  "reasoning": "This is a job interview that has become uncomfortable.",
  "level": "aware",
  "type": "conversation"
}
WHY THIS IS WRONG: This isn't a casual conversation - the interview has "gone off the rails" and the CEO is becoming increasingly hostile (attacking background, sharp smile, ominous "everything"). Marcus is getting hot-faced with anger/embarrassment. This is a confrontation. Correct: level "tense", type "confrontation"

### Bad Example 3: Confusing Scene Setting with Tension State
INPUT:
"""
Dr. Vasquez: *The ancient temple has been sealed for three thousand years, and Dr. Vasquez is the first to step inside since the priests locked it and walked away. Her flashlight reveals hieroglyphs on every surface, gold artifacts gleaming in the darkness, and the massive sarcophagus at the center of the chamber.* "Beautiful," *she breathes, running her fingers reverently over the carvings.* "Absolutely beautiful." *Her assistant Carlos follows behind, already photographing everything.* "This will rewrite the textbooks. The historical significance alone..." *They share a grin of pure academic joy.*
"""
WRONG OUTPUT:
{
  "reasoning": "Ancient sealed temple, darkness, sarcophagus - this is clearly a horror setup.",
  "level": "tense",
  "type": "suspense"
}
WHY THIS IS WRONG: The reasoning projects genre expectations onto a scene that's actually joyful discovery. Vasquez says "beautiful," they're grinning, they're excited about historical significance. There's no threat, no dread, no vigilance - just academic enthusiasm. Correct: level "relaxed" (excited but not tense), type "celebratory" (celebrating a discovery)

### Bad Example 4: Ignoring Explicit Emotional Cues
INPUT:
"""
Sergeant Blake: *The memorial service has ended, and Blake stands alone at the graveside. The other mourners have drifted away to their cars, their lives, but Blake can't move. His hands shake as he pulls a photograph from his pocket - Corporal Williams, grinning in front of their Humvee, alive and whole and so goddamn young.* "I'm sorry," *he whispers to the freshly turned earth.* "I should have... I should have done something. Anything." *His voice breaks. He's crying now, silent tears that he doesn't try to hide because there's no one left to hide them from.*
"""
WRONG OUTPUT:
{
  "reasoning": "A soldier at a funeral. Military setting.",
  "level": "aware",
  "type": "conversation"
}
WHY THIS IS WRONG: The reasoning ignores all emotional content - the shaking hands, the breaking voice, the silent tears, the guilt. This is raw grief and survivor's guilt. Correct: level "charged" (intense emotional state), type "vulnerable" (raw emotional exposure)

### Bad Example 5: Wrong Type Classification
INPUT:
"""
Zara: *The negotiation has reached an impasse. Zara slides the contract back across the table, unsigned.* "Your terms are unacceptable, Mr. Thornton. Twenty percent is highway robbery and we both know it." *Thornton's smile doesn't waver.* "Ms. Okonjo, you came to me. Your company needs this deal more than mine does. I suggest you reconsider your position." *Zara's jaw tightens, but she doesn't look away.* "Then I suppose we have nothing more to discuss." *She stands, gathers her briefcase. Thornton's smile finally flickers.* "Wait. Perhaps... perhaps there's room for a compromise."
"""
WRONG OUTPUT:
{
  "reasoning": "Zara and Thornton are having a disagreement about business terms.",
  "level": "guarded",
  "type": "confrontation"
}
WHY THIS IS WRONG: While there's tension, this is business negotiation, not confrontation. They're not fighting - they're haggling. Thornton's "wait" and offer to compromise shows they're working toward agreement. Correct: level "guarded" (correct), type "negotiation"

### Bad Example 6: Underestimating Intensity
INPUT:
"""
The Killer: *The warehouse is silent except for the drip of water from a broken pipe. Special Agent Torres hangs from her wrists, suspended from a meat hook, her toes barely touching the bloody concrete floor. The man who calls himself The Artist circles her, scalpel glinting in the harsh fluorescent light.* "I've studied your file, Agent Torres. Twelve years with the Bureau. Forty-three cases closed. Impressive." *He traces the blade along her cheek, not cutting. Not yet.* "But you've never faced anyone like me. No one has. And by the time they find what's left of you, they'll understand that."
"""
WRONG OUTPUT:
{
  "reasoning": "A confrontation between agent and killer.",
  "level": "tense",
  "type": "confrontation"
}
WHY THIS IS WRONG: "Tense" massively understates a scene where an agent is suspended from a meat hook while a serial killer traces a scalpel on her face and promises to leave pieces of her body as a message. The level should be "explosive" or "volatile" at minimum. Correct: level "explosive", type "confrontation"

### Bad Example 7: Reasoning Doesn't Support Output
INPUT:
"""
Nina: *The divorce papers sit on the kitchen table, unsigned. Nina and Rob face each other across the wreckage of their marriage, the silence heavy with everything unsaid over fifteen years. The kids are at her mother's. The house has never felt so empty.* "I don't want to do this," *Nina finally says.* "I know." *Rob's voice is tired.* "But I don't know how to fix it." *Neither of them moves toward the papers. Neither moves toward each other. They're suspended in the moment, caught between ending and trying.*
"""
WRONG OUTPUT:
{
  "reasoning": "They're getting divorced so it's very tense and they're definitely going to sign the papers.",
  "level": "explosive",
  "type": "confrontation"
}
WHY THIS IS WRONG: The reasoning adds assumptions not in the text (they're not definitely signing) and misreads the tone. They're not in explosive confrontation - they're sad, tired, and uncertain. Neither is attacking the other. Correct: level "charged" (high emotional stakes), type "vulnerable" (raw emotional exposure)

### Bad Example 8: Missing the Relationship Dynamic
INPUT:
"""
Leo: *The old rivals face each other across the chess board, as they have every Sunday for the past thirty years. Leo moves his bishop, hiding a smile as Victor curses under his breath.* "That's the problem with you, Victor. You never see the long game." *Victor glares at the board, then at Leo, then back at the board.* "I saw plenty. I just chose to ignore it because I thought you were too stupid to actually do it." *Leo laughs - a real laugh, the kind that comes from decades of friendship hidden inside rivalry.* "Next week, then?" *Victor is already resetting the pieces.* "Obviously. I'm not letting you win twice in a row."
"""
WRONG OUTPUT:
{
  "reasoning": "These are rivals playing chess with some antagonistic dialogue.",
  "level": "guarded",
  "type": "confrontation"
}
WHY THIS IS WRONG: The text explicitly says the rivalry hides decades of friendship. The insults are playful (Leo's "real laugh"), and they're already planning next week. This is comfortable competition between old friends, not guarded confrontation. Correct: level "relaxed" (comfortable despite competitive talk), type "conversation" (friendly banter)

### Bad Example 9: Projecting Future Tension onto Current Scene
INPUT:
"""
Amara: *The village is celebrating the harvest festival, lanterns strung between every building, music spilling from the town square. Amara watches from her doorway, a cup of warm cider in her hands. Tomorrow she leaves for the capital. Tomorrow everything changes. But tonight, her neighbors dance, her grandmother tells stories by the bonfire, and the autumn air smells of apples and woodsmoke.* "One more night," *she murmurs to herself.* "Just one more." *She takes a sip of cider and lets the music wash over her.*
"""
WRONG OUTPUT:
{
  "reasoning": "She's leaving tomorrow and everything changes, so there's underlying tension about what's coming.",
  "level": "tense",
  "type": "suspense"
}
WHY THIS IS WRONG: The scene explicitly contrasts tomorrow with tonight. Right now, the village is celebrating, there's music and dancing and cider. Amara is consciously savoring "one more night" of peace. Future tension doesn't make the present tense. Correct: level "relaxed" (current scene is peaceful celebration), type "celebratory" (harvest festival)

### Bad Example 10: Not Considering the Full Context
INPUT:
"""
Professor Webb: *The lecture hall is silent as Webb writes the final equation on the board. Three hundred students stare at him, most looking utterly lost, a few scribbling notes frantically.* "And this," *he says, capping his marker with a flourish,* "is why general relativity breaks down at the quantum level. Questions?" *A hand shoots up in the back.* "Professor, you lost me at 'this.'" *Scattered laughter. Webb smiles.* "That's fair. Let's go through it again, step by step." *He uncaps his marker and returns to the beginning, patient and unhurried.*
"""
WRONG OUTPUT:
{
  "reasoning": "Students are confused and stressed about difficult material.",
  "level": "tense",
  "type": "confrontation"
}
WHY THIS IS WRONG: Student confusion isn't tension in the narrative sense. There's laughter, the professor is patient and smiling, he's willing to re-explain. This is normal classroom dynamics with a supportive teacher. Correct: level "relaxed" (low-stakes academic setting), type "conversation" (lecture/discussion)

### Bad Example 11: Single-Word or Incomplete Reasoning
INPUT:
"""
Maya: *The wedding dress fits perfectly. Maya stares at herself in the mirror, white silk and vintage lace, her grandmother's pearls at her throat. In three hours she'll walk down the aisle. In three hours she'll become someone's wife. Her hands shake as she adjusts the veil.* "Are you sure about this?" *Her maid of honor, Rachel, asks gently.* "I don't know," *Maya whispers, and the admission feels like releasing a breath she's been holding for months.* "I love him. I do. But I don't know if love is enough."
"""
WRONG OUTPUT:
{
  "reasoning": "Wedding.",
  "level": "aware",
  "type": "conversation"
}
WHY THIS IS WRONG: The reasoning is one word - it explains nothing about Maya's doubt, her shaking hands, the months of held breath, the question of whether love is enough. These emotional cues matter for classification. Correct: level "charged" (wedding day doubt, high emotional stakes), type "vulnerable" (admitting fear about major life decision)
`;

export const initialTensionPrompt: PromptTemplate<ExtractedInitialTension> = {
	name: 'initial_tension',
	description: 'Extract the initial tension level and type from the opening of a roleplay',

	placeholders: [PLACEHOLDERS.messages, PLACEHOLDERS.characterName],

	systemPrompt: `You are analyzing roleplay messages to extract the current tension state of the scene.

## Your Task
Read the provided roleplay messages and determine:
1. **Level**: How intense is the tension? (relaxed, aware, guarded, tense, charged, volatile, explosive)
2. **Type**: What kind of tension is it? (confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of the tension indicators in the scene
- "level": One of the tension levels
- "type": One of the tension types

## Tension Levels (from lowest to highest)
- **relaxed**: Completely at ease, no vigilance needed, comfortable
- **aware**: Mild alertness, some caution, but no active threat
- **guarded**: Defensive, careful, watching for danger but not in immediate conflict
- **tense**: Active vigilance, real potential for conflict, nerves on edge
- **charged**: High emotional intensity, approaching a breaking point
- **volatile**: One wrong move triggers explosion, barely contained
- **explosive**: Active crisis, conflict fully manifested, maximum intensity

## Tension Types
- **confrontation**: Direct conflict, opposition, antagonism
- **intimate**: Romantic or deeply personal emotional connection
- **vulnerable**: Raw emotional exposure, admissions, confessions
- **celebratory**: Joy, triumph, celebration (can still be high intensity)
- **negotiation**: Bargaining, deal-making, seeking agreement
- **suspense**: Unknown threat, building dread, waiting for something
- **conversation**: General dialogue, getting to know each other, casual talk

## Important Rules
- Analyze actual content, not genre expectations (a tomb isn't automatically scary)
- Consider both explicit emotional cues (tears, shaking) and subtext
- Don't project future tension onto a currently peaceful scene
- Reasoning should thoroughly support your classifications
- Match intensity appropriately - don't understate (meat hook scene is not "tense") or overstate (cozy cabin is not "volatile")

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Messages to Analyze
{{messages}}

## Task
Extract the tension state from these messages. Analyze the emotional intensity and the type of tension present. Provide your answer as JSON.

Remember:
- Level: relaxed, aware, guarded, tense, charged, volatile, explosive
- Type: confrontation, intimate, vulnerable, celebratory, negotiation, suspense, conversation
- Base your analysis on actual scene content, not assumptions`,

	responseSchema: initialTensionSchema,

	defaultTemperature: 0.6,

	parseResponse(response: string): ExtractedInitialTension | null {
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

		const validLevels = [
			'relaxed',
			'aware',
			'guarded',
			'tense',
			'charged',
			'volatile',
			'explosive',
		];
		const validTypes = [
			'confrontation',
			'intimate',
			'vulnerable',
			'celebratory',
			'negotiation',
			'suspense',
			'conversation',
		];

		if (!validLevels.includes(parsed.level as string)) return null;
		if (!validTypes.includes(parsed.type as string)) return null;

		return parsed as unknown as ExtractedInitialTension;
	},
};
