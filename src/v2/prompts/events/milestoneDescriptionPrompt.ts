/**
 * Milestone Description Generation Prompt
 *
 * Creates concise, grounded descriptions for relationship milestones.
 * Focuses on describing the exact moment, not the entire scene.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedMilestoneDescription } from '../../types/extraction';
import { milestoneDescriptionSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

// Milestone-specific placeholders
const MILESTONE_PLACEHOLDERS = {
	milestoneType: {
		name: 'milestoneType',
		description: 'The type of milestone (first_kiss, confession, etc.)',
		example: 'first_kiss',
	},
	characterPair: {
		name: 'characterPair',
		description: 'The two characters involved in the milestone',
		example: 'Elena and Marcus',
	},
	timeOfDay: {
		name: 'timeOfDay',
		description: 'Current time of day',
		example: 'evening',
	},
	location: {
		name: 'location',
		description: 'Current location (area - place - position)',
		example: 'Downtown - The Blue Moon Bar - Corner booth',
	},
	props: {
		name: 'props',
		description: 'Nearby objects/props in the scene',
		example: 'half-empty glasses, dim overhead light',
	},
	characters: {
		name: 'characters',
		description: 'Character state details (position, mood, outfit)',
		example: 'Elena: Position: leaning across booth | Mood: nervous, anticipating | Wearing: torso: red blouse\nMarcus: Position: sitting across from her | Mood: intent, warm | Wearing: torso: dark suit jacket',
	},
	relationship: {
		name: 'relationship',
		description: 'Current relationship state between the pair',
		example: 'Elena & Marcus (close): Elena feels: attracted, hopeful | Marcus feels: protective, drawn',
	},
	eventDetail: {
		name: 'eventDetail',
		description: 'Specific detail about what happened in the milestone moment',
		example: 'Marcus kissed Elena across the booth table',
	},
};

export const milestoneDescriptionPrompt: PromptTemplate<ExtractedMilestoneDescription> = {
	name: 'milestone_description',
	description: 'Generate concise, grounded descriptions for relationship milestones',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.relationshipProfiles,
		MILESTONE_PLACEHOLDERS.milestoneType,
		MILESTONE_PLACEHOLDERS.characterPair,
		MILESTONE_PLACEHOLDERS.timeOfDay,
		MILESTONE_PLACEHOLDERS.location,
		MILESTONE_PLACEHOLDERS.props,
		MILESTONE_PLACEHOLDERS.characters,
		MILESTONE_PLACEHOLDERS.relationship,
		MILESTONE_PLACEHOLDERS.eventDetail,
	],

	systemPrompt: `Extract a brief description of a milestone moment. Return ONLY valid JSON.

<instructions>
Write 1-2 sentences describing ONLY the specific milestone moment between the characters.

FOCUS: Describe the exact moment of the milestone - not the entire conversation or scene.
- For first_kiss: describe the kiss itself, not everything that led to it
- For secret_shared: describe what secret was shared (use the event_detail)
- For first_embrace: describe the embrace itself

REQUIREMENTS:
- Use the event_detail field - it tells you exactly what happened
- Reference location and time of day when relevant
- Be factual and concise, not flowery or purple
- Write in past tense, third person
- Be detailed, do not omit details about sexual acts
- Do NOT summarize the whole scene - ONLY the milestone moment
- Keep it grounded in the specific details provided
</instructions>

<output_format>
{
  "reasoning": "Brief analysis of what makes this moment significant",
  "description": "1-2 sentence description of the milestone moment"
}
</output_format>

<examples>
<example milestone="first_kiss">
<time_of_day>evening</time_of_day>
<location>Downtown - The Blue Moon Bar - Corner booth</location>
<props>half-empty glasses, dim overhead light</props>
<character_details>
Elena: Position: leaning across booth | Mood: nervous, anticipating | Wearing: torso: red blouse
Marcus: Position: sitting across from her | Mood: intent, warm | Wearing: torso: dark suit jacket
</character_details>
<relationship_state>Elena & Marcus (close): Elena feels: attracted, hopeful | Marcus feels: protective, drawn</relationship_state>
<event_detail>Marcus kissed Elena</event_detail>
<messages>
Elena: *She leaned closer across the booth* "I've been thinking about this all night."
Marcus: *He reached over and cupped her cheek* "Me too." *He kissed her*
</messages>
<output>
{
  "reasoning": "First kiss in a bar setting, initiated by Marcus after Elena expressed her feelings",
  "description": "Elena and Marcus shared their first kiss in the corner booth of the Blue Moon Bar that evening, leaning across the table between their half-empty drinks."
}
</output>
</example>

<example milestone="first_embrace">
<time_of_day>afternoon</time_of_day>
<location>Westside - Elena's Apartment - Living room</location>
<props>couch, scattered tissues, muted TV</props>
<character_details>
Elena: Position: sitting on couch | Mood: devastated, vulnerable | Wearing: torso: oversized sweater
Marcus: Position: sitting beside her | Mood: concerned, gentle | Wearing: torso: t-shirt, jacket: leather jacket
</character_details>
<relationship_state>Elena & Marcus (friendly): Elena feels: grateful, needing support | Marcus feels: protective, caring</relationship_state>
<event_detail>Marcus pulled Elena into a hug while she was crying</event_detail>
<messages>
Marcus: *He found her on the couch, crying* "Hey. I came as soon as I heard."
Elena: *She looked up* "I didn't think you'd come."
Marcus: *He sat beside her and pulled her into a hug* "Of course I came."
</messages>
<output>
{
  "reasoning": "First embrace during emotional moment, Marcus comforting Elena",
  "description": "Marcus held Elena for the first time on her couch that afternoon, pulling her in while she cried about her father's diagnosis."
}
</output>
</example>

<example milestone="confession">
<time_of_day>morning</time_of_day>
<location>Riverside Park - Bench near the fountain</location>
<props>coffee cups, park bench</props>
<character_details>
Elena: Position: sitting on bench | Mood: nervous, determined | Wearing: jacket: light cardigan
Marcus: Position: sitting beside her | Mood: attentive, curious | Wearing: torso: casual shirt
</character_details>
<relationship_state>Elena & Marcus (close): Elena feels: in love, scared | Marcus feels: comfortable, uncertain</relationship_state>
<event_detail>Elena confessed she was in love with Marcus</event_detail>
<messages>
Elena: *She stared at her coffee* "I need to tell you something."
Marcus: *He waited*
Elena: "I'm in love with you. I have been for a while."
</messages>
<output>
{
  "reasoning": "Confession of love on a park bench, Elena initiating the vulnerable moment",
  "description": "Elena confessed her feelings on a park bench that morning, gripping her coffee cup as she finally admitted she'd been in love with Marcus for a while."
}
</output>
</example>

<example milestone="first_laugh">
<time_of_day>evening</time_of_day>
<location>Downtown - Ramen Shop - Counter seats</location>
<props>steaming ramen bowls, chopsticks, napkins</props>
<character_details>
Elena: Position: sitting at counter | Mood: amused, relaxed | Wearing: jacket: denim jacket
Marcus: Position: sitting beside her | Mood: playful, grinning | Wearing: torso: hoodie
</character_details>
<relationship_state>Elena & Marcus (acquaintances): Elena feels: warming up, curious | Marcus feels: interested, comfortable</relationship_state>
<event_detail>Elena burst out laughing at Marcus's messy eating</event_detail>
<messages>
Marcus: *He slurped his noodles loudly, getting broth on his chin* "That's how you're supposed to eat ramen. Trust me."
Elena: *She burst out laughing* "You look ridiculous."
</messages>
<output>
{
  "reasoning": "First genuine laugh together, sparked by Marcus's playful behavior",
  "description": "Their first genuine laugh together came at the ramen shop that evening when Marcus deliberately slurped his noodles and got broth all over his chin, making Elena burst out laughing despite herself."
}
</output>
</example>

<example milestone="first_gift">
<time_of_day>afternoon</time_of_day>
<location>Elena's Apartment - Doorway</location>
<props>doorframe, mailbox, potted plant</props>
<character_details>
Elena: Position: standing in doorway | Mood: surprised, touched | Wearing: torso: casual sweater
Marcus: Position: standing at door | Mood: nervous, hopeful | Wearing: jacket: coat, torso: button-up
</character_details>
<relationship_state>Elena & Marcus (friendly): Elena feels: appreciating, curious | Marcus feels: eager, nervous</relationship_state>
<event_detail>Marcus gave Elena a vintage compass</event_detail>
<messages>
Marcus: *He held out a small wrapped box* "I saw this and thought of you."
Elena: *She unwrapped it to find a vintage compass* "Marcus... this is beautiful."
Marcus: "So you'll always find your way home."
</messages>
<output>
{
  "reasoning": "First gift given, thoughtful compass with personal meaning",
  "description": "Marcus gave Elena her first gift at her apartment door that afternoon - a vintage compass he'd found, saying it was so she'd always find her way home."
}
</output>
</example>

<example milestone="first_conflict">
<time_of_day>night</time_of_day>
<location>Marcus's Office - Private study</location>
<props>desk, papers, whiskey glass</props>
<character_details>
Elena: Position: standing at desk | Mood: furious, betrayed | Wearing: torso: work blouse
Marcus: Position: behind desk | Mood: defensive, guilty | Wearing: torso: dress shirt, sleeves rolled
</character_details>
<relationship_state>Elena & Marcus (intimate): Elena feels: betrayed, hurt | Marcus feels: guilty, desperate</relationship_state>
<event_detail>Elena confronted Marcus about documents proving his deception</event_detail>
<messages>
Elena: *She threw the documents on his desk* "You've been lying to me this whole time."
Marcus: "I was trying to protect you—"
Elena: "Don't. Just don't." *She walked out*
</messages>
<output>
{
  "reasoning": "First serious conflict, sparked by discovery of deception",
  "description": "Their first real fight happened in Marcus's study when Elena confronted him with documents proving his deception. She walked out before he could explain."
}
</output>
</example>
</examples>`,

	userTemplate: `<context>
<milestone_type>{{milestoneType}}</milestone_type>
<character_pair>{{characterPair}}</character_pair>
<time_of_day>{{timeOfDay}}</time_of_day>
<location>{{location}}</location>
<nearby_props>{{props}}</nearby_props>
<event_detail>{{eventDetail}}</event_detail>
<character_profiles>
{{relationshipProfiles}}
</character_profiles>
<character_details>
{{characters}}
</character_details>
<relationship_state>
{{relationship}}
</relationship_state>
</context>

<recent_messages>
{{messages}}
</recent_messages>

Write a concise milestone description for this {{milestoneType}} moment between {{characterPair}}. Return valid JSON with "reasoning" and "description" fields.`,

	responseSchema: milestoneDescriptionSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedMilestoneDescription | null {
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
		if (typeof parsed.description !== 'string') return null;
		if (parsed.description.trim() === '') return null;

		return parsed as unknown as ExtractedMilestoneDescription;
	},
};
