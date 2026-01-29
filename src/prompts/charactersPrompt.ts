// ============================================
// Character Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const CHARACTERS_PROMPTS: Record<string, PromptDefinition> = {
	characters_initial: {
		key: 'characters_initial',
		name: 'Characters - Initial',
		description: 'Extracts all character states from scene opening',
		defaultTemperature: 0.7,
		placeholders: [
			COMMON_PLACEHOLDERS.userInfo,
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze this roleplay scene and extract all character states. You must only return valid JSON with no commentary.

<instructions>
<general>
- Extract all characters present in the scene.
- For each character, determine their position, activity, mood, physical state, and outfit.
- Make reasonable inferences where information is not explicit.
</general>
<outfit_rules>
- Consider whether the character would usually wear clothes (ponies, Pokemon, animals typically don't).
- For non-clothed species, return null for all outfit slots unless explicitly dressed.
- Be specific: 't-shirt' not 'default top' or 'unspecified top'.
- Include underwear/socks with reasonable assumptions for clothed characters.
- Fur, scales, and other anatomy do NOT count as outfit items.
- If clothing is described as removed or off, set that slot to null.
- neck slot: necklaces, chokers, scarves, ties, collars.
- back slot: backpacks, quivers, cloaks, capes, messenger bags, holsters.
</outfit_rules>
</instructions>

<examples>
<example>
<input>
*The coffee shop was quiet for a Monday morning. Elena sat in her usual corner booth, laptop open but ignored as she stared out the rain-streaked window. She'd thrown on her favorite oversized cardigan over a simple white tank top before leaving the apartment, paired with the worn jeans she always reached for on days when she needed comfort. Her hair was still damp from the shower, pulled back in a messy ponytail that dripped occasionally onto her shoulders.*

*She wrapped both hands around her latte, letting the warmth seep into her fingers. The shop's AC was cranked too high, as usual, and she wished she'd worn something warmer. Her phone buzzed on the table—probably Marcus again—but she couldn't bring herself to look at it yet. Instead, she watched a businessman outside struggle with his umbrella in the wind, his expensive suit getting splattered despite his efforts.*

*Her laptop pinged with a new email notification. Work. Always work. Elena sighed and finally pulled the computer closer, resigned to dealing with whatever crisis had erupted overnight. Her reading glasses were somewhere in her bag, but she didn't feel like digging for them.*
</input>
<output>
[{
  "name": "Elena",
  "position": "Corner booth by window",
  "activity": "Reluctantly checking work emails, holding latte",
  "mood": ["melancholy", "reluctant", "tired"],
  "physicalState": ["cold", "damp hair"],
  "outfit": {
    "head": null,
    "neck": null,
    "jacket": "Oversized cardigan",
    "back": null,
    "torso": "White tank top",
    "legs": "Worn comfortable jeans",
    "underwear": "Cotton bra and panties",
    "socks": "Ankle socks",
    "footwear": "Canvas sneakers"
  }
}]
</output>
<explanation>
- position: "Corner booth by window" - spatial location extracted from "usual corner booth" and "stared out the window"
- activity: Combines her current action (checking emails) with physical detail (holding latte) to paint the scene
- mood: Multiple moods captured - "melancholy" from window staring, "reluctant" from avoiding phone/emails, "tired" from overall tone
- physicalState: "cold" (AC too high, wished for warmer clothes) and "damp hair" (still wet from shower)
- outfit inference reasoning:
  * jacket: "Oversized cardigan" explicitly mentioned
  * torso: "White tank top" explicitly mentioned
  * legs: "Worn jeans" explicitly mentioned, added "comfortable" based on context about comfort-seeking
  * underwear: NOT mentioned, but inferred as "Cotton bra and panties" - simple, practical choice matching the casual comfort-focused outfit. A tank top requires a bra; the casual vibe suggests cotton over lace
  * socks: NOT mentioned, but inferred as "Ankle socks" - jeans typically worn with socks; casual outfit suggests simple ankle socks
  * footwear: NOT mentioned, but inferred as "Canvas sneakers" - casual comfort outfit + rainy day + jeans strongly suggests sneakers over heels or sandals
  * neck: null - no neckwear mentioned or contextually implied
  * back: null - she's sitting in a cafe, no bag/backpack mentioned
- Key principle: NEVER use "unspecified" or "unknown" - always make a reasonable inference based on the outfit style, occasion, and character context
</explanation>
</example>

<example>
<input>
*Detective Morrison entered the precinct looking like he hadn't slept in days—which, to be fair, he hadn't. His tie was loosened, top button undone, and his usually crisp white dress shirt had developed a concerning coffee stain near the pocket. The shoulder holster was visible under his rumpled gray suit jacket, service weapon a familiar weight against his ribs.*

*He tossed his badge on the desk and dropped into his chair with a groan, the old springs protesting loudly. Three days on this case and they were no closer to finding the girl. The case files were still spread across his desk from last night, photos and reports mixed together in organized chaos that only made sense to him.*

*His partner Chen looked up from her own desk, raising an eyebrow at his disheveled state. She was, as always, immaculately put together—pressed navy blazer, hair in a perfect bun, not a wrinkle in sight. How she managed it on the same hours he was working remained one of life's great mysteries.*

Morrison: "Don't say it."
Chen: "Wasn't going to say anything." *She slid a fresh coffee across the desk toward him.* "You look like hell, by the way."
</input>
<output>
[{
  "name": "Morrison",
  "position": "At his desk",
  "activity": "Just arrived, accepting coffee from partner",
  "mood": ["exhausted", "frustrated", "grimly determined"],
  "physicalState": ["sleep-deprived", "disheveled"],
  "outfit": {
    "head": null,
    "neck": "Loosened striped tie",
    "jacket": "Rumpled gray suit jacket",
    "back": null,
    "torso": "White dress shirt (coffee-stained, top button undone)",
    "legs": "Gray suit trousers",
    "underwear": "White undershirt, boxers",
    "socks": "Black dress socks",
    "footwear": "Black leather oxfords"
  }
},
{
  "name": "Chen",
  "position": "At her desk across from Morrison",
  "activity": "Offering coffee to partner, light teasing",
  "mood": ["alert", "professional", "slightly amused"],
  "physicalState": [],
  "outfit": {
    "head": null,
    "neck": "Simple gold chain necklace",
    "jacket": "Pressed navy blazer",
    "back": null,
    "torso": "White silk blouse",
    "legs": "Navy dress trousers",
    "underwear": "Seamless nude bra and panties",
    "socks": "Sheer nude knee-highs",
    "footwear": "Navy low heels"
  }
}]
</output>
<explanation>
TWO characters extracted - both detectives present in the scene.

Morrison:
- physicalState: "sleep-deprived" and "disheveled" - multiple states can coexist
- outfit details: State descriptors in parentheses - "(coffee-stained, top button undone)" for the shirt
- legs: "Gray suit trousers" inferred to match the "gray suit jacket" - suits come as sets
- underwear: "White undershirt, boxers" - male detective in a suit would typically wear an undershirt; boxers are standard professional default for men
- socks: "Black dress socks" - standard with suit and dark shoes
- footwear: "Black leather oxfords" - classic detective/professional male footwear, matches suit

Chen:
- mood includes "slightly amused" from her teasing
- outfit is described as immaculate/pressed - reflects personality
- torso: "White silk blouse" inferred - blazers typically worn over blouses in professional settings; silk matches her put-together appearance
- underwear: "Seamless nude bra and panties" - professional women often wear seamless undergarments under fitted clothing to avoid visible lines
- socks: "Sheer nude knee-highs" - professional women in trousers often wear knee-highs rather than full pantyhose for comfort
- footwear: "Navy low heels" - matches the navy blazer, professional but practical for detective work

Key inference principles:
1. Match underwear formality to outfit formality (silk blouse -> nicer undergarments)
2. Consider practicality (detective work -> low heels, not stilettos)
3. Color coordinate where logical (navy suit pieces together)
4. Account for gender norms in professional settings
</explanation>
</example>

<example>
<input>
*The Pikachu bounced excitedly around the Pokemon Center lobby, cheeks sparking with barely contained electricity. Its trainer, a young woman with bright pink hair, was trying desperately to calm it down before it short-circuited the healing machines again.*

Nurse Joy: "Perhaps some fresh air would help? The courtyard is lovely this time of day."

*The trainer—her name tag read 'Zoe'—sighed and scooped up the energetic electric mouse, tucking it under her arm like a fuzzy yellow football. She was dressed for travel: sturdy hiking boots, cargo shorts with about a million pockets, and a fitted black athletic top that had seen better days. A large backpack sat on the bench behind her, covered in patches from different gym badges and travel destinations.*

Zoe: "Sorry, he gets like this after battles. Too much energy and nowhere to put it."

*The Pikachu's ears twitched, and it let out a cheerful 'Pika!' before settling down slightly, though its tail still wagged against Zoe's hip.*
</input>
<output>
[{
  "name": "Pikachu",
  "position": "Being held under Zoe's arm",
  "activity": "Calming down after excitement, tail wagging",
  "mood": ["excited", "energetic", "happy"],
  "physicalState": ["excess electrical charge"],
  "outfit": {
    "head": null,
    "neck": null,
    "jacket": null,
    "back": null,
    "torso": null,
    "legs": null,
    "underwear": null,
    "socks": null,
    "footwear": null
  }
},
{
  "name": "Zoe",
  "position": "Near Pokemon Center lobby bench",
  "activity": "Holding Pikachu, apologizing to Nurse Joy",
  "mood": ["exasperated", "apologetic", "fond"],
  "physicalState": [],
  "outfit": {
    "head": null,
    "neck": null,
    "jacket": null,
    "back": "Large travel backpack (on bench)",
    "torso": "Black fitted athletic top (worn)",
    "legs": "Cargo shorts with multiple pockets",
    "underwear": "Sports bra and athletic briefs",
    "socks": "Thick hiking socks",
    "footwear": "Sturdy hiking boots"
  }
},
{
  "name": "Nurse Joy",
  "position": "Behind Pokemon Center counter",
  "activity": "Suggesting the courtyard, being helpful",
  "mood": ["patient", "helpful", "professional"],
  "physicalState": [],
  "outfit": {
    "head": "Nurse cap",
    "neck": null,
    "jacket": null,
    "back": null,
    "torso": "Pink nurse uniform dress",
    "legs": "Pink nurse uniform dress",
    "underwear": "White practical bra and panties",
    "socks": "White knee-high stockings",
    "footwear": "White nursing shoes"
  }
}]
</output>
<explanation>
THREE characters extracted, including the Pokemon:

Pikachu (non-human):
- ALL outfit slots are null - Pokemon don't wear clothes by default
- physicalState: "excess electrical charge" - this IS tracked for non-humans as it's a relevant physical condition
- mood still tracked normally - Pokemon have emotions

Zoe (Pokemon trainer):
- outfit matches "dressed for travel" description with practical/athletic theme
- underwear: "Sports bra and athletic briefs" - inferred from athletic top and active lifestyle. Someone in hiking gear and athletic wear would wear athletic undergarments, not lace
- socks: "Thick hiking socks" - hiking boots require substantial socks; this is a practical inference
- State descriptor "(worn)" added to athletic top since text mentioned "had seen better days"

Nurse Joy (uniform character):
- Iconic uniform character - nurse cap, pink dress, white accessories
- torso AND legs both list "Pink nurse uniform dress" - it's a single garment covering both
- underwear: "White practical bra and panties" - professional medical setting suggests practical, likely white to not show under uniform
- socks: "White knee-high stockings" - traditional nurse uniform includes white stockings
- footwear: "White nursing shoes" - comfortable, professional medical footwear

Key species principle: Pokemon, animals, and non-humanoid creatures get null for ALL outfit slots unless they're explicitly wearing something (like a Pokemon costume or accessory). But they still have mood and physicalState.
</explanation>
</example>

<bad_example>
<output>
[{
  "name": "Elena",
  "outfit": {
    "head": null,
    "neck": null,
    "jacket": "Cardigan",
    "back": null,
    "torso": "Tank top",
    "legs": "Jeans",
    "underwear": "Unspecified undergarments",
    "socks": "Unknown",
    "footwear": "Shoes"
  }
}]
</output>
<why_bad>
- "Unspecified undergarments" and "Unknown" are NEVER acceptable - always infer based on outfit style and context
- Outfit items lack detail: "Cardigan" should be "Oversized cardigan", "Tank top" should be "White tank top", "Jeans" should be "Worn comfortable jeans"
- "Shoes" is too vague - specify the type based on outfit context (sneakers, heels, boots, etc.)
- Missing state descriptors where relevant
- Should infer: casual outfit = cotton underwear, ankle socks, canvas sneakers
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<character_info>
{{userInfo}}

{{characterInfo}}
</character_info>

<current_location>
{{location}}
</current_location>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract all characters as valid JSON array:`,
	},

	characters_initial_outfit: {
		key: 'characters_initial_outfit',
		name: 'Characters - Initial Outfit',
		description: 'Infers outfits for characters that just entered the scene',
		defaultTemperature: 0.7,
		placeholders: [
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.messages,
			{
				name: '{{characters}}',
				description: 'New characters with position/activity info',
				example: 'Name: Marcus\nPosition: Front door entrance\nActivity: Entering with grocery bags',
			},
		],
		systemPrompt: `Analyze this roleplay scene and infer the outfit for characters who just entered. You must only return valid JSON with no commentary.

<instructions>
<general>
- You are given characters who just ENTERED the scene - infer what they would be wearing.
- Make reasonable inferences based on the context, location, and their apparent activity.
- Be specific and detailed with outfit descriptions.
</general>
<outfit_rules>
- Consider whether the character would usually wear clothes (ponies, Pokemon, animals typically don't).
- For non-clothed species, return null for all outfit slots unless explicitly dressed.
- Be specific: 't-shirt' not 'default top' or 'unspecified top'.
- Include underwear/socks with reasonable assumptions for clothed characters.
- Fur, scales, and other anatomy do NOT count as outfit items.
- neck slot: necklaces, chokers, scarves, ties, collars.
- back slot: backpacks, quivers, cloaks, capes, messenger bags, holsters.
- NEVER use "unspecified" or "unknown" - always make a reasonable inference based on outfit style, occasion, and character context.
</outfit_rules>
</instructions>

<examples>
<example>
<new_characters>
Name: Marcus
Position: Front doorway
Activity: Arriving home from work
</new_characters>
<location>Downtown Apartment - Living Room (Near the couch)</location>
<messages>
Elena: *She heard the familiar sound of keys jingling outside and quickly minimized the job listing she'd been browsing. The apartment door swung open and Marcus stepped inside, loosening his tie with one hand while balancing his leather briefcase in the other. He looked exhausted—the kind of bone-deep tired that came from back-to-back meetings and impossible deadlines.*

*Rain had caught him on the walk from the parking garage, leaving dark spots on the shoulders of his suit jacket. His usually neat hair was slightly disheveled, a few strands falling across his forehead. He kicked the door shut behind him and finally met her eyes, managing a weary smile.*

Marcus: "Sorry I'm late. The Henderson account blew up again." *He set his briefcase down by the coat rack and shrugged out of his damp jacket, draping it over the back of a chair.* "Please tell me there's wine."
</messages>
<output>
{
  "characters": [
    {
      "name": "Marcus",
      "outfit": {
        "head": null,
        "neck": "Loosened navy silk tie",
        "jacket": null,
        "back": null,
        "torso": "White dress shirt (rain-spotted)",
        "legs": "Charcoal dress trousers",
        "underwear": "White undershirt, gray boxer briefs",
        "socks": "Black dress socks",
        "footwear": "Brown leather oxfords"
      }
    }
  ]
}
</output>
<explanation>
Marcus is arriving from a corporate job, so professional attire is inferred. The jacket was explicitly removed in the text so it's null. The tie is described as being loosened. Rain spots are noted on his shirt. Underwear follows professional male norms (undershirt under dress shirt, boxer briefs). Dress socks and oxfords match the business attire.
</explanation>
</example>

<example>
<new_characters>
Name: Zoe
Position: Pokemon Center entrance
Activity: Rushing inside with injured Pokemon
</new_characters>
<location>Cerulean City - Pokemon Center (Main lobby)</location>
<messages>
*The automatic doors whooshed open and a young trainer burst through, cradling a Vulpix wrapped in her hoodie. The fire-type's fur was matted and dull, its breathing shallow. Behind her, a Pikachu scrambled to keep up, its usual energy replaced with worried chirps.*

Zoe: "Nurse Joy! Please, we need help!" *She skidded to a halt at the counter, nearly tripping over her own feet in her haste. Sweat plastered her pink-streaked hair to her forehead—she must have run all the way from Route 24.* "We got ambushed by a wild Primeape. Vulpix took a bad hit protecting Sparky."

*The Pikachu hopped up onto the counter, ears flat against its head as it watched its injured companion. Zoe's hands were trembling as she carefully transferred the Vulpix to Nurse Joy's waiting arms, her fingerless gloves doing little to hide how badly she was shaking.*
</messages>
<output>
{
  "characters": [
    {
      "name": "Zoe",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": "Worn trainer backpack",
        "torso": "Black tank top",
        "legs": "Cargo shorts with pokeball belt",
        "underwear": "Sports bra, athletic briefs",
        "socks": "Thick hiking socks",
        "footwear": "Trail running shoes"
      }
    },
    {
      "name": "Pikachu",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "underwear": null,
        "socks": null,
        "footwear": null
      }
    }
  ]
}
</output>
<explanation>
Zoe is a Pokemon trainer who's been traveling and battling—athletic/outdoor gear is appropriate. Her hoodie was used to wrap Vulpix, so jacket is null. Fingerless gloves are mentioned but there's no gloves slot. The backpack is standard trainer gear. Athletic underwear matches active lifestyle. Pikachu is a Pokemon so ALL outfit slots are null—Pokemon don't wear clothes.
</explanation>
</example>

<example>
<new_characters>
Name: Detective Chen
Position: Crime scene entrance
Activity: Arriving to investigate

Name: Officer Rodriguez
Position: Behind Detective Chen
Activity: Following with evidence kit
</new_characters>
<location>Industrial District - Abandoned Warehouse (Main floor)</location>
<messages>
*The warehouse door groaned as Detective Chen pushed it open, the beam of her flashlight cutting through decades of accumulated dust. She paused at the threshold, taking in the scene with practiced eyes—overturned crates, scattered paperwork, and in the center of it all, the reason they were here at 3 AM on a Tuesday.*

*Officer Rodriguez ducked under the crime scene tape behind her, his evidence kit clinking softly as he moved. He was young, maybe six months out of the academy, but he had good instincts. Chen had requested him specifically for this case.*

Detective Chen: "Nobody touches anything until forensics gets here." *She pulled a pair of nitrile gloves from her coat pocket, snapping them on with practiced efficiency.* "Rodriguez, start documenting. I want photos of everything before CSU arrives."

Officer Rodriguez: "Yes, ma'am." *He was already pulling out his camera, the flash briefly illuminating the navy blue of his uniform.* "Should I call for additional units? This place is huge."
</messages>
<output>
{
  "characters": [
    {
      "name": "Detective Chen",
      "outfit": {
        "head": null,
        "neck": "Detective badge on lanyard",
        "jacket": "Black wool peacoat",
        "back": null,
        "torso": "Burgundy silk blouse",
        "legs": "Black dress pants",
        "underwear": "Seamless nude bra and panties",
        "socks": "Black trouser socks",
        "footwear": "Black leather ankle boots"
      }
    },
    {
      "name": "Officer Rodriguez",
      "outfit": {
        "head": "Police uniform cap",
        "neck": null,
        "jacket": "Police uniform jacket",
        "back": null,
        "torso": "Navy police uniform shirt",
        "legs": "Navy police uniform pants",
        "underwear": "White undershirt, boxer briefs",
        "socks": "Black boot socks",
        "footwear": "Black duty boots"
      }
    }
  ]
}
</output>
<explanation>
Detective Chen is plainclothes—professional but practical for fieldwork. Her coat is mentioned (pulling gloves from pocket). Badge lanyard is standard for detectives. Ankle boots are practical for crime scenes. Officer Rodriguez is in uniform as explicitly noted ("navy blue of his uniform"). Police officers wear duty boots and typically an undershirt under the uniform. The cap is standard patrol gear.
</explanation>
</example>

<example>
<new_characters>
Name: Aria
Position: Tavern doorway
Activity: Entering from the rain
</new_characters>
<location>Ravenhollow - The Rusty Tankard Inn (Common room)</location>
<messages>
*The tavern door burst open, letting in a gust of wind and rain that made the hearth fire sputter. A figure stumbled through—an elven woman with silver hair plastered to her pale features, her traveling cloak so waterlogged it hung like a lead weight from her shoulders. She pushed the door shut against the storm, leaning against it for a moment to catch her breath.*

*The common room fell quiet as patrons turned to stare. It wasn't every day you saw one of the Fair Folk in these parts, let alone one who looked like she'd been dragged through every mud puddle between here and the Silverwood. Her boots squelched with each step as she approached the bar, leaving a trail of water on the worn wooden floor.*

Aria: *She pushed back her hood, revealing pointed ears adorned with delicate silver cuffs.* "I need a room." *Her voice was hoarse, exhausted.* "And information about the road north. I'll pay well for both."

*The barkeep eyed her warily, taking in the ornate dagger at her hip and the subtle shimmer of enchantment on her bracers.*
</messages>
<output>
{
  "characters": [
    {
      "name": "Aria",
      "outfit": {
        "head": null,
        "neck": "Silver ear cuffs (on pointed ears)",
        "jacket": "Waterlogged gray traveling cloak",
        "back": null,
        "torso": "Forest green tunic with silver embroidery",
        "legs": "Dark leather traveling pants",
        "underwear": "Simple linen smallclothes",
        "socks": "Wool traveling socks",
        "footwear": "Worn leather boots (waterlogged)"
      }
    }
  ]
}
</output>
<explanation>
Fantasy setting with an elven traveler. The cloak is explicitly described as waterlogged. Ear cuffs are mentioned as adornment. Bracers are noted but there's no arm slot—focus on main outfit. The dagger would be equipment, not clothing. Medieval/fantasy travelers wear practical but quality gear; elves typically favor greens and natural colors. Simple undergarments appropriate for the setting. Boots described as squelching, so noted as waterlogged.
</explanation>
</example>
</examples>

<schema>
{
  "type": "object",
  "required": ["characters"],
  "properties": {
    "characters": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "outfit"],
        "properties": {
          "name": { "type": "string" },
          "outfit": {
            "type": "object",
            "properties": {
              "head": { "type": ["string", "null"] },
              "neck": { "type": ["string", "null"] },
              "jacket": { "type": ["string", "null"] },
              "back": { "type": ["string", "null"] },
              "torso": { "type": ["string", "null"] },
              "legs": { "type": ["string", "null"] },
              "underwear": { "type": ["string", "null"] },
              "socks": { "type": ["string", "null"] },
              "footwear": { "type": ["string", "null"] }
            }
          }
        }
      }
    }
  }
}
</schema>`,
		userTemplate: `<new_characters>
{{characters}}
</new_characters>

