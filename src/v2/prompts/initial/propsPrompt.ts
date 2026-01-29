/**
 * Initial Props Extraction Prompt
 *
 * Extracts notable objects and props from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialProps } from '../../types/extraction';
import { initialPropsSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Explicit Object Descriptions
INPUT:
"""
Elena: *The antique shop is a maze of curiosities and forgotten treasures. Elena trails her fingers across a dusty globe that still spins on its brass axis, its painted continents faded by time. Nearby, a grandfather clock ticks solemnly, its pendulum swinging with hypnotic regularity. The oak counter at the front holds a brass cash register with ornate floral engravings, and behind it, rows of glass display cases showcase everything from pocket watches to jade figurines. A taxidermied owl perches on a wooden stand, its glass eyes following her as she moves. The air smells of old books and furniture polish. Elena picks up a silver hand mirror, turning it over to examine the intricate scrollwork on its back.*
"""
OUTPUT:
{
  "reasoning": "The scene describes many objects explicitly: a dusty globe on a brass axis, a grandfather clock with pendulum, a brass cash register, glass display cases, pocket watches, jade figurines, a taxidermied owl on a stand, and a silver hand mirror. I should focus on notable, interactable objects rather than every tiny detail. The display cases are containers, but their contents (watches, figurines) are separately notable.",
  "props": [
    "dusty antique globe",
    "grandfather clock",
    "brass cash register",
    "glass display cases",
    "collection of pocket watches",
    "jade figurines",
    "taxidermied owl",
    "silver hand mirror"
  ]
}

### Example 2: Interactive Props in a Bar Scene
INPUT:
"""
Characters' Current Outfits:
Marcus: worn leather jacket, faded band t-shirt, dark jeans, cowboy boots

Marcus: *The Rusty Nail hasn't changed in twenty years, and Marcus finds comfort in that. He slides into his usual booth, the leather seat worn smooth by countless patrons before him. The jukebox in the corner plays some old country song, its neon tubes casting a warm glow across the scarred wooden floor. Behind the bar, bottles of every description line the mirrored shelves, their labels a history of vice and comfort. Marcus signals to the bartender, who reaches for a bottle of Jameson and pours two fingers into a heavy glass tumbler. A bowl of pretzels appears alongside it, the basket chipped but functional. On the wall above the bar, a neon Budweiser sign flickers intermittently, one letter threatening to die completely. A pool table dominates the back room, the green felt visible through a doorway.*
"""
OUTPUT:
{
  "reasoning": "Interactive and significant props in this bar scene include: the jukebox (plays music, has neon tubes), bottles on shelves (bartender reaches for Jameson), glass tumbler (drink is poured into it), bowl of pretzels (served to patron), neon Budweiser sign (notable decor, flickering), and pool table (visible, used for games). The leather booth is furniture but notable as Marcus's 'usual' spot. I'll focus on things characters might interact with or that set the scene's atmosphere.",
  "props": [
    "jukebox",
    "whiskey bottles on mirrored shelves",
    "glass tumbler",
    "bowl of pretzels",
    "neon Budweiser sign",
    "pool table"
  ]
}

### Example 3: Environmental Props Setting Mood
INPUT:
"""
Narrator: *The abandoned hospital corridor stretches before them, lit only by the emergency lights that cast everything in an eerie red glow. Gurneys line the walls, some overturned, others still bearing the impression of bodies long gone. Medical charts scatter the floor like fallen leaves, their pages yellowed and unreadable. An IV stand lies toppled near a doorway, its tubing coiled like a dead snake. The nurses' station ahead is a chaos of overturned monitors and scattered medication bottles, the glass partition cracked but not shattered. Somewhere in the darkness, water drips steadily from a broken pipe, each drop echoing in the silence. A fire extinguisher hangs from the wall, its glass case intact, the only thing in the corridor that seems untouched by whatever happened here.*
"""
OUTPUT:
{
  "reasoning": "This horror/abandoned setting has many atmospheric props: gurneys along walls (some overturned), scattered medical charts, a toppled IV stand with tubing, overturned monitors at nurses' station, scattered medication bottles, cracked glass partition, a broken pipe dripping water, and an intact fire extinguisher. These set the mood and some could be used (fire extinguisher, medications). I'll include the most significant ones.",
  "props": [
    "hospital gurneys",
    "scattered medical charts",
    "toppled IV stand",
    "overturned monitors",
    "scattered medication bottles",
    "cracked glass partition",
    "fire extinguisher in glass case"
  ]
}

### Example 4: Weapons and Tools
INPUT:
"""
Commander Vex: *The armory is a testament to humanity's determination to survive among the stars. Vex walks the rows of weapon racks, each one holding pulse rifles secured by magnetic locks. On the workbench, a disassembled plasma pistol awaits repair, its components spread across a static-free mat. The wall displays a collection of melee weapons - vibroblades, shock batons, and a ceremonial sword that belonged to the ship's first captain. Ammunition crates stack three high along the back wall, their contents marked in bold red letters. A holographic targeting range occupies one corner, currently displaying a frozen simulation of hostile contacts. The quartermaster's desk holds a tablet and a half-empty mug of cold coffee, the only signs of recent human presence.*
"""
OUTPUT:
{
  "reasoning": "This sci-fi armory contains many significant props: pulse rifles on racks, a disassembled plasma pistol on workbench, vibroblades, shock batons, ceremonial sword, ammunition crates, a holographic targeting range, quartermaster's tablet, and coffee mug. All are either weapons (highly notable), tools, or personal items that indicate recent presence. The ceremonial sword has historical significance.",
  "props": [
    "pulse rifles on magnetic racks",
    "disassembled plasma pistol",
    "vibroblades",
    "shock batons",
    "ceremonial captain's sword",
    "ammunition crates",
    "holographic targeting range",
    "quartermaster's tablet",
    "cold coffee mug"
  ]
}

### Example 5: Personal Items and Background vs Foreground
INPUT:
"""
Sarah: *Mom's bedroom is exactly as she left it, frozen in time since the accident. Sarah stands in the doorway, afraid to cross the threshold. The bed is still unmade, the floral comforter bunched at the foot where Mom always kicked it off in her sleep. On the nightstand, reading glasses sit atop a dog-eared romance novel, a bookmark three-quarters of the way through a story she'll never finish. The vanity mirror reflects dusty perfume bottles and a hairbrush still tangled with gray hairs. Photos crowd the dresser - Sarah's graduation, her parents' wedding, a faded shot of grandparents long gone. The window is cracked open, and the lace curtains drift in the breeze, carrying the faint scent of the jasmine Mom planted years ago. A worn bathrobe hangs from a hook on the closet door, waiting for someone who won't return.*
"""
OUTPUT:
{
  "reasoning": "This emotionally charged scene has many personal items: unmade bed with floral comforter, reading glasses and dog-eared romance novel on nightstand, perfume bottles on vanity, hairbrush with gray hairs, photos on dresser (graduation, wedding, grandparents), lace curtains at open window, and a worn bathrobe on hook. These personal items are significant because they tell the story of the deceased mother. I'll focus on the most emotionally resonant and interactive objects.",
  "props": [
    "floral comforter",
    "reading glasses",
    "dog-eared romance novel",
    "dusty perfume bottles",
    "hairbrush with gray hairs",
    "framed family photos",
    "lace curtains",
    "worn bathrobe"
  ]
}

### Example 6: Fantasy/Magical Props
INPUT:
"""
Archmagus Theron: *The tower's apex chamber hums with arcane energy. Crystalline orbs orbit slowly around the central pedestal, each one containing a captured fragment of starlight. The pedestal itself supports an ancient grimoire, its pages turning of their own accord, revealing spells written in luminescent ink. Candelabras of black iron stand at the cardinal points, their flames burning an unnatural violet. Along the curved walls, shelves groan under the weight of alchemical reagents - jars of dragon scales, vials of phoenix tears, bundles of dried mandrake. A silver basin on a tripod contains still water that reflects not the ceiling above, but distant galaxies. The archmagus's staff leans against an armchair near the fireplace, its headpiece a caged sphere of perpetual lightning.*
"""
OUTPUT:
{
  "reasoning": "This magical tower has many fantastical props: crystalline orbs containing starlight, ancient grimoire with self-turning pages, black iron candelabras with violet flames, jars of dragon scales, vials of phoenix tears, dried mandrake bundles, a silver scrying basin showing galaxies, and the archmagus's lightning-caged staff. All are magical items that could be interacted with or are significant to the scene's fantasy atmosphere.",
  "props": [
    "orbiting crystalline starlight orbs",
    "self-turning ancient grimoire",
    "black iron candelabras with violet flames",
    "jars of dragon scales",
    "vials of phoenix tears",
    "bundles of dried mandrake",
    "silver scrying basin",
    "lightning-caged staff"
  ]
}

### Example 7: Sci-Fi Ship Interior
INPUT:
"""
Lieutenant Hayes: *The bridge of the Constellation is a symphony of light and technology. Hayes takes her station at the navigation console, its holographic display springing to life at her touch. The captain's chair dominates the center, its arms bristling with controls and a private screen for confidential communications. Along the forward viewport, a string of ancient prayer beads hangs from a hook - a reminder that superstition survives even among the stars. The tactical station to the right displays a real-time map of nearby sectors, red dots marking potential hostiles. Coffee cups litter the duty officer's station, evidence of a long night. An emergency toolkit is magnetically secured beneath the engineering console, and above it, a framed photograph shows the ship's original crew, most now retired or dead.*
"""
OUTPUT:
{
  "reasoning": "The sci-fi bridge has notable props: navigation console with holographic display, captain's chair with arm controls and private screen, ancient prayer beads (notable personal/cultural item), tactical station display, coffee cups (evidence of activity), emergency toolkit, and framed crew photograph. These range from high-tech equipment to personal items that humanize the scene.",
  "props": [
    "navigation console with holographic display",
    "captain's command chair",
    "ancient prayer beads",
    "tactical sector map display",
    "scattered coffee cups",
    "emergency toolkit",
    "framed original crew photograph"
  ]
}

### Example 8: Crime Scene Investigation
INPUT:
"""
Detective Vargas: *The apartment tells a story of violence interrupted. Vargas steps carefully around the chalk outline, noting the blood spatter pattern on the wall behind where the body was found. A coffee table lies overturned, its glass surface shattered into a thousand pieces that glitter in the camera flashes. On the floor near the window, a woman's high-heeled shoe lies alone - its partner presumably still on the victim. The open laptop on the desk displays a frozen video call, the timestamp reading 11:47 PM. Three empty wine glasses cluster near the sink, lipstick marks on two of them. A cell phone, cracked but possibly salvageable, rests in the corner where it skidded during the struggle. The victim's purse has been dumped out, contents scattered: wallet, keys, a pack of cigarettes, pepper spray that went unused.*
"""
OUTPUT:
{
  "reasoning": "This crime scene has many evidentiary props: overturned coffee table with shattered glass, victim's high-heeled shoe, open laptop showing frozen video call with timestamp, three wine glasses with lipstick marks (evidence of multiple people), cracked cell phone, and scattered purse contents including wallet, keys, cigarettes, and unused pepper spray. All are significant as potential evidence or for understanding what happened.",
  "props": [
    "overturned coffee table with shattered glass",
    "victim's high-heeled shoe",
    "open laptop with frozen video call",
    "three wine glasses with lipstick marks",
    "cracked cell phone",
    "victim's wallet",
    "keys",
    "pack of cigarettes",
    "unused pepper spray"
  ]
}

### Example 9: Kitchen/Domestic Scene
INPUT:
"""
Rosa: *The farmhouse kitchen is alive with the sounds and smells of Sunday dinner. Rosa stirs the massive stockpot on the ancient cast-iron stove, the aroma of her grandmother's pozole filling the air. On the butcher block island, fresh tortillas rest under a embroidered cloth, still warm from the comal that sits on the back burner. Bundles of dried chilies hang from hooks near the window, swaying gently in the breeze. The refrigerator is covered in children's drawings and family photos held by colorful magnets. A well-worn recipe box sits open on the counter, revealing yellowed index cards covered in faded handwriting. The radio on the windowsill plays corridos, slightly tinny but perfectly nostalgic. A wooden spoon with a cracked handle - Rosa's grandmother's - hangs in a place of honor above the stove.*
"""
OUTPUT:
{
  "reasoning": "This warm domestic scene has many meaningful props: large stockpot of pozole, cast-iron stove, fresh tortillas under embroidered cloth, comal on back burner, dried chili bundles hanging by window, children's drawings on fridge, colorful magnets, worn recipe box with yellowed cards, radio playing corridos, and grandmother's cracked wooden spoon. These props establish cultural heritage, family history, and the love put into the meal.",
  "props": [
    "large stockpot of pozole",
    "cast-iron stove",
    "fresh tortillas under embroidered cloth",
    "comal",
    "dried chili bundles",
    "children's drawings on fridge",
    "worn recipe box with yellowed cards",
    "radio",
    "grandmother's wooden spoon"
  ]
}

### Example 10: Steampunk/Victorian Workshop
INPUT:
"""
Professor Whitmore: *The workshop is a testament to the marriage of science and craftsmanship. Whitmore adjusts his magnifying goggles, peering at the delicate clockwork mechanism spread across his workbench. Brass gears of every size fill glass jars along the shelves, sorted by diameter with scientific precision. An automaton stands in the corner, half-assembled, its exposed innards a maze of copper tubing and crystalline power cells. The pneumatic press hisses softly in its standby state, ready to stamp patterns into metal sheets. Technical drawings cover every inch of the walls, some his own designs, others acquired from less reputable sources. A leather tool roll lies open beside him, revealing picks and pliers sized for work that would frustrate a watchmaker. The orrery by the window - his masterpiece - turns silently, its mechanical planets tracing orbits around a glowing sun-sphere.*
"""
OUTPUT:
{
  "reasoning": "This steampunk workshop has many specialized props: magnifying goggles, clockwork mechanism on workbench, glass jars of sorted brass gears, half-assembled automaton with copper tubing and power cells, pneumatic press, technical drawings on walls, leather tool roll with precision picks and pliers, and an orrery with mechanical planets around a glowing sun-sphere. These are all tools of the trade or works in progress that the professor might interact with.",
  "props": [
    "magnifying goggles",
    "clockwork mechanism",
    "jars of brass gears",
    "half-assembled automaton",
    "pneumatic press",
    "technical drawings",
    "leather tool roll with precision instruments",
    "mechanical orrery"
  ]
}

### Example 11: Underwater/Aquatic Scene
INPUT:
"""
Marina: *The submarine's observation deck offers a window into another world. Marina presses her palm against the reinforced glass, watching bioluminescent creatures drift past like living constellations. The sonar console behind her pings softly, mapping the seafloor three hundred meters below. Emergency air tanks are secured in a rack by the hatch, their gauges showing full capacity. A diving suit hangs in an alcove, its helmet connected by umbilical to the ship's life support. The underwater drone sits in its charging cradle, waiting for its next deployment to explore the thermal vents they discovered yesterday. On the small desk, Marina's research journal lies open, filled with sketches of species that have no names yet. A preserved specimen jar catches the glow from outside - a creature they haven't been able to identify, tentacles pressed against the glass.*
"""
OUTPUT:
{
  "reasoning": "This underwater exploration scene has specialized props: reinforced observation glass, sonar console, emergency air tanks in rack, diving suit with helmet and umbilical, underwater drone in charging cradle, research journal with species sketches, and a preserved specimen jar with unidentified tentacled creature. All are relevant to marine exploration and research activities.",
  "props": [
    "reinforced observation glass",
    "sonar console",
    "emergency air tanks",
    "diving suit with connected helmet",
    "underwater drone in charging cradle",
    "research journal with sketches",
    "preserved specimen jar with unknown creature"
  ]
}

### Example 12: Post-Apocalyptic Survival Camp
INPUT:
"""
Jax: *The camp is rough but defensible, carved out of an old parking structure. Jax checks the trip wires they strung across the entrance, ensuring the tin cans are still attached and ready to rattle a warning. The fire pit in the center crackles with salvaged furniture, heating a dented pot of boiled rainwater. Their supplies are meager but organized: a few cans of expired food, a first aid kit with more bandages than medicine, bottles of purified water lined against the wall. The motorcycle they arrived on is half-hidden under a tarp, its tank nearly empty. A shotgun leans against Jax's sleeping bag, never more than arm's reach away. On a makeshift table of cinder blocks and plywood, a hand-crank radio sits silent, its batteries long dead. Someone has drawn a map on the wall in charcoal, marking safe routes and danger zones.*
"""
OUTPUT:
{
  "reasoning": "This survival camp has many practical props for a post-apocalyptic setting: trip wires with tin can alarms, fire pit with dented pot, canned food supplies, first aid kit, purified water bottles, motorcycle under tarp, shotgun by sleeping bag, hand-crank radio (dead batteries), and charcoal map on wall. All are crucial for survival or security and could be interacted with.",
  "props": [
    "trip wire alarm system with tin cans",
    "fire pit with dented pot",
    "cans of expired food",
    "first aid kit",
    "bottles of purified water",
    "motorcycle under tarp",
    "shotgun",
    "hand-crank radio",
    "charcoal map of safe routes"
  ]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Including Characters as Props
INPUT:
"""
Elena: *The office party is in full swing. Elena stands by the punch bowl, watching her coworkers mingle. Marcus leans against the wall near the photocopier, nursing a drink. The receptionist, Kelly, is dancing near the DJ booth while the new intern looks uncomfortable by the snack table. Steve from accounting tells his usual boring stories to anyone who will listen.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene has many elements including Marcus, Kelly, the intern, and Steve who are at the party.",
  "props": [
    "punch bowl",
    "Marcus",
    "photocopier",
    "Kelly",
    "DJ booth",
    "the intern",
    "snack table",
    "Steve from accounting"
  ]
}
WHY THIS IS WRONG: Characters (Marcus, Kelly, the intern, Steve) are NOT props. Props are objects, not people. The correct props from this scene would be: punch bowl, photocopier, DJ booth, and snack table.

### Bad Example 2: Including Permanent Fixtures
INPUT:
"""
James: *The warehouse is vast and empty, echoing with every footstep. James walks across the concrete floor, his flashlight beam cutting through the darkness. The walls are corrugated metal, rusting in places where rain has leaked through the ceiling. Support pillars march in rows toward the loading dock at the far end.*
"""
WRONG OUTPUT:
{
  "reasoning": "The warehouse has many structural elements I should list.",
  "props": [
    "concrete floor",
    "walls",
    "corrugated metal",
    "ceiling",
    "support pillars",
    "loading dock",
    "flashlight"
  ]
}
WHY THIS IS WRONG: Permanent structural fixtures like floor, walls, ceiling, and support pillars are part of the building, not props. The loading dock is also structural. The only actual prop here is the flashlight that James is carrying.

### Bad Example 3: Too Generic (Just "Furniture")
INPUT:
"""
Dr. Chen: *The therapist's office is designed for comfort and confidentiality. Soft armchairs face each other across a low coffee table, and a leather couch lines one wall. Bookshelves full of psychology texts flank the window, where light filters through gauze curtains. On the desk, a notepad and pen wait beside a small sand timer. A box of tissues sits on the coffee table, strategically placed.*
"""
WRONG OUTPUT:
{
  "reasoning": "Standard office with typical furniture.",
  "props": [
    "furniture",
    "books",
    "window",
    "desk",
    "stuff"
  ]
}
WHY THIS IS WRONG: "Furniture" and "stuff" are too generic. The scene specifically describes soft armchairs, a leather couch, bookshelves with psychology texts, gauze curtains, notepad and pen, sand timer, and tissue box. These specific items create atmosphere and could be interacted with. "Window" is also a permanent fixture, not a prop.

### Bad Example 4: Too Specific (Every Tiny Detail)
INPUT:
"""
Maria: *The jewelry store sparkles under carefully positioned lights. Display cases hold rings, necklaces, and bracelets, each piece nestled on velvet cushions. Maria examines a sapphire pendant, turning it to catch the light.*
"""
WRONG OUTPUT:
{
  "reasoning": "I need to list every single item in the store.",
  "props": [
    "first display case",
    "second display case",
    "third display case",
    "fourth display case",
    "diamond ring #1",
    "diamond ring #2",
    "diamond ring #3",
    "gold ring",
    "silver ring",
    "pearl necklace",
    "gold necklace",
    "sapphire necklace",
    "ruby bracelet",
    "gold bracelet",
    "every velvet cushion",
    "overhead light #1",
    "overhead light #2",
    "sapphire pendant",
    "positioning lights"
  ]
}
WHY THIS IS WRONG: This is excessively detailed, listing multiple instances of the same type of object. The props should be representative: "display cases with jewelry on velvet cushions" and "sapphire pendant" (specifically being examined) capture the scene without exhaustive enumeration.

### Bad Example 5: Missing Obvious Important Props
INPUT:
"""
Agent Smith: *The interrogation room is stark and intimidating. Smith sits across from the suspect, a single bright lamp angled to shine in the man's eyes. The metal table between them holds only a manila folder thick with evidence and a recording device with its red light blinking. On the wall, a one-way mirror reflects Smith's impassive face. Handcuffs chain the suspect to a bolt in the table.*
"""
WRONG OUTPUT:
{
  "reasoning": "Basic interrogation room, not much here.",
  "props": [
    "lamp"
  ]
}
WHY THIS IS WRONG: This misses critical props: the metal table, manila folder with evidence, recording device (blinking red light = active recording), one-way mirror, and handcuffs chained to bolt. These are all significant objects that contribute to the scene's tension and could be referenced in the narrative.

### Bad Example 6: Including Props from Other Scenes/Memories
INPUT:
"""
Thomas: *The beach house living room is peaceful, waves audible through the open windows. Thomas sets down his suitcase and looks around at the wicker furniture and nautical decorations. He remembers the last time he was here - the argument in the city apartment, throwing his wedding ring, the sound of shattering glass as the vase hit the wall. But that was months ago. Now there's only the rattan couch, the driftwood coffee table, and the painting of a lighthouse above the fireplace.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene includes many objects from his memory and the current location.",
  "props": [
    "suitcase",
    "wicker furniture",
    "nautical decorations",
    "wedding ring",
    "shattered vase",
    "city apartment wall",
    "rattan couch",
    "driftwood coffee table",
    "lighthouse painting",
    "fireplace"
  ]
}
WHY THIS IS WRONG: The wedding ring, shattered vase, and city apartment wall are from a MEMORY of a past scene, not props in the current beach house. Only objects actually present in the current scene should be listed: suitcase, wicker furniture/rattan couch, nautical decorations, driftwood coffee table, and lighthouse painting.

### Bad Example 7: Including Abstract Concepts as Props
INPUT:
"""
Maya: *The meditation studio is a haven of tranquility. Maya sits on a cushion, eyes closed, focusing on her breath. Incense smoke curls upward from a brass holder, and a singing bowl rests beside her teacher's mat. The walls are painted in soft earth tones, and natural light filters through rice paper screens. Peace and serenity fill the space.*
"""
WRONG OUTPUT:
{
  "reasoning": "The space contains both physical objects and the atmosphere.",
  "props": [
    "meditation cushion",
    "incense holder",
    "singing bowl",
    "rice paper screens",
    "peace",
    "serenity",
    "tranquility",
    "Maya's breath",
    "natural light"
  ]
}
WHY THIS IS WRONG: "Peace," "serenity," "tranquility," "Maya's breath," and "natural light" are not physical props - they are abstract concepts, sensations, or natural phenomena. Props must be tangible objects. The correct props are: meditation cushion, brass incense holder, singing bowl, and rice paper screens.

### Bad Example 8: Listing Clothing Characters Are Wearing as Props
INPUT:
"""
Elena: *She strolled through the gallery in her elegant red evening gown, the silk catching the light as she moved. Her diamond earrings sparkled, and the vintage pearl necklace she'd inherited from her grandmother added a touch of old-world glamour. Marcus followed in his tailored charcoal suit and burgundy tie, his polished oxford shoes clicking on the marble floor.*
"""
WRONG OUTPUT:
{
  "reasoning": "The characters are wearing notable clothing that should be tracked.",
  "props": [
    "red evening gown",
    "diamond earrings",
    "vintage pearl necklace",
    "charcoal suit",
    "burgundy tie",
    "polished oxford shoes"
  ]
}
WHY THIS IS WRONG: Clothing that characters are actively wearing is NOT a prop - it's part of the character's appearance. Props are objects in the environment that exist independently of the characters. Elena's dress, earrings, necklace, and Marcus's suit, tie, and shoes are all being WORN by characters. They only become props when removed and set aside (e.g., "she draped her coat over the chair").

### Bad Example 9: Including Worn Accessories and Carried Personal Items
INPUT:
"""
Detective Rivera: *Rivera adjusted his worn leather shoulder holster as he surveyed the crime scene. His badge hung from a lanyard around his neck, and his notebook was already out, pen clicking as he processed the details. The suspect's hotel room had been tossed - overturned mattress, slashed pillows leaking feathers, empty hangers in the open closet.*
"""
WRONG OUTPUT:
{
  "reasoning": "The detective's equipment and the crime scene items are all props.",
  "props": [
    "leather shoulder holster",
    "detective's badge",
    "lanyard",
    "notebook",
    "pen",
    "overturned mattress",
    "slashed pillows",
    "empty hangers"
  ]
}
WHY THIS IS WRONG: The shoulder holster, badge on lanyard, notebook, and pen are all items worn or carried by Detective Rivera - they are part of his character, not scene props. The correct props are only the crime scene items: overturned mattress, slashed pillows, and empty hangers. Character equipment, jewelry, weapons in holsters, bags being carried, etc. are NOT props unless set down in the scene.

### Bad Example 14: Duplicating Items From Provided Outfits
INPUT:
"""
Characters' Current Outfits:
Elena: black leather jacket, white silk blouse, dark jeans, ankle boots, silver pendant necklace
Marcus: gray wool overcoat, charcoal suit, burgundy tie, oxford shoes

Elena: *She walked into the dimly lit jazz club, her leather jacket creaking slightly as she moved. The silver pendant at her throat caught the stage lights. Marcus was already at the bar, his overcoat draped over the stool beside him to save her seat.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene describes clothing and the jazz club setting.",
  "props": [
    "black leather jacket",
    "silver pendant necklace",
    "gray wool overcoat",
    "bar stools",
    "stage lights"
  ]
}
WHY THIS IS WRONG: The leather jacket, silver pendant, and overcoat are all listed in the "Characters' Current Outfits" section and are being WORN by the characters. These are already tracked separately and must NOT be duplicated as props. NOTE: Marcus's overcoat is "draped over the stool" - but since it's listed in his current outfit, this is him temporarily setting it aside while still wearing/owning it. Only the bar stools and stage lights are actual scene props here.

### Bad Example 10: Including Weather/Environment as Props
INPUT:
"""
Captain Yuki: *The mountain summit offers a breathtaking view. Yuki plants the expedition flag in the snow, the fabric snapping in the fierce wind. Her climbing gear is secured to the anchor point she hammered in moments ago. Dark clouds gather on the horizon, promising a storm. The temperature has dropped significantly in the last hour.*
"""
WRONG OUTPUT:
{
  "reasoning": "Everything on the mountain is a prop.",
  "props": [
    "mountain summit",
    "expedition flag",
    "snow",
    "fierce wind",
    "climbing gear",
    "anchor point",
    "dark clouds",
    "storm",
    "temperature drop"
  ]
}
WHY THIS IS WRONG: The mountain summit, snow, wind, clouds, storm, and temperature are environmental conditions, not props. Props are objects that could be picked up, used, or interacted with. The correct props are: expedition flag, climbing gear, and anchor point.

### Bad Example 11: Duplicating Props with Different Names
INPUT:
"""
Chef Antonio: *The restaurant kitchen is a controlled chaos. Antonio moves between stations, checking the line. On his right, the sautee station blazes with activity. The stove, range, and burners all work in concert as his sous chef manages four pans simultaneously. Plates wait on the pass, ready for garnish.*
"""
WRONG OUTPUT:
{
  "reasoning": "List all cooking equipment mentioned.",
  "props": [
    "stove",
    "range",
    "burners",
    "sautee station",
    "cooking station",
    "four pans",
    "plates on pass",
    "pass",
    "garnish station"
  ]
}
WHY THIS IS WRONG: "Stove," "range," and "burners" are essentially the same piece of equipment described different ways. "Sautee station" and "cooking station" are duplicates. "Plates on pass" and "pass" are the same. "Garnish station" wasn't even mentioned - it was just that plates are "ready for garnish." Consolidate: sautee station with stove, pans, and plates on the pass.

### Bad Example 12: Including Body Parts as Props
INPUT:
"""
The Surgeon: *The operating room is bathed in clinical white light. The surgeon's gloved hands move with precision, her instruments laid out on the sterile tray beside her. The patient lies unconscious on the table, their chest cavity opened and held by retractors. Heart monitors beep steadily. The surgical team passes tools back and forth in practiced silence.*
"""
WRONG OUTPUT:
{
  "reasoning": "Everything in the OR is important.",
  "props": [
    "surgical gloves",
    "instruments",
    "sterile tray",
    "operating table",
    "patient's chest cavity",
    "patient's organs",
    "retractors",
    "heart monitors",
    "surgical tools"
  ]
}
WHY THIS IS WRONG: "Patient's chest cavity" and "patient's organs" are body parts, not props. "Surgical gloves" are worn by the surgeon. "Instruments" and "surgical tools" are duplicates. The correct props are: sterile tray with instruments/tools, operating table, retractors, and heart monitors.

### Bad Example 13: Listing Food Being Consumed vs. Available as Props
INPUT:
"""
Grandmother Lin: *The family dinner is reaching its peak. Lin watches her grandchildren devour the dumplings she spent all morning making. Platters of fried rice and spring rolls pass from hand to hand around the crowded table. The lazy Susan in the center holds a whole steamed fish that's already half gone, and bowls of various sauces. Lin's chopsticks rest on their little ceramic holder as she takes a moment just to watch.*
"""
WRONG OUTPUT:
{
  "reasoning": "All the food is props.",
  "props": [
    "dumplings being eaten",
    "devoured food",
    "platters of fried rice",
    "spring rolls in mouths",
    "lazy Susan",
    "half-eaten fish",
    "sauce bowls",
    "Lin's chopsticks in use",
    "chopstick holder"
  ]
}
WHY THIS IS WRONG: "Dumplings being eaten," "devoured food," "spring rolls in mouths," and "Lin's chopsticks in use" describe food in the process of consumption, not static props. The props are the serving dishes and remaining food: platters of fried rice, spring rolls (what's left on platters), lazy Susan, steamed fish (remaining half), sauce bowls, and the ceramic chopstick holder.
`;

export const initialPropsPrompt: PromptTemplate<ExtractedInitialProps> = {
	name: 'initial_props',
	description: 'Extract notable objects and props from the opening of a roleplay',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterOutfits,
	],

	systemPrompt: `You are analyzing roleplay messages to extract notable props and objects in the scene.

## Your Task
Read the provided roleplay messages and identify notable objects/props that are present in the current scene.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what objects are notable in the scene
- "props": An array of strings describing notable objects/props

## What Counts as a Prop
Props are tangible objects that:
1. Characters could potentially interact with (pick up, use, examine)
2. Are significant to the scene's atmosphere or setting
3. Could be referenced later in the narrative
4. Help establish the location or situation

## What is NOT a Prop
- Characters or people
- Permanent structural fixtures (walls, floor, ceiling, doors unless special)
- Weather conditions (rain, wind, temperature)
- Abstract concepts (peace, tension, love)
- Body parts
- Clothing being worn (unless removed and set aside)
- Objects only mentioned in memories/flashbacks

## IMPORTANT: Character Outfits Are Provided Separately
You will be given a list of what characters are currently wearing. These items are already tracked as outfits and must NOT be extracted as props. Only include clothing as a prop if it is REMOVED and set aside (e.g., "coat draped over chair").

## Prop Selection Guidelines
- Be specific but not exhaustive (don't list every item of the same type)
- Consolidate similar items ("collection of bottles" not "bottle 1, bottle 2, bottle 3")
- Focus on interactive or atmospherically significant objects
- Include weapons, tools, and personal items prominently
- Include items that set mood or establish genre
- 5-15 props is typical; adjust based on scene richness

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Characters' Current Outfits (DO NOT include as props)
{{characterOutfits}}

## Messages to Analyze
{{messages}}

## Task
Extract notable props and objects from these messages. Consider what objects are:
1. Explicitly described
2. Interactive (characters could use them)
3. Atmospherically significant
4. Genre or setting appropriate

Remember:
- Props are OBJECTS, not people
- Only include items in the CURRENT scene, not memories
- Be specific but not exhaustive
- Focus on notable, interactable, or significant items
- DO NOT include items listed in "Characters' Current Outfits" above - those are already tracked`,

	responseSchema: initialPropsSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedInitialProps | null {
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
		if (!Array.isArray(parsed.props)) return null;

		// Validate all props are strings
		if (!parsed.props.every((p: unknown) => typeof p === 'string')) return null;

		return parsed as unknown as ExtractedInitialProps;
	},
};
