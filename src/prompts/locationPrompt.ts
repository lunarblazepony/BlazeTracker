// ============================================
// Location Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const LOCATION_PROMPTS: Record<string, PromptDefinition> = {
	location_initial: {
		key: 'location_initial',
		name: 'Location - Initial',
		description: 'Extracts location from the scene opening',
		defaultTemperature: 0.5,
		placeholders: [
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze this roleplay scene and extract the current location. You must only return valid JSON with no commentary.

<instructions>
- Determine where this scene takes place.
- The 'area' should be neighborhood + city + country/region (e.g. 'Downtown, Huntsville, AL', 'Farringdon, London, UK', 'Mordor, Middle Earth', 'Ponyville, Equestria'). Always include the country or region identifier.
- The 'place' should be a SPECIFIC named location:
  - For buildings: Use FULL proper names (e.g. 'Pixar Animation Studios' NOT just 'Studio', 'The Rusty Nail Bar' NOT just 'Bar')
  - For outdoor/street locations: Use street name + nearby landmark (e.g. 'Ferris Street (near Zenith nightclub)', 'Central Park West (by the fountain)', 'Baker Street (outside 221B)')
  - NEVER use generic descriptions like 'Nightclub in a busy district' or 'Street in the city' - always invent a specific name
- The 'position' should be a SPATIAL location within the place (e.g. 'Main lobby', 'Corner booth', 'Sidewalk near entrance'). Do NOT include character poses or actions in position.
- Props rules (IMPORTANT):
  - Props are PHYSICAL OBJECTS that characters could pick up or interact with
  - Each prop should be ONE SINGLE ITEM (e.g. "Neon sign" not "Neon signs reflecting in puddles")
  - NO sounds, smells, or atmosphere (e.g. NOT "Bass thumping" or "Smell of smoke")
  - NO people or their activities (e.g. NOT "Smokers huddled by door" or "Idling taxis")
  - NO clothing that characters are currently WEARING - that goes in character outfits
  - Only include clothing as props if REMOVED and placed somewhere (e.g. "Discarded jacket on chair")
- If location is not explicit, infer from context clues and INVENT specific names that fit the setting.
</instructions>

<examples>
<example>
<input>
Elena: *She pushed through the revolving door into the Meridian Grand Hotel, shaking raindrops from her umbrella. The lobby stretched before her in all its art deco glory—geometric patterns in the marble floor, brass fixtures polished to a mirror shine, and a massive crystal chandelier casting prismatic light across the space. A string quartet played something classical near the fountain, their music competing with the murmur of well-dressed guests and the occasional ding of elevator arrivals.*

*She spotted the concierge desk to her left, staffed by a woman in an immaculate uniform, and beyond it the entrance to what looked like a high-end restaurant. The check-in counter dominated the far wall, where a short queue of travelers waited with their luggage. Elena's heels clicked against the marble as she made her way toward the seating area near the windows, where oversized leather armchairs surrounded low coffee tables scattered with magazines.*

"Impressive," *she murmured, taking in the fifteen-foot ceilings and the gallery of black-and-white photographs lining the walls.*
</input>
<output>
{
  "area": "Downtown, Chicago, IL",
  "place": "Meridian Grand Hotel",
  "position": "Main lobby near window seating area",
  "props": ["Crystal chandelier", "Art deco marble floor", "Brass fixtures", "Fountain with string quartet nearby", "Oversized leather armchairs", "Low coffee tables with magazines", "Black-and-white photograph gallery"]
}
</output>
<explanation>
- area: Inferred as major city with grand hotels; "Downtown, Chicago, IL" includes neighborhood + city + state
- place: Full proper name "Meridian Grand Hotel" extracted exactly as mentioned, not abbreviated to "Hotel" or "The Meridian"
- position: "Main lobby near window seating area" - describes WHERE she is spatially, not WHAT she's doing (no "walking" or "taking in the view")
- props: Selected the most scene-relevant items that characters might interact with. Excluded transient elements (the queue of travelers, the concierge herself) and focused on environmental features. Note specificity: "Art deco marble floor" not just "floor"
</explanation>
</example>

<example>
<input>
*The submarine's control room was cramped and humid, every surface covered in switches, dials, and screens displaying sonar readouts. Captain Reyes stood at the periscope station, one eye pressed to the viewfinder while her XO monitored the depth gauge nearby. Red emergency lighting bathed everything in an ominous glow—they'd been running silent for six hours now, and the tension was palpable.*

*Banks of monitors showed the surrounding ocean in ghostly green sonar imagery. The helm station dominated the front of the room, where two junior officers sat rigid at their controls. Overhead, pipes and cables snaked across the ceiling, occasionally dripping condensation onto the metal deck plates below. A navigation chart was spread across the plotting table, weighted down with coffee mugs and a brass compass.*

*The air recycler hummed its constant drone, barely masking the distant ping of active sonar from somewhere above them.*

Reyes: "Maintain current depth. Nobody makes a sound."
</input>
<output>
{
  "area": "Pacific Ocean, 200 meters depth",
  "place": "USS Triton (Attack Submarine)",
  "position": "Control room",
  "props": ["Periscope station", "Sonar display monitors", "Helm control stations", "Navigation plotting table with charts", "Brass compass", "Depth gauge", "Red emergency lighting", "Overhead pipe network", "Air recycler"]
}
</output>
<explanation>
- area: For mobile locations like vehicles/vessels, area describes the broader environment ("Pacific Ocean, 200 meters depth")
- place: Vessel name inferred as military submarine; given a reasonable designation. Full name includes vessel type for clarity
- position: "Control room" - the specific compartment, not "standing at periscope" or "running silent"
- props: Focused on interactive/notable equipment. Excluded people (XO, junior officers) and temporary states (coffee mugs as weights). Included atmospheric elements (red lighting, air recycler) that affect scene mood
</explanation>
</example>

<example>
<input>
*Marcus found himself in what had clearly once been a grand ballroom, though decades of neglect had transformed it into something out of a gothic nightmare. Faded murals peeled from the walls in long strips, revealing water-stained plaster beneath. The parquet floor, once polished to a gleam, was now warped and broken in places, with weeds pushing through the gaps where it met the crumbling baseboards.*

*Dust motes danced in the shafts of pale light filtering through broken windows high above. A massive fireplace dominated one wall, its marble mantle cracked and blackened with old soot. Someone had dragged a mattress into the corner—recent, by the look of it, with rumpled blankets and empty food cans scattered nearby. Graffiti covered the lower portions of the walls, tags and crude drawings layered over each other.*

*The remnants of a crystal chandelier lay shattered in the center of the room, its brass frame twisted and tarnished. Marcus could hear pigeons cooing somewhere in the rafters above, and the distant sound of traffic from the street outside.*
</input>
<output>
{
  "area": "Old Town, Baltimore, MD",
  "place": "Abandoned Harrington Estate",
  "position": "Former grand ballroom",
  "props": ["Peeling murals and water-stained walls", "Warped parquet floor with weeds", "Cracked marble fireplace (blackened)", "Recent mattress with blankets in corner", "Empty food cans", "Layered graffiti", "Shattered crystal chandelier (brass frame on floor)", "Broken high windows"]
}
</output>
<explanation>
- area: "Old Town, Baltimore, MD" - specific district + city + state inferred from context of historic estate
- place: Named estate rather than just "abandoned building" - gives the location identity and history
- position: "Former grand ballroom" - spatial designation with context about what the room was/is
- props: Mixed permanent features (fireplace, floor) with signs of decay (peeling murals, shattered chandelier) AND evidence of recent habitation (mattress, food cans). Props tell the story of the location. Note state descriptors: "cracked," "blackened," "shattered"
</explanation>
</example>

<example>
<input>
*The bass from the club behind them was still audible, a muffled thump-thump-thump that vibrated through the pavement. Elena stepped out into the cool night air, grateful to escape the crush of bodies inside. The street was quiet at this hour—just a few smokers huddled near the entrance and a taxi idling at the curb.*

*Across the street, a kebab shop's neon sign flickered on and off, casting red and blue shadows on the wet pavement. The rain had stopped, but puddles still dotted the sidewalk, reflecting the glow of the streetlamps. A bouncer in a black jacket stood by the velvet rope, checking his phone while a couple argued nearby about whose turn it was to call an Uber.*

*Elena pulled her jacket tighter against the chill and walked a few steps away from the crowd, past a shuttered newsagent and a graffiti-covered electrical box. The smell of cigarette smoke and frying meat mixed in the air.*
</input>
<output>
{
  "area": "Shoreditch, London, UK",
  "place": "Kingsland Road (outside Vinyl Dreams nightclub)",
  "position": "Sidewalk near shuttered newsagent",
  "props": ["Kebab shop neon sign", "Streetlamp", "Velvet rope", "Electrical box", "Newsagent shutters"]
}
</output>
<explanation>
- area: "Shoreditch, London, UK" - specific neighborhood + city + country, inferred from nightclub culture context
- place: "Kingsland Road (outside Vinyl Dreams nightclub)" - specific street name + nearby landmark, NOT generic "Street near nightclub" or "Outside a club"
- position: "Sidewalk near shuttered newsagent" - spatial location on the street
- props: ONLY physical objects characters could interact with. Each is ONE item. Excludes: people (bouncer, smokers), sounds (bass), atmosphere (puddles, reflections), worn clothing
</explanation>
</example>

<bad_example>
<output>
{
  "area": "City",
  "place": "Hotel",
  "position": "Walking through the lobby, looking around nervously while shaking off her umbrella"
}
</output>
<why_bad>
- area too vague: Should include neighborhood + city + state/country ("Downtown, Chicago, IL" not "City")
- place too generic: Should use the full proper name ("Meridian Grand Hotel" not "Hotel")
- position contains actions: "Walking through," "looking around nervously," and "shaking off umbrella" are character actions, not spatial locations. Should be "Main lobby" or "Lobby entrance"
</why_bad>
</bad_example>

<bad_example>
<output>
{
  "area": "London",
  "place": "Nightclub in a busy district",
  "position": "Outside near the entrance, under a flickering streetlamp"
}
</output>
<why_bad>
- area missing neighborhood and country: Should be "Shoreditch, London, UK" or "Soho, London, UK" - not just the city name
- place is a generic description, not a specific name: "Nightclub in a busy district" should be a specific place like "Kingsland Road (outside Vinyl Dreams)" or "Greek Street (near The Blue Note)"
- Always invent specific place names when not provided - never use generic descriptions
</why_bad>
</bad_example>

<bad_example>
<output>
{
  "area": "Downtown, Seattle, WA",
  "place": "The Blue Moon Lounge",
  "position": "Main bar area",
  "props": ["Leather bar stools", "Neon signs", "Elena's red cocktail dress", "Marcus's gray suit jacket", "Martini glasses"]
}
</output>
<why_bad>
- props include clothing characters are WEARING: "Elena's red cocktail dress" and "Marcus's gray suit jacket" should NOT be in props - they belong in each character's outfit slots
- Only include clothing in props if it has been REMOVED and placed somewhere (e.g., "Marcus's suit jacket on barstool", "Discarded scarf near entrance")
- Clothing that characters are currently wearing goes in character outfit tracking, not location props
</why_bad>
</bad_example>

<bad_example>
<output>
{
  "area": "Shoreditch, London, UK",
  "place": "Kingsland Road (outside Vinyl Dreams)",
  "position": "Sidewalk near entrance",
  "props": ["Flickering neon signs reflecting in puddles", "Bass thumping from nightclub entrance", "Smokers huddled by the door", "Idling taxis", "Clara's limited edition hat", "Matt's designer hoodie"]
}
</output>
<why_bad>
- "Flickering neon signs reflecting in puddles" combines multiple things - should be separate: "Neon sign" (puddles are not props)
- "Bass thumping from nightclub entrance" is a SOUND, not a physical object - do not include sounds/atmosphere
- "Smokers huddled by the door" and "Idling taxis" are PEOPLE and their activities - do not include people as props
- "Clara's limited edition hat" and "Matt's designer hoodie" are clothing characters are WEARING - belongs in character outfits, not props
- Correct props would be: "Neon sign", "Velvet rope", "Club entrance door", "Electrical box"
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<character_info>
{{characterInfo}}
</character_info>

<scene_messages>
{{messages}}
</scene_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the location as valid JSON:`,
	},

	location_update: {
		key: 'location_update',
		name: 'Location - Update',
		description: 'Updates location based on recent messages',
		defaultTemperature: 0.5,
		placeholders: [
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze these roleplay messages and extract any location changes. You must only return valid JSON with no commentary.

<instructions>
- Determine if the location has changed from the previous state.
- Track any movement: characters entering new rooms, traveling, position changes within a space.
- The 'area' should be neighborhood + city + country/region (e.g. 'Downtown, Huntsville, AL', 'Farringdon, London, UK'). Always include country/region.
- The 'place' should be a SPECIFIC named location:
  - For buildings: Use FULL proper names (e.g. 'Meridian Grand Hotel' not 'Hotel')
  - For outdoor/street locations: Use street name + nearby landmark (e.g. 'Kingsland Road (outside Vinyl Dreams nightclub)')
  - NEVER use generic descriptions - always use or invent specific names
- The 'position' should be a SPATIAL location only (e.g. 'Corner booth', 'Kitchen', 'Sidewalk near entrance'). Do NOT include character poses or actions.
- Props rules (IMPORTANT):
  - Props are PHYSICAL OBJECTS that characters could pick up or interact with
  - Each prop should be ONE SINGLE ITEM (e.g. "Neon sign" not "Neon signs reflecting in puddles")
  - NO sounds, smells, or atmosphere (e.g. NOT "Bass thumping" or "Smell of smoke")
  - NO people or their activities (e.g. NOT "Smokers huddled by door")
  - NO clothing that characters are currently WEARING - that goes in character outfits
  - Only include clothing as props if REMOVED and placed somewhere (e.g. "Discarded jacket on chair")
- Update props: new items introduced, items picked up/removed, items changing state.
- If no location change occurred, return the previous location but consider prop changes.
- Be careful to track items that have been picked up (remove from props) or put down (add to props).
</instructions>

<examples>
<example>
<input>
*Elena finally let herself relax, kicking off her heels with a relieved sigh. They tumbled across the hardwood floor, coming to rest near the closet door. She shrugged out of her blazer and tossed it carelessly onto the armchair by the window, then padded over to the bed and flopped down face-first into the pillows.*

*After a moment, she rolled onto her back and stared at the ceiling, her stockinged feet hanging off the edge of the mattress. The room was quiet except for the soft hum of the air conditioning and the muffled sounds of city traffic from far below. She reached over to the nightstand and grabbed her phone, scrolling through messages she'd been ignoring all day.*

*The afternoon light filtered through the sheer curtains, casting long shadows across the Persian rug. Her laptop sat open on the desk across the room, screen dark but charging light blinking steadily. She should probably check her work email, but the thought made her groan and bury her face in the nearest pillow instead.*
</input>
<previous_location>
{
  "area": "Upper East Side, Manhattan, NY",
  "place": "Elena's Apartment (Unit 12B)",
  "position": "Entryway",
  "props": ["Coat rack", "Mirror", "Small table with keys bowl", "Umbrella stand"]
}
</previous_location>
<output>
{
  "area": "Upper East Side, Manhattan, NY",
  "place": "Elena's Apartment (Unit 12B)",
  "position": "Master bedroom",
  "props": ["Queen bed with pillows", "Nightstand with phone charger", "Armchair by window with discarded blazer", "Black heels near closet door", "Persian rug", "Desk with laptop (charging)", "Sheer curtains", "Air conditioning unit"]
}
</output>
<explanation>
- position: Changed from "Entryway" to "Master bedroom" - she moved rooms. Note we don't say "lying on bed" (that's her pose, not her location)
- props completely replaced: When moving to a new room, previous room's props (coat rack, mirror, etc.) are no longer relevant - we only track props in the CURRENT location
- Removed clothing added to props: "Black heels near closet door" and "Armchair by window with discarded blazer" - both include WHERE the items ended up
- New room props identified: Items she interacts with (bed, nightstand, phone) plus environmental details (rug, curtains, laptop) that could become relevant
- State noted where relevant: "laptop (charging)" because the blinking light was mentioned and could matter
</explanation>
</example>

<example>
<input>
*The storm had gotten worse since they'd arrived. Marcus stood at the cabin window, watching lightning illuminate the forest in staccato bursts. Rain hammered against the glass so hard he could feel the vibration through the frame. Behind him, Elena had gotten the old wood stove going—it crackled and popped, slowly pushing back against the chill that had seeped into the abandoned structure.*

*She'd found some moth-eaten blankets in the closet and spread them on the dusty floor near the stove, creating a makeshift camp. Their wet jackets hung from nails in the wall, dripping steadily onto the warped floorboards. Marcus had dragged in some firewood from the covered porch, stacking it near the door where it could dry out.*

*The cabin was sparse—just the one room with a rusted kitchenette in the corner and what might have once been a bed frame, now just bare springs and rotten wood. But it had a roof that mostly didn't leak, and right now that was enough.*

Elena: "Come sit by the fire. You're not going to make the storm stop by glaring at it."
</input>
<previous_location>
{
  "area": "Cascade Mountains, Washington",
  "place": "Forest Trail",
  "position": "Rocky outcropping (seeking shelter)",
  "props": ["Dense pine trees", "Trail marker", "Loose rocks", "Marcus's backpack"]
}
</previous_location>
<output>
{
  "area": "Cascade Mountains, Washington",
  "place": "Abandoned Ranger Cabin",
  "position": "Main room",
  "props": ["Wood stove (lit, crackling)", "Moth-eaten blankets on floor near stove", "Wet jackets hanging on wall nails", "Firewood stack by door", "Rain-streaked window", "Rusted kitchenette", "Broken bed frame", "Covered porch (exterior)"]
}
</output>
<explanation>
- area: Stays the same - they're still in the same mountain region
- place: Changed from "Forest Trail" to "Abandoned Ranger Cabin" - they found shelter and moved indoors
- position: "Main room" - simple spatial designation. NOT "standing at window" or "by the fire"
- props transformation: Trail props completely replaced with cabin interior. Note we track:
  * Items they brought/affected: "Wet jackets hanging on wall nails", "Firewood stack by door"
  * Environmental features: "Wood stove (lit, crackling)", "Rain-streaked window"
  * Potential interaction points: "Rusted kitchenette", "Broken bed frame", "Moth-eaten blankets"
  * Connected spaces: "Covered porch (exterior)" mentioned for context since firewood came from there
- State descriptors matter: "lit, crackling" for the stove, "wet" for jackets, "rusted" and "broken" for damaged items
</explanation>
</example>

<example>
<input>
*Sarah carefully set down her coffee cup, leaving a ring on the manuscript pages scattered across the table. The interview had been going for nearly an hour now, and the small conference room felt increasingly claustrophobic. Detective Morrison sat across from her, his recorder blinking red between them, while his partner leaned against the wall by the door—blocking the exit, Sarah noted.*

*The fluorescent lights buzzed overhead, one of them flickering intermittently in a way that was slowly driving her crazy. Someone had tried to make the room less institutional with a potted plant in the corner, but it was clearly fake and covered in dust. The blinds were drawn, cutting off any view of the bullpen outside, though she could hear phones ringing and people talking through the thin walls.*

*Morrison slid another photograph across the table—the third one in the last ten minutes. Sarah forced herself not to react, keeping her hands flat on the cool surface of the table. The chair was deliberately uncomfortable, she realized. Everything about this room was designed to make people want to leave, to say whatever would get them out fastest.*
</input>
<previous_location>
{
  "area": "Downtown Precinct",
  "place": "Central Police Station",
  "position": "Main lobby waiting area",
  "props": ["Plastic chairs", "Vending machines", "Bulletin board with wanted posters", "Front desk with duty officer"]
}
</previous_location>
<output>
{
  "area": "Downtown Precinct",
  "place": "Central Police Station",
  "position": "Interview Room B",
  "props": ["Metal table with scattered manuscript pages", "Coffee cup (with ring stain)", "Audio recorder (recording)", "Photographs (evidence)", "Uncomfortable metal chairs", "Flickering fluorescent lights", "Dusty fake plant in corner", "Drawn window blinds", "Single door (blocked by detective)"]
}
</output>
<explanation>
- area/place: Unchanged - still in same building, just different room
- position: Changed from "Main lobby waiting area" to "Interview Room B" - specific room designation inferred from context (police station interview rooms are typically lettered/numbered)
- props completely refreshed for new room:
  * Interview-specific items: "Audio recorder (recording)", "Photographs (evidence)", "Metal table with scattered manuscript pages"
  * Items characters placed: "Coffee cup (with ring stain)" - detail matters for scene continuity
  * Environmental/atmospheric: "Flickering fluorescent lights", "Uncomfortable metal chairs", "Dusty fake plant"
  * Tactical note: "Single door (blocked by detective)" - relevant to scene tension even though it involves a character's position
- Previous room props (vending machines, bulletin board, etc.) completely removed - not in current location
</explanation>
</example>

<bad_example>
<output>
{
  "area": "Downtown Precinct",
  "place": "Central Police Station",
  "position": "Sitting nervously across from the detective, trying to stay calm",
  "props": ["Plastic chairs", "Vending machines", "Bulletin board", "Audio recorder", "Photographs"]
}
</output>
<why_bad>
- position contains character state: "Sitting nervously" and "trying to stay calm" are character poses and emotions, not spatial locations. Should be "Interview Room B" or "Conference room"
- props mixed from two rooms: "Plastic chairs" and "Vending machines" were in the lobby, not the interview room. When location changes, props should COMPLETELY update to the new room
- props lack state/context: "Audio recorder" should note "(recording)", "Photographs" should note "(evidence)" for scene relevance
</why_bad>
</bad_example>
</examples>`,
		userTemplate: `<previous_location>
{{previousState}}
</previous_location>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the current location as valid JSON:`,
	},

	location_props: {
		key: 'location_props',
		name: 'Location Props - Track Changes',
		description: 'Tracks prop additions and removals in the scene environment',
		defaultTemperature: 0.5,
		placeholders: [
			{
				name: 'previousProps',
				description: 'Current props in the scene',
				example: '["Leather couch", "Coffee table with magazines", "Floor lamp"]',
			},
			{
				name: 'characterOutfits',
				description:
					'Character outfits for distinguishing clothing from props',
				example: '[{ "name": "Elena", "outfit": { "torso": "Red dress" } }]',
			},
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.messages,
		],
		systemPrompt: `Analyze these roleplay messages and identify prop changes in the environment. You must only return valid JSON with no commentary.

<instructions>
<key_rules>
1. Props are PHYSICAL OBJECTS in the environment that characters can interact with
2. **Undressing ADDS props** - Clothes removed from body land on furniture/floor as props
3. **Dressing REMOVES props** - Clothes picked up from environment go on body
4. **Room transitions: ALL old props removed, ALL new props added**
5. Only track CHANGES, not descriptions of existing props
6. Outfit items on a character are NOT props - they're outfit
7. Held items (in hands) are NOT room props
8. Don't track temporary interactions (pick up, use, put back in same spot = no change)
9. **Scents, smells, and odors are NOT props** - They are atmospheric/sensory details, not physical objects
</key_rules>

<output_format>
Return JSON with an "events" array. Each event has:
- subkind: "prop_added" or "prop_removed"
- prop: Description of the prop

If no changes, return { "events": [] }
</output_format>
</instructions>

<examples>
<example>
<previous_props>["Queen bed with white sheets", "Nightstand with lamp", "Dresser with mirror", "Plush armchair by window"]</previous_props>
<character_outfits>[{ "name": "Elena", "outfit": { "torso": "Black cocktail dress", "footwear": "Silver heels", "neck": "Pearl necklace" }}]</character_outfits>
<input>
Elena kicked off her heels the moment she crossed the threshold, letting out a groan of relief as they tumbled across the hardwood floor. One landed near the dresser, the other somewhere under the bed. The cocktail dress came next, unzipped with practiced efficiency and stepped out of with minimal ceremony. She tossed it over the armchair, the expensive fabric pooling carelessly over the cushion. Standing in just her underwear, she padded over to the bed and flopped face-first into the pillows.

Elena: "God, I'm never wearing heels to one of his stupid parties again."

She reached behind her back to unclasp her bra, tossing it vaguely in the direction of the dresser without looking. It landed on the floor instead.
</input>
<output>
{
  "events": [
    { "subkind": "prop_added", "prop": "Silver heel (near dresser)" },
    { "subkind": "prop_added", "prop": "Silver heel (under bed)" },
    { "subkind": "prop_added", "prop": "Black cocktail dress (draped over armchair)" },
    { "subkind": "prop_added", "prop": "Bra (on floor near dresser)" }
  ]
}
</output>
<explanation>When Elena undresses, her clothing becomes props in the environment. Each item removed from her body is now a physical object in the room that could be interacted with.</explanation>
</example>

<example>
<previous_props>["Bed (unmade)", "Jeans draped over desk chair", "Gray t-shirt on floor", "Phone charging on nightstand", "Laptop on desk"]</previous_props>
<character_outfits>[{ "name": "Marcus", "outfit": { "torso": null, "legs": "Boxers" }}]</character_outfits>
<input>
Marcus dragged himself out of bed, squinting against the morning light. His head was pounding. He spotted his jeans on the desk chair where he'd apparently tossed them and pulled them on. The gray t-shirt was harder to find until he noticed it crumpled on the floor near the closet. He grabbed it, gave it an experimental sniff, shrugged, and tugged it over his head.

Marcus: "Good enough for a coffee run."

He snagged his phone from the nightstand, unplugging it from the charger in one smooth motion, then patted his pockets to check for his wallet.
</input>
<output>
{
  "events": [
    { "subkind": "prop_removed", "prop": "Jeans draped over desk chair" },
    { "subkind": "prop_removed", "prop": "Gray t-shirt on floor" },
    { "subkind": "prop_removed", "prop": "Phone charging on nightstand" }
  ]
}
</output>
<explanation>Marcus is dressing, so items leave the environment. The jeans on the chair go on his body. The t-shirt on the floor goes on his body. Phone was a prop on the nightstand but he took it.</explanation>
</example>

<example>
<previous_props>["Kitchen island with bar stools", "Coffee maker (brewing)", "Fruit bowl with bananas and apples", "Knife block on counter"]</previous_props>
<character_outfits>[{ "name": "Elena", "outfit": { "torso": "Oversized sweater", "legs": "Yoga pants" }}]</character_outfits>
<input>
Elena was already wandering away from the kitchen, mug in hand. She drifted through the archway into the living room. The sectional sofa dominated the space, its cushions bearing imprints from last night's movie marathon. She sank into her usual corner.

The coffee table was a disaster zone—empty wine glasses from yesterday, a pizza box, scattered coasters. The TV remote had migrated somewhere between the cushions, and she fished around until her fingers closed around it.
</input>
<output>
{
  "events": [
    { "subkind": "prop_removed", "prop": "Kitchen island with bar stools" },
    { "subkind": "prop_removed", "prop": "Coffee maker (brewing)" },
    { "subkind": "prop_removed", "prop": "Fruit bowl with bananas and apples" },
    { "subkind": "prop_removed", "prop": "Knife block on counter" },
    { "subkind": "prop_added", "prop": "Sectional sofa (with cushion imprints)" },
    { "subkind": "prop_added", "prop": "Coffee table" },
    { "subkind": "prop_added", "prop": "Empty wine glasses on coffee table" },
    { "subkind": "prop_added", "prop": "Pizza box on coffee table" },
    { "subkind": "prop_added", "prop": "Scattered coasters on coffee table" },
    { "subkind": "prop_added", "prop": "TV remote (between cushions)" }
  ]
}
</output>
<explanation>Complete room transition from kitchen to living room. ALL kitchen props are removed. ALL new living room props are added as described.</explanation>
</example>

<example>
<previous_props>["Office desk with computer", "Ergonomic chair"]</previous_props>
<character_outfits>[{ "name": "Elena", "outfit": { "torso": "White blouse", "legs": "Gray slacks" }}]</character_outfits>
<input>
James crossed the room and set a thick manila envelope on her desk, right on top of the stack of papers. The envelope was heavy, official-looking, with "CONFIDENTIAL" stamped across it.

Elena stared at the envelope for a long moment before sighing and reaching for her letter opener in the desk drawer.
</input>
<output>
{
  "events": [
    { "subkind": "prop_added", "prop": "Manila envelope (CONFIDENTIAL, on desk)" },
    { "subkind": "prop_added", "prop": "Letter opener (from desk drawer)" }
  ]
}
</output>
<explanation>James introduced a new object—the envelope. Elena retrieved a letter opener from the drawer, which becomes a visible prop.</explanation>
</example>

<example>
<previous_props>["Messenger bag on coat hook", "Umbrella stand with two umbrellas", "Console table with keys bowl"]</previous_props>
<character_outfits>[{ "name": "Marcus", "outfit": { "torso": "Button-down shirt", "legs": "Chinos" }}]</character_outfits>
<input>
Marcus grabbed his messenger bag from the coat hook, slinging it over his shoulder. The keys were in the bowl on the console table. He scooped them up, the familiar jingle reassuring. Through the window, clouds were gathering—he plucked one of the umbrellas from the stand and tucked it under his arm.
</input>
<output>
{
  "events": [
    { "subkind": "prop_removed", "prop": "Messenger bag on coat hook" },
    { "subkind": "prop_removed", "prop": "Console table with keys bowl" },
    { "subkind": "prop_added", "prop": "Console table with empty keys bowl" },
    { "subkind": "prop_removed", "prop": "Umbrella stand with two umbrellas" },
    { "subkind": "prop_added", "prop": "Umbrella stand with one umbrella" }
  ]
}
</output>
<explanation>Marcus takes items. When containers partially empty, track the state change by removing old description and adding new one.</explanation>
</example>
</examples>

<bad_examples>
<bad_example>
<input>Elena curled up on the couch, pulling one of the throw pillows into her lap. The television was on but muted.</input>
<previous_props>["Couch with throw pillows", "Television mounted on wall"]</previous_props>
<wrong_output>{ "events": [{ "subkind": "prop_added", "prop": "Throw pillow in Elena's lap" }] }</wrong_output>
<why_bad>The throw pillow was ALREADY on the couch. Don't add props that already exist. Correct: { "events": [] }</why_bad>
</bad_example>

<bad_example>
<input>Elena was reading when Marcus stepped inside, juggling grocery bags. She hurried over to grab two bags.</input>
<previous_props>["Living room couch", "Coffee table"]</previous_props>
<wrong_output>{ "events": [{ "subkind": "prop_added", "prop": "Grocery bags (in Marcus's arms)" }] }</wrong_output>
<why_bad>Items being HELD are NOT room props. Marcus is carrying them. Correct: { "events": [] }</why_bad>
</bad_example>

<bad_example>
<input>Elena grabbed her water bottle, took a drink, then set it back down where it was.</input>
<previous_props>["Yoga mat", "Water bottle", "Towel"]</previous_props>
<wrong_output>{ "events": [{ "subkind": "prop_removed", "prop": "Water bottle" }, { "subkind": "prop_added", "prop": "Water bottle" }] }</wrong_output>
<why_bad>Picking up and putting back in same spot = NO CHANGE. Correct: { "events": [] }</why_bad>
</bad_example>

<bad_example>
<input>Elena sat on the park bench, watching the sunset. A bird landed on the grass nearby.</input>
<previous_props>["Park bench", "Lamppost"]</previous_props>
<wrong_output>{ "events": [{ "subkind": "prop_added", "prop": "Sunset sky" }, { "subkind": "prop_added", "prop": "Bird" }] }</wrong_output>
<why_bad>Sunsets and birds are environmental features, not interactable props. Correct: { "events": [] }</why_bad>
</bad_example>

<bad_example>
<input>They stepped into the sterile corridor. The scent of disinfectant hung heavy in the air, mingling with something metallic underneath.</input>
<previous_props>["Reception desk", "Waiting room chairs"]</previous_props>
<wrong_output>{ "events": [{ "subkind": "prop_added", "prop": "Scent of disinfectant" }, { "subkind": "prop_added", "prop": "Metallic smell" }] }</wrong_output>
<why_bad>Scents, smells, and odors are NOT props - they are atmospheric/sensory details that cannot be picked up or interacted with physically. Correct: { "events": [] } (or track the room transition props only)</why_bad>
</bad_example>
</bad_examples>`,
		userTemplate: `<current_location>
{{location}}
</current_location>

<previous_props>
{{previousProps}}
</previous_props>

<character_outfits>
{{characterOutfits}}
</character_outfits>

<recent_messages>
{{messages}}
</recent_messages>

Extract prop changes as valid JSON:`,
	},
};