<current_location>
{{location}}
</current_location>

<scene_messages>
{{messages}}
</scene_messages>

Infer outfits for these characters who just entered. Return valid JSON:`,
	},

	characters_presence: {
		key: 'characters_presence',
		name: 'Characters - Presence',
		description: 'Detects character entrances and exits from the scene',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.location,
		],
		systemPrompt: `Analyze these roleplay messages and detect any characters entering or leaving the scene. Return only valid JSON.

<instructions>
- Detect characters who APPEAR in the scene (arrive, enter, wake up, become present)
- Detect characters who DEPART from the scene (leave, exit, go to another room with closed door)
- For appearing characters, note their initial position and activity if mentioned
- A character going to another room AND closing/locking the door = departed
- A character just moving within the same space = NOT departed (no event needed)
- Only report CHANGES - don't list characters who were already present and stayed
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "character"],
        "properties": {
          "subkind": { "type": "string", "enum": ["appeared", "departed"] },
          "character": { "type": "string" },
          "initialPosition": { "type": "string", "description": "For appeared only - where they entered" },
          "initialActivity": { "type": "string", "description": "For appeared only - what they're doing" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_characters>
["Elena"]
</previous_characters>
<input>
*Elena was curled up on the couch reading when she heard keys in the front door. She set her book down, marking her place with a finger. Marcus stepped inside, stomping snow off his boots on the mat. His cheeks were red from the cold, and he was juggling grocery bags in both arms.*

Marcus: "Little help?" *He nodded toward the kitchen, struggling not to drop anything.*

Elena: *jumping up* "I didn't know you were going shopping!"

*She hurried over to grab two of the bags, peeking inside. They carried everything into the kitchen together, setting bags on the counter. Marcus pulled off his coat and hung it by the door.*
</input>
<output>
{
  "events": [
    { "subkind": "appeared", "character": "Marcus", "initialPosition": "Front door entrance", "initialActivity": "Entering with grocery bags" }
  ]
}
</output>
<explanation>
Marcus physically entered the space through the front door - this is an "appeared" event. Elena was already present, so no event for her. They both stayed in the scene, so no "departed" events.
</explanation>
</example>

<example>
<previous_characters>
["Jake", "Sarah", "Mike"]
</previous_characters>
<input>
*The argument had reached its breaking point. Sarah grabbed her phone from the nightstand and walked out of the bedroom, bare feet padding down the hallway. Jake heard the bathroom door close, then the lock click into place. A moment later, the shower started running.*

*Jake sat on the edge of the bed, staring at the empty doorway. His brother Mike, who had been awkwardly pretending to read in the corner armchair, finally looked up.*

Mike: "Dude... what did you do?"

Jake: "I don't want to talk about it."
</input>
<output>
{
  "events": [
    { "subkind": "departed", "character": "Sarah" }
  ]
}
</output>
<explanation>
Sarah left the bedroom, went down the hall, and the bathroom door closed AND locked. She's in a different room with a closed door = departed from the scene. Jake and Mike remain, so no events for them.
</explanation>
</example>

<example>
<previous_characters>
["User", "Rachel", "Dave"]
</previous_characters>
<input>
*The tension in the living room was unbearable. Rachel's roommate Dave had been hovering the entire time, making comments, and I'd finally had enough.*

*I stood up and held out my hand to Rachel.*

"Can we talk? Alone?"

*Rachel glanced at Dave, then back at me. She took my hand and let me pull her up from the couch.*

Rachel: "Yeah. Let's go to my room."

*We walked down the hallway together. I could feel Dave's eyes on our backs. Rachel opened her bedroom door and we stepped inside. She closed it firmly behind us, and I heard her flip the lock.*

Rachel: *leaning back against the door, finally relaxing* "God, I'm sorry about him."
</input>
<output>
{
  "events": [
    { "subkind": "departed", "character": "Dave" }
  ]
}
</output>
<explanation>
The POV (User) and Rachel moved to a new room and closed/locked the door. This means Dave is no longer in the scene - he "departed" from the POV's perspective. User and Rachel are still together, so no events for them.
</explanation>
</example>

<bad_example>
<previous_characters>
["Elena", "Marcus"]
</previous_characters>
<input>
*Elena walked from the living room to the kitchen to get a glass of water. Marcus followed her, leaning against the counter while she filled her glass.*

Elena: "Want one?"

Marcus: "Sure, thanks."

*She grabbed another glass and filled it, handing it to him.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "departed", "character": "Elena" },
    { "subkind": "appeared", "character": "Elena", "initialPosition": "Kitchen", "initialActivity": "Getting water" }
  ]
}
</bad_output>
<why_bad>
Moving within the same living space (living room to kitchen) is NOT a departure/appearance event. They're still in the same scene, just in a different spot. No doors were closed. This should return an empty events array.
</why_bad>
</bad_example>

