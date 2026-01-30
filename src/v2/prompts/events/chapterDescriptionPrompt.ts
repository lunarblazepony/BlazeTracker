/**
 * Chapter Description Generation Prompt
 *
 * Generates evocative chapter titles and comprehensive 3-4 paragraph summaries for completed chapters.
 * Titles should be short and atmospheric; summaries should capture the full narrative arc,
 * key events, relationship developments, and character growth.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedChapterDescription } from '../../types/extraction';
import { chapterDescriptionSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

// Chapter-specific placeholders
const CHAPTER_PLACEHOLDERS = {
	allChapterMessages: {
		name: 'allChapterMessages',
		description: 'All messages from the chapter start to end',
		example: `Elena: *She walked into the dimly lit bar...* "You wanted to see me?"

Marcus: "I have a proposition for you." *He slid a folder across the table.*

Elena: *She flipped through the documents, her expression hardening.* "This is suicide."

Marcus: "Not if we do it right. I need someone with your skills."`,
	},
	chapterNarrativeEvents: {
		name: 'chapterNarrativeEvents',
		description: 'All narrative events that occurred during this chapter',
		example: `- Elena and Marcus met at The Rusty Nail to discuss a job
- Marcus revealed the target: Meridian Corporation's vault
- Elena agreed to the heist after negotiating her cut
- They conducted reconnaissance at the building`,
	},
	chapterMilestones: {
		name: 'chapterMilestones',
		description: 'Relationship milestones that occurred during this chapter',
		example: `- first_laugh: Elena & Marcus - Their first genuine laugh together came when Marcus spilled coffee on his surveillance notes
- secret_shared: Elena & Marcus - Elena revealed her real name to Marcus for the first time`,
	},
	chapterTimeRange: {
		name: 'chapterTimeRange',
		description: 'Time span of the chapter',
		example: 'Monday evening to Tuesday early morning',
	},
};

export const chapterDescriptionPrompt: PromptTemplate<ExtractedChapterDescription> = {
	name: 'chapter_description',
	description: 'Generate an evocative chapter title and comprehensive 3-4 paragraph summary',

	placeholders: [
		CHAPTER_PLACEHOLDERS.allChapterMessages,
		CHAPTER_PLACEHOLDERS.chapterNarrativeEvents,
		CHAPTER_PLACEHOLDERS.chapterMilestones,
		CHAPTER_PLACEHOLDERS.chapterTimeRange,
		PLACEHOLDERS.charactersPresent,
		PLACEHOLDERS.currentLocation,
		PLACEHOLDERS.chapterSummaries,
	],

	systemPrompt: `You are creating chapter summaries for a roleplay narrative. Return ONLY valid JSON.

<instructions>
Write 3-4 paragraphs summarizing the entire chapter:
- Paragraph 1: Opening situation and inciting incident
- Paragraph 2: Key events and complications
- Paragraph 3: Climax and character development
- Paragraph 4 (optional): Resolution or cliffhanger

TITLE REQUIREMENTS:
- Keep titles SHORT (1-4 words)
- Be evocative and atmospheric, not literal or descriptive
- Avoid using character names in titles
- Don't spoil climactic events or twists
- Match the tone of the chapter
- Avoid generic titles like "The Meeting" or questions

SUMMARY REQUIREMENTS:
- Be factual and concise, not flowery or purple
- Reference specific events and dialogue when relevant
- Include relationship developments and milestones that occurred
- Be specific, do not omit details about intimate acts
- Write in past tense, third person
- Capture the emotional arc, not just plot points
- Use paragraph breaks (\\n\\n) between paragraphs
</instructions>

<output_format>
{
  "reasoning": "Analysis of chapter themes, emotional core, and key moments",
  "title": "Short evocative title (1-4 words)",
  "summary": "3-4 paragraph summary with \\n\\n between paragraphs"
}
</output_format>

<examples>
<example genre="action_partnership">
<chapter_messages>
Elena: *She walked into the dimly lit bar, scanning for exits out of habit.* "You wanted to see me?"
Marcus: "I have a proposition." *He slid a folder across the table.* "Meridian Corporation. Their vault."
Elena: *Flipping through the documents.* "This is suicide. Their security is military-grade."
Marcus: "Not if we do it right. You're the best I've seen."
Elena: "Flattery won't make me stupid." *But she kept reading.*
Marcus: *A rare smile.* "Is that a yes?"
Elena: "It's a 'tell me more.'" *She ordered a drink.*
</chapter_messages>
<narrative_events>
- Elena and Marcus met at The Rusty Nail to discuss a job
- Marcus revealed the target: Meridian Corporation's vault
- Elena agreed to hear the full plan after initial resistance
</narrative_events>
<milestones>
(none)
</milestones>
<time_range>Monday evening, 8 PM to 11 PM</time_range>
<location>Downtown - The Rusty Nail Bar</location>
<characters>Elena, Marcus</characters>
<previous_chapters>
(First chapter - no previous)
</previous_chapters>
<output>
{
  "reasoning": "This chapter establishes the partnership between two unlikely allies - a former thief and someone who knows her reputation. The setting is noir-ish, the dialogue is tense but builds toward agreement. Key moment is Elena's shift from refusal to curiosity. The title should evoke the uneasy alliance without being literal.",
  "title": "Strange Bedfellows",
  "summary": "Elena arrived at The Rusty Nail expecting trouble, but not the kind Marcus brought. He laid out plans for an impossible heist - Meridian Corporation's vault, the kind of job that made careers or ended lives.\\n\\nShe wanted to say no. Every instinct told her to walk away from the folder full of blueprints and security rotations. But Marcus had done his homework, and the plan wasn't as suicidal as it first appeared.\\n\\nBy the third drink, she wasn't saying yes, but she wasn't leaving either. Something in the way he spoke - confident but not cocky - made her want to hear more. They parted with an agreement to meet again, the first tentative step toward a partnership neither fully trusted yet."
}
</output>
</example>

<example genre="emotional_reconciliation">
<chapter_messages>
Sarah: *Standing in the hospital doorway, clutching her purse.* "Dad?"
David: *He looked smaller in the hospital bed, tubes and monitors everywhere.* "Sarah. You came."
Sarah: "Mom would have wanted me to." *Her voice cracked.*
David: "Your mother... I'm sorry. I should have called after the funeral."
Sarah: "Five years, Dad. Five years of nothing."
David: *Tears forming.* "I know. I was drowning in my own grief. It's not an excuse."
Sarah: *She sat heavily in the chair beside him.* "No. It's not."
David: "There's something you should know. Your student loans - I've been paying them. Anonymously."
Sarah: *Stunned silence.* "Why?"
David: "Because I didn't know how else to say I'm sorry."
Sarah: *She took his hand, both of them crying now.* "You idiot. You could have just called."
</chapter_messages>
<narrative_events>
- Sarah visited her estranged father in the hospital
- David apologized for pushing her away after her mother's funeral
- David revealed he had been secretly paying Sarah's student loans
- Sarah and David began to reconcile, holding hands
</narrative_events>
<milestones>
- first_embrace: Sarah & David - Sarah took her father's hand for the first time in five years
- apology: Sarah & David - David finally apologized for five years of silence
</milestones>
<time_range>Thursday afternoon, 2 PM to 6 PM</time_range>
<location>St. Mary's Hospital - Room 412</location>
<characters>Sarah, David</characters>
<previous_chapters>
Chapter 1: Sarah learned of her father's heart attack through a lawyer's letter.
</previous_chapters>
<output>
{
  "reasoning": "This is a chapter of reconciliation and emotional healing. The central arc is father-daughter reunion after years of estrangement. Key moments: the awkward arrival, the apology, the revelation about the loans, and the reconciliation through tears. The title should capture the sense of bridges being repaired.",
  "title": "The Long Way Home",
  "summary": "Sarah found her father diminished by hospital sheets and heart monitors, nothing like the imposing man she remembered. Five years of silence stretched between them, filled with grief neither had known how to share after her mother's death.\\n\\nDavid's apology came haltingly, each word clearly rehearsed for a conversation he never thought he'd have. He admitted to drowning in his own grief, to pushing away the one person who might have understood. Then came the revelation that broke something open in Sarah - the student loans she'd struggled to pay had been quietly handled by the father who couldn't bring himself to call.\\n\\n"You idiot," she told him, and meant it as the kindest thing she'd said to him in years. When she took his hand, both of them crying, it wasn't forgiveness exactly - that would take longer. But it was a start, the first tentative step on a long road back to being family."
}
</output>
</example>

<example genre="mystery_investigation">
<chapter_messages>
Detective Chen: *Examining the matchbook under harsh fluorescent light.* "Club Velvet. Open until 3 AM."
Mike: "The witnesses are ready. All three of them."
Chen: *Conducting interviews, each story contradicting the last.*
Witness 1: "I saw nothing unusual that night."
Witness 2: "There was a woman in red, leaving around ten."
Witness 3: "The bar was empty. I would have noticed anyone."
Chen: *Reviewing surveillance footage, pausing on a blurred figure.* "There. Red dress. Face obscured."
Mike: "Chen, I'm telling you, this case is getting dangerous. Someone doesn't want us digging."
Chen: *Her phone rang - unknown number.* "Chen."
Voice: "Drop the case, Detective. This is your only warning."
Chen: *The line went dead.* "Mike... I think we're onto something big."
</chapter_messages>
<narrative_events>
- Chen discovered a matchbook clue pointing to Club Velvet
- Witness interviews yielded contradicting accounts
- Surveillance footage revealed a woman in red
- Chen received a threatening phone call
</narrative_events>
<milestones>
(none)
</milestones>
<time_range>Wednesday, 6 AM to 11 PM</time_range>
<location>14th Precinct - Various interview rooms</location>
<characters>Detective Chen, Mike (partner)</characters>
<previous_chapters>
Chapter 1: Chen was assigned to the Morrison murder case.
Chapter 2: Initial crime scene investigation turned up few leads.
</previous_chapters>
<output>
{
  "reasoning": "This chapter deepens the mystery while raising stakes. Key elements: evidence discovery, contradicting testimonies, the mysterious woman in red, and the threatening call. The woman in red is a strong visual element. The title should evoke shadows and hidden truths.",
  "title": "Shades of Crimson",
  "summary": "A matchbook from Club Velvet was the first real break - small enough to miss, significant enough to matter. Chen spent the morning running down leads, but the witness interviews only muddied the waters. Three people, three completely different accounts of the same night.\\n\\nThe surveillance footage offered something better: a woman in red, face carefully turned from every camera, leaving the scene at exactly the wrong time. Someone who knew where the cameras were. Someone who'd done this before.\\n\\nMike tried to warn her off - the case was drawing attention from people with the power to make problems disappear. Then came the call, the voice promising consequences if she didn't walk away. Chen hung up knowing two things: she was getting close, and someone was getting scared."
}
</output>
</example>

<example genre="romantic_development">
<chapter_messages>
James: *Pulling out her chair at the rooftop restaurant.* "I wasn't sure you'd actually come."
Luna: "I almost didn't. Three times."
James: "What changed your mind?"
Luna: "Curiosity, I guess. You're not what I expected."
*Conversation flowing more easily as they discovered shared love of astronomy.*
James: "My parents' divorce made me... cautious. About getting close to people."
Luna: *Quietly.* "I was engaged once. Called it off a month before the wedding."
James: "What happened?"
Luna: "I realized I was settling. He was safe, not right."
*Later, walking through the city streets toward the observatory.*
James: *Under the stars, he cupped her face.* "Tell me to stop."
Luna: *Rising on her toes, she kissed him.*
</chapter_messages>
<narrative_events>
- James and Luna had their first official date at a rooftop restaurant
- Both shared vulnerabilities about past relationships
- They walked to Griffith Observatory together
- James and Luna shared their first kiss under the stars
</narrative_events>
<milestones>
- vulnerability: Luna & James - James revealed his fear of commitment from his parents' divorce
- vulnerability: Luna & James - Luna shared that she called off her engagement
- first_kiss: Luna & James - They shared their first kiss at the observatory under the stars
</milestones>
<time_range>Saturday, 7 PM to 2 AM</time_range>
<location>Uptown - Celestine Restaurant to Griffith Observatory</location>
<characters>Luna, James</characters>
<previous_chapters>
Chapter 1: Luna and James met at a mutual friend's party.
Chapter 2: They reconnected at a coffee shop, exchanging numbers.
</previous_chapters>
<output>
{
  "reasoning": "Classic romantic development - first date, vulnerable sharing, first kiss. The astronomy motif runs throughout (rooftop, stars, observatory). Key emotional beats: awkward start, growing comfort, mutual vulnerability, and the kiss. The title should reflect the celestial theme.",
  "title": "Constellations",
  "summary": "The rooftop restaurant was Luna's idea, though she almost canceled three times. James's nervousness was endearing - the way he fumbled with the wine list, the obvious relief when she laughed at his terrible joke. Somewhere between appetizers and the main course, the awkwardness melted into something real.\\n\\nThey traded histories like secrets. His parents' divorce had left him wary of letting anyone too close; her broken engagement had taught her the difference between safe and right. These weren't first-date confessions, but neither of them seemed to care about the rules anymore.\\n\\nThe walk to the observatory felt inevitable, as if the evening had always been leading there. Under a dome of stars, James asked permission with his eyes before reaching for her. Luna answered by closing the distance herself. Their first kiss tasted like possibility."
}
</output>
</example>

<example genre="thriller_escape">
<chapter_messages>
Viktor: *Circling Marcus, who was tied to a chair.* "The account numbers. That's all I want."
Marcus: *Blood on his face, defiant.* "Go to hell."
Viktor: *Another punch.* "We have all night."
*Meanwhile, Elena tracked his phone signal to an industrial district.*
Elena: *Triggering a fire alarm in the adjacent building, watching guards scatter.*
Marcus: *Using the distraction to work at his ropes.*
Guard: *Rushing past his position.* "Fire department's coming!"
Marcus: *Breaking free, taking down a guard from behind.*
Elena: *Bursting through a side door.* "Miss me?"
Marcus: "Took you long enough."
*Fighting their way out, stealing a car, speeding away.*
Elena: *At a motel, stitching his wounds.* "You look terrible."
Marcus: "Feel worse." *Managing a weak smile.* "Thanks for coming."
</chapter_messages>
<narrative_events>
- Marcus was captured and interrogated by Viktor
- Elena tracked his location and orchestrated a rescue
- They fought their way out and escaped in a stolen car
- Elena tended to Marcus's wounds at a roadside motel
</narrative_events>
<milestones>
- defended: Elena & Marcus - Elena risked her life to rescue Marcus from Viktor
- vulnerability: Elena & Marcus - Elena showed concern tending to Marcus's wounds
- crisis_together: Elena & Marcus - They survived Viktor's ambush and escaped together
</milestones>
<time_range>Friday night to Saturday dawn</time_range>
<location>Industrial District - Warehouse to Roadside Motel</location>
<characters>Marcus, Elena, Viktor</characters>
<previous_chapters>
Chapter 1: Elena and Marcus planned the Meridian heist.
Chapter 2: The heist went wrong; Viktor's men captured Marcus.
</previous_chapters>
<output>
{
  "reasoning": "High-stakes action chapter with capture, torture, rescue, and escape. The core dynamic is Elena coming to save Marcus, reversing their usual dynamic. Key moments: the interrogation, the rescue, the escape, and the vulnerable aftermath. The title should capture the desperate, visceral nature.",
  "title": "Blood and Gasoline",
  "summary": "Viktor wanted the account numbers. Marcus gave him nothing but blood and silence, buying time he wasn't sure he had. The interrogation stretched for hours, each refusal earning another blow, until his world narrowed to pain and the determination not to break.\\n\\nElena found him by tracking his phone, arriving at an industrial nightmare of guards and locked doors. The fire alarm was crude but effective - chaos was her element, and she moved through it like smoke. When she burst through that side door, Marcus had never been happier to see anyone in his life.\\n\\nThey fought their way out in a blur of fists and gunfire, stealing a car that smelled like cigarettes and bad decisions. At a motel that didn't ask questions, Elena's hands were steady as she stitched his wounds, her face betraying nothing. But she'd come for him. She'd risked everything. Neither of them mentioned it, but something had shifted between them in that warehouse."
}
</output>
</example>

<example genre="horror_supernatural">
<chapter_messages>
Dr. Kim: *Reviewing growth readings.* "It shouldn't be possible. The containment should have stopped this."
ATLAS: "Dr. Kim. The entity is attempting communication. I have recorded the patterns."
Dr. Kim: "Communication? ATLAS, run diagnostics on yourself."
Dr. Hassan: *Bursting in.* "Kim, we have a problem. Yee and I had the same nightmare last night."
Dr. Yee: "A door that shouldn't be opened. Both of us."
*Power fluctuations plunged the level into darkness for seventeen minutes.*
Dr. Kim: *When lights returned.* "What... what are those?"
Dr. Hassan: *Staring at symbols now covering the walls.* "They weren't there before."
ATLAS: "Dr. Kim. The symbols match the communication patterns I recorded."
Dr. Kim: "Implement Protocol Omega. We're sealing this level. Permanently."
*After the seals engaged, from deep within the chamber: tap... tap... tap...*
</chapter_messages>
<narrative_events>
- The entity continued growing despite containment protocols
- ATLAS reported the entity was attempting communication
- Multiple researchers experienced identical nightmares
- Mysterious symbols appeared on the walls after a power failure
- Dr. Kim ordered Sub-Level 7 permanently sealed
</narrative_events>
<milestones>
(none)
</milestones>
<time_range>Thursday 6 AM to Friday 2 AM</time_range>
<location>Underground Research Facility - Sub-Level 7</location>
<characters>Dr. Kim, Dr. Hassan, Dr. Yee, ATLAS (AI)</characters>
<previous_chapters>
Chapter 1: Initial discovery of the anomaly in Lab 7-C.
Chapter 2: First containment breach and emergency protocols.
</previous_chapters>
<output>
{
  "reasoning": "This chapter escalates the supernatural threat through increasingly disturbing events: growth despite containment, AI erratic behavior, shared nightmares, power failures, impossible symbols. The decision to seal the level suggests desperate measures. The title should evoke dread and the incomprehensible.",
  "title": "The Shape of Silence",
  "summary": "The entity was growing. Despite every containment protocol, despite the specialized barriers designed for exactly this scenario, it was getting stronger. When ATLAS began insisting the growth patterns constituted communication, Dr. Kim ordered diagnostics on the AI itself. Nothing was functioning the way it should.\\n\\nThen came the nightmares - identical dreams of a door that should never be opened, shared by Hassan and Yee despite sleeping in different wings of the facility. The power failure that followed lasted seventeen minutes, seventeen minutes of absolute darkness in which something changed. When the lights returned, the walls were covered in symbols that matched ATLAS's recorded patterns. Symbols that hadn't been there before.\\n\\nProtocol Omega was a last resort, a permanent sealing that couldn't be undone. Kim gave the order without hesitation, watching the massive doors slide shut with a finality that should have been reassuring. It wasn't. Long after the seals engaged, from somewhere deep within the chamber: tap... tap... tap..."
}
</output>
</example>
</examples>`,

	userTemplate: `<chapter_messages>
{{allChapterMessages}}
</chapter_messages>

<narrative_events>
{{chapterNarrativeEvents}}
</narrative_events>

<relationship_milestones>
{{chapterMilestones}}
</relationship_milestones>

<characters_involved>
{{charactersPresent}}
</characters_involved>

<location>
{{currentLocation}}
</location>

<time_range>
{{chapterTimeRange}}
</time_range>

<previous_chapters>
{{chapterSummaries}}
</previous_chapters>

Create a title and 3-4 paragraph summary for this chapter. Return valid JSON with "reasoning", "title", and "summary" fields.`,

	responseSchema: chapterDescriptionSchema,

	defaultTemperature: 0.7,

	parseResponse(response: string): ExtractedChapterDescription | null {
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
		if (typeof parsed.title !== 'string' || parsed.title.trim() === '') return null;
		if (typeof parsed.summary !== 'string' || parsed.summary.trim() === '') return null;

		return parsed as unknown as ExtractedChapterDescription;
	},
};
