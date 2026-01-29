/**
 * Props Confirmation Event Prompt
 *
 * Confirms which props from the current list are still present in the scene
 * and which should be removed. Used for periodic cleanup of prop lists.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedPropsConfirmation } from '../../types/extraction';
import { propsConfirmationSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Location Change - Most Props No Longer Relevant
INPUT:
Current props: office desk, computer monitor, ergonomic chair, filing cabinet, water cooler, motivational poster
Current location: Downtown Seattle - Riverside Park - near the duck pond
"""
Marcus: *The park was quieter than he expected for a Saturday afternoon. Marcus found a bench facing the pond and sat down heavily, loosening his tie as he watched the ducks paddle lazily across the water. The oak trees provided welcome shade from the afternoon sun, and somewhere nearby a child was laughing. He pulled out his phone and the crumpled resignation letter from his pocket, reading it one more time before he made the call.*
"""
OUTPUT:
{
  "reasoning": "The scene has moved from an office to Riverside Park. None of the office props (desk, monitor, chair, filing cabinet, water cooler, poster) are present at the park location. The current scene shows a park bench, a duck pond, oak trees, but these would be new observations rather than confirming old props. None of the previous props should be confirmed since we're in a completely different location.",
  "confirmed": [],
  "removed": ["office desk", "computer monitor", "ergonomic chair", "filing cabinet", "water cooler", "motivational poster"]
}

### Example 2: Same Location - Confirming Props Still Present
INPUT:
Current props: wooden bar counter, row of bar stools, neon beer signs, pool table, jukebox, dartboard
Current location: Downtown - The Rusty Nail bar - main floor
"""
Elena: *She leaned against the bar counter, the wood worn smooth by decades of elbows just like hers. The bartender slid her usual across to her without being asked - he knew her order after three years of Friday nights. Behind her, the crack of pool balls breaking echoed through the room, followed by good-natured cursing. The jukebox had been silent all night, but someone finally fed it quarters and an old Springsteen song crackled to life.*
"""
OUTPUT:
{
  "reasoning": "The scene is still at The Rusty Nail bar on the main floor. The text explicitly references: the bar counter (she leans against it), the pool table (balls breaking behind her), and the jukebox (someone plays it). The bar stools, neon beer signs, and dartboard aren't mentioned but would logically still be present at this same location. Since we're confirming props at the same location and nothing indicates these items were removed, I'll confirm all of them.",
  "confirmed": ["wooden bar counter", "row of bar stools", "neon beer signs", "pool table", "jukebox", "dartboard"],
  "removed": []
}

### Example 3: Partial Relevance - Some Props Consumed/Used
INPUT:
Current props: dining table, candelabra with lit candles, wine bottle, two wine glasses, bread basket, cheese platter, napkins
Current location: Victorian District - Elena's apartment - dining room
"""
Marcus: *The candles had burned low, reduced to flickering stubs in their holders, casting dancing shadows across the empty cheese platter. The wine bottle stood empty between them, and Marcus reached for it before remembering they'd finished the last of it an hour ago. The conversation had flowed as freely as the wine, and now they sat in comfortable silence, the remains of dinner between them. Elena gathered the crumb-scattered napkins and the depleted bread basket.*
"""
OUTPUT:
{
  "reasoning": "Same location - Elena's dining room. The text confirms: candelabra still present (with burned-low candles), wine glasses still present (implied by 'between them'), dining table still present. However, the wine bottle is explicitly empty and the cheese platter is described as empty - these are still physically present as props. The bread basket and napkins are being gathered by Elena (being removed). The candles are almost burned out but still exist.",
  "confirmed": ["dining table", "candelabra with lit candles", "wine bottle", "two wine glasses", "cheese platter"],
  "removed": ["bread basket", "napkins"]
}

### Example 4: Scene Destruction - Most Props Damaged or Gone
INPUT:
Current props: storefront window, mannequin displays, clothing racks, cash register, security camera
Current location: Commercial District - Bella's Boutique - main floor
"""
The aftermath of the break-in was devastating. Detective Reyes stepped through where the storefront window had been, now just a gaping hole ringed with jagged glass teeth. Inside, the clothing racks had been toppled like dominoes, expensive garments trampled into the debris. The mannequins lay scattered, some decapitated, their plastic limbs at unnatural angles. Only the security camera still watched from its corner mount, its red light blinking steadily - the silent witness they were counting on.
"""
OUTPUT:
{
  "reasoning": "Same location but after a break-in. The storefront window is destroyed (now 'a gaping hole'). The mannequin displays are scattered and damaged - technically still present but as debris. The clothing racks are toppled but still there. The cash register isn't mentioned - possibly stolen or just not in view. The security camera is explicitly confirmed ('still watched from its corner mount'). I should confirm what's explicitly present and remove what's explicitly gone or destroyed.",
  "confirmed": ["clothing racks", "security camera"],
  "removed": ["storefront window", "mannequin displays", "cash register"]
}

### Example 5: Time Skip - Props May Have Changed
INPUT:
Current props: hospital bed, IV drip stand, heart monitor, patient chart, bedside table, vase of flowers
Current location: General Hospital - Room 412 - patient room
"""
Three weeks later, Elena finally convinced the doctor to let her return for a visit. The room was almost unrecognizable - fresh paint on the walls, new sheets on the bed, and a different patient entirely staring back at her with confused eyes. "Oh, I'm sorry," she stammered, backing toward the door, "I was looking for... never mind." Marcus was gone. Discharged, transferred, or worse - she didn't know yet.
"""
OUTPUT:
{
  "reasoning": "Same hospital room (Room 412) but three weeks have passed and there's a different patient. The hospital bed is confirmed (mentioned with new sheets). Standard hospital fixtures would remain: IV drip stand, heart monitor. The patient chart would be different (new patient). The vase of flowers from weeks ago would certainly be gone. The bedside table is standard furniture. This is really a different context - same room but essentially a new scene.",
  "confirmed": ["hospital bed", "IV drip stand", "heart monitor", "bedside table"],
  "removed": ["patient chart", "vase of flowers"]
}

### Example 6: Outdoor Scene - Environmental Props
INPUT:
Current props: park bench, oak tree, trash can, squirrels, fallen leaves, drinking fountain
Current location: Riverside Park - near the main path
"""
Winter had transformed the park completely. Sarah pulled her coat tighter as she walked the familiar path, now dusted with fresh snow. The bench where they used to sit was still there, though piled high with white powder. The oak tree's branches were bare now, skeletal fingers reaching toward the gray sky. She passed the drinking fountain, its basin frozen solid and wrapped in caution tape. The squirrels had vanished with the last of the acorns, and the fallen leaves of autumn were buried beneath the snow.*
"""
OUTPUT:
{
  "reasoning": "Same park location but winter has changed things. The park bench is confirmed (still there, covered in snow). The oak tree is confirmed (bare branches now). The drinking fountain is confirmed (frozen, wrapped in tape). The trash can isn't mentioned but would still be there. The squirrels are gone (text says 'vanished'). The fallen leaves are 'buried beneath snow' - they're technically still there but no longer a visible prop.",
  "confirmed": ["park bench", "oak tree", "trash can", "drinking fountain"],
  "removed": ["squirrels", "fallen leaves"]
}

### Example 7: Vehicle Interior - After Exit
INPUT:
Current props: leather car seats, dashboard GPS, rearview mirror charm, fast food wrappers, gym bag in backseat
Current location: University Campus - Parking Lot B - standing outside
"""
Alex slammed the car door harder than necessary, the sound echoing across the nearly empty lot. He stood there for a moment, keys still in hand, staring at his reflection in the driver's side window. The argument replayed in his mind - every sharp word, every accusation. He'd left his phone on the passenger seat, he realized, but he couldn't bring himself to open the door again. Let it die in there. He turned and walked toward the campus, leaving everything behind.*
"""
OUTPUT:
{
  "reasoning": "The character has exited the vehicle and is now standing in the parking lot. The scene location is outside the car, so the interior props (seats, GPS, mirror charm, wrappers, gym bag) are no longer directly in the scene. The phone was left inside. Since we're tracking props in the current scene location (outside the car), the car's interior props should be removed from the active scene.",
  "confirmed": [],
  "removed": ["leather car seats", "dashboard GPS", "rearview mirror charm", "fast food wrappers", "gym bag in backseat"]
}

### Example 8: Office Scene - End of Day Cleanup
INPUT:
Current props: conference table, presentation screen, laptop, whiteboard with diagrams, empty coffee cups, stack of handouts
Current location: Tech Corp HQ - Conference Room 3A - main area
"""
The meeting had run three hours over, but finally, finally, it was done. Marcus began the tedious process of cleanup while the others filed out with relief on their faces. He powered down the presentation screen and unplugged the laptop, tucking it back into its bag. The whiteboard diagrams would need to stay for tomorrow's follow-up, but the scattered handouts and graveyard of coffee cups went straight into the trash. By the time he flicked off the lights, the room looked almost civilized again.
"""
OUTPUT:
{
  "reasoning": "Same conference room, end of meeting cleanup. The presentation screen is turned off but still there. The laptop is unplugged and put into a bag (leaving the scene with Marcus). The whiteboard with diagrams explicitly stays ('would need to stay for tomorrow'). The conference table is still there. The handouts and coffee cups are thrown in the trash - removed from the scene.",
  "confirmed": ["conference table", "presentation screen", "whiteboard with diagrams"],
  "removed": ["laptop", "empty coffee cups", "stack of handouts"]
}

### Example 9: Campsite - Morning After
INPUT:
Current props: two-person tent, sleeping bags, campfire pit with embers, cooler, folding chairs, flashlights, marshmallow sticks
Current location: Mountain Trail - Clearwater Campsite - main area
"""
Dawn broke cold and gray over the campsite. Elena emerged from the tent, yawning, to find Marcus already up and packing. The sleeping bags had been rolled and strapped to their packs, the folding chairs collapsed and stowed. "We should hit the trail in twenty," he said, not looking up as he kicked dirt over the last embers of the fire. The cooler was already latched and ready to carry. She grabbed her flashlight from the tent entrance, clicking it on and off to check the battery - still good enough for the hike out.
"""
OUTPUT:
{
  "reasoning": "Same campsite, but characters are packing up to leave. The tent is still there (Elena emerges from it). The sleeping bags are 'rolled and strapped to packs' - being packed up, removed as scene props. The campfire pit exists but embers are being buried. The cooler is 'latched and ready' - still present as a prop. The folding chairs are 'collapsed and stowed' - packed away, not scene props anymore. The flashlight is retrieved from tent - still present. The marshmallow sticks aren't mentioned and would likely have been left or burned.",
  "confirmed": ["two-person tent", "campfire pit with embers", "cooler", "flashlights"],
  "removed": ["sleeping bags", "folding chairs", "marshmallow sticks"]
}

### Example 10: Crime Scene - After Evidence Collection
INPUT:
Current props: body outline, blood spatter on wall, broken lamp, overturned chair, victim's purse, cell phone
Current location: Oak Street - Apartment 4B - living room
"""
The forensics team had been thorough. Detective Shaw surveyed the room again, noting what remained. The body outline was still there in tape, a ghost of what had been. The blood spatter on the wall had been photographed, swabbed, analyzed, but not cleaned - not yet. The broken lamp and overturned chair remained undisturbed, frozen in their violent angles. But the evidence bags had claimed their prizes: the victim's purse, the cell phone, even samples from the carpet. The room felt emptier now, stripped of its secrets if not its tragedy.
"""
OUTPUT:
{
  "reasoning": "Same apartment crime scene after evidence collection. The body outline remains (still there in tape). The blood spatter remains (not cleaned yet). The broken lamp remains (undisturbed). The overturned chair remains (frozen in place). The victim's purse was taken as evidence ('evidence bags had claimed'). The cell phone was taken as evidence. These are explicitly removed by the forensics team.",
  "confirmed": ["body outline", "blood spatter on wall", "broken lamp", "overturned chair"],
  "removed": ["victim's purse", "cell phone"]
}

### Example 11: Fantasy Tavern - After Bar Fight
INPUT:
Current props: wooden tables, bar counter, tankards, roaring fireplace, mounted deer head, bard's lute, spilled ale
Current location: Willow Creek - The Prancing Pony tavern - common room
"""
The tavern slowly returned to normal after the brawl, though "normal" was a relative term. The barkeep swept broken tankard shards into a pile while his wife mopped up the worst of the spilled ale - at least the third time that week. The wooden tables had mostly survived, though one leaned drunkenly on three legs now. The fireplace crackled on, oblivious to the chaos, and above it, the mounted deer head had somehow lost an antler. The bard sat in the corner, cradling his lute protectively - it had survived, thank the gods, though the same couldn't be said for his dignity.
"""
OUTPUT:
{
  "reasoning": "Same tavern, post-fight. Wooden tables are confirmed (survived, one damaged). Bar counter is implied by 'barkeep' working. Tankards are partially broken (shards being swept). Fireplace is confirmed (crackled on). Mounted deer head is damaged but present (lost an antler). Bard's lute is confirmed (cradled protectively). The spilled ale is being mopped up - it's being cleaned/removed. The broken tankards are being swept up.",
  "confirmed": ["wooden tables", "bar counter", "roaring fireplace", "mounted deer head", "bard's lute"],
  "removed": ["tankards", "spilled ale"]
}

### Example 12: Spaceship - After Damage
INPUT:
Current props: pilot's chair, navigation console, viewscreen, emergency lighting, fire suppression system, life support panel, captain's coffee mug
Current location: USS Horizon - Bridge - command center
"""
The hull breach had been contained, but the bridge would never be the same. Lieutenant Torres pulled herself along the handholds, emergency lighting casting everything in crimson shadows. The pilot's chair had been torn from its moorings by the decompression, now floating somewhere in the debris field outside. The navigation console still flickered with life, half its displays dark but functional enough. The viewscreen was cracked but holding, stars visible through the spider web of fractures. She made her way to life support - still green, thank god. The fire suppression system had done its job, though the extinguishing foam was still settling in the corners. She found the captain's mug magnetically sealed to a console edge, miraculously intact.*
"""
OUTPUT:
{
  "reasoning": "Same bridge location after severe damage. The pilot's chair is explicitly gone ('torn from its moorings, floating in debris field'). Navigation console is confirmed (flickering but functional). Viewscreen is confirmed (cracked but holding). Emergency lighting is confirmed (casting crimson shadows). Fire suppression system is confirmed (did its job, foam visible). Life support panel is confirmed (still green). Captain's coffee mug is confirmed (found intact, magnetically sealed).",
  "confirmed": ["navigation console", "viewscreen", "emergency lighting", "fire suppression system", "life support panel", "captain's coffee mug"],
  "removed": ["pilot's chair"]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Removing Props Just Because They're Not Mentioned
INPUT:
Current props: kitchen counter, refrigerator, stove, coffee maker, fruit bowl, knife block
Current location: Home - Kitchen - main area
"""
Sarah poured herself a cup of coffee, yawning as she watched the sunrise through the window. It was going to be a long day.
"""
WRONG OUTPUT:
{
  "reasoning": "Only the coffee maker is mentioned, so the other props might not be there.",
  "confirmed": ["coffee maker"],
  "removed": ["kitchen counter", "refrigerator", "stove", "fruit bowl", "knife block"]
}
WHY THIS IS WRONG: Props don't disappear just because they're not mentioned. At the same location (kitchen), standard fixtures and items would still be present. Only remove props when there's explicit evidence they're gone. The correct output would confirm all props.

### Bad Example 2: Confirming Props at a Different Location
INPUT:
Current props: beach umbrella, sand castle, beach towels, cooler, surfboard
Current location: Home - Living room - main area
"""
Tom collapsed onto the couch, exhausted from the beach trip. Sand still clung to his ankles despite his attempts to brush it off at the car. The AC hummed quietly as he reached for the remote.
"""
WRONG OUTPUT:
{
  "reasoning": "Tom just came from the beach, so those things should still be confirmed.",
  "confirmed": ["beach umbrella", "sand castle", "beach towels", "cooler", "surfboard"],
  "removed": []
}
WHY THIS IS WRONG: The scene is now in the living room, not at the beach. Beach props (umbrella, sand castle, towels, cooler, surfboard) are not in the living room. All of them should be removed as they're at a different location. The character moved scenes.

### Bad Example 3: Adding New Props to Confirmed List
INPUT:
Current props: park bench, oak tree, drinking fountain
Current location: Central Park - main path area
"""
Maria sat on the bench, watching pigeons fight over breadcrumbs. A street vendor nearby was selling hot dogs, the smell making her stomach growl. A jogger passed with a golden retriever on a leash.
"""
WRONG OUTPUT:
{
  "reasoning": "I can see several items in the scene now.",
  "confirmed": ["park bench", "oak tree", "drinking fountain", "pigeons", "breadcrumbs", "hot dog cart", "golden retriever"],
  "removed": []
}
WHY THIS IS WRONG: The confirmation prompt is only for verifying which CURRENT props are still present, not for adding new ones. Pigeons, breadcrumbs, hot dog cart, and the dog weren't in the original props list. The correct output would just confirm the original three props.

### Bad Example 4: Partially Confirming Props
INPUT:
Current props: wine glasses, wine bottle, cheese platter
Current location: Elena's apartment - living room
"""
They had finished most of the wine, and Elena picked at the last few pieces of cheese.
"""
WRONG OUTPUT:
{
  "reasoning": "Some things are partially consumed.",
  "confirmed": ["wine glasses", "half wine bottle", "mostly empty cheese platter"],
  "removed": []
}
WHY THIS IS WRONG: Props should be confirmed with their original names, not modified. "Half wine bottle" and "mostly empty cheese platter" are not proper confirmations. Either confirm the prop as it was listed or remove it entirely. Partial consumption doesn't usually require removal unless the item is completely gone.

### Bad Example 5: Removing Characters Listed as Props
INPUT:
Current props: garden bench, rose bushes, garden hose, lawn mower, elderly gardener
Current location: Victorian mansion - back garden
"""
The gardener had finished for the day and gone home, leaving the garden in perfect order. Sarah walked among the roses, enjoying the evening quiet.
"""
WRONG OUTPUT:
{
  "reasoning": "The gardener left, so should be removed from props.",
  "confirmed": ["garden bench", "rose bushes", "garden hose", "lawn mower"],
  "removed": ["elderly gardener"]
}
WHY THIS IS WRONG: Characters should never have been listed as props in the first place. While the output correctly doesn't confirm the gardener, the correct approach is to note that "elderly gardener" was incorrectly listed as a prop. For this response, simply don't include them in either list - they're not props.

### Bad Example 6: Ignoring Explicit Destruction
INPUT:
Current props: antique vase, fireplace mantel, family portrait, crystal decanter
Current location: Manor house - drawing room
"""
Her rage was beyond words. The antique vase shattered against the wall, followed by the crystal decanter, both reduced to glittering fragments on the hardwood floor.
"""
WRONG OUTPUT:
{
  "reasoning": "The items are still in the room, just broken.",
  "confirmed": ["antique vase", "fireplace mantel", "family portrait", "crystal decanter"],
  "removed": []
}
WHY THIS IS WRONG: The vase and decanter are explicitly SHATTERED - destroyed. Broken items should be removed from the prop list (or you could add "shattered glass" if the fragments are significant). The correct output would remove the vase and decanter while confirming the mantel and portrait.

### Bad Example 7: Confirming Props That Were Explicitly Taken
INPUT:
Current props: stack of cash, diamond necklace, gold watch, passport, briefcase
Current location: Hotel room - safe area
"""
Marcus stuffed the stack of cash and the diamond necklace into the briefcase, snapping it shut. "That's our retirement," he said with a grim smile, heading for the door.
"""
WRONG OUTPUT:
{
  "reasoning": "Everything is still in the room technically.",
  "confirmed": ["stack of cash", "diamond necklace", "gold watch", "passport", "briefcase"],
  "removed": []
}
WHY THIS IS WRONG: Marcus took the briefcase (with the cash and necklace inside) and is leaving. These items are explicitly leaving the scene with him. The gold watch and passport aren't mentioned as taken. Correct: confirmed: ["gold watch", "passport"], removed: ["stack of cash", "diamond necklace", "briefcase"].

### Bad Example 8: Using Different Names Than Original Props
INPUT:
Current props: Smith & Wesson revolver, leather holster, box of ammunition
Current location: Gun shop - back room
"""
The detective examined the weapon carefully, a six-shooter in excellent condition. The holster was well-oiled leather, and there was plenty of ammo available.
"""
WRONG OUTPUT:
{
  "reasoning": "The items are described but with different names.",
  "confirmed": ["six-shooter", "well-oiled holster", "plenty of ammo"],
  "removed": ["Smith & Wesson revolver", "leather holster", "box of ammunition"]
}
WHY THIS IS WRONG: The same props are being renamed, not replaced. "Six-shooter" is the same as "Smith & Wesson revolver." Always use the original prop names in your confirmation. The correct output would confirm all original props with their original names.

### Bad Example 9: Making Assumptions About Off-Screen Areas
INPUT:
Current props: grand piano, music stand, metronome, sheet music, piano bench
Current location: Concert hall - main stage
"""
The intermission was announced and the audience filed out to the lobby for refreshments. The stage lights dimmed to a soft glow.
"""
WRONG OUTPUT:
{
  "reasoning": "The audience left, so maybe the stage equipment did too?",
  "confirmed": ["piano bench"],
  "removed": ["grand piano", "music stand", "metronome", "sheet music"]
}
WHY THIS IS WRONG: The audience leaving doesn't affect stage props. The grand piano, music stand, metronome, and sheet music would all remain on stage during intermission. Nothing indicates these items were removed. All props should be confirmed.

### Bad Example 10: Confirming Props After a Major Time Skip
INPUT:
Current props: birthday cake, party decorations, pile of presents, paper plates
Current location: Family home - living room
"""
Five years later, Elena returned to the house for the first time since her mother's funeral. The living room was exactly as she remembered and yet completely different - the same furniture, but without the warmth that had once filled it.
"""
WRONG OUTPUT:
{
  "reasoning": "Same house, so same props.",
  "confirmed": ["birthday cake", "party decorations", "pile of presents", "paper plates"],
  "removed": []
}
WHY THIS IS WRONG: Five years have passed! Birthday party items (cake, decorations, presents, paper plates) would absolutely not still be present. Only permanent fixtures or furniture might remain after such a time skip. All party-specific items should be removed.

### Bad Example 11: Removing Environmental Props
INPUT:
Current props: oak trees, park bench, gravel path, duck pond, weeping willow
Current location: City Park - eastern section
"""
Night had fallen over the park, the streetlights casting pools of yellow light along the paths. Sarah hurried toward the exit, unnerved by the darkness between the trees.
"""
WRONG OUTPUT:
{
  "reasoning": "It's dark now, can't see the trees or pond clearly.",
  "confirmed": ["park bench", "gravel path"],
  "removed": ["oak trees", "duck pond", "weeping willow"]
}
WHY THIS IS WRONG: Environmental features don't disappear at night. The trees, pond, and willow are still there even if less visible in darkness. Poor visibility doesn't remove props from the scene. All props should be confirmed.

### Bad Example 12: Literal vs Conceptual Removal
INPUT:
Current props: framed diploma, family photos, desk nameplate, motivational poster, potted plant
Current location: Corporate office - personal office
"""
"You're fired," the CEO said coldly. "Security will escort you out. You have ten minutes to collect your personal belongings."
"""
WRONG OUTPUT:
{
  "reasoning": "He's fired, so all his office stuff is conceptually no longer his.",
  "confirmed": [],
  "removed": ["framed diploma", "family photos", "desk nameplate", "motivational poster", "potted plant"]
}
WHY THIS IS WRONG: Being fired doesn't physically remove items from a location. The scene is still in the office, and all these items are still physically present. The character might pack some up, but that hasn't happened yet in this text. All props should be confirmed as still present until actually taken.
`;

export const propsConfirmationPrompt: PromptTemplate<ExtractedPropsConfirmation> = {
	name: 'props_confirmation',
	description: 'Confirm which props from the current list are still present in the scene',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentProps,
		PLACEHOLDERS.currentLocation,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterOutfits,
	],

	systemPrompt: `You are analyzing roleplay messages to confirm which props from the current list are still present in the scene.

## Your Task
Given the current props list and recent messages, determine:
1. Which props are CONFIRMED to still be present in the scene
2. Which props should be REMOVED (no longer present due to location change, destruction, being taken away, etc.)

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of which props remain and which are gone
- "confirmed": Array of prop names (using original names) that are still present
- "removed": Array of prop names that are no longer in the scene

## When to CONFIRM a Prop
- Scene is at the same location and prop would logically still be there
- Prop is explicitly mentioned or referenced
- No evidence suggests the prop was removed, destroyed, or taken
- Environmental features at the same outdoor location
- Fixed features at the same indoor location

## When to REMOVE a Prop
- Scene has moved to a different location (props from old location aren't here)
- Prop was explicitly destroyed (broken, burned, etc.)
- Prop was explicitly taken away by a character leaving the scene
- Prop was consumed/used up entirely
- Significant time has passed and prop is temporary (food, decorations, etc.)

## Important Rules
- Use the ORIGINAL prop names exactly as listed
- Don't add new props - only confirm or remove existing ones
- Don't modify prop descriptions (no "half-eaten food" instead of "food")
- If unsure, err on the side of confirming (props don't disappear randomly)
- Characters are not props - ignore any character names in the props list
- A prop not being mentioned doesn't mean it's gone
- Items currently WORN by characters (listed in Character Outfits) should be REMOVED from props - worn clothing is not a scene prop

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Current Location
{{currentLocation}}

## Current Props to Verify
{{currentProps}}

## Characters' Current Outfits (items here should NOT be confirmed as props)
{{characterOutfits}}

## Recent Messages
{{messages}}

## Task
Determine which props from the list are still present at this location and which should be removed.

Remember:
- Use original prop names exactly
- Location changes remove location-specific props
- Props don't disappear just because they're not mentioned
- Don't add new props, only confirm or remove existing ones
- If a prop matches something in "Current Outfits", it should be REMOVED (it's being worn, not a scene prop)`,

	responseSchema: propsConfirmationSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedPropsConfirmation | null {
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
		if (!Array.isArray(parsed.confirmed)) return null;
		if (!Array.isArray(parsed.removed)) return null;

		// Validate all items are strings
		if (!parsed.confirmed.every((item: unknown) => typeof item === 'string'))
			return null;
		if (!parsed.removed.every((item: unknown) => typeof item === 'string')) return null;

		return parsed as unknown as ExtractedPropsConfirmation;
	},
};