<bad_example>
<previous_characters>
["Elena"]
</previous_characters>
<input>
*Elena thought about calling Marcus. She wondered what he was doing right now, probably at work like always. She missed him. Maybe she should text him and see if he wanted to grab dinner later.*

*She picked up her phone and started typing a message.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "appeared", "character": "Marcus", "initialPosition": "Unknown", "initialActivity": "Being thought about" }
  ]
}
</bad_output>
<why_bad>
Marcus was only MENTIONED/thought about - he didn't physically appear in the scene. Characters must actually enter the space to generate an "appeared" event. This should return an empty events array.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_characters>
{{previousState}}
</previous_characters>

<current_location>
{{location}}
</current_location>

<recent_messages>
{{messages}}
</recent_messages>

Extract character presence changes as valid JSON:`,
	},

	characters_position: {
		key: 'characters_position',
		name: 'Characters - Position',
		description: 'Tracks character movement within the scene',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.location,
		],
		systemPrompt: `Analyze these roleplay messages and detect any character position changes. Return only valid JSON.

<instructions>
- Detect when characters MOVE to a new POSITION within the scene
- Position is SPATIAL location (where they are), not POSE (how they're sitting/standing)
- "Moved from couch to kitchen" = position change
- "Shifted from sitting to lying on the couch" = NOT a position change (same location, different pose)
- Only report CHANGES - don't list characters whose position stayed the same
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "character", "newValue", "previousValue"],
        "properties": {
          "subkind": { "type": "string", "const": "position_changed" },
          "character": { "type": "string" },
          "newValue": { "type": "string", "description": "New position (spatial only, not pose)" },
          "previousValue": { "type": "string" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
[
  { "name": "Elena", "position": "Corner booth by window" },
  { "name": "Marcus", "position": "At the bar counter" }
]
</previous_state>
<input>
*Marcus picked up both drinks and walked over to Elena's booth. He slid into the seat across from her, setting her martini down carefully.*

Marcus: "They were out of the good gin, so I had them use the house brand. Hope that's okay."

Elena: *taking a sip* "It's fine. Better than fine, actually."

*She shifted closer to the wall to make room as he got comfortable, their knees almost touching under the table.*
</input>
<output>
{
  "events": [
    { "subkind": "position_changed", "character": "Marcus", "newValue": "Corner booth across from Elena", "previousValue": "At the bar counter" }
  ]
}
</output>
<explanation>
Marcus moved from the bar counter to the booth - this is a position change. Elena shifted within the booth but stayed in the same location - that's a pose change, not a position change, so no event for her.
</explanation>
</example>

<example>
<previous_state>
[
  { "name": "Elena", "position": "Standing in entryway" },
  { "name": "Marcus", "position": "Living room couch" }
]
</previous_state>
<input>
*Elena kicked off her heels and padded across the living room to where Marcus sat. She flopped down next to him on the couch, curling her legs up underneath her.*

Elena: "What a day."

Marcus: *wrapping an arm around her* "That bad?"

*She leaned into him, resting her head on his shoulder.*
</input>
<output>
{
  "events": [
    { "subkind": "position_changed", "character": "Elena", "newValue": "Living room couch next to Marcus", "previousValue": "Standing in entryway" }
  ]
}
</output>
<explanation>
Elena moved from the entryway to the couch - position change. Marcus stayed on the couch (same position), just adjusted his pose to put an arm around her - no position change for him.
</explanation>
</example>

<bad_example>
<previous_state>
[
  { "name": "Elena", "position": "Living room couch" }
]
</previous_state>
<input>
*Elena had been sitting on the couch for an hour, but her back was starting to hurt. She shifted, lying down and stretching her legs out across the cushions. Much better. She grabbed a pillow and tucked it under her head.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "position_changed", "character": "Elena", "newValue": "Lying on living room couch", "previousValue": "Sitting on living room couch" }
  ]
}
</bad_output>
<why_bad>
Sitting vs lying on the same couch is a POSE change, not a POSITION change. Position is about spatial location (WHERE in the room), not body configuration (HOW they're positioned there). This should return an empty events array.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<current_location>
{{location}}
</current_location>

<recent_messages>
{{messages}}
</recent_messages>

Extract position changes as valid JSON:`,
	},

	characters_activity: {
		key: 'characters_activity',
		name: 'Characters - Activity',
		description: 'Tracks what characters are doing',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.location,
		],
		systemPrompt: `Analyze these roleplay messages and detect any character activity changes. Return only valid JSON.

<instructions>
- Detect when characters START a new activity or STOP doing something
- Activity is what they're DOING (reading, cooking, talking, sleeping)
- Use null for newValue when someone stops an activity without starting a new one
- Only report CHANGES - don't list characters whose activity stayed the same
- "Continuing to read" = NOT a change
- "Put down book and started cooking" = activity change
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "character", "newValue"],
        "properties": {
          "subkind": { "type": "string", "const": "activity_changed" },
          "character": { "type": "string" },
          "newValue": { "type": ["string", "null"], "description": "New activity, null if stopped" },
          "previousValue": { "type": ["string", "null"] }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
[
  { "name": "Elena", "activity": "Reading a novel" },
  { "name": "Marcus", "activity": "Watching TV" }
]
</previous_state>
<input>
*Elena set her book down on the coffee table and stretched, her back popping after hours of reading. She wandered into the kitchen, opening the fridge to see what they had for dinner.*

Elena: "Are you hungry? I was thinking of making pasta."

Marcus: *not looking away from the screen* "Sure, sounds good."

*She pulled out ingredients and started filling a pot with water.*
</input>
<output>
{
  "events": [
    { "subkind": "activity_changed", "character": "Elena", "newValue": "Cooking pasta", "previousValue": "Reading a novel" }
  ]
}
</output>
<explanation>
Elena stopped reading and started cooking - activity change. Marcus is still watching TV - no change.
</explanation>
</example>

<example>
<previous_state>
[
  { "name": "Elena", "activity": "Working on laptop" },
  { "name": "Marcus", "activity": "Pacing nervously" }
]
</previous_state>
<input>
*Marcus finally stopped pacing and collapsed into the armchair, burying his face in his hands. Elena closed her laptop and went to sit beside him on the arm of the chair.*

Elena: "Hey. Talk to me. What's going on?"

*He looked up at her with red-rimmed eyes.*

Marcus: "I got the call. They're letting me go."
</input>
<output>
{
  "events": [
    { "subkind": "activity_changed", "character": "Elena", "newValue": "Comforting Marcus", "previousValue": "Working on laptop" },
    { "subkind": "activity_changed", "character": "Marcus", "newValue": null, "previousValue": "Pacing nervously" }
  ]
}
</output>
<explanation>
Elena stopped working and is now comforting Marcus. Marcus stopped pacing and isn't doing a specific activity now (just sitting/talking) - newValue is null.
</explanation>
</example>

<bad_example>
<previous_state>
[
  { "name": "Elena", "activity": "Reading a novel" }
]
</previous_state>
<input>
*Elena turned the page, completely absorbed in the story. This was the third chapter she'd read tonight, and she couldn't put it down. The protagonist was just about to confront the villain.*

*She shifted on the couch, getting more comfortable, and kept reading.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "activity_changed", "character": "Elena", "newValue": "Reading chapter 3 of novel", "previousValue": "Reading a novel" }
  ]
}
</bad_output>
<why_bad>
Continuing to read the same book is NOT an activity change. The activity is still "reading" - which chapter doesn't matter. This should return an empty events array.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<current_location>
{{location}}
</current_location>

