/**
 * Chapter Description Generation Prompt
 *
 * Generates evocative chapter titles and concise summaries for completed chapters.
 * Titles should be short and atmospheric; summaries should capture key events and character development.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedChapterDescription } from '../../types/extraction';
import { chapterDescriptionSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Action-Focused Chapter
INPUT:
"""
Chapter Events:
- Elena and Marcus planned a heist at The Rusty Nail bar, establishing their uneasy partnership
- They conducted reconnaissance at the Meridian Corporation building, noting security patterns
- Marcus revealed he used to be a cop, creating tension with Elena's criminal background
- They narrowly escaped when a security guard almost discovered them during recon
- The chapter ended with them agreeing to proceed despite the risks, sealing the deal with a handshake

Characters involved: Elena, Marcus
Location: Downtown Seattle (The Rusty Nail bar, Meridian Corporation building)
Time span: Monday evening to Tuesday early morning
"""
OUTPUT:
{
  "reasoning": "This chapter establishes the partnership between two unlikely allies - a former thief and an ex-cop. The key events are the planning session, the reconnaissance mission, and the revelation of Marcus's past. The tension between their backgrounds is central. The title should evoke the uneasy alliance and the criminal undertaking without being too literal.",
  "title": "Strange Bedfellows",
  "summary": "Elena and Marcus forge an unlikely alliance at a downtown bar, planning a heist on Meridian Corporation. Their reconnaissance mission nearly goes wrong when Marcus's cop past creates friction, but they commit to the job despite knowing the risks."
}

### Example 2: Emotional/Relationship Chapter
INPUT:
"""
Chapter Events:
- Sarah visited her estranged father in the hospital after his heart attack
- They had their first real conversation in five years, uncovering old wounds about her mother's death
- Her father apologized for pushing her away after the funeral
- Sarah learned her father had been secretly paying off her student loans
- She agreed to stay in town for a few weeks while he recovered
- The chapter ended with them watching old home movies together, crying and laughing

Characters involved: Sarah, David (father), mentioned: mother (deceased)
Location: St. Mary's Hospital, Room 412
Time span: Thursday afternoon through evening
"""
OUTPUT:
{
  "reasoning": "This is a chapter of reconciliation and emotional healing. The central arc is the father-daughter reunion after years of estrangement. Key moments include the apology, the revelation about the loans, and the shared memories through home movies. The title should capture the sense of bridges being repaired and old wounds beginning to heal.",
  "title": "The Long Way Home",
  "summary": "After five years of silence, Sarah reunites with her ailing father in his hospital room. Old wounds about her mother's death resurface, but David's tearful apology and his secret support of her dreams begin mending what seemed beyond repair. They find their way back to each other through shared memories and tears."
}

### Example 3: Mystery/Investigation Chapter
INPUT:
"""
Chapter Events:
- Detective Chen discovered a crucial piece of evidence - a matchbook from Club Velvet
- She interviewed three witnesses who all gave contradicting accounts of the night in question
- The surveillance footage showed a woman in red leaving the scene, but her face was obscured
- Chen received an anonymous tip pointing to a warehouse on the east side
- Her partner warned her the case was getting too dangerous, suggesting powerful people were involved
- The chapter ended with Chen receiving a threatening phone call telling her to drop the case

Characters involved: Detective Chen, witnesses (unnamed), partner (Mike)
Location: 14th Precinct, various interview rooms, Chen's car
Time span: Wednesday morning through night
"""
OUTPUT:
{
  "reasoning": "This chapter deepens the mystery while raising the stakes. Key elements: evidence discovery, contradicting testimonies, the mysterious woman in red, the anonymous tip, and the threat. The title should evoke the sense of shadows and hidden truths without giving away specifics. The 'woman in red' is a strong visual element.",
  "title": "Shades of Crimson",
  "summary": "Detective Chen's investigation takes a dangerous turn when a matchbook clue leads to Club Velvet and a mysterious woman in red. As witness accounts contradict each other and an anonymous tip points eastward, powerful forces make clear they want the case buried - along with anyone who keeps digging."
}

### Example 4: Romantic Development Chapter
INPUT:
"""
Chapter Events:
- Luna and James had their first official date at a rooftop restaurant
- The conversation started awkward but grew natural as they discovered shared interests in astronomy
- James revealed his fear of commitment stemming from his parents' divorce
- Luna shared that she had been engaged before but called it off when she realized she was settling
- They walked through the city after dinner, ending up at an observatory
- James kissed Luna under the stars, and she kissed him back
- The chapter ended with them making plans for a second date

Characters involved: Luna, James
Location: Rooftop restaurant (Celestine), city streets, Griffith Observatory
Time span: Saturday evening (7 PM to 2 AM)
"""
OUTPUT:
{
  "reasoning": "This is a classic romantic development chapter - first date, vulnerable sharing, and first kiss. The astronomy motif runs throughout (rooftop, stars, observatory), which should be reflected in the title. The emotional beats are the awkward start, growing comfort, mutual vulnerability, and the kiss.",
  "title": "Constellations",
  "summary": "Luna and James's first date evolves from awkward small talk to genuine connection over a shared love of astronomy. Between rooftop dining and a moonlit walk, they trade stories of past hurts - his fear of commitment, her broken engagement. At the observatory, surrounded by stars, they share their first kiss."
}

### Example 5: Thriller/Escape Chapter
INPUT:
"""
Chapter Events:
- Marcus woke up tied to a chair in an unknown warehouse, with Viktor demanding to know where the money was
- He endured interrogation and a beating, refusing to give up the account numbers
- Elena, tracking his phone, found the warehouse location
- She caused a distraction by triggering the fire alarm in an adjacent building
- In the chaos, Marcus managed to free himself and take out one guard
- Elena burst in through a side door, and together they fought their way out
- They escaped in a stolen car, Marcus badly injured but alive
- The chapter ended with them hiding in a motel, Elena stitching his wounds while they planned their next move

Characters involved: Marcus, Elena, Viktor, unnamed guards
Location: Abandoned warehouse (unknown location), highway, roadside motel
Time span: Friday night through Saturday dawn
"""
OUTPUT:
{
  "reasoning": "This is a high-stakes action chapter with capture, torture, rescue, and escape. The core dynamic is Elena coming to save Marcus, reversing their usual dynamic. Key moments: the interrogation, the rescue, the escape, and the vulnerable aftermath at the motel. The title should capture the desperate, violent nature of the events.",
  "title": "Blood and Gasoline",
  "summary": "Marcus endures Viktor's brutal interrogation in an abandoned warehouse, protecting the account numbers at great personal cost. Elena tracks him down and orchestrates a daring rescue, fighting through guards to reach him. They flee in a stolen car and take refuge in a roadside motel, where Elena tends his wounds and they realize how much they've come to depend on each other."
}

### Example 6: Character Development/Reflection Chapter
INPUT:
"""
Chapter Events:
- Agent Reyes took a mandatory leave of absence after the Martinez shooting review
- She spent time at her late grandmother's cabin in the mountains, sorting through old photographs
- Memories of her grandmother teaching her right from wrong conflicted with the violence of her job
- She called her estranged sister for the first time in two years, leaving an awkward voicemail
- A chance encounter with a local artist reminded her that beauty still exists in the world
- She made the decision to return to work, but with a different perspective
- The chapter ended with her packing her bags, ready to face the review board

Characters involved: Agent Reyes, mentioned: grandmother (deceased), sister (Maria), local artist (brief)
Location: Mountain cabin, nearby town
Time span: Two weeks (October 1-15)
"""
OUTPUT:
{
  "reasoning": "This is an introspective chapter about a character at a crossroads. The grandmother's influence, the estranged sister, and the contrast between violence and beauty are all significant. The time alone allows for processing trauma. The title should reflect this period of reflection and the decision to return changed.",
  "title": "What Remains",
  "summary": "Forced into leave after the shooting review, Reyes retreats to her grandmother's mountain cabin seeking answers. Two weeks of solitude, old photographs, and memories of simpler morals help her process the violence she's both witnessed and caused. A voicemail to her estranged sister and an encounter with a local artist remind her of what she's fighting for - she returns to work with renewed purpose."
}

### Example 7: Horror/Supernatural Chapter
INPUT:
"""
Chapter Events:
- Dr. Kim discovered the entity in Lab 7-C had been growing despite the containment protocols
- The facility's AI began behaving erratically, insisting the entity was "communicating"
- Two researchers reported identical nightmares about a door that shouldn't be opened
- Power fluctuations plunged the sub-level into darkness for seventeen minutes
- When lights returned, strange symbols were found etched into the walls - symbols not in any known language
- Dr. Kim made the decision to implement Protocol Omega, sealing the level permanently
- The chapter ended with the sound of something tapping from inside the sealed chamber

Characters involved: Dr. Kim, Dr. Hassan, Dr. Yee, AI (ATLAS)
Location: Underground research facility, Sub-Level 7
Time span: Thursday 6 AM to Friday 2 AM
"""
OUTPUT:
{
  "reasoning": "This chapter escalates the supernatural threat through increasingly disturbing events: growth despite containment, AI erratic behavior, shared nightmares, power failures, mysterious symbols. The decision to seal the level suggests desperate measures. The title should evoke dread and the sense of something incomprehensible.",
  "title": "The Shape of Silence",
  "summary": "The entity in Lab 7-C defies every containment measure, growing stronger as the facility's AI reports 'communication.' Researchers share identical nightmares, and when a power failure plunges the level into darkness, they return to find impossible symbols etched into the walls. Dr. Kim orders Sub-Level 7 permanently sealed, but something continues to tap from within."
}

### Example 8: Political Intrigue Chapter
INPUT:
"""
Chapter Events:
- Ambassador Vex discovered evidence that General Hawkins was planning a military coup
- She held secret meetings with loyalist senators, gathering support for intervention
- Her aide was revealed to be a spy, forcing her to change all her plans at the last minute
- A tense dinner party became a battleground of veiled threats and false smiles
- Vex secured the support of Admiral Chen by revealing Hawkins's plan to eliminate the naval command
- She arranged for the evidence to be leaked to the press, timing it for maximum impact
- The chapter ended with General Hawkins being arrested live on the evening news

Characters involved: Ambassador Vex, General Hawkins, Admiral Chen, various senators, aide (compromised)
Location: Capitol City, various government buildings, Vex's residence
Time span: Monday through Friday
"""
OUTPUT:
{
  "reasoning": "This chapter is about political maneuvering, betrayal, and triumph through careful strategy. Key moments: discovering the coup, the spy revelation, the tense dinner, securing allies, and the public takedown. The title should evoke the chess-like nature of political combat.",
  "title": "The Queen's Gambit",
  "summary": "Ambassador Vex uncovers General Hawkins's coup plot and begins a dangerous game of political chess. Betrayed by her own aide, she pivots to work through backchannels, winning Admiral Chen's support by revealing Hawkins's plans for the navy. A week of veiled threats and secret meetings culminates in a perfectly timed leak - and General Hawkins's arrest on live television."
}

### Example 9: Coming-of-Age/Discovery Chapter
INPUT:
"""
Chapter Events:
- Sixteen-year-old Maya discovered she could hear other people's thoughts during a panic attack at school
- She initially believed she was going crazy and isolated herself from friends
- Her grandmother revealed the family secret - all the women in their line have "the gift"
- Maya learned to control the ability with her grandmother's guidance, using meditation techniques
- She accidentally discovered her best friend Chloe was planning to run away from an abusive home
- Maya faced the choice between respecting Chloe's privacy and intervening to help
- She chose to talk to Chloe directly, leading to Chloe confiding the abuse and accepting help
- The chapter ended with Maya realizing her gift came with responsibility

Characters involved: Maya, grandmother (Rose), Chloe, mentioned: Chloe's parents
Location: High school, Maya's home, grandmother's garden
Time span: Two weeks
"""
OUTPUT:
{
  "reasoning": "This is a coming-of-age chapter about discovering powers and learning responsibility. The arc goes from fear, to understanding, to first real use of the ability. The theme of listening - both literally and metaphorically - runs throughout. The title should reflect both the supernatural gift and the growth in understanding.",
  "title": "Voices Carry",
  "summary": "When sixteen-year-old Maya starts hearing thoughts, she believes she's losing her mind - until her grandmother reveals the family secret. Two weeks of training and meditation teach her control, but nothing prepares her for hearing her best friend's silent cries for help. Maya learns that some gifts are really responsibilities in disguise."
}

### Example 10: War/Survival Chapter
INPUT:
"""
Chapter Events:
- Private Santos's squad was ambushed during a routine patrol, leaving only four survivors
- They took shelter in a bombed-out school, rationing their remaining supplies
- The medic, Kowalski, died from his wounds despite Santos's attempts to save him
- They made radio contact with base but learned extraction was impossible for 48 hours
- Enemy forces began systematically searching the area, forcing the squad to move
- Santos made the call to split up and regroup at the extraction point
- One soldier, Rivera, was captured during the escape - Santos could only watch, unable to help
- The chapter ended with Santos alone, approaching the extraction point, hearing helicopters

Characters involved: Private Santos, Kowalski (deceased), Rivera (captured), Chen (status unknown)
Location: Unnamed warzone, bombed school, urban ruins
Time span: Tuesday afternoon through Wednesday night
"""
OUTPUT:
{
  "reasoning": "This is a brutal survival chapter about loss, impossible choices, and the horrors of war. Key events: the ambush, Kowalski's death, the impossible extraction, the decision to split up, Rivera's capture. The title should reflect both the physical and emotional devastation without being gratuitous.",
  "title": "What's Left Behind",
  "summary": "An ambush leaves Private Santos with three survivors and no way out for 48 hours. In a bombed-out school, she watches their medic die and makes the desperate call to split up. Forced to watch Rivera's capture without intervening, Santos reaches the extraction point alone, carrying the weight of everyone she couldn't save."
}

### Example 11: Comedy/Ensemble Chapter
INPUT:
"""
Chapter Events:
- Jake's plan to throw a surprise birthday party for his roommate devolved into chaos
- He accidentally invited his ex-girlfriend AND his ex-girlfriend's new boyfriend
- The cake was dropped by the delivery guy, leading to a frantic midnight baking session
- His grandmother showed up a day early, loudly critiquing everyone's life choices
- The neighbor's dog somehow got inside and ate the replacement cake
- Jake's roommate came home early and they had to pretend it was a "dog birthday party"
- Against all odds, everyone ended up having fun, including the dog
- The chapter ended with Jake and his roommate eating cake off paper plates at 2 AM, laughing about the disaster

Characters involved: Jake, roommate (Ben), grandmother, ex-girlfriend (Amy), Amy's boyfriend (Derek), neighbor, dog (Mr. Snuffles)
Location: Jake and Ben's apartment
Time span: Saturday (all day and night)
"""
OUTPUT:
{
  "reasoning": "This is a comedy of errors with an ensemble cast and escalating absurdity. The humor comes from everything going wrong but ending in unexpected joy. Key moments: the ex drama, the cake disasters, the grandmother, and the improvised 'dog birthday party' lie. The title should be light and playful.",
  "title": "Best Laid Plans",
  "summary": "Jake's surprise party for Ben goes spectacularly wrong: his ex shows up with her new boyfriend, the cake gets destroyed twice (once by gravity, once by a dog named Mr. Snuffles), and his grandmother arrives a day early with opinions for everyone. When Ben comes home to a room full of chaos, Jake pivots to calling it a dog birthday party. Somehow, it becomes the best night any of them have had in months."
}

### Example 12: Sci-Fi Exploration Chapter
INPUT:
"""
Chapter Events:
- The Prometheus reached the orbit of Kepler-442b after three years of travel
- Initial scans revealed structures on the surface that appeared artificial
- Commander Vex led the first landing party, discovering ruins of an alien civilization
- The ruins contained writing that Dr. Chen partially translated: a warning about something "awakening"
- Strange energy readings began emanating from beneath the ruins
- One crew member, Lieutenant Park, experienced visions of beings made of light
- The team discovered a still-functioning device at the heart of the ruins
- The chapter ended with the device activating, projecting a star map showing Earth

Characters involved: Commander Vex, Dr. Chen, Lieutenant Park, landing team
Location: Kepler-442b surface, alien ruins
Time span: Two days
"""
OUTPUT:
{
  "reasoning": "This is a first contact/discovery chapter with classic sci-fi elements: ancient ruins, mysterious warnings, strange visions, and a revelation connecting to Earth. The pacing escalates from wonder to concern to shocking discovery. The title should evoke the scale of what's been found.",
  "title": "The Message",
  "summary": "After three years of travel, the Prometheus reaches Kepler-442b and discovers more than an alien world - they find the ruins of a civilization that knew about humanity. Partial translations warn of something awakening, and Lieutenant Park experiences visions of light-beings. When the team activates an ancient device, it projects a star map with Earth at its center. They were expected."
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Title Too Literal/Descriptive
INPUT:
"""
Chapter Events:
- Elena and Marcus met at a bar to plan a heist
- They discussed breaking into the Meridian building
- Marcus revealed he used to be a cop
"""
WRONG OUTPUT:
{
  "reasoning": "They met at a bar and planned a heist. Marcus was a cop.",
  "title": "Elena and Marcus Meet at a Bar to Plan a Heist",
  "summary": "Elena and Marcus met at a bar. They planned a heist on the Meridian building. Marcus said he used to be a cop."
}
WHY THIS IS WRONG: The title is just a description of what happened, not evocative. Titles should be short and atmospheric, hinting at themes rather than stating events. The summary is also too bare-bones - it just lists events without capturing emotional beats or significance.

### Bad Example 2: Title Uses Character Names
INPUT:
"""
Chapter Events:
- Sarah reconciled with her father at the hospital
- They watched old home movies together
- She decided to stay and help him recover
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah and David made up. They had an emotional moment.",
  "title": "Sarah and David's Reconciliation",
  "summary": "Sarah visited her father David in the hospital. They made up after years of not talking. She decided to stay with him."
}
WHY THIS IS WRONG: Chapter titles generally shouldn't include character names - they should be universal and evocative. "Sarah and David's Reconciliation" sounds like a newspaper headline, not a chapter title. The summary also lacks emotional depth.

### Bad Example 3: Summary Too Long and Detailed
INPUT:
"""
Chapter Events:
- Detective found a clue (matchbook)
- Interviewed three witnesses
- Received a threatening phone call
"""
WRONG OUTPUT:
{
  "reasoning": "Many things happened in this investigation chapter that need to be documented thoroughly for future reference.",
  "title": "Clues",
  "summary": "Detective Chen went to the crime scene first thing in the morning where she found a matchbook from Club Velvet hidden under a table leg that the forensics team had missed. She then spent hours interviewing three different witnesses: first there was Mrs. Patterson who said she saw nothing, then Mr. Kim who claimed to have seen a woman in red leaving around 10 PM, and finally the bartender who contradicted both of them by saying the bar was empty that night. After all the interviews, Chen went to her car where she received a threatening phone call from an unknown number telling her to drop the case or face consequences. She was shaken but determined to continue."
}
WHY THIS IS WRONG: The summary is far too long and reads like a detailed report. Summaries should be 2-4 sentences capturing the essence, not a blow-by-blow account. The title "Clues" is also too vague and boring.

### Bad Example 4: Title Too Generic
INPUT:
"""
Chapter Events:
- Luna and James had their first kiss at the observatory
- They opened up about past relationships
- Made plans for a second date
"""
WRONG OUTPUT:
{
  "reasoning": "Romantic chapter with a first kiss.",
  "title": "The First Date",
  "summary": "Luna and James went on their first date. They talked about their pasts and kissed at the end. They want to see each other again."
}
WHY THIS IS WRONG: "The First Date" is extremely generic - it could apply to any romance story. The astronomy/stars motif from the original events could have inspired a more unique title. The summary is also bland and misses the emotional nuance of the chapter.

### Bad Example 5: Spoiling the Climax in the Title
INPUT:
"""
Chapter Events:
- Marcus was captured and tortured by Viktor
- Elena tracked him and orchestrated a rescue
- They escaped in a stolen car
- Ended up hiding in a motel
"""
WRONG OUTPUT:
{
  "reasoning": "The main event was Elena rescuing Marcus from Viktor.",
  "title": "Elena Saves Marcus from Viktor's Torture Chamber",
  "summary": "Viktor captured Marcus and tortured him for information. Elena found where he was being held and rescued him. They drove away in a stolen car and hid in a motel where she treated his wounds."
}
WHY THIS IS WRONG: The title gives away the entire plot of the chapter, including that Elena succeeds in the rescue. A good title creates intrigue without spoiling. Also, using character names and describing specific plot points makes it read like a summary, not a title.

### Bad Example 6: Missing Emotional Core
INPUT:
"""
Chapter Events:
- Agent Reyes spent two weeks at her grandmother's cabin
- She sorted through old photographs
- Called her estranged sister
- Met a local artist
- Decided to return to work
"""
WRONG OUTPUT:
{
  "reasoning": "Reyes took time off and then went back to work.",
  "title": "The Break",
  "summary": "Agent Reyes took a mandatory leave and stayed at a cabin in the mountains for two weeks. She looked at photos, called her sister, met an artist, and then decided to go back to work for the review board."
}
WHY THIS IS WRONG: This completely misses the emotional journey of the chapter - the introspection, the conflict between violence and innocence, the processing of trauma. The summary reads like a to-do list, and the title "The Break" suggests a pause rather than transformation.

### Bad Example 7: Summary That Misses Key Events
INPUT:
"""
Chapter Events:
- Entity in Lab 7-C growing despite containment
- AI acting strangely, claiming entity is communicating
- Researchers having identical nightmares
- Power failures
- Strange symbols appearing
- Level sealed permanently
- Something tapping from inside the sealed chamber
"""
WRONG OUTPUT:
{
  "reasoning": "Scary things happened in the lab.",
  "title": "The Entity",
  "summary": "Something strange was happening in the underground lab. Dr. Kim decided to seal the level. There were some power problems and people had bad dreams."
}
WHY THIS IS WRONG: The summary glosses over all the specific, creepy details that make this chapter effective - the shared nightmares, the symbols, the AI's behavior, and especially the tapping at the end. "The Entity" is also too direct and loses the atmospheric quality.

### Bad Example 8: Title That Doesn't Match Tone
INPUT:
"""
Chapter Events:
- Private Santos's squad was ambushed, leaving four survivors
- Medic died despite efforts to save him
- Had to split up to escape enemy forces
- Another soldier was captured
- Santos reached extraction point alone
"""
WRONG OUTPUT:
{
  "reasoning": "War chapter with action and loss.",
  "title": "Mission Accomplished!",
  "summary": "Santos and her squad got ambushed during a patrol. Some people died and one got captured but Santos made it to the extraction point at the end."
}
WHY THIS IS WRONG: "Mission Accomplished!" is completely wrong for the tone - this is a chapter about loss, failure, and survivor's guilt, not triumph. The exclamation point makes it worse. The summary is also callously brief about deaths and captures.

### Bad Example 9: Reasoning That's Just Restating Events
INPUT:
"""
Chapter Events:
- Surprise party planning went wrong
- Multiple disasters with cakes
- Awkward ex-girlfriend situation
- Everyone ended up having fun anyway
"""
WRONG OUTPUT:
{
  "reasoning": "Jake planned a party. The party had problems. Things went wrong with the cake. His ex was there. They had fun.",
  "title": "The Party",
  "summary": "Jake's surprise party had a lot of problems including cake disasters and his ex showing up. But everyone had a good time at the end."
}
WHY THIS IS WRONG: The reasoning should analyze themes and emotional beats, not just restate what happened. "The Party" is an extremely boring title for a comedy of errors chapter. The summary loses all the humor and specific absurd details that made the chapter funny.

### Bad Example 10: Getting Facts Wrong in Summary
INPUT:
"""
Chapter Events:
- Prometheus reached Kepler-442b after three years
- Found alien ruins with ancient writing
- Dr. Chen translated warning about something "awakening"
- Lieutenant Park had visions of light beings
- Device activated showing star map with Earth
"""
WRONG OUTPUT:
{
  "reasoning": "Space exploration chapter where they find aliens.",
  "title": "Alien Contact",
  "summary": "The spaceship Discovery landed on an alien planet after five years of travel. They found some ruins and Captain Vex translated the alien writing. When they turned on an alien computer, it showed them where the aliens came from."
}
WHY THIS IS WRONG: Multiple factual errors - ship is Prometheus not Discovery, travel was 3 years not 5, Vex is Commander not Captain, Chen did the translation not Vex, the map showed Earth (not where aliens came from). Summaries must be accurate to the source material.

### Bad Example 11: Title That's a Question
INPUT:
"""
Chapter Events:
- Maya discovered she could read minds
- Grandmother revealed family secret about "the gift"
- Maya learned to control her ability
- Used it to help her friend Chloe escape abuse
"""
WRONG OUTPUT:
{
  "reasoning": "Maya found out she has powers and uses them to help a friend.",
  "title": "What Will Maya Do With Her Powers?",
  "summary": "Maya found out she can read minds. Her grandmother told her it runs in the family. She used her powers to find out her friend was being abused and helped her."
}
WHY THIS IS WRONG: Titles shouldn't be questions - they should be evocative statements or phrases. Questions make titles feel uncertain and weak. Also, the summary is too matter-of-fact and misses the emotional journey from fear to acceptance to responsibility.

### Bad Example 12: Summary Without Context
INPUT:
"""
Chapter Events:
- Ambassador Vex discovered coup plot
- Her aide was revealed as a spy
- She secured Admiral Chen's support
- Leaked evidence to press
- General Hawkins arrested on live TV
"""
WRONG OUTPUT:
{
  "reasoning": "Political intrigue.",
  "title": "Politics",
  "summary": "Vex found out about a coup and after some problems, Hawkins got arrested."
}
WHY THIS IS WRONG: The title "Politics" is absurdly generic. The summary is so vague it's almost meaningless - it doesn't mention who Hawkins is, what the coup was about, how Vex overcame the spy problem, or any of the actual political maneuvering that made the chapter interesting. It strips all specificity and interest from the events.
`;

export const chapterDescriptionPrompt: PromptTemplate<ExtractedChapterDescription> = {
	name: 'chapter_description',
	description: 'Generate an evocative chapter title and concise summary',

	placeholders: [
		PLACEHOLDERS.recentEvents,
		PLACEHOLDERS.charactersPresent,
		PLACEHOLDERS.currentLocation,
		PLACEHOLDERS.chapterSummaries,
	],

	systemPrompt: `You are creating chapter titles and summaries for a roleplay narrative.

## Your Task
Given a summary of chapter events, create:
1. A **title**: Short, evocative, atmospheric - hints at themes without spoiling events
2. A **summary**: 2-4 sentences capturing key events, emotional beats, and character development

## Title Guidelines
- Keep titles SHORT (1-4 words typically)
- Be evocative and atmospheric, not literal or descriptive
- Avoid using character names in titles
- Don't spoil climactic events or twists
- Match the tone of the chapter (dark for tragedy, light for comedy, etc.)
- Draw from themes, imagery, or emotional core rather than plot points
- Avoid generic titles like "The Meeting" or "Chapter 3"
- Avoid questions as titles

## Summary Guidelines
- 2-4 sentences, no more
- Capture the essential arc: beginning situation, key turning points, end state
- Include emotional beats, not just plot events
- Mention key character dynamics and development
- Be accurate to the source events - don't add or change details
- Write in present tense for immediacy
- Avoid bullet points or lists - write flowing prose

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of the chapter's themes, emotional core, and key moments
- "title": Short, evocative chapter title (1-4 words)
- "summary": Brief summary (2-4 sentences)

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Chapter Events
{{recentEvents}}

## Characters Involved
{{charactersPresent}}

## Location
{{currentLocation}}

## Previous Chapter Context
{{chapterSummaries}}

## Task
Create an evocative chapter title and a concise summary that captures the essence of this chapter. The title should hint at themes without spoiling, and the summary should convey the emotional arc in 2-4 sentences.

Respond with your analysis and results as JSON.`,

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
