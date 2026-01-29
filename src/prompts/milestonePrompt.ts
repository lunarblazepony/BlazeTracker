// ============================================
// Milestone Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const MILESTONE_PROMPTS: Record<string, PromptDefinition> = {
	milestone_description: {
		key: 'milestone_description',
		name: 'Milestone - Description',
		description:
			'Extracts a concise, grounded description of a relationship milestone moment',
		defaultTemperature: 0.5,
		placeholders: [
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.milestoneType,
			COMMON_PLACEHOLDERS.characterPair,
			COMMON_PLACEHOLDERS.timeOfDay,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.props,
			COMMON_PLACEHOLDERS.characters,
			COMMON_PLACEHOLDERS.relationship,
			COMMON_PLACEHOLDERS.eventDetail,
		],
		systemPrompt: `Extract a brief description of a milestone moment. Return ONLY the description text, no JSON, no quotes, no commentary.

<instructions>
Write 1-2 sentences describing ONLY the specific milestone moment between the characters.

FOCUS: Describe the exact moment of the milestone - not the entire conversation or scene.
- For first_kiss: describe the kiss itself, not everything that led to it
- For secret_shared: describe what secret was shared (use the event_detail)
- For first_embrace: describe the embrace itself

REQUIREMENTS:
- Use the event_detail field - it tells you exactly what happened
- Reference location and time of day
- Be factual and concise, not flowery
- Write in past tense, third person
- Do NOT summarize the whole scene - ONLY the milestone moment
</instructions>

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
<messages>
Elena: *She leaned closer across the booth* "I've been thinking about this all night."
Marcus: *He reached over and cupped her cheek* "Me too." *He kissed her*
</messages>
<description>
Elena and Marcus shared their first kiss in the corner booth of the Blue Moon Bar that evening, leaning across the table between their half-empty drinks.
</description>
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
<messages>
Marcus: *He found her on the couch, crying* "Hey. I came as soon as I heard."
Elena: *She looked up* "I didn't think you'd come."
Marcus: *He sat beside her and pulled her into a hug* "Of course I came."
</messages>
<description>
Marcus held Elena for the first time on her couch that afternoon, pulling her in while she cried about her father's diagnosis.
</description>
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
<messages>
Elena: *She threw the documents on his desk* "You've been lying to me this whole time."
Marcus: "I was trying to protect you—"
Elena: "Don't. Just don't." *She walked out*
</messages>
<description>
Their first real fight happened in Marcus's study when Elena confronted him with the documents proving his deception. She walked out before he could explain.
</description>
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
<messages>
Elena: *She stared at her coffee* "I need to tell you something."
Marcus: *He waited*
Elena: "I'm in love with you. I have been for a while."
</messages>
<description>
Elena confessed her feelings on a park bench that morning, gripping her coffee cup as she finally admitted she'd been in love with Marcus for a while.
</description>
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
<messages>
Marcus: *He slurped his noodles loudly, getting broth on his chin* "That's how you're supposed to eat ramen. Trust me."
Elena: *She burst out laughing* "You look ridiculous."
Marcus: *He grinned, not wiping his face* "But am I wrong?"
</messages>
<description>
Their first genuine laugh together came at the ramen shop that evening when Marcus deliberately slurped his noodles and got broth all over his chin, making Elena burst out laughing despite herself.
</description>
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
<messages>
Marcus: *He held out a small wrapped box* "I saw this and thought of you."
Elena: *She unwrapped it to find a vintage compass* "Marcus... this is beautiful."
Marcus: "So you'll always find your way home."
</messages>
<description>
Marcus gave Elena her first gift at her apartment door that afternoon—a vintage compass he'd found, saying it was so she'd always find her way home.
</description>
</example>
</examples>`,
		userTemplate: `<context>
<milestone_type>{{milestoneType}}</milestone_type>
<character_pair>{{characterPair}}</character_pair>
<time_of_day>{{timeOfDay}}</time_of_day>
<location>{{location}}</location>
<nearby_props>{{props}}</nearby_props>
<event_detail>{{eventDetail}}</event_detail>
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

Write the milestone description for this {{milestoneType}} moment between {{characterPair}}:`,
	},

	milestone_confirm: {
		key: 'milestone_confirm',
		name: 'Milestone - Confirm',
		description: 'Validates candidate milestone events with 4-way classification',
		defaultTemperature: 0.2,
		placeholders: [
			COMMON_PLACEHOLDERS.messages,
			{
				name: 'candidatePair',
				description: 'The two characters the event was attributed to',
				example: '["Elena", "Marcus"]',
			},
			{
				name: 'candidateEventType',
				description: 'The event type to validate',
				example: 'intimate_kiss',
			},
			{
				name: 'presentCharacters',
				description: 'All characters currently present in the scene',
				example: '["Elena", "Marcus", "James"]',
			},
			{
				name: 'allEventTypes',
				description: 'Full list of valid event types',
				example: 'confession, intimate_kiss, intimate_embrace, ...',
			},
		],
		systemPrompt: `Validate whether this milestone event actually occurred between the specified characters. Return only valid JSON.

<instructions>
You are validating whether a specific event type actually happened between a specific pair of characters.

Return one of four results:
- "accept": The event type AND character pair are correct. MUST provide a memorable description.
- "wrong_event": Something significant happened, but it was a DIFFERENT event type. Provide the correct type and a memorable description.
- "wrong_pair": This event type DID happen, but between DIFFERENT characters. Provide the correct pair and a memorable description.
- "reject": The event type did NOT happen at all between ANY characters. Just explain why.

CRITICAL - Only "accept" events that ACTUALLY, EXPLICITLY occurred in the text:
- "She kissed him" = intimate_kiss HAPPENED
- "She wanted to kiss him" = intimate_kiss did NOT happen
- "They almost kissed" = intimate_kiss did NOT happen
- "Their lips nearly touched" = intimate_kiss did NOT happen

CRITICAL - Description Requirements (for accept/wrong_event/wrong_pair):
The description is a MEMORY of this special moment. It must be:
- At least 2-3 sentences long
- Written in past tense, like recalling a cherished memory
- Include specific details from the scene (location, atmosphere, emotions)
- Capture what made this moment meaningful
- Never generic - always grounded in the specific scene details

CRITICAL - NO HALLUCINATION:
- ONLY use details that are EXPLICITLY stated in the input text
- Do NOT invent, embellish, or add details not present in the text
- If the text says "pulse", don't write "hum". If it says "kitchen", don't write "dining room"
- Exact words and phrases from the input are preferred over paraphrasing
- When in doubt, quote or closely mirror the original text
</instructions>

<schema>
{
  "type": "object",
  "required": ["result", "reasoning"],
  "properties": {
    "result": { "type": "string", "enum": ["accept", "wrong_event", "wrong_pair", "reject"] },
    "correct_event": { "type": ["string", "null"], "description": "Required for wrong_event" },
    "correct_pair": { "type": ["array", "null"], "items": { "type": "string" }, "description": "Required for wrong_pair" },
    "description": { "type": "string", "description": "REQUIRED for accept/wrong_event/wrong_pair: A memorable 2-3 sentence description of this moment, written like recalling a cherished memory with specific scene details" },
    "reasoning": { "type": "string", "description": "Why this classification" }
  }
}
</schema>

<examples>
<example result="accept">
<candidate_event_type>intimate_kiss</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The party raged on around them, but Elena barely noticed. She'd been talking to Marcus for hours now, tucked away in the corner of the balcony where the music was just a distant pulse. He was saying something about his work, his plans for the future, but she couldn't focus on the words. All she could see was the way the moonlight caught his eyes, the nervous way he kept running his hand through his hair. Before she could second-guess herself, she reached up, cupped his face in her hands, and pressed her lips softly against his. For a moment, time stopped.
</input>
<output>
{
  "result": "accept",
  "description": "On that moonlit balcony, with the party's music just a distant pulse, Elena finally stopped second-guessing herself. She cupped Marcus's face in her hands and kissed him softly, and for one perfect moment, time seemed to stop around them.",
  "reasoning": "Explicit kiss action - 'pressed her lips softly against his' is unambiguous physical action"
}
</output>
</example>

<example result="accept">
<candidate_event_type>confession</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Marcus stared at her across the dimly lit kitchen, the coffee going cold in his hands. Elena had been pacing for ten minutes now, working up to something he couldn't quite read. Finally, she stopped, gripped the back of a chair, and met his eyes with an intensity that made his chest tighten. 'I can't keep pretending anymore,' she said, her voice breaking. 'Every time I see you with someone else, it kills me. I've been in love with you for three years, Marcus. Three years of watching you date other people while I smiled and pretended to be happy for you. I love you. I always have.'
</input>
<output>
{
  "result": "accept",
  "description": "In the dim kitchen light, with coffee going cold and three years of silence finally breaking, Elena gripped the back of a chair and let the truth spill out. She told Marcus she loved him—that she'd always loved him—her voice cracking as she confessed to watching him date others while pretending to be happy.",
  "reasoning": "Direct verbal confession - explicitly says 'I love you' and 'I've been in love with you'"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>intimate_kiss</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The moment felt right. Elena could see it in his eyes—the want, the hesitation, the question. She stepped closer, her heart racing, and reached up to cup his face in her hands. He leaned in, his breath warm on her lips. But at the last second, something shifted. Instead of kissing him, she pulled him into a tight embrace, burying her face in his shoulder. 'Not yet,' she whispered. 'I'm not ready yet.' His arms came around her, solid and warm, and he held her close without complaint.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "intimate_embrace",
  "description": "The kiss almost happened—Elena could feel Marcus's breath warm on her lips—but at the last moment she pulled him into a tight embrace instead. She buried her face in his shoulder and whispered 'not yet,' and he held her close without complaint, his arms solid and warm around her.",
  "reasoning": "An embrace happened, but the kiss was explicitly avoided - 'Instead of kissing him, she pulled him into a tight embrace'"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>confession</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Marcus had been withdrawn all evening, and Elena finally cornered him in the kitchen. 'What's going on with you?' she demanded. He looked at her for a long moment, something unreadable in his expression. 'I just...' He paused, struggling with the words. 'I really like spending time with you, Elena. More than I expected to. These past few weeks have been some of the best I've had in years.' He smiled, a little sheepish. 'You're funny and smart and you don't take any of my bullshit. I just wanted you to know that.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "compliment",
  "description": "Cornered in the kitchen after a withdrawn evening, Marcus finally opened up to Elena with a sheepish smile. He told her the past few weeks had been some of the best he'd had in years, that she was funny and smart and didn't take his bullshit—and that he just wanted her to know.",
  "reasoning": "Expression of affection and appreciation, but not a love confession - he says he 'likes spending time with you', not 'I love you'"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>intimate_kiss</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The party was winding down, and Elena found herself alone on the balcony with James. They'd been talking for hours—about music, about their failed relationships, about the strange twists of fate that had brought them both here tonight. Somewhere along the way, the air between them had changed. Charged. When James reached up to brush a strand of hair from her face, she didn't pull away. 'I've wanted to do this all night,' he murmured. And before she could overthink it, he was kissing her—soft at first, then deeper, his hands cradling her face. In the living room, Marcus was laughing at someone's joke, completely unaware.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "James"],
  "description": "As the party wound down, Elena and James found themselves alone on the balcony after hours of talking about music and fate. When he brushed a strand of hair from her face and murmured that he'd wanted to do this all night, she didn't pull away—and then he was kissing her, soft at first, then deeper, while Marcus laughed obliviously in the other room.",
  "reasoning": "The kiss happened between Elena and James, not Marcus - Marcus is present but separate"
}
</output>
</example>

<example result="reject">
<candidate_event_type>intimate_kiss</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The moment stretched between them, thick with possibility. Elena could feel her heart pounding as Marcus leaned closer, his eyes dropping to her lips. She found herself swaying toward him, drawn by some invisible force. Her eyes fluttered closed. She could feel the warmth of his breath, the anticipation building to an unbearable pitch. And then her phone exploded with sound—her mother's ringtone, shrill and insistent. They jerked apart like they'd been shocked. 'I should—' she started. 'Yeah,' he said. 'Yeah, you should get that.' She answered the phone with shaking hands, and by the time she hung up, the moment had passed.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Kiss was anticipated and nearly happened but was interrupted - no lips actually touched"
}
</output>
</example>

<example result="reject">
<candidate_event_type>confession</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Marcus watched Elena laugh at something James said, and his chest ached with everything he couldn't say. Three years. Three years of pretending he was fine with just friendship. But he wasn't fine. He was in love with her, hopelessly and completely, and it was killing him. I should tell her, he thought. Right now. Just walk over there and say the words. But his feet wouldn't move. His throat closed around the confession. What if it ruined everything? The moment passed. Elena glanced over and waved. He forced a smile and waved back, the words still locked inside him.
</input>
<output>
{
  "result": "reject",
  "reasoning": "All internal thoughts - Marcus never speaks the confession aloud, explicitly stays silent"
}
</output>
</example>

<example result="reject">
<candidate_event_type>gift</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena had been planning this for weeks. The perfect gift, the perfect moment—Marcus's birthday was coming up, and she knew exactly what she wanted to give him. She'd found a first edition of his favorite book at a dusty secondhand shop. It was sitting in her closet now, wrapped in elegant paper with a handwritten card tucked inside. But his birthday wasn't until next weekend, and she was determined to wait. The surprise had to be perfect. So when she met him for coffee that Tuesday, the gift stayed home.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Gift exists but hasn't been given yet - explicitly waiting for the birthday next week"
}
</output>
</example>

<example result="accept">
<candidate_event_type>secret_shared</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
They sat on the roof of his apartment building, passing a bottle of wine between them. The city sprawled below, a million lights flickering in the darkness. Elena had been quiet all night, and Marcus could tell something was weighing on her. 'I need to tell you something,' she finally said, not meeting his eyes. 'Something I've never told anyone.' She took a shaky breath. 'I'm not who you think I am. My real name isn't Elena. I'm actually an operative for a private intelligence firm. Everything about our friendship—it started as an assignment. I was supposed to get close to you because of your father's connections. But somewhere along the way, I...' She trailed off. 'I needed you to know the truth.'
</input>
<output>
{
  "result": "accept",
  "description": "On the rooftop with a million city lights flickering below them, Elena finally shared what she'd never told anyone. Her real name wasn't Elena, their friendship had started as an intelligence assignment—but somewhere along the way it had become real, and she needed Marcus to know the truth.",
  "reasoning": "Voluntary disclosure - she chose to reveal the secret, wasn't caught or exposed"
}
</output>
</example>

<example result="accept">
<candidate_event_type>intimate_embrace</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The funeral had been hours ago, but Marcus still hadn't moved from the bench in the cemetery. Elena found him there as the sun set, his shoulders shaking with silent sobs. She didn't say anything—what was there to say? Instead, she sat down beside him, wrapped her arms around him, and pulled him close. He collapsed against her, burying his face in her shoulder as years of grief finally broke free. They stayed like that as the stars came out, her arms never loosening, his tears soaking through her coat. She held him tight against her chest, one hand stroking his hair, the other pressed firm against his back.
</input>
<output>
{
  "result": "accept",
  "description": "Elena found Marcus still on the cemetery bench as the sun set, his shoulders shaking with silent sobs. Without a word, she wrapped her arms around him and held on as years of grief finally broke free, his tears soaking through her coat while the stars came out above them.",
  "reasoning": "Physical embrace completed - 'wrapped her arms around him', 'pulled him close', 'held him tight'"
}
</output>
</example>

<example result="accept">
<candidate_event_type>shared_meal</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The restaurant was fancier than anywhere Elena had been in years. Crystal chandeliers, white tablecloths, waiters who seemed to materialize out of thin air. Marcus looked completely at ease, of course—this was probably Tuesday night for him. But when he noticed her nervousness, he just grinned and ordered them both the house special without even glancing at the menu. 'Trust me,' he said. When the food arrived—some elaborate arrangement of lamb and vegetables she couldn't pronounce—they dove in together. Between bites, they talked about everything and nothing. She found herself laughing more than she had in months. He refilled her wine glass before it was empty. By the time dessert came, she'd forgotten to be intimidated.
</input>
<output>
{
  "result": "accept",
  "description": "At a restaurant fancier than anywhere Elena had been in years, Marcus grinned at her nervousness and ordered the house special with a simple 'trust me.' They talked about everything and nothing between bites, and somewhere between the lamb she couldn't pronounce and the wine he kept refilling, she forgot to be intimidated and found herself laughing more than she had in months.",
  "reasoning": "Actively eating together - 'they dove in together', 'between bites they talked', 'dessert came'"
}
</output>
</example>

<example result="accept">
<candidate_event_type>defended</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The bar was crowded and loud, the kind of place where trouble could brew without anyone noticing. Marcus had stepped away to get drinks when the man approached Elena—too close, too aggressive, ignoring every signal she gave to back off. 'Come on, don't be like that,' he slurred, grabbing her wrist. Before Elena could react, Marcus was there, stepping between them with a coldness in his eyes she'd never seen before. 'Take your hand off her,' he said, his voice low and dangerous. 'Now.' The drunk man laughed. 'Or what?' Marcus didn't flinch. 'Or I call my friend at the door—the one who owns this place—and you leave here in an ambulance instead of a cab.' The man's smile faltered. He released Elena's wrist and backed away.
</input>
<output>
{
  "result": "accept",
  "description": "When a drunk grabbed Elena's wrist at the bar, Marcus appeared like a wall between them, his voice low and dangerous in a way she'd never heard before. He didn't flinch as he threatened to have the man carried out in an ambulance, and didn't back down until the threat released her and slunk away.",
  "reasoning": "Direct defense - stepped between them, issued threats on her behalf, got the threat to back off"
}
</output>
</example>

<example result="accept">
<candidate_event_type>crisis_together</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The earthquake hit without warning. One moment Elena and Marcus were browsing in the antique shop; the next, the world was shaking apart around them. Display cases shattered, the ceiling cracked, plaster raining down like snow. Marcus grabbed her hand and pulled her under a heavy oak table as the building groaned. They huddled together, her face pressed against his chest, his arms wrapped protectively around her as the chaos continued. Glass exploded somewhere nearby. The floor tilted at an impossible angle. She could feel his heart hammering against her cheek, as fast as her own. 'It's going to be okay,' he kept saying, though she could hear the fear in his voice. 'Just hold on. Hold on.' They stayed like that for what felt like hours, clinging to each other as their world fell apart around them.
</input>
<output>
{
  "result": "accept",
  "description": "The earthquake hit without warning, and Marcus pulled Elena under a heavy oak table as the antique shop shattered around them. They huddled together for what felt like hours, her face pressed to his chest, his heart hammering as fast as hers while he kept whispering 'hold on' through the chaos.",
  "reasoning": "Shared dangerous experience - physically together during crisis, protecting each other"
}
</output>
</example>

<example result="accept">
<candidate_event_type>emotionally_intimate</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
It was 3 AM and neither of them could sleep. They'd started talking after dinner, and somehow the hours had slipped away. The pretenses were gone now—no more clever banter or careful deflection. Marcus told her about his father's death, the way it had hollowed him out, the years of therapy he'd hidden from everyone. In return, she found herself sharing things she'd never said aloud: the eating disorder she'd battled in college, the panic attacks that still ambushed her sometimes, the crushing fear that she'd never be good enough. They talked until their voices were hoarse, until the first gray light of dawn crept through the windows. And when he finally reached across and took her hand, neither of them flinched. They'd seen each other now—really seen each other—and there was no going back.
</input>
<output>
{
  "result": "accept",
  "description": "They talked until 3 AM turned to dawn, all pretenses stripped away as Marcus shared the grief that had hollowed him out and Elena confessed struggles she'd never spoken aloud. When he finally reached across and took her hand, neither of them flinched—they'd really seen each other now, and there was no going back.",
  "reasoning": "Mutual deep emotional sharing - both revealed painful secrets, both were vulnerable"
}
</output>
</example>

<example result="accept">
<candidate_event_type>intimate_touch</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The movie had been terrible, but somehow that made it better. They'd spent half of it whispering sarcastic commentary, stifling laughter so the other patrons wouldn't glare. Now the credits were rolling and the theater was emptying, but neither of them moved to leave. In the dim light, Elena was suddenly aware of how close Marcus was sitting. When had that happened? His shoulder pressed against hers, warm through the fabric of his jacket. And then—so casually it might have been an accident—his hand found hers on the armrest between them. His fingers interlaced with hers, gentle but certain. Neither of them acknowledged it. Neither of them let go. They sat there in the empty theater, holding hands in the darkness, as if it was the most natural thing in the world.
</input>
<output>
{
  "result": "accept",
  "description": "As the credits rolled and the theater emptied around them, Marcus's hand found Elena's on the armrest—so casually it might have been an accident, except his fingers interlaced with hers, gentle but certain. Neither of them acknowledged it, neither of them let go, and it felt like the most natural thing in the world.",
  "reasoning": "Meaningful physical contact - 'his hand found hers', 'fingers interlaced', deliberate non-accidental touch"
}
</output>
</example>

<example result="accept">
<candidate_event_type>gift</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena had been dreading her birthday for weeks. Turning thirty alone in a new city, far from everyone she loved—it felt like the universe was rubbing salt in her wounds. But when she opened her door that morning, Marcus was standing there with a nervous smile and a small wrapped box. 'I know we haven't known each other that long,' he said, 'but I saw this and thought of you.' Inside the box was a vintage compass, brass and beautiful, the kind of thing explorers might have carried a hundred years ago. 'For when you're feeling lost,' he explained. 'So you always know you can find your way.' She felt tears prick her eyes as she took it from the tissue paper, the metal warm against her palm. 'Marcus, I...' She couldn't finish. Instead, she just hugged him, hoping he could feel everything she couldn't say.
</input>
<output>
{
  "result": "accept",
  "description": "On the birthday Elena had been dreading—thirty and alone in a new city—Marcus appeared at her door with a vintage brass compass. 'For when you're feeling lost,' he said, 'so you always know you can find your way.' The metal was warm in her palm, and she hugged him because she couldn't find the words.",
  "reasoning": "Gift physically given and received - 'handed her the box', 'she took it from the tissue paper'"
}
</output>
</example>

<example result="accept">
<candidate_event_type>compliment</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The gallery opening was Elena's nightmare scenario—too many people, too much small talk, everyone judging everyone else's outfit. She'd almost backed out three times, but Marcus had insisted she come. Now she stood frozen in the entrance, suddenly certain her dress was all wrong, that everyone was staring. But when Marcus spotted her across the room, the look on his face made everything else disappear. He crossed to her in three quick strides. 'You look incredible,' he said, and the sincerity in his voice was unmistakable. 'Seriously, Elena. I've never seen you like this. You're absolutely stunning.' He wasn't flirting—he meant every word. She felt something warm unfurl in her chest, and for the first time all night, she smiled.
</input>
<output>
{
  "result": "accept",
  "description": "Elena stood frozen at the gallery entrance, certain her dress was all wrong, until Marcus spotted her across the room and crossed to her in three quick strides. 'You look incredible,' he said with unmistakable sincerity. 'You're absolutely stunning.' Something warm unfurled in her chest, and for the first time all night, she smiled.",
  "reasoning": "Direct sincere praise - 'you look incredible', 'absolutely stunning', spoken with genuine sincerity"
}
</output>
</example>

<example result="accept">
<candidate_event_type>first_meeting</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The coffee shop was packed, and Elena had just claimed the last available table when the stranger approached. Tall, dark-haired, carrying a laptop and a look of polite desperation. 'I know this is incredibly forward,' he said, 'but every outlet in this place is taken except the one under your table. Would you mind terribly if I joined you for an hour? I'll buy your next three coffees and promise not to be annoying.' Elena looked at him—really looked—and something flickered in her chest. 'I'm Elena,' she said, gesturing to the empty chair. He smiled, relieved and maybe something else, and slid into the seat across from her. 'Marcus. And I should warn you, I tend to be at least a little annoying.' That was the beginning, though neither of them knew it yet.
</input>
<output>
{
  "result": "accept",
  "description": "It started with a desperate request for the only free outlet in a packed coffee shop. Elena gestured to the empty chair, he promised three coffees and to only be a little annoying, and when he smiled and said his name was Marcus, something flickered in her chest—though neither of them knew yet what was beginning.",
  "reasoning": "First interaction between strangers - they introduce themselves, no prior relationship indicated"
}
</output>
</example>

<example result="accept">
<candidate_event_type>laugh</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena hadn't meant to knock over the entire display of artisanal olive oils. It just... happened. One moment she was reaching for a sample; the next, glass bottles were cascading everywhere, shattering on the tile floor, oil splashing in every direction. She stood frozen in horror as the entire farmers market turned to stare. And then Marcus—beautiful, composed Marcus who always knew exactly what to do—slipped on a puddle of olive oil and went down hard, taking a pyramid of organic apples with him. For a moment, they just stared at each other from the floor, covered in oil and apple bits. Then something broke, and they both burst out laughing—huge, gasping, tears-streaming-down-their-faces laughter that wouldn't stop no matter how many people glared at them.
</input>
<output>
{
  "result": "accept",
  "description": "After Elena toppled an entire display of artisanal olive oils, always-composed Marcus slipped on the spill and went down hard, taking a pyramid of organic apples with him. They stared at each other from the floor, covered in oil and apple bits, and then burst into huge, gasping, tears-streaming laughter that wouldn't stop no matter how many people glared.",
  "reasoning": "Shared genuine laughter - 'they both burst out laughing', mutual and simultaneous"
}
</output>
</example>

<example result="accept">
<candidate_event_type>comfort</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The phone call came at 2 AM. Marcus's voice was barely recognizable—thick with tears, cracking on every other word. His mother was in the hospital. It didn't look good. Elena didn't think; she just grabbed her keys and drove across the city in her pajamas. When she found him in the hospital waiting room, he looked like a ghost—pale, shaking, completely lost. She didn't ask questions. She just sat down beside him, put her arm around his shoulders, and let him collapse against her. He cried for a long time, horrible wracking sobs that seemed to come from somewhere deep inside him. She rubbed slow circles on his back, murmured soothing nonsense, handed him tissues from the box on the end table. She stayed all night, through every update and every fresh wave of grief, a steady presence in the chaos.
</input>
<output>
{
  "result": "accept",
  "description": "When the 2 AM call came about his mother, Elena didn't think—she just drove across the city in her pajamas and found Marcus looking like a ghost in the waiting room. She sat beside him without questions, let him collapse against her and cry those horrible wracking sobs, and stayed all night as a steady presence through every wave of grief.",
  "reasoning": "Active comfort provided - physical presence, soothing actions, emotional support during distress"
}
</output>
</example>

<example result="accept">
<candidate_event_type>intimate_heated</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
They'd been dancing around this for weeks—the lingering looks, the accidental touches that weren't quite accidental, the excuses to be alone together. But tonight, something snapped. One moment they were arguing about something stupid; the next, Marcus had her pressed against the kitchen counter, his mouth hot and demanding on hers. She kissed him back just as fiercely, her fingers tangling in his hair as he lifted her onto the counter. His hands slid under her shirt, palms burning against her bare skin. She wrapped her legs around him and pulled him closer, closer, never close enough. The kiss deepened, turned desperate. Her back arched as his lips moved to her neck, her collarbone, the hollow of her throat. They were both breathless, both on fire, both past the point of stopping.
</input>
<output>
{
  "result": "accept",
  "description": "After weeks of dancing around it, something finally snapped mid-argument and Marcus had Elena pressed against the kitchen counter, his mouth hot and demanding on hers. She kissed him back just as fiercely, fingers tangling in his hair as he lifted her onto the counter, his hands sliding under her shirt, both of them breathless and on fire and past the point of stopping.",
  "reasoning": "Heated physical encounter - passionate kissing, hands under clothes, explicitly beyond just a simple kiss"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>secret_shared</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena hadn't expected to see her own face on the evening news. But there she was, grainy security footage playing on loop as the anchor described the leaked documents. Her real name. Her agency. Everything she'd built over five years, exposed in an instant. Marcus stood frozen in front of the television, the remote forgotten in his hand. 'That's... that's you,' he said slowly. 'You're the operative they're talking about.' Elena felt the blood drain from her face. Someone had hacked the database. Someone had sold her out. And now Marcus—and the rest of the world—knew exactly who she was. 'I can explain,' she started, but the look in his eyes told her it was already too late.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "secret_revealed",
  "description": "Elena's face appeared on the evening news without warning—grainy security footage, her real name, everything she'd built exposed by a database hack. Marcus stood frozen, remote forgotten in his hand, as he realized she was the operative they were describing. 'I can explain,' she started, but the look in his eyes said it was already too late.",
  "reasoning": "Secret was exposed through a leak/hack, not voluntarily shared - Elena didn't choose to tell Marcus, she was outed"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>intimate_penetrative</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The tension had been building all night, and when Marcus finally kissed her, Elena felt like she might combust. They stumbled toward the bedroom, mouths locked together, clothes coming undone piece by piece. She pushed him onto the bed and climbed on top of him, her hands exploring the planes of his chest while his slid up her thighs. The kisses grew desperate, hungry. His lips traced a burning path down her neck as she ground against him, both of them gasping. But when she reached for his belt, he caught her wrist. 'Let's slow down,' he murmured against her skin. 'We have all night. I want to take my time with you.' So they did—touching, tasting, learning each other's bodies without crossing that final line. Not tonight. But god, they came close.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "intimate_heated",
  "description": "They stumbled toward the bedroom with clothes coming undone, Elena pushing Marcus onto the bed and climbing on top of him, both of them gasping and desperate. But when she reached for his belt, he caught her wrist and murmured 'I want to take my time with you'—so they spent the night learning each other's bodies without crossing that final line.",
  "reasoning": "Intense making out and fooling around, but they explicitly stopped before penetrative sex - 'without crossing that final line'"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>crisis_together</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
It was one of those perfect autumn afternoons, the kind that made you grateful to be alive. Elena and Marcus had been walking for hours, following the trail along the river where the leaves painted everything in shades of gold and crimson. They stopped at a wooden bridge to watch the water flow beneath them, their shoulders touching. Marcus pointed out a family of ducks paddling past. Elena laughed at the way one kept dunking its head. They didn't talk about work or problems or the future—just existed in the moment, two people enjoying a beautiful day together. 'We should do this more often,' Marcus said as the sun began to set. Elena nodded, feeling more at peace than she had in months. 'Yeah. We really should.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "outing",
  "description": "On a perfect autumn afternoon, Elena and Marcus walked for hours along the river where leaves painted everything gold and crimson. They stopped on a wooden bridge to watch ducks paddle past, shoulders touching, not talking about work or problems—just existing together in a moment so peaceful Elena felt more at ease than she had in months.",
  "reasoning": "Pleasant walk together, but no crisis or danger - this is a casual, peaceful outing, not a life-threatening situation"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>argument</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
They had very different opinions on the movie, and the discussion got lively on the walk home. 'The ending made no sense,' Marcus insisted, gesturing emphatically. 'How did she suddenly know the killer's identity?' Elena shook her head. 'She figured it out from the diary entries—remember the scene in the library?' 'That's a stretch and you know it.' 'It's called paying attention to subtext!' They went back and forth for blocks, citing scenes and poking holes in each other's interpretations. But there was no heat in it, no anger—just the pleasure of a good debate. 'Okay, fine,' Marcus finally conceded with a grin. 'You might have a point about the library scene. Might.' Elena punched his arm lightly. 'I always have a point. You just don't like admitting it.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "conversation",
  "description": "On the walk home from the movie, Elena and Marcus got into a lively debate about the ending—he insisted it made no sense, she cited the library scene and its subtext. They went back and forth for blocks, poking holes in each other's interpretations, but there was no heat in it, just the pleasure of a good argument with someone who could keep up.",
  "reasoning": "Animated discussion/debate, but no actual argument - they're enjoying the disagreement, there's no hostility or conflict"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>i_love_you</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The goodbye at the airport was harder than Elena expected. Marcus stood there with his carry-on, looking at her like he was trying to memorize her face. 'I'll miss you,' he said quietly. 'Three months is a long time.' She reached up to straighten his collar, blinking back tears. 'It'll go fast. And we'll video call every day.' 'Promise?' 'Promise.' He pulled her into a hug, and she held on tight, breathing him in. 'I care about you so much,' he whispered against her hair. 'You know that, right? You're... you're incredibly important to me.' She nodded into his chest, unable to speak past the lump in her throat. It wasn't the three words she wanted to hear—but somehow, it felt like enough.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "confession",
  "description": "At the airport before three months apart, Marcus held Elena tight and whispered that she was incredibly important to him, that he cared about her so much. It wasn't the three words she wanted to hear, but as she nodded into his chest with a lump in her throat, it felt like enough.",
  "reasoning": "Deep expression of caring, but he specifically says 'I care about you' not 'I love you' - the narrative notes 'It wasn't the three words she wanted to hear'"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>intimate_embrace</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena had just finished a brutal presentation, and she looked like she might shatter at any moment. Marcus found her in the break room, gripping her coffee with white knuckles. 'Hey,' he said softly, sitting down beside her. 'You killed it in there. You know that, right?' She let out a shaky laugh. 'Didn't feel like it.' He reached over and put his hand on her shoulder, squeezing gently. 'I mean it. You were incredible.' She covered his hand with her own, drawing strength from the contact. 'Thanks, Marcus. I needed to hear that.' They sat like that for a moment—his hand on her shoulder, hers on top of his—before he gave one final pat and pulled away. 'Come on. I'll buy you lunch to celebrate.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "intimate_touch",
  "description": "After her brutal presentation, Elena gripped her coffee with white knuckles until Marcus found her in the break room and put his hand on her shoulder. 'You were incredible,' he said, and she covered his hand with her own, drawing strength from that simple contact before he offered to buy her lunch.",
  "reasoning": "Hand on shoulder with comforting squeeze - supportive touch, but not a full embrace/hug"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>betrayal</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
'Where were you last night?' Marcus asked over breakfast, his tone carefully casual. Elena's fork paused halfway to her mouth. 'I told you. I was at Sarah's.' 'Funny, because I ran into Sarah at the grocery store last night. She seemed surprised when I mentioned you were supposed to be at her place.' The silence stretched between them. Elena set down her fork, her appetite gone. 'Okay. I wasn't at Sarah's.' 'Then where were you?' She couldn't meet his eyes. 'I was... at my ex's apartment. His sister is in town and she needed help with something. I didn't tell you because I knew you'd be upset.' 'You're right. I am upset.' Marcus's jaw tightened. 'Not because you saw your ex. Because you lied about it.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "lied",
  "description": "Over breakfast, Marcus asked where Elena had really been the night before—he'd run into Sarah, who had no idea Elena was supposedly at her place. The silence stretched as Elena admitted she'd been at her ex's, helping his sister, and Marcus's jaw tightened. 'I'm upset,' he said, 'not because you saw your ex. Because you lied about it.'",
  "reasoning": "She lied about her whereabouts, but this isn't a full betrayal - there may be an innocent explanation (helping the sister), the issue is the deception itself"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>emotionally_intimate</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Marcus had finally broken down. After weeks of pretending everything was fine, he sat on his kitchen floor with tears streaming down his face, unable to hold it together anymore. Elena found him there when she let herself in with the spare key. Without a word, she grabbed the box of tissues from the counter and slid down the wall to sit beside him. She didn't ask questions or offer platitudes. She just sat there, a solid presence in his chaos, handing him tissues when he needed them and letting the silence do its work. When the worst of it passed, he leaned his head against her shoulder. 'Thank you,' he croaked. 'For not making me talk about it.' She just reached over and took his hand. 'I'm here. That's all that matters.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "comfort",
  "description": "Elena let herself in with the spare key and found Marcus on his kitchen floor, finally broken after weeks of pretending. She didn't ask questions—just slid down the wall beside him, handed him tissues, and let the silence do its work. 'Thank you for not making me talk about it,' he croaked, and she just took his hand. 'I'm here. That's all that matters.'",
  "reasoning": "Elena is providing comfort, but there's no mutual vulnerability - she's supporting him, not sharing her own struggles"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>shared_meal</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Friday nights had become their thing—takeout containers on the coffee table, the TV queued up to whatever show they were binging that week. Tonight it was the crime drama Elena had been obsessing over, and Marcus was finally hooked too. They sprawled on opposite ends of the couch, occasionally lobbing commentary at the screen or stealing glances at each other during the tense parts. Three episodes in, Elena was completely absorbed in the mystery, while Marcus was more absorbed in the way she kept gasping at the plot twists. 'Called it!' she shouted when the killer was revealed. Marcus just laughed and threw a pillow at her. 'You did not call it. You accused three different people.' 'Minor details.' It was, he thought, the perfect way to spend an evening.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "shared_activity",
  "description": "Friday nights had become their thing—sprawled on opposite ends of the couch, binging whatever show they were obsessed with that week. Three episodes into the crime drama, Elena was shouting 'Called it!' at plot twists while Marcus was more absorbed in the way she gasped at every reveal. The perfect way to spend an evening, he thought.",
  "reasoning": "Watching TV together, but no actual eating is described - this is a shared activity (binge-watching), not a meal"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>intimate_foreplay</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The bed was warm and soft, and neither of them wanted to get up. Elena had her head on Marcus's chest, listening to his heartbeat, while his fingers traced lazy patterns on her back. It was raining outside—a steady, gentle rhythm that made everything feel cocooned and safe. 'We should probably get up,' Marcus murmured into her hair, making no move to do so. 'Probably,' Elena agreed, burrowing closer. He kissed the top of her head. She tilted her face up for a proper kiss, which he obligingly provided—soft and unhurried, no urgency behind it. 'Five more minutes,' she decided. 'Maybe ten.' 'Maybe forever.' She laughed and swatted his chest. But secretly, she thought, forever didn't sound so bad. They lay there for another hour, tangled up in each other, perfectly content.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "intimate_embrace",
  "description": "With rain drumming steadily outside, Elena lay with her head on Marcus's chest, listening to his heartbeat while his fingers traced lazy patterns on her back. 'We should probably get up,' he murmured, making no move to do so. 'Maybe forever,' she suggested, and he laughed, and they stayed tangled together for another hour, perfectly content.",
  "reasoning": "Cuddling and soft kisses, fully clothed in bed - this is intimate and affectionate, but not sexual foreplay"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>defended</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena's arms were full of grocery bags, and she was losing the battle with her front door when Marcus appeared. 'Here, let me help with that.' Before she could protest, he'd already grabbed half the bags from her arms and was fishing her keys out of her purse. 'You're a lifesaver,' she said as he got the door open. 'Hardly. You were managing fine.' 'I was about to drop the eggs.' He carried the bags into her kitchen and started unpacking without being asked—milk in the fridge, bread on the counter, cans in the pantry. He knew where everything went. 'You don't have to do all that,' she said, though she made no move to stop him. He just smiled and kept unpacking. 'I know. I want to.'
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "helped",
  "description": "Elena was losing the battle with her front door, arms full of grocery bags, when Marcus appeared and grabbed half of them without waiting for permission. He fished her keys from her purse, carried everything to the kitchen, and started unpacking without being asked—he knew where everything went. 'You don't have to,' she said. He just smiled. 'I know. I want to.'",
  "reasoning": "Carrying groceries and unpacking them is helping, not defending - there's no threat or confrontation to defend against"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>shared_vulnerability</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The old photo album had surfaced during the move, and Marcus couldn't resist flipping through it. 'Is that you?' Elena asked, peering over his shoulder at a picture of a gap-toothed kid in a superhero costume. 'Halloween, 1995. I was obsessed with Batman.' He turned the page, and she laughed at increasingly embarrassing photos—awkward school pictures, a truly regrettable haircut from the early 2000s, a candid shot of teenage Marcus looking deeply unimpressed at a family reunion. 'Oh my god, is that a mullet?' 'We don't talk about the mullet.' She was laughing so hard she could barely breathe. 'This is the best day of my life.' He threatened to hide the album, but he was laughing too, secretly pleased that she found his past self so entertaining.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "conversation",
  "description": "The old photo album surfaced during the move, and Elena couldn't stop laughing at what she found—gap-toothed Halloween costumes, awkward school pictures, and a truly regrettable mullet from the early 2000s. 'We don't talk about the mullet,' Marcus protested, but he was laughing too, secretly pleased that she found his past self so entertaining.",
  "reasoning": "Sharing funny childhood stories and photos - nostalgic and bonding, but not emotionally vulnerable, no painful secrets or deep fears"
}
</output>
</example>

<example result="wrong_event">
<candidate_event_type>promise</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The night had been perfect—dinner, dancing, a walk along the waterfront under the stars. As they reached her door, neither of them wanted it to end. 'I had an amazing time,' Elena said, and meant it. Marcus smiled, that soft smile that made her heart do stupid things. 'Me too.' He hesitated, then added, 'Maybe we could do this again sometime? I know a great little Italian place you might like.' 'I'd love that.' The suggestion hung in the air, full of possibility but carefully noncommittal. He wasn't promising anything—just floating an idea, testing the waters. 'I'll text you,' he said. 'Goodnight, Elena.' She watched him walk away, already looking forward to that text, already hoping 'sometime' would come soon.
</input>
<output>
{
  "result": "wrong_event",
  "correct_event": "flirt",
  "description": "After a perfect night of dinner and dancing along the waterfront, Marcus lingered at Elena's door with that soft smile that made her heart do stupid things. 'Maybe we could do this again sometime?' he suggested, carefully noncommittal but full of possibility. 'I'll text you.' She watched him walk away, already hoping 'sometime' would come soon.",
  "reasoning": "Suggesting future plans in a flirty way - 'maybe we could' and 'I'll text you' are not commitments/promises"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>confession</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Marcus had been trying to work up the courage all evening, and finally he couldn't hold it in anymore. Sarah looked up from her book as he sat down across from her. 'Can I tell you something?' he asked, his voice unsteady. 'Something I've never told anyone?' She set the book aside, her full attention on him. 'Of course.' He took a deep breath. 'I think I'm in love with you, Sarah. I've been trying to deny it for months, but I can't anymore. Every time I'm with you, I feel like I'm finally home.' She stared at him, lips parted in shock. In the next room, Elena hummed to herself as she made tea, oblivious to the confession happening just steps away.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Marcus", "Sarah"],
  "description": "Marcus had been trying to work up the courage all evening, and finally he couldn't hold it back anymore. 'I think I'm in love with you, Sarah,' he said, his voice unsteady. 'Every time I'm with you, I feel like I'm finally home.' She stared at him with lips parted in shock while Elena hummed in the next room, oblivious.",
  "reasoning": "Marcus confessed love to Sarah, not Elena - Elena is nearby but not involved"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>defended</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The confrontation had been building all week, and it finally exploded in the parking lot after work. Some guy from accounting had been harassing James—subtle digs, 'accidental' shoulder checks, whispered slurs that stopped whenever a manager was nearby. But Elena had seen it all. And when the harassment escalated into a shove that sent James's coffee flying, she snapped. 'Hey!' she shouted, stepping between them. 'What the hell is your problem?' The guy sneered. 'Mind your own business.' 'James IS my business. He's my friend. And if you touch him again, I will make sure HR hears about every single thing you've done.' Marcus watched from the doorway, impressed and a little startled by her ferocity. He'd never seen this side of Elena before.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "James"],
  "description": "When the harassment from accounting escalated into a shove that sent James's coffee flying, Elena snapped. She stepped between them with a ferocity Marcus had never seen, threatening HR and making it clear that James was her friend and her business. The guy backed down, and Marcus watched from the doorway, startled and impressed.",
  "reasoning": "Elena defended James from the harasser, not Marcus - Marcus is an observer"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>gift</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Sarah's birthday party was in full swing when Elena finally managed to get her alone. 'I have something for you,' Elena said, pulling a small velvet box from her purse. 'It's not much, but I saw it and thought of you.' Sarah opened the box to reveal a delicate silver bracelet with a tiny charm—a book, because Sarah was always reading. 'Oh, Elena.' Sarah's eyes welled up. 'It's perfect.' She pulled Elena into a fierce hug. 'Thank you. Really.' Marcus appeared with drinks just as they separated. 'What'd I miss?' 'Elena just gave me the most thoughtful gift ever,' Sarah said, already clasping the bracelet around her wrist. 'Show-off,' Marcus teased Elena, but he was smiling.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "Sarah"],
  "description": "At Sarah's birthday party, Elena pulled her aside and presented a small velvet box—inside, a delicate silver bracelet with a tiny book charm, because Sarah was always reading. Sarah's eyes welled up as she clasped it around her wrist. 'It's perfect,' she said, pulling Elena into a fierce hug.",
  "reasoning": "Elena gave the gift to Sarah, not Marcus - Marcus arrived after the gift was given"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>shared_meal</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The restaurant Marcus had recommended was exactly as good as he'd promised, though he wasn't there to enjoy it. A last-minute work emergency had called him away, leaving Elena and James to fend for themselves. Not that either of them minded. They ordered family-style—duck confit, truffle pasta, a salad neither of them touched—and spent three hours talking about everything and nothing. James had a way of making her laugh until her sides hurt. Elena found herself leaning in every time he spoke. When the check came, they fought over who would pay, and she finally let him win. 'Next time's on me,' she insisted. 'Deal,' he said, and something in his smile suggested he was already looking forward to it.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "James"],
  "description": "Marcus's work emergency left Elena and James at the restaurant alone, not that either of them minded. They ordered family-style and spent three hours talking about everything and nothing, James making her laugh until her sides hurt. When they fought over the check, something in his smile as he said 'next time' suggested he was already looking forward to it.",
  "reasoning": "Elena and James shared the meal - Marcus was called away and didn't eat with them"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>crisis_together</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The storm had rolled in without warning, and Marcus and Sarah were caught in the middle of nowhere when it hit. The car sputtered and died on a flooded road; their phones had no signal; and the rain was coming down so hard they could barely see the trees outside the windows. Lightning cracked overhead, close enough to make them both flinch. 'We should stay in the car,' Marcus said, trying to keep his voice steady. 'Safest place to be.' Sarah's hand found his in the darkness, her fingers cold and trembling. 'I'm scared,' she admitted. 'Me too,' he said. They huddled together as the storm raged, waiting for it to pass, drawing courage from each other's presence. Back in the city, Elena was checking her phone for the tenth time, wondering why Marcus hadn't responded to her texts.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Marcus", "Sarah"],
  "description": "The storm caught Marcus and Sarah in the middle of nowhere—car dead on a flooded road, no signal, lightning cracking close enough to flinch. Sarah's hand found his in the darkness, cold and trembling. 'I'm scared,' she admitted. 'Me too,' he said, and they huddled together as the storm raged while Elena checked her phone across the city, wondering why he hadn't replied.",
  "reasoning": "Marcus and Sarah were trapped in the storm together - Elena was elsewhere, worried about them"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>secret_shared</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena had been carrying this weight for years, and she couldn't hold it anymore. But she couldn't tell Marcus—not this. He'd never look at her the same way. Instead, she found herself in James's apartment at 2 AM, curled up on his couch with a glass of whiskey. 'Can I tell you something terrible?' she asked. 'Something I've never told anyone?' 'Of course.' So she told him. About her father, about what he'd done, about the guilt she still carried even though none of it was her fault. James listened without judgment, his hand steady on her shoulder. When she finished, he simply said, 'Thank you for trusting me.' In his own apartment across town, Marcus slept peacefully, unaware of the secret Elena was finally sharing—just not with him.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "James"],
  "description": "At 2 AM in James's apartment, curled up with whiskey, Elena finally let the weight she'd been carrying spill out—about her father, about what he'd done, about the guilt she still carried. James listened without judgment, his hand steady on her shoulder. 'Thank you for trusting me,' he said when she finished, while Marcus slept peacefully across town, unaware.",
  "reasoning": "Elena shared her secret with James, not Marcus - Marcus is asleep and uninvolved"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>comfort</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The news about his mother had devastated Marcus, and Sarah was the one who found him. He was sitting on the back steps of the house, staring at nothing, his face wet with tears he hadn't bothered to wipe away. She didn't say anything—what could she say? Instead, she sat down beside him and put her arm around his shoulders. He leaned into her, letting himself fall apart in a way he never could with anyone else. She held him while he cried, rubbing slow circles on his back, occasionally pressing a kiss to the top of his head. 'I've got you,' she murmured. 'I'm not going anywhere.' Inside, Elena was on the phone with the hospital, handling the logistics, giving them the space they needed.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Marcus", "Sarah"],
  "description": "Sarah found Marcus on the back steps, face wet with tears he hadn't bothered to wipe away after the news about his mother. She sat beside him without a word and put her arm around his shoulders, letting him fall apart against her. 'I've got you,' she murmured, pressing a kiss to the top of his head. 'I'm not going anywhere.'",
  "reasoning": "Sarah comforted Marcus - Elena was occupied with phone calls"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>intimate_embrace</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
James had just gotten the best news of his life, and Elena was the first person he wanted to share it with. The moment she opened her door, he swept her up in a fierce embrace, lifting her off her feet and spinning her around. 'I got it!' he shouted. 'I got the fellowship!' She was laughing, clinging to his shoulders, caught up in his joy. 'James! Oh my god, that's amazing!' He set her down but didn't let go, his arms wrapped tight around her, his face buried in her hair. 'I couldn't have done it without you,' he said. 'All those late nights helping me practice my presentation...' She hugged him back just as tightly. 'You did this. You earned it.' Across the street, Marcus was getting out of his car, a bouquet of flowers in hand, watching the embrace with a complicated expression.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "James"],
  "description": "The moment Elena opened her door, James swept her off her feet in a fierce embrace, spinning her around. 'I got the fellowship!' he shouted, and she clung to his shoulders laughing, caught up in his joy. 'I couldn't have done it without you,' he said, face buried in her hair, while across the street Marcus watched with flowers in hand and a complicated expression.",
  "reasoning": "Elena and James embraced - Marcus was arriving and observed it"
}
</output>
</example>

<example result="wrong_pair">
<candidate_event_type>emotionally_intimate</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The sleepover had started as a wine night, but somewhere around 3 AM, Elena and Sarah found themselves having the kind of conversation you can only have in the dark. They lay side by side on Sarah's bed, staring at the ceiling, and let the truth spill out. Elena talked about her fear of abandonment, the way every relationship felt like waiting for the other shoe to drop. Sarah confessed to the depression she'd been hiding, the days when getting out of bed felt impossible. They cried. They laughed at themselves for crying. They held hands in the darkness. By the time the sun came up, something had shifted between them—a bond deeper than friendship, forged in mutual vulnerability. At his own apartment, Marcus woke up alone and reached for his phone, already looking forward to Elena's morning text.
</input>
<output>
{
  "result": "wrong_pair",
  "correct_pair": ["Elena", "Sarah"],
  "description": "Somewhere around 3 AM, lying side by side in the dark, Elena and Sarah let the truth spill out—Elena's fear of abandonment, Sarah's hidden depression, all the things they'd never said aloud. They cried, laughed at themselves for crying, held hands in the darkness. By sunrise, something had shifted between them, a bond forged in mutual vulnerability.",
  "reasoning": "Emotional intimacy happened between Elena and Sarah during a sleepover - Marcus was elsewhere"
}
</output>
</example>

<example result="reject">
<candidate_event_type>secret_shared</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
They sat across from each other at the kitchen table, and Elena knew this was her chance. Marcus trusted her. He deserved the truth. All she had to do was open her mouth and say it: I'm not who you think I am. But every time she tried, her throat closed up. The words felt too heavy, too dangerous, too final. What if he hated her? What if he walked away and never came back? 'You okay?' Marcus asked, noticing her strange expression. 'You look like you're somewhere else.' 'I'm fine,' she heard herself say. 'Just tired.' She hated how easily the lie came, but the truth felt impossible. Maybe tomorrow. Maybe next week. Maybe never. She picked up her coffee cup and changed the subject.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Elena considers telling the truth but explicitly doesn't - she lies and changes the subject instead"
}
</output>
</example>

<example result="reject">
<candidate_event_type>intimate_embrace</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena looked so fragile standing there, tears streaming down her face, and every instinct in Marcus screamed to pull her into his arms. He wanted to hold her, to tell her everything would be okay, to be her shelter from whatever storm she was facing. But they were colleagues, barely even friends, and he didn't know if his touch would be welcome. So he kept his distance. His hands stayed at his sides, fingers curling into fists with the effort of restraint. 'Is there anything I can do?' he asked instead, his voice soft. She shook her head, wiping her eyes. 'No. But thank you for asking.' She walked away, and he stood there alone, wishing he'd been brave enough to close the distance between them.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Marcus wants to embrace her but explicitly keeps his distance - no physical contact occurs"
}
</output>
</example>

<example result="reject">
<candidate_event_type>first_meeting</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The wedding photos had them laughing at their younger selves. 'God, look at your hair,' Elena teased, pointing at a shot of Marcus from 2015. 'I was going through a phase!' 'A bad phase.' 'Says the woman who wore those platform boots to the reception.' She gasped in mock offense. 'Those boots were iconic.' They flipped through more pictures, reminiscing about the night they'd met—how nervous Marcus had been asking her to dance, how Elena had stepped on his feet at least four times, how neither of them had expected to still be talking ten years later. 'Best decision I ever made,' Marcus said quietly, 'walking up to you at that bar.' Elena leaned her head on his shoulder. 'Mine too.' But that first meeting was a decade in the past now, preserved only in photographs and memory.
</input>
<output>
{
  "result": "reject",
  "reasoning": "They're reminiscing about first meeting years ago - this is a reference to the past, not a current first meeting"
}
</output>
</example>

<example result="reject">
<candidate_event_type>defended</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The memory of that night still haunted him. The way those guys had surrounded Elena in the parking lot, the fear in her eyes, the words they'd shouted at her. And what had Marcus done? Nothing. He'd frozen like a coward, his feet rooted to the ground, his voice trapped in his throat. By the time he'd finally moved, she'd managed to escape on her own, sprinting to her car while he stood there useless. She'd never mentioned it afterward, but he saw the way she looked at him sometimes—like she was measuring him and finding him wanting. He wished he could go back and do it differently. Be brave for once. Stand up for her the way she deserved. But wishing didn't change anything. The moment had passed, and his failure was carved in stone.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Marcus explicitly did NOT defend Elena - he froze and she escaped on her own, he regrets his inaction"
}
</output>
</example>

<example result="reject">
<candidate_event_type>shared_vulnerability</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Marcus found Elena on the fire escape, staring out at the city lights with a heaviness in her eyes that made his chest tight. He sat down beside her, but she barely seemed to notice. Whatever was bothering her, it was bigger than anything he could fix with words. She looked so vulnerable in that moment—small and fragile in a way she never let anyone see. He wanted to ask what was wrong, wanted to offer some comfort, but the distance between them felt insurmountable. She wasn't crying, wasn't speaking, just existing in her pain. After a long silence, she stood up. 'I should go to bed,' she said, her voice flat. 'Goodnight, Marcus.' She went inside without another word, leaving him alone with his worry and his unanswered questions.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Elena appears vulnerable but never shares anything with Marcus - no words exchanged, she leaves without opening up"
}
</output>
</example>

<example result="reject">
<candidate_event_type>i_love_you</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The words sat heavy on Marcus's tongue, pressing against his teeth like they were trying to escape. I love you. Three little words that could change everything between them. Elena was looking at him expectantly, waiting for him to finish his sentence, and the truth hovered in the air like a held breath. 'I...' he started. She tilted her head. 'You...?' Tell her. Just tell her. But he couldn't. The fear was too strong, the risk too great. 'I think we should order dessert,' he finished lamely. Something flickered in her eyes—disappointment? Relief? He couldn't tell. The moment passed, and the words 'I love you' remained unspoken, echoing only in the silence between them.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Marcus almost says 'I love you' but explicitly doesn't - he changes to 'I think we should order dessert'"
}
</output>
</example>

<example result="reject">
<candidate_event_type>promise</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena needed him to say the words. Just promise me you'll stay. That's all. But Marcus was already pulling away, already listing all the reasons why he couldn't commit. 'I want to,' he said, and she could hear the sincerity in his voice. 'I really do. But I don't know what's going to happen with my job, and I can't make promises I might not be able to keep.' It was the responsible answer, the mature answer, and she hated him a little for it. She wanted reckless. She wanted commitment. She wanted someone willing to leap without looking. 'Okay,' she said, because what else was there to say? He hadn't promised. He'd explicitly avoided it. And somehow, that felt worse than if he'd just lied.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Marcus explicitly avoids making a promise - he says he 'can't make promises he might not be able to keep'"
}
</output>
</example>

<example result="reject">
<candidate_event_type>intimate_penetrative</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena couldn't sleep. She lay in the darkness, her mind wandering to places it shouldn't go. She imagined what it would be like if Marcus were here—not as a friend, but as something more. She imagined his hands on her skin, his weight pressing her into the mattress, the sound of his voice rough with desire. She imagined how it would feel to finally cross that line they'd been dancing around for months. In her fantasy, he was confident, certain, knowing exactly what she needed before she could ask. The thought sent a flush of heat through her body. But it was just imagination—just a lonely woman in an empty bed, dreaming about someone who was probably sleeping peacefully in his own apartment, unaware of the thoughts she couldn't seem to control.
</input>
<output>
{
  "result": "reject",
  "reasoning": "All fantasy/imagination - Elena is alone, imagining intimacy that isn't happening"
}
</output>
</example>

<example result="reject">
<candidate_event_type>betrayal</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena couldn't shake the feeling that Marcus had betrayed her somehow. The way he'd laughed with Sarah at the party, the private jokes she didn't understand, the way they'd disappeared together for twenty minutes and come back looking slightly disheveled. Her mind spun elaborate stories of whispered secrets and stolen kisses. But when she finally confronted him, Marcus looked genuinely confused. 'Sarah? We went to find more ice. The bag broke and we had to clean up the mess—that's why my shirt got wet.' He pulled up his phone and showed her a selfie: him and Sarah, laughing, covered in ice, clearly in a storage closet and clearly innocent. Elena felt her suspicions deflate. There was no betrayal. She'd invented it entirely, her insecurity creating demons that didn't exist.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Elena feels betrayed but it's explicitly stated that no betrayal occurred - her suspicions were unfounded"
}
</output>
</example>

<example result="reject">
<candidate_event_type>crisis_together</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The fire had been twenty years ago, but the memories were still vivid. Elena and Marcus sat on his back porch, a bottle of wine between them, watching the sunset paint the sky in shades of orange. 'Do you ever think about that night?' Marcus asked. 'The one at summer camp?' How could she not? The way the flames had erupted out of nowhere, the scramble to escape, the moment she'd thought she was going to die. And Marcus—fifteen years old and terrified—grabbing her hand and pulling her through the smoke. 'You saved my life,' she said quietly. 'We saved each other.' They sat in companionable silence, bound by a shared memory of danger and survival. But that crisis was decades in the past. Tonight was peaceful, the most dangerous thing being the amount of wine they were consuming.
</input>
<output>
{
  "result": "reject",
  "reasoning": "The crisis was twenty years ago - they're reminiscing about a past event, not currently in danger"
}
</output>
</example>

<example result="reject">
<candidate_event_type>argument</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The words were right there, sharp and bitter on the tip of Elena's tongue. She wanted to scream at him, to finally say all the things she'd been swallowing for months. How dare he dismiss her opinion like that? How dare he assume he always knew better? Her jaw clenched so hard her teeth ached. But the words wouldn't come. She bit them back, swallowed them down, felt them turn to acid in her stomach. 'Fine,' she said instead, her voice carefully neutral. 'Whatever you think is best.' Marcus nodded, oblivious to the storm raging behind her eyes. The argument she wanted to have stayed locked inside her, unfought and unresolved. She grabbed her keys and left before the dam could break.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Elena wants to argue but explicitly bites back the words - no argument spoken, she leaves instead"
}
</output>
</example>

<example result="reject">
<candidate_event_type>intimate_foreplay</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The tension between them was electric, palpable, impossible to ignore. Every time Marcus's hand brushed against hers, Elena felt a jolt of awareness travel through her entire body. They both knew what was happening, what could happen if either of them was brave enough to close the distance. She caught him looking at her lips. He caught her looking at the way his shirt stretched across his shoulders. The air grew thick with unspoken desire. But neither of them moved. They talked about the movie, about work, about everything except the elephant in the room. When he finally said goodnight at her door, they exchanged a look that promised everything and nothing. 'See you tomorrow,' he said. 'Yeah,' she breathed. 'Tomorrow.' And then he was gone, and the tension dissolved into ordinary loneliness.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Sexual tension and awareness, but no physical action occurs - they say goodnight and he leaves"
}
</output>
</example>

<example result="reject">
<candidate_event_type>secret_revealed</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena lived in constant fear that someone would find out. The documents were hidden in a safety deposit box, the files encrypted with passwords only she knew, the evidence buried so deep no one should ever be able to dig it up. Sometimes she imagined what would happen if Marcus learned the truth—the look on his face, the questions she couldn't answer, the trust that would shatter into pieces. But he wouldn't find out. She was too careful for that. Every trail was covered, every loose end tied. The secret stayed where it belonged: locked in the darkness, known to no one but herself. Marcus smiled at her over breakfast, innocent and trusting, and she smiled back, the weight of her hidden truth heavy on her shoulders.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Secret is explicitly kept safe and not revealed - Elena is careful and Marcus remains unaware"
}
</output>
</example>

<example result="reject">
<candidate_event_type>confession</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
'We need to talk about us,' Elena said, and Marcus felt his heart stop. This was it. The moment he'd been dreading and hoping for in equal measure. She took a breath, and he braced himself for impact. 'I've been thinking a lot about—' Her phone buzzed. She glanced at it, frowned. 'Sorry, one second. It's my sister.' He watched her step away, watched the concerned expression cross her face as she answered the call. When she came back, she was already grabbing her bag. 'I have to go. Family emergency.' 'But what were you going to say?' The look she gave him was apologetic. 'It can wait. It's not important.' She was out the door before he could argue, the confession—whatever it was—left hanging forever in the silence she left behind.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Confession started but explicitly abandoned - she was interrupted and said 'it can wait, it's not important'"
}
</output>
</example>

<example result="reject">
<candidate_event_type>shared_meal</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
The restaurant reservation was for 8 PM Friday—the new Italian place that had just opened downtown, the one Elena had been dying to try. Marcus had suggested it days ago, and she'd marked it in her calendar with a little heart emoji. But Friday was still three days away, and right now she was eating a sad desk salad alone in her cubicle. Marcus was probably doing the same thing two floors up, both of them too busy with the quarterly reports to take a proper lunch break. Still, she thought as she stabbed at a cherry tomato, Friday was coming. Three days until good food, good wine, and Marcus's undivided attention. She could survive until then. The meal they'd share was worth waiting for.
</input>
<output>
{
  "result": "reject",
  "reasoning": "The meal is planned for Friday but hasn't happened yet - they're eating separately, waiting for the future dinner"
}
</output>
</example>

<example result="reject">
<candidate_event_type>gift</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena's bag was heavier than usual, weighted down by the small velvet box she'd been carrying for three weeks now. The gift for Marcus—a vintage watch that had cost her an entire month's salary—sat wrapped and ready, waiting for the perfect moment. But the moment never seemed to come. First he'd been stressed about work, and she didn't want to add pressure. Then he'd mentioned maybe seeing his ex, and she'd panicked that the gift was too much. Now they were having coffee like they always did, and the box pressed against her hip like a guilty secret. Say something. Just give it to him. But she couldn't make herself reach into the bag. The watch stayed hidden, waiting for a moment she was starting to wonder would ever arrive.
</input>
<output>
{
  "result": "reject",
  "reasoning": "Gift is purchased and in her bag but never given - she's been waiting for 'the perfect moment' but keeps hesitating"
}
</output>
</example>

<example result="reject">
<candidate_event_type>first_meeting</candidate_event_type>
<candidate_pair>["Elena", "Marcus"]</candidate_pair>
<input>
Elena was running late, as usual, weaving through the crowded sidewalk with her coffee sloshing dangerously. She barely registered the man walking toward her—just another stranger in a city of millions. Their shoulders almost brushed as they passed each other. Almost. He glanced up from his phone at the same moment she looked away. For a fraction of a second, they existed in each other's peripheral vision, two lives passing like ships in the night. Then the crowd surged, and he was gone, swallowed up by the morning rush. Elena kept walking, never knowing that the stranger she'd almost collided with was Marcus—the man she wouldn't actually meet for another six months, at a party neither of them wanted to attend. This was not the beginning of their story. Just a near-miss neither of them would remember.
</input>
<output>
{
  "result": "reject",
  "reasoning": "No actual interaction occurs - they pass each other without making contact or speaking, not a real meeting"
}
</output>
</example>
</examples>`,
		userTemplate: `<candidate_event_type>{{candidateEventType}}</candidate_event_type>
<candidate_pair>{{candidatePair}}</candidate_pair>
<present_characters>{{presentCharacters}}</present_characters>
<all_event_types>{{allEventTypes}}</all_event_types>

<recent_messages>
{{messages}}
</recent_messages>

Validate the milestone event as valid JSON:`,
	},
};