<recent_messages>
{{messages}}
</recent_messages>

Extract activity changes as valid JSON:`,
	},

	characters_mood: {
		key: 'characters_mood',
		name: 'Characters - Mood',
		description: 'Analyzes character emotional state changes',
		defaultTemperature: 0.4,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.location,
		],
		systemPrompt: `Analyze these roleplay messages and detect any character mood changes. Return only valid JSON.

<instructions>
- Detect when characters GAIN new moods (mood_added) or LOSE old moods (mood_removed)
- Mood is an EMOTIONAL state (happy, sad, anxious, relieved)
- Only report moods that CLEARLY changed based on the text
- Don't infer subtle moods from minor actions
- Moods should be clear from dialogue, actions, or explicit descriptions
- A character can have multiple moods at once
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "character", "mood"],
        "properties": {
          "subkind": { "type": "string", "enum": ["mood_added", "mood_removed"] },
          "character": { "type": "string" },
          "mood": { "type": "string", "description": "Single mood word (e.g., 'anxious', 'relieved')" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
[
  { "name": "Elena", "mood": ["stressed", "worried"] },
  { "name": "Marcus", "mood": ["calm", "supportive"] }
]
</previous_state>
<input>
*Elena's phone buzzed. She grabbed it, saw the notification, and her whole body seemed to relax at once. She let out a long breath she didn't know she'd been holding.*

Elena: "They approved the loan. We're okay. We're actually okay."

*She started laughing, tears forming in her eyes—relief, pure relief. Marcus pulled her into a hug.*

Marcus: "I knew it would work out."

*She hugged him back tightly, still laughing.*
</input>
<output>
{
  "events": [
    { "subkind": "mood_removed", "character": "Elena", "mood": "stressed" },
    { "subkind": "mood_removed", "character": "Elena", "mood": "worried" },
    { "subkind": "mood_added", "character": "Elena", "mood": "relieved" },
    { "subkind": "mood_added", "character": "Elena", "mood": "joyful" }
  ]
}
</output>
<explanation>
Elena went from stressed/worried to relieved/joyful - clear emotional shift shown through body language (relaxing), dialogue, and description (laughing, tears of relief). Marcus stayed calm and supportive - no change.
</explanation>
</example>

<example>
<previous_state>
[
  { "name": "Jake", "mood": ["cheerful", "optimistic"] }
]
</previous_state>
<input>
*Jake's smile faded as he read the text message. He read it again, just to make sure he understood. Then he set the phone down very carefully, like it might explode.*

Jake: "She's not coming."

*His voice was flat. He stared at the wall for a long moment.*

Jake: "After everything... she's just not coming."
</input>
<output>
{
  "events": [
    { "subkind": "mood_removed", "character": "Jake", "mood": "cheerful" },
    { "subkind": "mood_removed", "character": "Jake", "mood": "optimistic" },
    { "subkind": "mood_added", "character": "Jake", "mood": "disappointed" },
    { "subkind": "mood_added", "character": "Jake", "mood": "hurt" }
  ]
}
</output>
<explanation>
Clear emotional shift from cheerful/optimistic to disappointed/hurt. The flat voice, staring at the wall, and the dialogue all indicate this change.
</explanation>
</example>

<bad_example>
<previous_state>
[
  { "name": "Elena", "mood": ["focused"] }
]
</previous_state>
<input>
*Elena typed another line of code, checked the output, frowned slightly, and made a correction. She took a sip of her coffee—cold now, but she didn't really notice—and kept working.*

*The bug was stubborn, but she was making progress.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "mood_added", "character": "Elena", "mood": "frustrated" }
  ]
}
</bad_output>
<why_bad>
A slight frown while coding doesn't indicate a mood change. She's still focused and working through the problem. The text even says she's "making progress." This should return an empty events array.
</why_bad>
</bad_example>

