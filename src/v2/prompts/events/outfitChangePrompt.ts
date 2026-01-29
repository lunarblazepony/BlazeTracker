/**
 * Character Outfit Change Extraction Prompt
 *
 * Extracts when a character has clothing items added or removed.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedOutfitChange } from '../../types/extraction';
import { outfitChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';
import type { OutfitSlot } from '../../types/common';

const VALID_SLOTS: OutfitSlot[] = [
	'head',
	'neck',
	'jacket',
	'back',
	'torso',
	'legs',
	'footwear',
	'socks',
	'underwear',
];

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Taking Off a Jacket
INPUT:
"""
Character: Elena
Current outfit:
- jacket: black leather jacket
- torso: white blouse
- legs: dark jeans
- footwear: ankle boots

New message:
*The heat inside the club is oppressive. Elena shrugs off her leather jacket and drapes it over the back of her chair, revealing the shoulder holster she'd been concealing.*

"Better," *she mutters, rolling up her sleeves.*
"""
OUTPUT:
{
  "reasoning": "Elena removes her leather jacket due to the heat. She 'shrugs off' the jacket and puts it on the chair. The jacket slot should be marked as removed. No new items are added - the blouse was already being worn underneath, and the holster is an accessory not tracked in standard outfit slots.",
  "character": "Elena",
  "removed": ["jacket"],
  "added": {}
}

### Example 2: Changing Footwear
INPUT:
"""
Character: Marcus
Current outfit:
- torso: dress shirt
- legs: slacks
- footwear: dress shoes
- socks: black dress socks

New message:
*Marcus kicks off his dress shoes the moment he's through the door, leaving them in a haphazard pile by the entrance. He pads to the couch in his socks and collapses with a groan.*

"I hate formal events," *he announces to the empty apartment.*
"""
OUTPUT:
{
  "reasoning": "Marcus removes his dress shoes by kicking them off at the door. He's now just in socks (which he was already wearing underneath). Only the footwear slot is removed.",
  "character": "Marcus",
  "removed": ["footwear"],
  "added": {}
}

### Example 3: Putting On Multiple Items
INPUT:
"""
Character: Sarah
Current outfit:
- torso: tank top
- legs: yoga pants

New message:
*Sarah surveys herself in the mirror. The job interview is in an hour and she looks like she just came from the gym. She pulls on a crisp white blouse, steps into her navy pencil skirt, and slips on her black heels. A quick glance at her watch - thirty minutes. Time enough for makeup.*
"""
OUTPUT:
{
  "reasoning": "Sarah is getting dressed for an interview. She puts on a white blouse (torso - replacing the tank top), a navy pencil skirt (legs - replacing yoga pants), and black heels (footwear - new addition). Three slots change, with torso and legs being replacements and footwear being newly added.",
  "character": "Sarah",
  "removed": [],
  "added": {
    "torso": "crisp white blouse",
    "legs": "navy pencil skirt",
    "footwear": "black heels"
  }
}

### Example 4: Complete Undressing
INPUT:
"""
Character: Jake
Current outfit:
- jacket: denim jacket
- torso: band t-shirt
- legs: ripped jeans
- footwear: sneakers
- socks: white ankle socks
- underwear: boxer briefs

New message:
*Jake strips as he walks to the bathroom, leaving a trail of clothes behind him - jacket tossed on the bed, shirt on the floor, jeans in the hallway. By the time he reaches the shower, he's down to nothing, and the hot water is already steaming up the mirror.*
"""
OUTPUT:
{
  "reasoning": "Jake completely undresses on the way to the shower. The text explicitly describes him removing jacket, shirt, and jeans, and ending up 'down to nothing'. This means all clothing is removed including underwear and socks, even though those weren't explicitly mentioned being removed.",
  "character": "Jake",
  "removed": ["jacket", "torso", "legs", "footwear", "socks", "underwear"],
  "added": {}
}

### Example 5: Adding Accessories (Head/Neck)
INPUT:
"""
Character: Detective Morrison
Current outfit:
- torso: white shirt
- legs: tan slacks
- footwear: oxford shoes

New message:
*Morrison finishes his coffee and checks the time. The stakeout starts in ten minutes. He pulls on his old fedora - the one his father gave him - and wraps a scarf around his neck. The autumn wind is brutal this time of year.*

*He grabs his keys and heads out.*
"""
OUTPUT:
{
  "reasoning": "Morrison adds two items: a fedora (head slot) and a scarf (neck slot). No items are removed. These are additions to his existing outfit.",
  "character": "Morrison",
  "removed": [],
  "added": {
    "head": "old fedora",
    "neck": "scarf"
  }
}

### Example 6: Changing One Item For Another
INPUT:
"""
Character: Mira
Current outfit:
- head: red baseball cap
- torso: casual t-shirt
- legs: shorts
- footwear: flip-flops

New message:
*The art gallery has a strict dress code, which Mira only remembered after getting out of the cab. She ducks into a nearby boutique and emerges twenty minutes later in a sleek black dress that cost more than she wanted to think about. The baseball cap is stuffed in her purse, replaced by a delicate silver hairpin.*
"""
OUTPUT:
{
  "reasoning": "Mira changes her entire outfit for the gallery. She removes the baseball cap (head) and replaces it with a silver hairpin. She changes from a t-shirt to a black dress (torso), shorts to the dress which covers legs too (the dress handles both), and presumably changes footwear though not explicitly stated. The baseball cap is explicitly removed and replaced with a hairpin. For torso, the dress replaces the t-shirt. For legs, the dress covers this slot too.",
  "character": "Mira",
  "removed": [],
  "added": {
    "head": "delicate silver hairpin",
    "torso": "sleek black dress",
    "legs": "sleek black dress"
  }
}

### Example 7: Removing Only One Layer
INPUT:
"""
Character: Professor Webb
Current outfit:
- jacket: tweed blazer
- neck: bow tie
- torso: oxford shirt
- legs: chinos
- footwear: loafers

New message:
*The lecture hall is sweltering - apparently the AC is broken again. Professor Webb loosens his bow tie and shrugs out of his blazer, draping it over the lectern.*

"Now, where were we? Ah yes, the inconsistencies in quantum field theory..."
"""
OUTPUT:
{
  "reasoning": "Professor Webb removes two items due to the heat: his bow tie (loosened, which means removed from proper position) and his blazer. The bow tie being 'loosened' in this context suggests it's undone/removed from the neck slot. The blazer is clearly removed.",
  "character": "Professor Webb",
  "removed": ["jacket", "neck"],
  "added": {}
}

### Example 8: Partial State Change - Sleeves Rolled Up (Not A Slot Change)
INPUT:
"""
Character: Marcus
Current outfit:
- torso: white dress shirt
- legs: black slacks
- footwear: dress shoes

New message:
*Marcus rolls up his sleeves, exposing his forearms. The tattoo he usually keeps hidden - a coiled serpent - is now visible.*

"Let's get to work," *he says, grabbing the first file from the stack.*
"""
OUTPUT:
{
  "reasoning": "Rolling up sleeves doesn't change the torso slot - the shirt is still being worn, just in a different configuration. This is a state change, not an outfit change. No items are added or removed.",
  "character": "Marcus",
  "removed": [],
  "added": {}
}

### Example 9: Getting Dressed In The Morning
INPUT:
"""
Character: Elena
Current outfit:
- underwear: cotton underwear

New message:
*Elena's morning routine is practiced: shower, coffee, clothes. She pulls on her jeans, adds a simple gray sweater, and steps into her reliable combat boots. A leather jacket completes the look - practical, comfortable, and with enough pockets for the essentials.*
"""
OUTPUT:
{
  "reasoning": "Elena gets dressed after presumably being in just underwear. She adds jeans (legs), a gray sweater (torso), combat boots (footwear), and a leather jacket (jacket). Four slots are filled.",
  "character": "Elena",
  "removed": [],
  "added": {
    "legs": "jeans",
    "torso": "simple gray sweater",
    "footwear": "combat boots",
    "jacket": "leather jacket"
  }
}

### Example 10: Costume Change For Disguise
INPUT:
"""
Character: Agent Torres
Current outfit:
- torso: tactical vest over black t-shirt
- legs: cargo pants
- footwear: combat boots

New message:
*The cover identity requires a complete transformation. Torres strips off her tactical gear in the back of the van, replacing it piece by piece with the socialite disguise: a shimmering cocktail dress, strappy heels that she already hates, and a blonde wig that itches like hell.*

"I look ridiculous," *she mutters into the comms.*
"""
OUTPUT:
{
  "reasoning": "Torres does a complete outfit change for her cover identity. She removes tactical gear (torso, legs, footwear) and puts on a cocktail dress (torso and legs - it's a dress), strappy heels (footwear), and a blonde wig (head). The transformation is complete.",
  "character": "Agent Torres",
  "removed": [],
  "added": {
    "head": "blonde wig",
    "torso": "shimmering cocktail dress",
    "legs": "shimmering cocktail dress",
    "footwear": "strappy heels"
  }
}

### Example 11: Taking Off Shoes While Keeping Socks
INPUT:
"""
Character: Grandma Miller
Current outfit:
- torso: floral housedress
- legs: support stockings
- footwear: orthopedic shoes
- socks: compression socks

New message:
*Grandma Miller settles into her recliner with a sigh and kicks off her orthopedic shoes. Her feet, still in their compression socks, flex gratefully against the footrest.*

"That's better," *she murmurs, reaching for her knitting.*
"""
OUTPUT:
{
  "reasoning": "Grandma Miller removes only her orthopedic shoes. Her compression socks (in the socks slot) remain on, as explicitly stated. Only the footwear slot is cleared.",
  "character": "Grandma Miller",
  "removed": ["footwear"],
  "added": {}
}

### Example 12: Adding a Backpack
INPUT:
"""
Character: Jake
Current outfit:
- torso: hoodie
- legs: cargo shorts
- footwear: hiking boots

New message:
*Jake hoists the heavy backpack onto his shoulders, adjusting the straps until the weight settles comfortably. Inside: tent, sleeping bag, three days of food, and enough climbing gear to scale a small mountain.*

"Ready when you are," *he tells the group.*
"""
OUTPUT:
{
  "reasoning": "Jake puts on a backpack, which goes in the 'back' slot. This is a new addition - he wasn't wearing anything on his back before.",
  "character": "Jake",
  "removed": [],
  "added": {
    "back": "heavy backpack"
  }
}

### Example 13: Removing Underwear Specifically
INPUT:
"""
Character: Sarah
Current outfit:
- torso: silk nightgown
- underwear: lace underwear

New message:
*Sarah hesitates at the edge of the hot tub, then makes a decision. She reaches under her nightgown and slips off her underwear, leaving them on the deck chair before sliding into the steaming water with a sigh of contentment.*

"This was a good idea," *she admits.*
"""
OUTPUT:
{
  "reasoning": "Sarah removes her underwear before getting in the hot tub, leaving it on the chair. The nightgown stays on. Only the underwear slot is cleared.",
  "character": "Sarah",
  "removed": ["underwear"],
  "added": {}
}

### Example 14: Implied Removal By Situation
INPUT:
"""
Character: Marcus
Current outfit:
- jacket: suit jacket
- torso: dress shirt
- legs: suit pants
- footwear: dress shoes

New message:
*The waves crash around Marcus's ankles as he stumbles onto the beach, coughing up seawater. His suit is ruined, his shoes lost somewhere in the surf. He collapses on the sand, grateful to be alive.*
"""
OUTPUT:
{
  "reasoning": "Marcus's shoes are explicitly noted as 'lost somewhere in the surf' - they're gone. The rest of his outfit, though ruined, is still being worn. Only footwear is removed.",
  "character": "Marcus",
  "removed": ["footwear"],
  "added": {}
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Wrong Slot Assignment
INPUT:
"""
Character: Elena
Current outfit:
- torso: black dress

New message:
*Elena pulls on a cardigan to ward off the evening chill.*
"""
WRONG OUTPUT:
{
  "reasoning": "She puts on a cardigan which is an upper body item.",
  "character": "Elena",
  "removed": [],
  "added": { "torso": "cardigan" }
}
WHY THIS IS WRONG: A cardigan is an outer layer, not a torso item. It should go in the "jacket" slot since it's worn over the dress. Correct: added: { "jacket": "cardigan" }

### Bad Example 2: Missing Slot That Should Change
INPUT:
"""
Character: Marcus
Current outfit:
- torso: t-shirt
- legs: boxers

New message:
*Marcus gets dressed for work: fresh shirt, tie, slacks, belt, jacket, socks, and his lucky cufflinks. The morning routine complete, he grabs his briefcase.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus puts on work clothes.",
  "character": "Marcus",
  "removed": [],
  "added": { "torso": "shirt with tie", "legs": "slacks" }
}
WHY THIS IS WRONG: Multiple slots are missed. The jacket is explicitly mentioned (jacket slot), socks are explicitly mentioned (socks slot), and the t-shirt should arguably be replaced not just have a shirt added. Correct would include jacket and socks slots at minimum.

### Bad Example 3: Tracking Accessories Outside Standard Slots
INPUT:
"""
Character: Elena
Current outfit:
- torso: blouse
- legs: pencil skirt

New message:
*Elena clasps a gold watch around her wrist and slides three thin bangles onto her other arm. A spritz of perfume and she's ready.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena adds jewelry.",
  "character": "Elena",
  "removed": [],
  "added": { "wrist": "gold watch and bangles" }
}
WHY THIS IS WRONG: "wrist" is not a valid slot. The valid slots are: head, neck, jacket, back, torso, legs, footwear, socks, underwear. Watches and bracelets don't fit these slots. Correct: removed: [], added: {} (no trackable changes)

### Bad Example 4: Confusing Removal With Damage
INPUT:
"""
Character: Jake
Current outfit:
- torso: white shirt
- legs: jeans

New message:
*The explosion throws Jake backward. When he looks down, his shirt is torn and scorched, barely hanging together.*
"""
WRONG OUTPUT:
{
  "reasoning": "The shirt is destroyed so it's removed.",
  "character": "Jake",
  "removed": ["torso"],
  "added": {}
}
WHY THIS IS WRONG: The shirt is damaged but still being worn ("barely hanging together"). It's not removed. Damage to clothing doesn't constitute removal unless the item is completely gone. Correct: removed: [], added: {}

### Bad Example 5: Using Non-Standard Slot Names
INPUT:
"""
Character: Sarah
Current outfit:
- torso: sweater
- legs: jeans

New message:
*Sarah laces up her running shoes and ties her hair back with a scrunchie.*
"""
WRONG OUTPUT:
{
  "reasoning": "She puts on shoes and a hair accessory.",
  "character": "Sarah",
  "removed": [],
  "added": { "feet": "running shoes", "hair": "scrunchie" }
}
WHY THIS IS WRONG: "feet" should be "footwear" and "hair" should be "head". Always use the standard slot names. Correct: added: { "footwear": "running shoes", "head": "scrunchie" }

### Bad Example 6: Treating Adjustment As Removal
INPUT:
"""
Character: Marcus
Current outfit:
- jacket: suit jacket
- neck: tie

New message:
*Marcus loosens his tie and unbuttons the top button of his shirt. It's been a long day.*
"""
WRONG OUTPUT:
{
  "reasoning": "He loosens his tie, essentially removing it.",
  "character": "Marcus",
  "removed": ["neck"],
  "added": {}
}
WHY THIS IS WRONG: Loosening a tie is not the same as removing it. The tie is still around his neck, just not tight. Only remove an item from a slot if it's actually taken off. Correct: removed: [], added: {}

### Bad Example 7: Missing Implicit Underwear Under Explicit Clothing
INPUT:
"""
Character: Elena
Current outfit:
- (nothing specified, just woke up)

New message:
*Elena rolls out of bed and pulls on her favorite sundress, not bothering with much else given the summer heat. She slips on sandals and she's out the door.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena puts on a sundress and sandals.",
  "character": "Elena",
  "removed": [],
  "added": { "torso": "sundress", "legs": "sundress", "footwear": "sandals", "underwear": "panties", "torso-under": "bra" }
}
WHY THIS IS WRONG: First, "torso-under" is not a valid slot. Second, the text says "not bothering with much else" which suggests she's NOT wearing underwear. Don't add items that aren't mentioned or implied. Correct: added: { "torso": "sundress", "legs": "sundress", "footwear": "sandals" }

### Bad Example 8: Wrong Character Attribution
INPUT:
"""
Previous context: Marcus and Elena are in the scene.
Character being analyzed: Elena
Current outfit (Elena):
- torso: blouse
- legs: skirt

New message:
*Marcus shrugs off his jacket and drapes it around Elena's shoulders.* "You look cold."
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus removes his jacket.",
  "character": "Marcus",
  "removed": ["jacket"],
  "added": {}
}
WHY THIS IS WRONG: The prompt is asking about Elena's outfit change, not Marcus's. Elena is receiving the jacket. Correct: character: "Elena", removed: [], added: { "jacket": "Marcus's jacket" }

### Bad Example 9: Double-Counting Same Item
INPUT:
"""
Character: Jake
Current outfit:
- torso: button-down shirt

New message:
*Jake unbuttons his shirt and tosses it aside, revealing his toned chest.*
"""
WRONG OUTPUT:
{
  "reasoning": "Jake removes his shirt by unbuttoning and tossing it.",
  "character": "Jake",
  "removed": ["torso", "torso"],
  "added": {}
}
WHY THIS IS WRONG: The shirt is one item removed once. Don't duplicate entries. Correct: removed: ["torso"]

### Bad Example 10: Treating Description As Change
INPUT:
"""
Character: Elena
Current outfit:
- torso: red dress
- footwear: black heels

New message:
*Elena smooths her red dress and checks her heels in the mirror. Everything is perfect for the gala.*
"""
WRONG OUTPUT:
{
  "reasoning": "The text mentions her dress and heels.",
  "character": "Elena",
  "removed": [],
  "added": { "torso": "red dress", "footwear": "black heels" }
}
WHY THIS IS WRONG: She's already wearing these items - they're in her current outfit. The text is describing/referencing existing clothing, not adding new items. Correct: removed: [], added: {}

### Bad Example 11: Invalid Slot Value
INPUT:
"""
Character: Marcus
Current outfit:
- torso: t-shirt

New message:
*Marcus pulls on a heavy winter coat.*
"""
WRONG OUTPUT:
{
  "reasoning": "He puts on a coat.",
  "character": "Marcus",
  "removed": [],
  "added": { "coat": "heavy winter coat" }
}
WHY THIS IS WRONG: "coat" is not a valid slot. Coats go in the "jacket" slot (which covers all outer layers - jackets, coats, cardigans, etc.). Correct: added: { "jacket": "heavy winter coat" }

### Bad Example 12: Completely Missing Obvious Changes
INPUT:
"""
Character: Sarah
Current outfit:
- torso: office blouse
- legs: pencil skirt
- footwear: heels

New message:
*Sarah strips off her work clothes the moment she gets home, leaving them in a pile by the door. She changes into her comfy pajamas - an oversized t-shirt and soft flannel pants - and immediately feels better.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah changes clothes.",
  "character": "Sarah",
  "removed": [],
  "added": { "torso": "oversized t-shirt" }
}
WHY THIS IS WRONG: This misses that legs changes to flannel pants, and footwear is likely removed (heels off at home). Also, if the work clothes are "stripped off", those slots should be cleared before the new items are added (though in practice we track the end state). Correct: added: { "torso": "oversized t-shirt", "legs": "soft flannel pants" }, removed: ["footwear"]

### Bad Example 13: Using Descriptive Absence Instead of Slot Removal
INPUT:
"""
Character: Derek
Current outfit:
- torso: t-shirt
- legs: jeans
- footwear: sneakers

New message:
*Derek peels off his sweaty t-shirt and tosses it in the laundry basket. The summer heat is unbearable.*
"""
WRONG OUTPUT:
{
  "reasoning": "Derek removes his t-shirt due to the heat.",
  "character": "Derek",
  "removed": [],
  "added": { "torso": "shirtless" }
}
WHY THIS IS WRONG: When a slot becomes empty, add it to the "removed" array - don't set the value to "shirtless", "nothing", "topless", "bare", or any other descriptive word. These are not clothing items. Correct: removed: ["torso"], added: {}
`;

export const outfitChangePrompt: PromptTemplate<ExtractedOutfitChange> = {
	name: 'outfit_change',
	description: 'Extract clothing items added or removed from a character',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.targetCharacter,
		PLACEHOLDERS.targetCharacterState,
		PLACEHOLDERS.characterProfile,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to determine changes to a character's outfit.

## Your Task
Compare the character's current outfit with the new message to identify:
1. **Removed**: Outfit slots where items were taken off
2. **Added**: Outfit slots where items were put on or changed

## Valid Outfit Slots
- **head**: Hats, headbands, hair accessories, wigs, helmets
- **neck**: Necklaces, scarves, collars, ties, bow ties
- **jacket**: Outer layers - jackets, coats, cardigans, vests, capes
- **back**: Backpacks, bags worn on back, capes (if not in jacket)
- **torso**: Main upper body - shirts, blouses, dresses (upper), tank tops
- **legs**: Lower body - pants, skirts, shorts, dresses (lower)
- **footwear**: Shoes, boots, sandals, heels, slippers
- **socks**: Socks, stockings, tights
- **underwear**: Undergarments (bras, underwear, boxers, etc.)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of what clothing changes occurred
- "character": The character's name
- "removed": Array of slot names where items were removed
- "added": Object mapping slot names to new item descriptions

## Important Rules
- Only track ACTUAL changes - not descriptions of existing clothing
- Use final state after any changes in the passage
- Dresses count as both "torso" AND "legs" slots
- Adjustments (rolling sleeves, loosening tie) are NOT removals unless item comes off
- Damage to clothing is NOT removal unless item is completely gone
- Watches, bracelets, rings, earrings don't fit standard slots - ignore them
- If replacing one item with another in same slot, just use "added" (not removed)

## Inferring Added Items
When text implies clothing was added but doesn't give specifics, INFER appropriate items from context:
- "She changed into work clothes" → infer professional attire (blouse, dress pants, flats)
- "He got dressed for the gym" → infer workout clothes (athletic shirt, gym shorts, sneakers)
- "She put on something more comfortable" → infer casual wear (t-shirt, sweatpants, slippers)
Do NOT invent removals - only report items explicitly described as removed/taken off.

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Target Character
{{targetCharacter}}

## Character Profile
{{characterProfile}}

## Current Outfit State
{{targetCharacterState}}

## New Message to Analyze
{{messages}}

## Task
Identify any clothing changes for {{targetCharacter}} in this message.

Remember:
- Valid slots: head, neck, jacket, back, torso, legs, footwear, socks, underwear
- Only track actual changes, not descriptions of existing items
- Dresses count as both torso and legs
- Don't track watches, jewelry, or accessories outside standard slots`,

	responseSchema: outfitChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedOutfitChange | null {
		let parsed: Record<string, unknown>;
		try {
			const result = parseJsonResponse(response);
			if (!result || typeof result !== 'object' || Array.isArray(result))
				return null;
			parsed = result as Record<string, unknown>;
		} catch {
			return null;
		}

		if (typeof parsed.reasoning !== 'string') return null;
		if (typeof parsed.character !== 'string') return null;
		if (!Array.isArray(parsed.removed)) return null;
		if (
			typeof parsed.added !== 'object' ||
			parsed.added === null ||
			Array.isArray(parsed.added)
		)
			return null;

		// Validate removed slots
		for (const slot of parsed.removed) {
			if (typeof slot !== 'string' || !VALID_SLOTS.includes(slot as OutfitSlot)) {
				return null;
			}
		}

		// Validate added slots
		const added = parsed.added as Record<string, unknown>;
		for (const [slot, item] of Object.entries(added)) {
			if (!VALID_SLOTS.includes(slot as OutfitSlot)) return null;
			if (typeof item !== 'string') return null;
		}

		return {
			reasoning: parsed.reasoning as string,
			character: parsed.character as string,
			removed: parsed.removed as OutfitSlot[],
			added: added as Partial<Record<OutfitSlot, string>>,
		};
	},
};
