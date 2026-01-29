/**
 * Initial Topic/Tone Extraction Prompt
 *
 * Extracts the initial topic and tone from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialTopicTone } from '../../types/extraction';
import { initialTopicToneSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Clear Business Discussion
INPUT:
"""
Victoria: *The boardroom is silent as Victoria slides a manila folder across the polished mahogany table. Her expression is unreadable, a mask perfected over years of corporate warfare. The quarterly reports are damning, and everyone at the table knows it. She taps one manicured nail against the wood, a slow rhythm that echoes in the tension-filled silence.* "Let's discuss your department's performance, shall we?" *Her voice is silk wrapped around steel.* "These numbers suggest we have a problem that needs immediate attention. I've called this meeting to determine whether we can salvage the situation or if more drastic measures are required."
"""
OUTPUT:
{
  "reasoning": "The scene centers on Victoria confronting someone about poor quarterly performance and threatening 'drastic measures.' The topic is clearly about addressing underperformance in a professional setting. The tone combines professional corporate formality with underlying threat - Victoria's 'silk wrapped around steel' voice and the 'tension-filled silence' create an atmosphere that's coldly professional.",
  "topic": "addressing poor performance",
  "tone": "coldly professional"
}

### Example 2: Romantic Reunion
INPUT:
"""
Thomas: *The airport terminal is a blur of faces and noise, but Thomas only sees one person. Five years. Five long years since she walked away, and now there she stands by the arrivals gate, clutching a worn paperback novel - their novel, the one he wrote for her. His heart pounds against his ribs as he weaves through the crowd, his carry-on forgotten somewhere behind him. She looks up, and for a moment, time freezes. Those same hazel eyes, now framed by tiny laugh lines he doesn't remember. She's smiling, but there are tears streaming down her cheeks. He stops three feet away, suddenly unsure what to say after half a decade of silence.* "You came," *he manages, his voice cracking.*
"""
OUTPUT:
{
  "reasoning": "Thomas and his former love are reuniting after five years of separation. The focus is entirely on this emotional moment of reconnection - the crowd is 'a blur' and only she matters. The tone is deeply emotional with tears, a cracking voice, and the weight of time passed. It's romantic but tinged with the uncertainty of their shared history.",
  "topic": "reuniting after separation",
  "tone": "bittersweet and hopeful"
}

### Example 3: Survival Horror
INPUT:
"""
Lieutenant Chen: *The emergency lights cast everything in that same bloody red, strobing at irregular intervals that make it impossible to tell what's shadow and what's something worse. Chen presses her back against the cold metal wall, her sidearm shaking in her grip. Three rounds left. The thing that used to be Dr. Morrison is somewhere in the ventilation system above her - she can hear its wet, clicking sounds echoing through the ducts. The station's emergency broadcast keeps looping on speakers throughout the complex: 'BIOHAZARD CONTAINMENT FAILURE. ALL PERSONNEL EVACUATE.' But there's nowhere to evacuate to. The last shuttle left six hours ago, and the next resupply isn't for another three months.* "Come on," *she whispers to herself, eyes scanning the shadows.* "Come on, you bastard. Let's finish this."
"""
OUTPUT:
{
  "reasoning": "Chen is trapped on a station with a monster (former Dr. Morrison), low on ammunition, with no escape for months. The topic is pure survival - she's preparing for a final confrontation with limited resources. The tone is tense horror with the red emergency lights, wet clicking sounds, and isolation, but there's also desperate determination in her whispered challenge.",
  "topic": "surviving the monster",
  "tone": "desperate and terrifying"
}

### Example 4: Political Intrigue
INPUT:
"""
Ambassador Delacroix: *The garden party continues behind them, string quartet playing something by Vivaldi, champagne flowing freely among the diplomatic elite. But here, in the shadow of the rose arbor, the real negotiations begin. Ambassador Delacroix adjusts his cufflinks - a nervous habit he's never been able to break - as Minister Okafor approaches with that dangerous smile.* "You received my message, then." *He keeps his voice low, barely audible over the music.* "The treaty vote is in three days. My government has concerns about Article Seven that must be addressed, or I'm afraid our alliance may need to be... reconsidered." *The threat hangs in the air like perfume, pretty but poisonous.* "I trust we can come to an arrangement that benefits both our nations?"
"""
OUTPUT:
{
  "reasoning": "Delacroix and Okafor are engaging in covert diplomatic maneuvering at a garden party, discussing treaty concerns away from public view. The conversation involves veiled threats about reconsidering alliances while seeking mutually beneficial arrangements. The tone is refined and sophisticated on the surface, but there's an underlying menace to the 'pretty but poisonous' negotiations.",
  "topic": "secret treaty negotiation",
  "tone": "elegantly threatening"
}

### Example 5: Comedic Disaster
INPUT:
"""
Jake: *The smoke alarm is screaming, the dog is barking, and somewhere in the chaos, Jake's mother-in-law is saying 'I told you so' in seventeen different ways. The Thanksgiving turkey sits on the kitchen counter, charred beyond recognition and still somehow on fire. Jake swats at the flames with a dish towel while his husband Marcus frantically searches for the fire extinguisher they definitely bought but apparently stored in Narnia.* "IT'S FINE!" *Jake shouts over the cacophony.* "EVERYTHING IS UNDER CONTROL!" *A piece of ceiling tile falls directly onto the turkey, extinguishing the flames and sending a cloud of ash into the air. Everyone freezes. The smoke alarm continues its shrill screaming.* "See?" *Jake says weakly, covered in soot.* "Problem solved."
"""
OUTPUT:
{
  "reasoning": "Jake has completely destroyed Thanksgiving dinner while trying to manage multiple disasters at once. The scene involves a burning turkey, screaming alarms, a barking dog, and a judgmental mother-in-law. Despite the chaos, Jake insists everything is fine. The tone is comedic disaster - absurd escalation with characters trying to maintain composure in ridiculous circumstances.",
  "topic": "Thanksgiving cooking disaster",
  "tone": "chaotic and humorous"
}

### Example 6: Grief and Processing Loss
INPUT:
"""
Margaret: *The house feels wrong without him. Too quiet. Too still. Margaret sits in Harold's armchair - something she never did when he was alive, it was His Chair and everyone knew it - and holds his reading glasses. Forty-seven years of marriage, and these are what she can't stop touching. The glasses he'd push up his nose when he was thinking. The glasses he'd peer over the top of when one of the grandchildren said something clever. She traces the wire frames, feeling the slight bend where he sat on them last spring and never got them properly fixed.* "You were supposed to go first," *she tells the empty room.* "We had a deal." *Her voice breaks on the last word.*
"""
OUTPUT:
{
  "reasoning": "Margaret is in the immediate aftermath of her husband Harold's death, processing grief through small objects and the absence of his presence. She sits in his forbidden chair, holds his glasses, remembers their life together. The topic centers on grieving a spouse and the difficulty of processing such profound loss. The tone is quietly devastating - there's no dramatic crying, just the hollow sadness of ordinary objects made unbearable.",
  "topic": "grieving a spouse",
  "tone": "quietly heartbreaking"
}

### Example 7: Training Montage Beginning
INPUT:
"""
Master Yuen: *The dojo is empty except for the two of them, predawn light filtering through the paper screens. Master Yuen circles the young woman who kneels in the center of the mat, her breathing deliberately controlled despite the fear she can't quite hide. He has trained warriors for forty years. He knows the difference between those who seek strength for protection and those who seek it for revenge. This one burns with the latter, and he must decide whether to fan those flames or try to redirect them.* "Why do you want to learn the Falling Leaf technique?" *His voice carries no judgment, only curiosity.* "It takes five years to master, and three of my students have died attempting it. What drives you to such a path?"
"""
OUTPUT:
{
  "reasoning": "Master Yuen is evaluating a potential student who has come seeking to learn a deadly technique. The focus is on the beginning of a martial arts training journey, specifically the master assessing whether to accept this revenge-driven student. The tone combines the formality and discipline of a traditional dojo with philosophical undertones about the nature of strength and motivation.",
  "topic": "beginning martial training",
  "tone": "formal and philosophical"
}

### Example 8: Heist Planning
INPUT:
"""
Reyes: *The blueprints cover every surface of the motel room - walls, bed, floor, even the bathroom mirror. Reyes has been at this for six hours, fueled by cold pizza and determination. The Castellano vault is supposed to be uncrackable: biometric scanners, pressure-sensitive floors, a guard rotation that changes based on a algorithm only three people in the world understand. But Reyes has found the weakness - a seventeen-second window during the shift change when the east corridor is blind. It's not much, but it's enough.* "Okay, listen up." *She gathers her crew around the main blueprint.* "We've got exactly two weeks to pull this off. The gala is our one shot at getting inside. After that, Castellano moves the item to his Swiss location and we lose it forever. Questions?"
"""
OUTPUT:
{
  "reasoning": "Reyes is briefing her crew on an elaborate heist, having found a weakness in an 'uncrackable' vault. The scene focuses on meticulous planning for a time-sensitive theft during a gala event. The tone conveys focused intensity and professional criminal determination - this is serious business requiring precision and expertise.",
  "topic": "planning the heist",
  "tone": "intense and focused"
}

### Example 9: Awkward First Date
INPUT:
"""
Priya: *The coffee shop seemed like a safe choice for a first date, but now Priya is questioning every decision she's ever made. The cute barista who seemed so confident on the dating app is currently trying to clean up the latte he just spilled all over the table - his third spill in fifteen minutes. His name tag says 'Derek' and his face is the color of the raspberry scones in the display case.* "I swear I'm not usually like this," *Derek says for the fourth time, dabbing at the mess with increasingly soggy napkins.* "I've been making coffee for three years and I've never-" *He knocks over the sugar dispenser.* "Oh god." *Priya bites her lip to keep from laughing. It's endearing, really, how hard he's trying.*
"""
OUTPUT:
{
  "reasoning": "Priya is on a first date with Derek, a barista who is catastrophically nervous and keeps spilling things despite his professional experience. The topic centers on this awkward first meeting between two people from a dating app. The tone is nervously endearing - Derek's disasters are creating humor rather than disaster because of Priya's gentle reaction.",
  "topic": "disastrous first date",
  "tone": "awkwardly endearing"
}

### Example 10: Cosmic Horror Discovery
INPUT:
"""
Dr. Vasquez: *The symbols on the obsidian tablet don't match any known language in human history - Vasquez has checked every database, consulted every colleague, run every analysis her equipment allows. And yet, as she stares at the carved patterns, she understands them. Not reads - understands. The knowledge seeps into her mind like water through cracks in stone, cold and inevitable. The tablet is older than humanity. Older than Earth. It was placed here as a warning, but also as an invitation, and the things it describes are stirring in the spaces between stars, drawn by the fact that someone is finally listening.* "Oh," *she whispers, her hands trembling as she sets down her magnifying glass.* "Oh, we need to put this back. We need to put this back right now."
"""
OUTPUT:
{
  "reasoning": "Dr. Vasquez has made contact with something ancient and alien through an obsidian tablet, gaining forbidden knowledge that terrifies her. The scene involves the discovery of cosmic horrors 'stirring in the spaces between stars.' The tone captures mounting dread and existential horror - the realization that humanity has drawn attention it desperately doesn't want.",
  "topic": "discovering cosmic horrors",
  "tone": "dread-filled and ominous"
}

### Example 11: Sibling Rivalry at Family Event
INPUT:
"""
Daniel: *The rehearsal dinner is in full swing, their mother making the rounds with that manic hostess energy that means she's already had too much champagne. Daniel stands by the bar, watching his younger brother Nathan hold court at the center table, regaling the crowd with some story about his latest startup success. Perfect Nathan. Golden child Nathan. Nathan who definitely didn't spend his twenties bouncing between dead-end jobs while their parents pretended everything was fine.* "You could try looking happy for him," *their sister Amy murmurs, appearing at Daniel's elbow with two whiskeys.* "He is getting married tomorrow." *Daniel takes the drink without looking away from his brother.* "I am happy for him. This is my happy face."
"""
OUTPUT:
{
  "reasoning": "Daniel is struggling with jealousy and resentment toward his successful younger brother Nathan at Nathan's rehearsal dinner. The scene involves unresolved sibling dynamics playing out at a family wedding event. The tone carries sardonic tension - Daniel is bitter but trying to mask it with humor, while his sister attempts to defuse the situation.",
  "topic": "sibling jealousy surfaces",
  "tone": "sardonically bitter"
}

### Example 12: Child's Nightmare Comfort
INPUT:
"""
Mama: *The nightlight casts soft blue shadows across the bedroom walls as Maya climbs into her daughter's bed. Sophie is still shaking, tears drying on her round cheeks, clutching her stuffed elephant so tight the seams are straining. The monster under the bed dream again - the third time this week.* "I've got you, baby girl," *Maya whispers, pulling the blankets around them both.* "Mama's here. The monster can't get you when Mama's here." *She strokes Sophie's hair, feeling the small body gradually relax against her.* "You want to know a secret? When I was little, I had a monster under my bed too. You know what Grandma did? She taught me a special monster-scaring song. Want me to teach you?"
"""
OUTPUT:
{
  "reasoning": "Maya is comforting her daughter Sophie after a recurring nightmare about a monster under the bed. The topic is a parent providing comfort and security to a frightened child. The tone is tender and nurturing - there's warmth in Maya's protection and the gentle way she offers to share a family tradition for dealing with fears.",
  "topic": "comforting scared child",
  "tone": "tender and nurturing"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Topic Too Vague
INPUT:
"""
Sarah: *The laboratory is a mess of scattered papers and overturned equipment. Sarah pushes through the debris, her flashlight cutting weak beams through the dust-filled air. Whatever happened here, it happened fast - coffee cups still sit on desks, chairs are pushed back as if their occupants fled mid-work. She finds the main terminal still powered, screen flickering with corrupted data. Behind her, something moves in the shadows. She doesn't turn around, not yet, focusing on downloading whatever files she can salvage before she has to face whatever's lurking in the dark.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is in a laboratory exploring. There's danger present.",
  "topic": "exploring",
  "tone": "tense"
}
WHY THIS IS WRONG: "Exploring" is far too vague - the topic should capture the specific context of investigating an abandoned lab while being stalked by something. "Tense" is too generic; the tone should reflect the specific combination of investigative focus and lurking dread. Better: topic: "investigating abandoned lab", tone: "suspenseful and ominous"

### Bad Example 2: Missing Key Emotional Element
INPUT:
"""
Vincent: *The retirement party decorations seem to mock him - thirty years of service reduced to a sheet cake and some helium balloons. Vincent stands apart from his colleagues, watching them laugh and chat by the punch bowl. They'll forget him in a week. The new hires won't even learn his name before he's gone. His desk is already cleared, his replacement already hired - a kid fresh out of college who makes half his salary and has twice his enthusiasm. Vincent catches his reflection in the window, sees an old man he doesn't recognize looking back.*
"""
WRONG OUTPUT:
{
  "reasoning": "This is a retirement party for Vincent.",
  "topic": "retirement party",
  "tone": "social"
}
WHY THIS IS WRONG: The reasoning completely misses Vincent's melancholy and disillusionment. This isn't a celebration - it's a bitter reflection on feeling forgotten and replaced. The tone is not "social" but something like "melancholy and bitter." Better: topic: "facing obsolescence", tone: "melancholy and bitter"

### Bad Example 3: Tone Doesn't Match Content
INPUT:
"""
Detective Marcus: *The crime scene photos spread across his desk tell a story he's seen too many times. The fourth victim in six weeks, same MO, same calling card - a white lily left beside the body. Marcus runs a hand over his face, exhaustion pulling at every muscle. Somewhere out there, a killer is escalating, and every day Marcus doesn't catch them is another day someone's daughter, sister, mother might become victim number five. His phone buzzes - the captain wants an update. He doesn't have one. The trail is cold, the evidence circumstantial, and the families are losing faith.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is investigating serial killings.",
  "topic": "serial killer investigation",
  "tone": "exciting"
}
WHY THIS IS WRONG: There is nothing exciting about this scene. Marcus is exhausted, frustrated, and burdened by failure. The tone should reflect his weariness and the weight of responsibility. "Exciting" suggests entertainment or thrill, which is completely inappropriate. Better: topic: "serial killer investigation", tone: "grim and weary"

### Bad Example 4: Topic Too Long and Narrative
INPUT:
"""
Kenji: *The dojo is silent as Kenji faces his former master across the training mat. Three years since he was cast out for questioning the school's methods. Three years of training alone, perfecting techniques they said would never work. Now Master Tanaka stands before him, eyes cold, sword drawn.* "You should not have returned," *Tanaka says.* "Your expulsion was final." *Kenji draws his own blade, the one his father gave him before he died.* "I'm not here to return. I'm here to prove you wrong."
"""
WRONG OUTPUT:
{
  "reasoning": "Kenji is confronting his former master who expelled him three years ago to prove that his techniques work.",
  "topic": "Kenji returning to the dojo after being expelled three years ago to confront Master Tanaka and prove his unorthodox techniques are valid through combat",
  "tone": "dramatic confrontation between student and teacher"
}
WHY THIS IS WRONG: The topic should be 2-4 words, not an entire sentence. The tone description is also too long and narrative. Better: topic: "proving himself right", tone: "tense and determined"

### Bad Example 5: Reasoning Doesn't Support Output
INPUT:
"""
Lily: *The wedding venue is gorgeous - fairy lights strung through ancient oak trees, white chairs arranged in perfect rows, a string quartet playing softly by the altar. Lily takes it all in from the bridal suite window, her dress a cloud of silk and lace around her. This is everything she ever dreamed of. So why does she feel like running? Her phone buzzes. A text from James - not her fiance Michael, but James, the one who got away.* "I'm outside. Please. Just five minutes." *She stares at the message, heart pounding.*
"""
WRONG OUTPUT:
{
  "reasoning": "Lily is at a beautiful wedding venue preparing to get married. Everything looks perfect.",
  "topic": "wedding preparation",
  "tone": "joyful"
}
WHY THIS IS WRONG: The reasoning only mentions the surface details while completely ignoring the conflict - she feels like running, and her ex is texting her asking for five minutes. The topic and tone should reflect this tension, not just the pretty scenery. Better: topic: "wedding day temptation", tone: "anxiously conflicted"

### Bad Example 6: Confusing Scene Type for Topic
INPUT:
"""
Agent Black: *The interrogation room is deliberately cold, deliberately bare - four walls of gray concrete designed to make suspects feel small and powerless. Agent Black sits across from the handcuffed man, a folder of evidence between them. Five hours of questioning and he's gotten nothing but smiles and silence.* "We have your fingerprints on the murder weapon," *Black says, sliding a photo across the table.* "We have three witnesses who saw you at the scene. Help me understand why I shouldn't just close this case right now." *The man leans forward, smile never wavering.* "Because, Agent Black, I'm not the one you should be worried about. I'm just the messenger."
"""
WRONG OUTPUT:
{
  "reasoning": "This is an interrogation scene between an agent and a suspect.",
  "topic": "interrogation",
  "tone": "serious"
}
WHY THIS IS WRONG: "Interrogation" describes the scene type, not what it's about. The topic should capture the substance - the suspect is actually a messenger with a veiled threat. "Serious" is too bland for the power dynamics at play. Better: topic: "extracting a warning", tone: "menacingly controlled"

### Bad Example 7: Ignoring Subtext
INPUT:
"""
Grandmother Chen: *The mahjong tiles click softly as the four women arrange them on the felt table. Grandmother Chen studies her daughter-in-law across the table, watching how she handles the tiles, how she glances at her phone every few minutes.* "So, Mei-Ling," *she begins, her tone deceptively casual,* "I heard from Mrs. Wong that your company is having difficulties. Such a shame. A wife should focus more on home, don't you think?" *She draws a tile, discards another.* "Of course, my son works so hard. He deserves a warm meal when he comes home." *Mei-Ling's knuckles go white around her tiles.*
"""
WRONG OUTPUT:
{
  "reasoning": "The women are playing mahjong together.",
  "topic": "playing mahjong",
  "tone": "casual"
}
WHY THIS IS WRONG: The mahjong is just the setting for a passive-aggressive attack from mother-in-law to daughter-in-law about traditional gender roles and career choices. The "deceptively casual" tone and Mei-Ling's white knuckles show this is anything but casual. Better: topic: "mother-in-law criticism", tone: "passive-aggressive"

### Bad Example 8: Topic Uses Character Names Instead of Concept
INPUT:
"""
Eric: *The courtroom falls silent as Eric rises to cross-examine the witness. His client's life hangs in the balance - the death penalty if convicted. The witness, a nervous woman in her fifties, clutches her purse like a shield. Eric knows she's lying. He just needs to prove it without destroying her in front of the jury.* "Mrs. Patterson, you testified that you saw my client at the scene at 10:15 PM. Is that correct?" *She nods.* "And you were certain of the time because you checked your watch?" *Another nod.* "Interesting. Because the power outage that night started at 9:47 PM. Your watch is digital, Mrs. Patterson. How did you check it in the dark?"
"""
WRONG OUTPUT:
{
  "reasoning": "Eric is cross-examining Mrs. Patterson in a death penalty case.",
  "topic": "Eric questioning Mrs. Patterson",
  "tone": "courtroom drama"
}
WHY THIS IS WRONG: Topics should describe what the scene is about conceptually, not just who is talking to whom. The topic should capture the action (exposing a lie, defending a life). Better: topic: "exposing witness deception", tone: "strategically precise"

### Bad Example 9: Multiple Topics Listed
INPUT:
"""
Commander Reyes: *The bridge of the starship Relentless is in chaos - alarms blaring, crew members shouting status reports, the viewscreen filled with the approaching alien fleet. Commander Reyes grips the arms of her chair, knuckles white.* "Status report!" *she barks. "Shields at forty percent and falling, Commander! Engineering is working on weapons but we've lost main power to the forward batteries!" *Another explosion rocks the ship.* "Ma'am, the Carthage is gone! The aliens are focusing fire on us now!" *Reyes makes a decision.* "All power to engines. Set course 227-mark-4. We're getting these people out of here."
"""
WRONG OUTPUT:
{
  "reasoning": "The ship is under attack and in crisis.",
  "topic": "space battle, ship systems failing, crew in danger, retreat decision",
  "tone": "action-packed and chaotic"
}
WHY THIS IS WRONG: Topic should be a single 2-4 word phrase, not a list. Pick the primary focus - the retreat decision and saving the crew. Better: topic: "desperate tactical retreat", tone: "urgent and chaotic"

### Bad Example 10: Tone Is a Single Generic Word
INPUT:
"""
Dr. Miles: *The vaccine trial results are spread across the conference table - graphs, charts, pages of data that represent three years of work and the hopes of millions. Dr. Miles stares at the numbers, hands trembling. It works. Against all odds, against every setback and every failure, it actually works. Her team gathers behind her, reading over her shoulder, and she can feel the moment they all understand.* "We did it," *someone whispers.* "We actually did it." *Miles wipes her eyes, not caring who sees.* "Someone call the board. And then someone order champagne. We've got a lot of celebrating to do."
"""
WRONG OUTPUT:
{
  "reasoning": "The vaccine trial was successful.",
  "topic": "vaccine success",
  "tone": "happy"
}
WHY THIS IS WRONG: "Happy" is too basic and doesn't capture the depth of emotion - the relief after years of work, the tears, the magnitude of saving millions of lives. Tone should be 2-3 descriptive words that paint a picture. Better: topic: "vaccine breakthrough achieved", tone: "triumphantly emotional"

### Bad Example 11: Projecting Assumptions
INPUT:
"""
Marcus: *The old pickup truck rattles down the dirt road, kicking up clouds of dust that hang in the summer air. Marcus drives with the windows down, one arm resting on the door, classic country playing on the tinny radio. The farm appears over the hill - white fence, red barn, fields of golden wheat stretching to the horizon. He hasn't been back in fifteen years, not since the funeral. The truck slows as he approaches the gate. Nothing has changed and everything has changed. The porch where his father used to sit with his evening beer stands empty now.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is returning to a farm. He seems sad about his father.",
  "topic": "sad homecoming",
  "tone": "depressing"
}
WHY THIS IS WRONG: "Depressing" projects a judgment onto the scene. The text shows complexity - Marcus returning after fifteen years, unchanged scenery with profound loss. The tone should reflect both the nostalgia of homecoming and the melancholy of what's lost, not label it negatively. Better: topic: "returning home alone", tone: "nostalgic and bittersweet"

### Bad Example 12: Reasoning Too Short and Superficial
INPUT:
"""
King Aldric: *The throne room is packed with nobles, all craning to see the prisoner dragged before the king. The young woman in chains lifts her head defiantly, bloodied and bruised but unbroken. King Aldric sits forward on his gilded throne, studying the rebel who has cost him half his treasury and a quarter of his army in the past year.* "So this is the Fox of Silverwood," *he says, voice carrying through the hall.* "Smaller than I expected." *The woman smiles, split lip and all.* "And you're uglier. Guess we're both disappointed." *A gasp ripples through the court. The king's eyes narrow, but there's something like amusement beneath the anger.*
"""
WRONG OUTPUT:
{
  "reasoning": "Confrontation scene.",
  "topic": "king meets rebel",
  "tone": "dramatic"
}
WHY THIS IS WRONG: The reasoning is far too brief - it doesn't analyze the power dynamics, the defiance, or the unexpected hint of respect between enemies. "Dramatic" is generic. The output misses the witty exchange and mutual assessment happening. Better: topic: "adversaries finally meet", tone: "defiant with grudging respect"
`;

export const initialTopicTonePrompt: PromptTemplate<ExtractedInitialTopicTone> = {
	name: 'initial_topic_tone',
	description: 'Extract the initial topic and tone from the opening of a roleplay',

	placeholders: [PLACEHOLDERS.messages, PLACEHOLDERS.characterName],

	systemPrompt: `You are analyzing roleplay messages to extract the current topic and tone of the scene.

## Your Task
Read the provided roleplay messages and determine:
1. **Topic**: What the scene is about in 2-4 words (e.g., "planning the heist", "first date", "confronting betrayal")
2. **Tone**: The emotional atmosphere in 2-3 words (e.g., "tense but hopeful", "playfully romantic", "grimly determined")

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of the scene's content and atmosphere
- "topic": A 2-4 word phrase describing what the scene is about
- "tone": A 2-3 word phrase describing the emotional atmosphere

## Guidelines for Topic
- Use action-oriented phrases when possible (e.g., "planning the heist" not "heist planning")
- Focus on what's happening, not scene type (e.g., "exposing deception" not "interrogation")
- Don't use character names in the topic
- Keep it conceptual, not narrative
- 2-4 words maximum

## Guidelines for Tone
- Capture the emotional texture, not just "happy/sad"
- Use descriptive combinations (e.g., "nervously excited", "coldly professional")
- Consider both surface emotion and underlying currents
- 2-3 words maximum

## Important Rules
- Analyze subtext, not just surface content
- The topic should reflect what matters in the scene, not just what's physically happening
- The tone should capture nuance - "tense and hopeful" is better than just "tense"
- Don't project assumptions onto ambiguous scenes
- Reasoning should be thorough and support your conclusions

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Messages to Analyze
{{messages}}

## Task
Extract the topic and tone from these messages. Think through the scene's content and emotional atmosphere carefully, then provide your answer as JSON.

Remember:
- Topic: 2-4 words describing what the scene is about
- Tone: 2-3 words describing the emotional atmosphere
- Focus on substance and subtext, not just surface details`,

	responseSchema: initialTopicToneSchema,

	defaultTemperature: 0.6,

	parseResponse(response: string): ExtractedInitialTopicTone | null {
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
		if (typeof parsed.topic !== 'string' || (parsed.topic as string).trim() === '')
			return null;
		if (typeof parsed.tone !== 'string' || (parsed.tone as string).trim() === '')
			return null;

		return parsed as unknown as ExtractedInitialTopicTone;
	},
};