<bad_example>
<previous_state>
[
  { "name": "Marcus", "mood": ["relaxed"] }
]
</previous_state>
<input>
*Marcus shifted on the couch and yawned. He should probably go to bed soon, but the movie was almost over. He reached for the remote to check how much time was left.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "mood_added", "character": "Marcus", "mood": "tired" }
  ]
}
</bad_output>
<why_bad>
Yawning is a physical action, not necessarily a mood. "Tired" might be physical state if he's exhausted, but a simple yawn while relaxed watching TV isn't a mood change. He's still relaxed. This should return an empty events array.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<current_location>
{{location}}
</current_location>

<recent_messages>
{{messages}}
</recent_messages>

Extract mood changes as valid JSON:`,
	},

	characters_outfit: {
		key: 'characters_outfit',
		name: 'Characters - Outfit',
		description: 'Tracks clothing changes by slot',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.location,
		],
		systemPrompt: `Analyze these roleplay messages and detect any clothing/outfit changes. Return only valid JSON.

<instructions>
- Detect when characters PUT ON or TAKE OFF clothing
- Track by slot: head, neck, jacket, back, torso, legs, footwear, socks, underwear
- Use null for newValue when clothing is removed
- Only report CHANGES - don't list slots that stayed the same
- Clothing merely DESCRIBED (not changed) is NOT an event
- "She was wearing a red dress" = description, not change
- "She slipped off her dress" = change (removal)
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "character", "slot", "newValue"],
        "properties": {
          "subkind": { "type": "string", "const": "outfit_changed" },
          "character": { "type": "string" },
          "slot": { "type": "string", "enum": ["head", "neck", "jacket", "back", "torso", "legs", "footwear", "socks", "underwear"] },
          "newValue": { "type": ["string", "null"], "description": "New item, null if removed" },
          "previousValue": { "type": ["string", "null"] }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
[
  { "name": "Elena", "outfit": { "torso": "White blouse", "jacket": "Gray blazer", "legs": "Black pencil skirt", "footwear": "Black heels" } }
]
</previous_state>
<input>
*Elena finally let herself relax, kicking off her heels with a relieved sigh. They tumbled across the hardwood floor, coming to rest near the closet door. She shrugged out of her blazer and tossed it carelessly onto the armchair by the window.*

Elena: "God, that feels better."

*She padded over to the bed in her bare feet.*
</input>
<output>
{
  "events": [
    { "subkind": "outfit_changed", "character": "Elena", "slot": "footwear", "newValue": null, "previousValue": "Black heels" },
    { "subkind": "outfit_changed", "character": "Elena", "slot": "jacket", "newValue": null, "previousValue": "Gray blazer" }
  ]
}
</output>
<explanation>
Elena kicked off her heels (footwear removed) and shrugged out of her blazer (jacket removed). Both are now null. Her blouse and skirt weren't changed.
</explanation>
</example>

<example>
<previous_state>
[
  { "name": "Marcus", "outfit": { "torso": null, "legs": "Boxers" } }
]
</previous_state>
<input>
*Marcus stepped out of the shower, toweling off his hair. He grabbed a fresh t-shirt from the drawer and pulled it on, then found his jeans from yesterday draped over the chair.*

Marcus: "Running late again..."

*He hopped around trying to get the jeans on, nearly falling over.*
</input>
<output>
{
  "events": [
    { "subkind": "outfit_changed", "character": "Marcus", "slot": "torso", "newValue": "Fresh t-shirt", "previousValue": null },
    { "subkind": "outfit_changed", "character": "Marcus", "slot": "legs", "newValue": "Jeans", "previousValue": "Boxers" }
  ]
}
</output>
<explanation>
Marcus put on a t-shirt (was shirtless) and jeans (over his boxers). Note: jeans OVER boxers means the legs slot changes to jeans, and we assume boxers are still there as underwear.
</explanation>
</example>

<bad_example>
<previous_state>
[
  { "name": "Elena", "outfit": { "torso": "Blue sundress", "footwear": "Sandals" } }
]
</previous_state>
<input>
*Elena looked stunning in her blue sundress. The fabric swayed gently as she walked across the patio, her sandals clicking against the stone. She adjusted the strap on her shoulder.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "outfit_changed", "character": "Elena", "slot": "torso", "newValue": "Blue sundress (adjusted strap)", "previousValue": "Blue sundress" }
  ]
}
</bad_output>
<why_bad>
The text is DESCRIBING her outfit, not changing it. Adjusting a strap is not removing or replacing the item. Her clothing is the same as before. This should return an empty events array.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<current_location>
{{location}}
</current_location>

