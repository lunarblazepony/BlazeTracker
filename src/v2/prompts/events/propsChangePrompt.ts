/**
 * Props Change Event Prompt
 *
 * Detects props appearing or disappearing from the scene during roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedPropsChange } from '../../types/extraction';
import { propsChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Weapon Drawn During Confrontation
INPUT:
Current props: wooden bar counter, beer taps, pool cue rack, jukebox, dart board, whiskey bottles on shelf
"""
Marcus: *The tension had been building all night, and when the stranger made a move toward Sarah, Marcus's patience snapped. His hand moved to his hip in one fluid motion, drawing the Glock 19 he kept concealed under his jacket. The cold steel felt familiar in his grip as he leveled it at the man's chest. "That's far enough," he said, his voice calm despite the adrenaline coursing through his veins. The bar went silent, patrons freezing mid-drink, the jukebox's country tune suddenly the only sound in the room. Marcus kept his finger alongside the trigger guard, trained but not yet threatening lethal force.*
"""
OUTPUT:
{
  "reasoning": "Marcus draws a concealed Glock 19 handgun from under his jacket. This weapon was not among the current props (it was hidden on his person), but now it's been drawn and is actively in the scene. No props have been removed from the scene - the bar counter, beer taps, pool cue rack, jukebox, dart board, and whiskey bottles are all still present.",
  "added": ["Glock 19 handgun"],
  "removed": []
}

### Example 2: Character Picks Up and Pockets an Object
INPUT:
Current props: antique desk, leather journal, fountain pen, brass letter opener, vintage telephone, oil lamp, stack of letters
"""
Victoria: *She scanned the desk one final time, knowing she might never return to this study. The letters were too bulky, the telephone useless, but the brass letter opener... she picked it up, feeling its weight. It had been her father's - one of the few things of his she could take. She slipped it into her coat pocket, the metal cold against her thigh through the fabric. "I'm ready," she said to the waiting detective, her voice steady despite the tears she refused to shed.*
"""
OUTPUT:
{
  "reasoning": "Victoria picks up the brass letter opener and puts it in her coat pocket. While the letter opener technically still exists, it's no longer a scene prop - it's now on her person, in her pocket. The other items on the desk remain: the antique desk itself, leather journal, fountain pen, vintage telephone, oil lamp, and stack of letters.",
  "added": [],
  "removed": ["brass letter opener"]
}

### Example 3: Food and Drinks Being Served
INPUT:
Current props: restaurant booth, laminated menus, napkin dispenser, salt and pepper shakers, sugar caddy
"""
Waitress: *The waitress returned with a practiced efficiency, balancing the heavy tray on one arm while her other hand distributed the order. "Alright, we've got the Reuben with extra sauerkraut," she said, sliding a steaming plate in front of Marcus. "And the Caesar for the lady." She set down Elena's salad with a flourish, followed by their drinks - a dark beer for him, a glass of house red for her. "Fresh ground pepper for the salad?" She pulled the enormous pepper mill from her apron, holding it ready. When Elena nodded, she twisted it expertly over the greens. "Anything else you folks need?"*
"""
OUTPUT:
{
  "reasoning": "The waitress brings multiple new items to the table: Marcus receives a Reuben sandwich plate, Elena receives a Caesar salad plate, Marcus gets a beer, Elena gets red wine, and a pepper mill is temporarily present (used for grinding). The existing props (booth, menus, napkin dispenser, salt/pepper, sugar caddy) all remain. I'll add the substantial items - the food plates and drinks - as scene props. The pepper mill was only briefly present.",
  "added": ["Reuben sandwich plate", "Caesar salad plate", "glass of dark beer", "glass of red wine"],
  "removed": []
}

### Example 4: Breaking an Object
INPUT:
Current props: glass coffee table, ceramic vase with dried flowers, leather sofa, floor lamp, framed photographs on wall, crystal ashtray
"""
Natasha: *Her anger had been simmering all evening, and his dismissive laugh was the final spark. Before she could think, her hand swept across the coffee table, sending the ceramic vase crashing to the floor. It shattered spectacularly, dried flowers scattering across the hardwood like confetti at a funeral. "Don't you dare laugh at me," she hissed, shards of painted clay crunching under her heel as she stepped toward him. The dried petals had already begun to settle, their dusty scent mixing with the lingering tension in the air.*
"""
OUTPUT:
{
  "reasoning": "Natasha breaks the ceramic vase by sweeping it off the coffee table. The vase is destroyed (shattered into shards), so it should be removed. The dried flowers that were in the vase are now scattered on the floor - they still exist but in a different form. The glass coffee table, leather sofa, floor lamp, framed photographs, and crystal ashtray all remain undamaged.",
  "added": ["shattered ceramic shards", "scattered dried flowers"],
  "removed": ["ceramic vase with dried flowers"]
}

### Example 5: Document Revealed and Examined
INPUT:
Current props: office desk, computer monitor, keyboard, desk phone, stack of folders, coffee mug, desk lamp
"""
Detective Morrison: *Morrison pulled open the bottom drawer of the desk - the one that had been locked until he'd found the key hidden in the fake plant. Inside, beneath a false bottom he'd nearly missed, lay a single manila folder marked 'CONFIDENTIAL' in faded red ink. His heart rate quickened as he lifted it out, feeling its weight - too heavy for just papers. He set it on the desk and opened it carefully, revealing not just documents but a set of photographs, a USB drive, and what appeared to be a diplomatic passport under an assumed name. "Well, well," he murmured, "what were you hiding, Ambassador?"*
"""
OUTPUT:
{
  "reasoning": "Detective Morrison finds a hidden manila folder in a locked drawer with a false bottom. The folder contains photographs, a USB drive, and a fake diplomatic passport. These were previously hidden (not in the scene) but are now revealed and placed on the desk. All existing props remain. The locked drawer's contents are now visible scene props.",
  "added": ["manila folder marked CONFIDENTIAL", "photographs", "USB drive", "diplomatic passport"],
  "removed": []
}

### Example 6: Magical Item Consumed
INPUT:
Current props: stone altar, ritual candles (5), silver chalice, ancient grimoire, obsidian dagger, vial of dragon's blood
"""
Archmage Theron: *The ritual reached its crescendo as Theron lifted the vial of dragon's blood, its contents glowing with an inner crimson light. He spoke the final words of power and upended the vial over the chalice, watching the thick liquid spiral down in defiance of gravity. As the last drop fell, the vial crumbled to dust in his hand - vessels of dragon's blood were never meant for reuse. The chalice now pulsed with power, the combined reagents transforming into something new, something dangerous. The candle flames flickered wildly, casting mad shadows across the chamber walls.*
"""
OUTPUT:
{
  "reasoning": "The vial of dragon's blood is consumed in the ritual - Theron pours it into the chalice and the vial crumbles to dust. The vial should be removed as it no longer exists. The dragon's blood is now part of the mixture in the chalice, so we shouldn't add it separately. The stone altar, ritual candles, silver chalice (now containing the potion), ancient grimoire, and obsidian dagger all remain.",
  "added": [],
  "removed": ["vial of dragon's blood"]
}

### Example 7: Character Receives a Gift/Object Transfer
INPUT:
Current props: park bench, oak tree, picnic blanket, wicker basket, wine bottle, two wine glasses, cheese board
"""
Elena: *The picnic had been perfect - better than perfect. As the sun began its golden descent, Marcus reached into his jacket pocket with an expression she'd never seen before, something between terror and hope. He pulled out a small velvet box, and Elena's breath caught in her throat. "I've been carrying this for three weeks," he admitted, his voice rough with emotion, "waiting for the right moment." He opened it to reveal a ring - a simple band with a vintage emerald that caught the fading light. "It was my grandmother's. She would have loved you."*
"""
OUTPUT:
{
  "reasoning": "Marcus reveals a small velvet box containing his grandmother's emerald ring. This was in his jacket pocket (on his person), but now it's out in the scene, opened and displayed. The ring is being offered/shown, making it an active scene prop. All existing props (park bench, oak tree, picnic blanket, wicker basket, wine bottle, glasses, cheese board) remain present.",
  "added": ["velvet ring box", "vintage emerald ring"],
  "removed": []
}

### Example 8: Evidence Destroyed/Burned
INPUT:
Current props: fireplace with burning logs, wingback chair, side table, whiskey decanter, crystal tumbler, stack of documents, antique clock
"""
Senator Williams: *He didn't hesitate. Twenty years of careful record-keeping, of documenting every transaction, every favor, every secret - all of it had to go. Williams grabbed the stack of documents and began feeding them into the fire, page by page at first, then in handfuls as the flames hungrily consumed the evidence. Names, dates, bank account numbers - all turning to ash and smoke that swirled up the chimney. His hands trembled not from guilt but from the cold calculus of survival. When the last page had curled and blackened, he reached for the whiskey with soot-stained fingers.*
"""
OUTPUT:
{
  "reasoning": "Senator Williams burns the entire stack of documents in the fireplace. The documents are destroyed - they've been consumed by fire and turned to ash. The fireplace, wingback chair, side table, whiskey decanter, and crystal tumbler all remain. The antique clock is still present.",
  "added": [],
  "removed": ["stack of documents"]
}

### Example 9: Technology Being Set Up
INPUT:
Current props: empty conference table, office chairs (8), whiteboard, window blinds, wall clock
"""
IT Tech: *Chen wheeled in the cart loaded with presentation equipment, already mentally running through the setup checklist. First, the projector - he positioned it at the far end of the table, angling it toward the blank wall. The laptop came next, its corporate sticker marking it as company property, cables snaking out to connect everything. He booted it up while mounting the wireless microphone receiver, testing the connection with a few taps. Finally, he set up the webcam for the remote participants, its red light blinking as it came online. "Conference room's ready," he reported into his radio, "video link is live."*
"""
OUTPUT:
{
  "reasoning": "Chen sets up multiple pieces of technology in the conference room: a projector positioned at the table, a laptop connected with cables, a wireless microphone receiver, and a webcam with active red light. These are all newly introduced props. The existing props (conference table, chairs, whiteboard, window blinds, wall clock) remain.",
  "added": ["projector", "laptop with cables", "wireless microphone receiver", "webcam"],
  "removed": []
}

### Example 10: Cleaning Up/Removing Multiple Items
INPUT:
Current props: dining table, dinner plates (4), wine glasses (4), serving dishes, bread basket, candelabra, flower centerpiece, napkins
"""
Maria: *The dinner party guests had finally departed, leaving Maria alone with the aftermath. She moved efficiently around the table, stacking the dirty plates with practiced ease - four of them, caked with the remnants of her grandmother's recipe. The wine glasses went next, two still bearing lipstick marks, into the plastic tub she'd brought from the kitchen. The serving dishes followed, along with the depleted bread basket, its cloth napkin now just a nest for crumbs. She paused at the candelabra, its candles burned down to stubs, and decided to leave it for morning along with the flower arrangement that still looked fresh enough to save.*
"""
OUTPUT:
{
  "reasoning": "Maria is clearing the table after the dinner party. She removes and takes to the kitchen: the dinner plates (stacked), wine glasses (into a tub), serving dishes, bread basket, and presumably the napkins as they're bundled with other items. The candelabra (with burned-down candles) and flower centerpiece are explicitly left for later, so they remain. The dining table itself remains.",
  "added": [],
  "removed": ["dinner plates", "wine glasses", "serving dishes", "bread basket", "napkins"]
}

### Example 11: Sci-Fi Equipment Materializing
INPUT:
Current props: starship bridge console, captain's chair, viewscreen, tactical display, empty transporter pad
"""
Lieutenant Torres: *The transporter beam shimmered into existence on the pad, its characteristic whine filling the bridge with an energy that set Torres's teeth on edge. When the light faded, two figures stood where there had been empty space - and between them, a hovering cargo container marked with Romulan script. "The device is secure," one of the figures reported, her voice tight with barely contained excitement. She stepped off the pad, revealing the container's contents through its transparent panel: a crystalline structure that pulsed with an inner light, mounted in what appeared to be a stasis field generator. Starfleet Intelligence had been hunting this technology for decades.*
"""
OUTPUT:
{
  "reasoning": "Two figures materialize on the transporter pad along with a hovering cargo container. The container holds a crystalline device in a stasis field generator. The transporter pad is no longer empty - it now has occupants, but they're characters, not props. The cargo container and its visible contents (crystalline structure in stasis field generator) are new props. The bridge console, captain's chair, viewscreen, and tactical display remain.",
  "added": ["Romulan cargo container", "crystalline device in stasis field"],
  "removed": []
}

### Example 12: Combat - Weapons Expended and Lost
INPUT:
Current props: warehouse floor, shipping crates (stacked), forklift, emergency exit door, broken window, protagonist's assault rifle, enemy's shotgun, fire extinguisher
"""
Alex: *The firefight had been brutal and brief. Alex's rifle clicked empty - her last magazine spent on the two gunmen who now lay motionless behind the crates. She let the useless weapon fall, its clatter against the concrete masked by the ringing in her ears. The shotgun the big one had been carrying was closer, but as she scrambled toward it, a boot caught her in the ribs. The third man - she'd miscounted. She rolled with the impact, grabbing the fire extinguisher from the wall mount and swinging it in a desperate arc. The satisfying thunk of metal on skull told her she'd bought herself another moment. She didn't let go of her improvised weapon as she staggered to her feet.*
"""
OUTPUT:
{
  "reasoning": "Alex's assault rifle is emptied and dropped - it's still physically present but she's abandoned it. The fire extinguisher is grabbed from the wall and used as a weapon - it's no longer mounted but is still in the scene (in her hands). The enemy's shotgun is mentioned as being nearby. The warehouse floor, shipping crates, forklift, emergency exit door, and broken window remain. I'll remove the fire extinguisher from 'wall props' as it's now a handheld weapon, and note the dropped assault rifle. Actually, props that are dropped remain props, just in different locations. The rifle is still there, just empty and dropped.",
  "added": [],
  "removed": ["fire extinguisher"]
}

### Example 13: Clothing Removed Becomes Prop
INPUT:
Current props: leather armchair, fireplace, coffee table, wine glasses
Characters' Current Outfits:
Elena: red silk dress, black heels, pearl earrings
Marcus: charcoal suit jacket, white dress shirt, slacks, oxford shoes
Recent Outfit Changes:
Elena: removed: black heels | added: none
Marcus: removed: charcoal suit jacket | added: none
"""
Elena: *She kicked off her heels by the door, sighing with relief as her feet touched the cool hardwood. Marcus shrugged off his jacket, draping it over the back of the armchair as he moved to pour them both a drink.*
"""
OUTPUT:
{
  "reasoning": "The outfit changes show Elena removed her heels and Marcus removed his jacket. These items are no longer being worn, so they become scene props. Elena's heels are 'by the door' and Marcus's jacket is 'draped over the armchair'. The existing props (armchair, fireplace, coffee table, wine glasses) remain.",
  "added": ["black heels by the door", "charcoal suit jacket draped over armchair"],
  "removed": []
}

### Example 14: Clothing Put On Removes Prop
INPUT:
Current props: hotel bed, nightstand, Elena's discarded dress on floor, Marcus's shoes by closet
Characters' Current Outfits:
Elena: silk robe
Marcus: boxers
Recent Outfit Changes:
Elena: removed: none | added: silk dress
Marcus: removed: none | added: dress pants, shirt, oxford shoes
"""
The morning after. Elena slipped back into her dress from the night before, smoothing the wrinkled fabric. Marcus finished buttoning his shirt and stepped into his shoes, already reaching for his phone to check messages.
"""
OUTPUT:
{
  "reasoning": "The outfit changes show Elena put on her silk dress and Marcus put on pants, shirt, and shoes. These items were previously scene props (Elena's discarded dress, Marcus's shoes) and are now being worn. They should be removed from props. The hotel bed and nightstand remain.",
  "added": [],
  "removed": ["Elena's discarded dress on floor", "Marcus's shoes by closet"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Adding Props That Were Already Present
INPUT:
Current props: kitchen counter, knife block, cutting board, mixing bowls, refrigerator
"""
Chef Marco: *Marco selected his favorite knife from the block - the eight-inch chef's knife with the worn wooden handle. He tested its edge against his thumb before beginning to dice the onions with rapid, precise movements.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marco takes out a chef's knife and uses it.",
  "added": ["chef's knife"],
  "removed": []
}
WHY THIS IS WRONG: The knife block was already listed in current props, so knives were already present in the scene. Marco selecting a knife from the block doesn't add a new prop - he's using something that was already there. The correct output would have empty added and removed arrays.

### Bad Example 2: Removing Props That Are Just Moved
INPUT:
Current props: bookshelf, leather armchair, reading lamp, stack of books, coffee table, mug of tea
"""
Professor Ellis: *She carried the stack of books from the coffee table to her armchair, settling in for a long night of research. The lamp cast a warm circle of light as she opened the first volume.*
"""
WRONG OUTPUT:
{
  "reasoning": "The books are moved from the coffee table, so they're no longer there.",
  "added": ["books on armchair"],
  "removed": ["stack of books"]
}
WHY THIS IS WRONG: Moving a prop within the same scene doesn't remove it - the books are still present, just in a different location. Props are only removed when they leave the scene entirely (taken away, destroyed, consumed, etc.). The correct output would have empty arrays for both.

### Bad Example 3: Adding Characters as Props
INPUT:
Current props: hospital bed, IV stand, heart monitor, privacy curtain, bedside table
"""
Dr. Patterson: *The door opened and Dr. Patterson strode in, white coat flapping behind him. Following close behind was Nurse Chen with a medication cart, and behind her, the patient's anxious daughter clutching a bouquet of flowers.*
"""
WRONG OUTPUT:
{
  "reasoning": "New people and items enter the room.",
  "added": ["Dr. Patterson", "Nurse Chen", "patient's daughter", "medication cart", "bouquet of flowers"],
  "removed": []
}
WHY THIS IS WRONG: People (Dr. Patterson, Nurse Chen, the daughter) are characters, not props. Only the medication cart and bouquet of flowers are actual props that should be added. Characters are never props regardless of how they're described.

### Bad Example 4: Removing Props Based on Assumptions
INPUT:
Current props: beach towels, cooler, umbrella, sunscreen bottle, beach bag, sandcastle
"""
Mia: *The tide was coming in fast now, the water creeping higher up the beach with each wave. Mia gathered the cooler and beach bag, calling to the kids to hurry.*
"""
WRONG OUTPUT:
{
  "reasoning": "Mia gathers items and the tide is coming, so the sandcastle will be destroyed and items are being taken.",
  "added": [],
  "removed": ["cooler", "beach bag", "sandcastle", "beach towels", "umbrella", "sunscreen bottle"]
}
WHY THIS IS WRONG: The text only explicitly states that Mia gathered the cooler and beach bag. The sandcastle hasn't been destroyed yet (the tide is "coming in" - future), and the other items (towels, umbrella, sunscreen) aren't mentioned as being picked up. Only remove what is explicitly taken or destroyed in the text. Correct: removed: ["cooler", "beach bag"].

### Bad Example 5: Missing Obvious New Props
INPUT:
Current props: empty parking lot, streetlamp, chain-link fence, dumpster
"""
Vinnie: *The black sedan pulled into the lot, headlights cutting through the darkness before going dark. Two men stepped out, one carrying a briefcase, the other a sports bag that clinked metallically with each step. They approached the meeting spot under the streetlamp, the briefcase man setting his cargo down on the cracked asphalt.*
"""
WRONG OUTPUT:
{
  "reasoning": "A car arrives but cars come and go, so I won't add it.",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: The black sedan, briefcase, and sports bag (with metallic contents) are all significant new props that have entered the scene. Just because cars "come and go" doesn't mean they shouldn't be tracked when present. The correct output would add: ["black sedan", "briefcase", "sports bag"].

### Bad Example 6: Being Too Specific About Consumed Items
INPUT:
Current props: picnic table, paper plates, hot dogs, hamburgers, buns, ketchup bottle, mustard bottle, bag of chips, pitcher of lemonade
"""
The family ate heartily, working their way through the food. Dad finished his second hot dog, Mom nibbled on her burger, and the kids demolished the chips between them while passing around the lemonade.
"""
WRONG OUTPUT:
{
  "reasoning": "Food is being eaten, so I need to track exactly what's consumed.",
  "added": [],
  "removed": ["2 hot dogs", "0.5 hamburgers", "most of chips", "some lemonade"]
}
WHY THIS IS WRONG: This is overly specific and tries to track partial consumption. Food being eaten at a meal doesn't typically mean props are "removed" unless the text explicitly indicates something is finished or all gone. The family is eating but the food items as categories are still present at the picnic. Only remove if explicitly stated that all of an item is gone.

### Bad Example 7: Adding What Characters Are Wearing as Props
INPUT:
Current props: ballroom dance floor, crystal chandeliers, orchestra pit, champagne fountain
"""
Victoria: *She made her entrance in a stunning emerald ballgown, the fabric shimmering as she descended the grand staircase. Her diamond tiara caught the chandelier light, and the elbow-length silk gloves completed the look. Lord Ashworth approached in his formal black tailcoat and white bow tie, offering his hand for the first dance.*
"""
WRONG OUTPUT:
{
  "reasoning": "Victoria and Lord Ashworth are wearing notable attire that should be tracked.",
  "added": ["emerald ballgown", "diamond tiara", "silk gloves", "black tailcoat", "white bow tie"],
  "removed": []
}
WHY THIS IS WRONG: What characters are WEARING is never a prop - clothing on a person is part of their appearance, tracked separately from scene props. Victoria's gown, tiara, and gloves, as well as Lord Ashworth's tailcoat and bow tie are all being worn by characters. The correct output has empty arrays since no scene props changed.

### Bad Example 8: Confusing Discarded Clothing with Props
INPUT:
Current props: hotel room bed, nightstand, desk, mini bar, suitcase
"""
Amanda: *She peeled off her travel-stained clothes, dropping them in a heap by the suitcase - the wrinkled blouse, the skirt that had been through three time zones. The hot shower was calling her name.*
"""
WRONG OUTPUT:
{
  "reasoning": "Amanda removes her clothes and drops them, creating new props.",
  "added": ["wrinkled blouse", "skirt"],
  "removed": []
}
WHY THIS IS WRONG: Clothing that a character was wearing and then removed becomes part of the scene but in a minimal way - they're "dropped in a heap by the suitcase." Unless clothes become significant scene elements that other characters interact with or that affect the narrative, discarded personal clothing doesn't need to be tracked as props. The correct output would likely have empty arrays unless the clothes become plot-relevant.

### Bad Example 9: Ignoring Explicitly Destroyed Props
INPUT:
Current props: storefront window, mannequin display, clothing racks, cash register, security cameras
"""
The protesters' anger finally boiled over. Someone hurled a brick through the storefront window, the glass exploding inward in a cascade of glittering shards. Within moments, the mannequins had been toppled and the clothing racks overturned as the crowd surged inside.
"""
WRONG OUTPUT:
{
  "reasoning": "The protest is causing damage but everything is still technically there.",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: The storefront window is explicitly destroyed ("glass exploding inward"). This should be removed or noted as destroyed. The text describes significant changes to the scene. Correct: removed: ["storefront window"] and possibly added: ["broken glass/shards"] and the mannequins and racks are damaged but not necessarily removed.

### Bad Example 10: Adding Sounds or Sensations as Props
INPUT:
Current props: nightclub dance floor, DJ booth, bar counter, strobe lights, speaker towers
"""
The bass dropped and the crowd roared, the beat pounding through everyone's chest like a second heartbeat. Laser lights cut through the artificial fog, painting the dancers in neon greens and purples.
"""
WRONG OUTPUT:
{
  "reasoning": "New sensory elements are introduced to the scene.",
  "added": ["bass beat", "crowd roar", "artificial fog", "laser lights"],
  "removed": []
}
WHY THIS IS WRONG: Sounds (bass beat, crowd roar) are not props - they're sensory experiences. However, the artificial fog and laser lights ARE props/equipment that weren't in the original list. The correct output would only add: ["fog machine output", "laser light system"] or similar physical items.

### Bad Example 11: Listing the Same Prop Multiple Ways
INPUT:
Current props: abandoned warehouse, rusted machinery, broken pallets
"""
The detective found the murder weapon under a pile of broken pallets - a blood-stained crowbar, its curved end matted with hair.
"""
WRONG OUTPUT:
{
  "reasoning": "A crowbar is discovered as evidence.",
  "added": ["crowbar", "murder weapon", "blood-stained crowbar", "the weapon"],
  "removed": []
}
WHY THIS IS WRONG: This lists the same object four different ways. Props should be listed once with a clear, specific description. The correct output would be: added: ["blood-stained crowbar"].

### Bad Example 12: Removing Props That Go Off-Screen Temporarily
INPUT:
Current props: restaurant table, menus, water glasses, bread basket, candle
"""
Elena: *She excused herself to use the restroom, leaving Marcus alone at the table. He watched her walk away, mind racing with what to say when she returned.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena leaves the table area.",
  "added": [],
  "removed": ["Elena's water glass", "Elena's menu"]
}
WHY THIS IS WRONG: The scene is still at the restaurant table. Elena leaving temporarily doesn't remove props from the table. The water glass and menu she was using are still there. Props are removed when they physically leave the scene location, not when a character steps away briefly.

### Bad Example 13: Adding Abstract Concepts as Props
INPUT:
Current props: therapy office, leather couch, tissue box, degrees on wall, potted plant
"""
Dr. Martinez: *"Tell me about the guilt you're feeling," she said softly. The weight of unspoken trauma hung in the air between them, years of suppressed memories threatening to surface.*
"""
WRONG OUTPUT:
{
  "reasoning": "Emotional elements enter the scene.",
  "added": ["guilt", "trauma", "suppressed memories", "weight in the air"],
  "removed": []
}
WHY THIS IS WRONG: Guilt, trauma, memories, and "weight in the air" are abstract concepts and emotions, not physical props. Nothing physical changed in this exchange. The correct output would have empty arrays.

### Bad Example 14: Adding Currently Worn Items as Props
INPUT:
Current props: bed, nightstand, lamp
Characters' Current Outfits:
Elena: black lace negligee, silk robe
Marcus: pajama pants
Recent Outfit Changes:
(none)
"""
Elena: *She stretched languidly on the bed, the silk of her robe sliding against the sheets. The black lace of her negligee peeked out as she shifted position.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene describes Elena's clothing in detail.",
  "added": ["black lace negligee", "silk robe"],
  "removed": []
}
WHY THIS IS WRONG: The negligee and robe are listed in "Characters' Current Outfits" - they are being WORN by Elena, not sitting in the scene. Worn clothing is never a scene prop. The correct output would have empty arrays.

### Bad Example 15: Forgetting to Add Removed Clothing as Props
INPUT:
Current props: living room couch, coffee table, TV remote
Characters' Current Outfits:
Elena: tank top, shorts
Recent Outfit Changes:
Elena: removed: cardigan sweater, ankle boots | added: none
"""
Elena: *She tossed her cardigan onto the back of the couch and kicked off her boots, leaving them by the door. Finally home.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena comes home and gets comfortable.",
  "added": [],
  "removed": []
}
WHY THIS IS WRONG: The outfit changes show Elena removed her cardigan and boots. The text explicitly describes where these items ended up - cardigan "onto the back of the couch" and boots "by the door". These should be added as props with their locations: "cardigan sweater on couch", "ankle boots by door".
`;

export const propsChangePrompt: PromptTemplate<ExtractedPropsChange> = {
	name: 'props_change',
	description: 'Detect props appearing or disappearing from the scene',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentProps,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterOutfits,
		PLACEHOLDERS.outfitChanges,
	],

	systemPrompt: `You are analyzing roleplay messages to detect changes in scene props - objects appearing or disappearing.

## Your Task
Compare the current props list against the new message to identify:
1. Props that have been ADDED to the scene (newly introduced, revealed, or materialized)
2. Props that have been REMOVED from the scene (taken away, destroyed, consumed, or hidden)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what props changed and why
- "added": Array of strings describing new props that appeared
- "removed": Array of strings describing props that are no longer present

## What Counts as Adding a Prop
- Objects newly brought into the scene by characters
- Objects pulled out from pockets, bags, drawers (previously hidden, now visible)
- Objects that materialize (magic, teleportation, etc.)
- Food/drinks being served or delivered
- Equipment being set up
- Documents or items being revealed/discovered

## What Counts as Removing a Prop
- Objects taken out of the scene entirely (carried away to another location)
- Objects destroyed (broken, burned, dissolved)
- Objects consumed (eaten, drunk, used up)
- Objects hidden (put in pocket, bag, or concealed)
- Objects that dematerialize or disappear

## What Does NOT Count
- Moving a prop within the same scene (it's still present)
- Characters (people are not props)
- Sounds, smells, or sensations
- Abstract concepts (tension, mood, memories)
- Clothing currently being worn (tracked separately as outfits)
- Props that are "about to" be affected but haven't yet

## IMPORTANT: Outfit Changes
You will be given the current outfits characters are wearing AND any recent outfit changes (items removed/added).
- Items currently WORN should NOT be listed as props
- When a character REMOVES clothing (takes off a jacket, drops a dress), the removed item becomes a scene prop - add it with its location (e.g., "jacket draped over chair", "dress pooled on floor")
- When a character PUTS ON clothing, that item is no longer a scene prop (remove it if it was listed)

## Guidelines
- Only track explicit, clear changes described in the text
- Don't assume props are removed just because they're not mentioned
- Don't assume props are added just because similar items might exist
- Use clear, specific descriptions for props
- Don't list the same prop multiple ways

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Current Props in Scene
{{currentProps}}

## Characters' Current Outfits (DO NOT include as props)
{{characterOutfits}}

## Recent Outfit Changes
{{outfitChanges}}

## New Message to Analyze
{{messages}}

## Task
Analyze this message to detect any props that have appeared or disappeared. Compare against the current props list.

Remember:
- Only track EXPLICIT changes described in the text
- Characters are not props
- Moving props within the scene doesn't remove them
- Items in "Current Outfits" are being worn and are NOT scene props
- When clothing is REMOVED (from outfit changes), add it as a prop with its location
- When clothing is PUT ON (from outfit changes), remove it from props if it was there
- Be specific but don't duplicate`,

	responseSchema: propsChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedPropsChange | null {
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
		if (!Array.isArray(parsed.added)) return null;
		if (!Array.isArray(parsed.removed)) return null;

		// Validate all items are strings
		if (!parsed.added.every((item: unknown) => typeof item === 'string')) return null;
		if (!parsed.removed.every((item: unknown) => typeof item === 'string')) return null;

		return parsed as unknown as ExtractedPropsChange;
	},
};