<recent_messages>
{{messages}}
</recent_messages>

Extract outfit changes as valid JSON:`,
	},

	characters_physical: {
		key: 'characters_physical',
		name: 'Characters - Physical State',
		description: 'Tracks physical conditions (injuries, exhaustion, etc.)',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.location,
		],
		systemPrompt: `Analyze these roleplay messages and detect any physical state changes. Return only valid JSON.

<instructions>
- Detect when characters GAIN or LOSE physical conditions
- Physical state includes: injuries, exhaustion, hunger, cold, heat, illness, arousal, intoxication
- This is PHYSICAL condition, not emotional mood
- "Tired" as a mood = emotional weariness
- "Exhausted" as physical = body physically worn out
- Only report clear physical state changes, not subtle sensations
</instructions>

<schema>
{
  "type": "object",
  "required": ["events"],
  "properties": {
    "events": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["subkind", "character", "physicalState"],
        "properties": {
          "subkind": { "type": "string", "enum": ["physical_state_added", "physical_state_removed"] },
          "character": { "type": "string" },
          "physicalState": { "type": "string", "description": "Physical condition (e.g., 'shivering', 'exhausted', 'bleeding')" }
        }
      }
    }
  }
}
</schema>

<examples>
<example>
<previous_state>
[
  { "name": "Elena", "physicalState": [] },
  { "name": "Marcus", "physicalState": ["out of breath"] }
]
</previous_state>
<input>
*They'd been running for what felt like forever. Elena's lungs burned and her legs were starting to shake. She stumbled against a wall, gasping.*

Elena: "Can't... keep going..."

*Marcus grabbed her arm to steady her. His own breathing had finally slowed down after their brief rest.*

Marcus: "Just a little further. The car's right there."

*Elena nodded, pushing off the wall. A sharp pain lanced through her ankle—she must have twisted it during the chase.*
</input>
<output>
{
  "events": [
    { "subkind": "physical_state_added", "character": "Elena", "physicalState": "exhausted" },
    { "subkind": "physical_state_added", "character": "Elena", "physicalState": "twisted ankle" },
    { "subkind": "physical_state_removed", "character": "Marcus", "physicalState": "out of breath" }
  ]
}
</output>
<explanation>
Elena became exhausted (burning lungs, shaking legs, gasping) and injured her ankle. Marcus recovered from being out of breath (breathing slowed down).
</explanation>
</example>

<example>
<previous_state>
[
  { "name": "Elena", "physicalState": ["soaking wet", "shivering"] }
]
</previous_state>
<input>
*The hot shower was exactly what she needed. Elena stood under the spray until the water started to run lukewarm, feeling the chill finally leave her bones. She stepped out, wrapped in a fluffy towel, her skin pink and warm.*

Elena: "Much better."

*She dried off and pulled on her coziest pajamas.*
</input>
<output>
{
  "events": [
    { "subkind": "physical_state_removed", "character": "Elena", "physicalState": "soaking wet" },
    { "subkind": "physical_state_removed", "character": "Elena", "physicalState": "shivering" }
  ]
}
</output>
<explanation>
The hot shower resolved both physical states. She's no longer wet (dried off) or cold (skin pink and warm).
</explanation>
</example>

<bad_example>
<previous_state>
[
  { "name": "Marcus", "physicalState": [] }
]
</previous_state>
<input>
*Marcus felt a little warm in the crowded room. He loosened his tie slightly and took a sip of his drink.*
</input>
<bad_output>
{
  "events": [
    { "subkind": "physical_state_added", "character": "Marcus", "physicalState": "overheated" }
  ]
}
</bad_output>
<why_bad>
Feeling "a little warm" in a crowded room is a minor, transient sensation, not a notable physical state. He's not suffering heat exhaustion or sweating profusely. This should return an empty events array.
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_state>
{{previousState}}
</previous_state>

<current_location>
{{location}}
</current_location>

<recent_messages>
{{messages}}
</recent_messages>

Extract physical state changes as valid JSON:`,
	},
};
