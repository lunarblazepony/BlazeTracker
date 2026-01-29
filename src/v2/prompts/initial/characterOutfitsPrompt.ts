/**
 * Initial Character Outfits Extraction Prompt
 *
 * Extracts the outfits/clothing of characters present in the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedCharacterOutfits } from '../../types/extraction';
import { characterOutfitsSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Detailed Modern Outfit Description
INPUT:
"""
Elena: *Elena strides into the upscale restaurant, turning heads as she moves. Her crimson cocktail dress hugs her figure, the fabric shimmering under the crystal chandeliers. A delicate gold necklace with a small ruby pendant rests against her collarbone, matching the ruby studs in her ears. She's forgone a jacket despite the autumn chill, her bare arms showing goosebumps she refuses to acknowledge. Black stiletto heels click against the marble floor, and a small clutch purse dangles from her wrist by a thin gold chain. Her hair is swept up, revealing the elegant line of her neck.*

Marcus: *He rises from the corner booth as she approaches, straightening his charcoal suit jacket. His white dress shirt is crisp, the top button undone, no tie tonight. The silver cufflinks at his wrists catch the light as he extends his hand. His leather dress shoes are polished to a mirror shine.*
"""
OUTPUT:
{
  "reasoning": "Elena's outfit is described in detail: crimson cocktail dress (torso/legs combined as a dress), gold necklace with ruby pendant (neck), black stiletto heels (footwear), clutch purse (can be tracked as accessory but not a slot). No jacket mentioned as worn. No head covering. Marcus wears a charcoal suit - suit jacket (jacket), white dress shirt (torso), suit pants implied (legs), leather dress shoes (footwear). Cufflinks are accessories. Neither has explicitly described underwear, socks, or back items.",
  "outfits": [
    {
      "character": "Elena",
      "outfit": {
        "head": null,
        "neck": "gold necklace with ruby pendant",
        "jacket": null,
        "back": null,
        "torso": "crimson cocktail dress",
        "legs": "crimson cocktail dress",
        "footwear": "black stiletto heels",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Marcus",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "charcoal suit jacket",
        "back": null,
        "torso": "white dress shirt",
        "legs": "charcoal suit pants",
        "footwear": "polished leather dress shoes",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 2: Casual/Minimal Description with Defaults
INPUT:
"""
Jake: *Jake sprawls across the couch in his usual weekend uniform - a faded band t-shirt and sweatpants. His feet are bare, kicked up on the coffee table. He hasn't shaved in three days, and his hair is a mess, but who's going to see him? The only company he expects today is his cat.*

Sarah: *Sarah lets herself in with her spare key, still in her running clothes - sports bra, shorts, and sneakers. Her ponytail is soaked with sweat, and her face is flushed from the five-mile run.*

"Surprise visit," *she announces, heading straight for his kitchen.* "Please tell me you have water that isn't from the tap."
"""
OUTPUT:
{
  "reasoning": "Jake is described wearing a faded band t-shirt (torso) and sweatpants (legs). His feet are explicitly bare - no footwear, no socks. Sarah is in running clothes: sports bra (torso), shorts (legs), sneakers (footwear). She likely has socks with running shoes but they aren't mentioned. No jackets, head items, neck items, or back items for either.",
  "outfits": [
    {
      "character": "Jake",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "faded band t-shirt",
        "legs": "sweatpants",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Sarah",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "sports bra",
        "legs": "running shorts",
        "footwear": "sneakers",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 3: Fantasy/Medieval Clothing
INPUT:
"""
Narrator: *Sir Aldric stands at the castle gates, his armor gleaming in the morning sun. The knight wears a full suit of plate mail over a padded gambeson, the steel etched with the silver dragon of his house. A deep blue cloak billows behind him, clasped at his shoulder with a dragon-shaped brooch. His great helm is tucked under one arm, revealing his weathered face and close-cropped gray hair. Chainmail gauntlets protect his hands, and steel sabatons cover his feet.*

*Beside him, the young squire Thomas fidgets in his simpler attire - a brown leather jerkin over a homespun linen shirt, rough-spun wool breeches, and worn leather boots. A small dagger hangs from his belt, and a traveling pack is strapped to his back.*
"""
OUTPUT:
{
  "reasoning": "Sir Aldric wears medieval armor: plate mail with gambeson underneath (torso), plate leg armor implied (legs), great helm currently not worn/under arm (head is null since not wearing it), blue cloak (jacket/outer layer), steel sabatons (footwear), dragon brooch at shoulder (neck area). Thomas has leather jerkin over linen shirt (jacket and torso), wool breeches (legs), leather boots (footwear), and a traveling pack (back).",
  "outfits": [
    {
      "character": "Sir Aldric",
      "outfit": {
        "head": null,
        "neck": "dragon-shaped cloak brooch",
        "jacket": "deep blue cloak over plate armor",
        "back": "deep blue cloak",
        "torso": "plate mail over padded gambeson",
        "legs": "plate armor leg pieces",
        "footwear": "steel sabatons",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Thomas",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "brown leather jerkin",
        "back": "traveling pack",
        "torso": "homespun linen shirt",
        "legs": "rough-spun wool breeches",
        "footwear": "worn leather boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 4: Uniform/Professional Attire
INPUT:
"""
Officer Chen: *Officer Chen adjusts her duty belt as she exits the patrol car. The standard LAPD uniform is second skin after fifteen years - dark blue short-sleeve shirt with badge pinned to the chest, matching navy pants with the yellow stripe down the leg, black tactical boots. Her bulletproof vest adds bulk under the shirt. A radio is clipped to her shoulder, and her service weapon sits in the holster at her hip. Her peaked cap shades her eyes from the harsh California sun.*

Paramedic Walsh: *Walsh jogs over from the ambulance, his navy blue paramedic uniform already stained with sweat. The white cross on his sleeve identifies him as EMS. He wears latex gloves, and a stethoscope hangs around his neck. His boots are sensible - black, rubber-soled, built for running.*
"""
OUTPUT:
{
  "reasoning": "Officer Chen wears a complete police uniform: peaked cap (head), dark blue short-sleeve uniform shirt with vest underneath (torso), navy pants with yellow stripe (legs), black tactical boots (footwear). Radio and weapon are equipment, not clothing. Walsh has paramedic uniform: navy blue uniform shirt (torso), matching pants implied (legs), black rubber-soled boots (footwear), stethoscope around neck (neck). Gloves are disposable equipment.",
  "outfits": [
    {
      "character": "Officer Chen",
      "outfit": {
        "head": "LAPD peaked cap",
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "dark blue short-sleeve uniform shirt with bulletproof vest",
        "legs": "navy uniform pants with yellow stripe",
        "footwear": "black tactical boots",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Paramedic Walsh",
      "outfit": {
        "head": null,
        "neck": "stethoscope",
        "jacket": null,
        "back": null,
        "torso": "navy blue paramedic uniform shirt",
        "legs": "navy blue paramedic uniform pants",
        "footwear": "black rubber-soled boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 5: Layered Winter Clothing
INPUT:
"""
Yuki: *The Hokkaido winter is brutal, and Yuki has dressed accordingly. She's bundled in a thick down parka with a fur-lined hood pulled up over her wool beanie. A chunky knit scarf is wrapped multiple times around her neck, covering half her face. Underneath the parka, she wears a cable-knit sweater over a thermal undershirt. Her legs are protected by insulated snow pants over fleece leggings. Waterproof winter boots with thick rubber soles keep her feet dry, worn over two pairs of wool socks. Fleece-lined mittens complete the ensemble.*

*Her companion, Hiro, is less prepared - just a leather jacket over a hoodie, jeans, and sneakers. He's shivering visibly.*

"I told you to dress warmer," *Yuki says, her voice muffled by the scarf.*
"""
OUTPUT:
{
  "reasoning": "Yuki has multiple layers: wool beanie under parka hood (head), chunky knit scarf (neck), thick down parka with fur-lined hood (jacket), cable-knit sweater over thermal undershirt (torso), insulated snow pants over fleece leggings (legs), waterproof winter boots (footwear), two pairs of wool socks (socks). Mittens are accessories. Hiro has minimal layers: leather jacket (jacket), hoodie (could be considered jacket or torso layer), jeans (legs), sneakers (footwear). He's underdressed for winter.",
  "outfits": [
    {
      "character": "Yuki",
      "outfit": {
        "head": "wool beanie under fur-lined parka hood",
        "neck": "chunky knit scarf",
        "jacket": "thick down parka",
        "back": null,
        "torso": "cable-knit sweater over thermal undershirt",
        "legs": "insulated snow pants over fleece leggings",
        "footwear": "waterproof winter boots",
        "socks": "two pairs of wool socks",
        "underwear": null
      }
    },
    {
      "character": "Hiro",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "leather jacket over hoodie",
        "back": null,
        "torso": "hoodie",
        "legs": "jeans",
        "footwear": "sneakers",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 6: Swimwear/Beach Scene
INPUT:
"""
Carlos: *The private beach is paradise - white sand, crystal blue water, not another soul in sight. Carlos emerges from the waves, water streaming down his tanned chest. His red swim trunks cling to his thighs as he wades toward shore. A waterproof sports watch is his only accessory.*

Adriana: *Adriana looks up from her beach towel, lowering her oversized sunglasses just enough to appreciate the view. Her white bikini contrasts beautifully with her olive skin. A sheer sarong is tied loosely around her waist, fluttering in the ocean breeze. A wide-brimmed sun hat keeps her face in shadow, and a gold anklet glints on her left foot.*
"""
OUTPUT:
{
  "reasoning": "Beach/swimwear scene. Carlos is in red swim trunks only (legs) - no shirt, bare feet in the water. Watch is an accessory, not clothing. Adriana wears a white bikini (torso and legs/underwear), sheer sarong around waist (could be legs outer layer), wide-brimmed sun hat (head), oversized sunglasses (head accessory). Gold anklet is jewelry. Both are minimally dressed for the beach setting.",
  "outfits": [
    {
      "character": "Carlos",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": "red swim trunks",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Adriana",
      "outfit": {
        "head": "wide-brimmed sun hat and oversized sunglasses",
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "white bikini top",
        "legs": "white bikini bottom with sheer sarong",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 7: Sleepwear/Nighttime Scene
INPUT:
"""
Clara: *The scream wakes her at 3 AM. Clara bolts upright in bed, heart pounding, her silk nightgown twisted around her body. She fumbles for her glasses on the nightstand, then swings her legs over the edge of the bed, her bare feet hitting the cold hardwood floor. Without thinking to grab a robe, she runs into the hallway.*

Arthur: *Her husband is already there, standing outside their daughter's room. He's wearing nothing but his boxer briefs, his chest bare, his hair standing up in wild sleep-mussed spikes. He holds a baseball bat in a white-knuckled grip.*

"I heard it too," *he whispers.* "Stay behind me."
"""
OUTPUT:
{
  "reasoning": "Nighttime emergency scene with minimal clothing. Clara wears a silk nightgown (torso/legs as nightwear), bare feet explicitly mentioned. No robe - she didn't grab one. Arthur wears only boxer briefs (underwear/legs), bare chest, bare feet implied. Both are in sleepwear/minimal clothing appropriate for being woken suddenly at night.",
  "outfits": [
    {
      "character": "Clara",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "silk nightgown",
        "legs": "silk nightgown",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Arthur",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": "boxer briefs"
      }
    }
  ]
}

### Example 8: Victorian/Historical Period Dress
INPUT:
"""
Lady Pemberton: *Lady Amelia Pemberton descends the grand staircase of Ashworth Manor, her elaborate evening gown trailing behind her. The dress is a confection of midnight blue silk and black lace, with a fitted bodice that emphasizes her tiny corseted waist. Long white gloves cover her arms past the elbow. Her dark hair is piled high and secured with pearl-tipped pins, a matching pearl choker encircling her throat. The bustle of her skirt sways with each measured step, and her silk slippers barely peek from beneath the hem.*

*Her lady's maid, Mary, follows three steps behind, demure in her black dress with white apron and cap - the standard uniform of household staff. Her practical black boots are meant for long hours of standing and fetching.*
"""
OUTPUT:
{
  "reasoning": "Victorian era clothing. Lady Pemberton wears elaborate evening dress: pearl-tipped pins in hair (head), pearl choker (neck), midnight blue and black lace evening gown with corseted bodice (torso and legs), long white gloves, silk slippers (footwear). The corset is mentioned as part of the fitted bodice. Mary wears standard maid's uniform: white cap (head), black dress with white apron (torso and legs), practical black boots (footwear).",
  "outfits": [
    {
      "character": "Lady Pemberton",
      "outfit": {
        "head": "pearl-tipped hair pins",
        "neck": "pearl choker",
        "jacket": null,
        "back": null,
        "torso": "midnight blue silk evening gown with fitted corseted bodice and black lace",
        "legs": "midnight blue silk evening gown with bustle",
        "footwear": "silk slippers",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Mary",
      "outfit": {
        "head": "white maid's cap",
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "black dress with white apron",
        "legs": "black dress",
        "footwear": "practical black boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 9: Sci-Fi/Futuristic Attire
INPUT:
"""
Commander Vex: *Commander Vex stands at the helm of the Prometheus, her figure silhouetted against the starfield beyond the viewport. The standard issue naval uniform fits her perfectly - a form-fitting black jumpsuit with silver rank insignia on the collar and the ship's emblem on her left shoulder. Magnetic boots keep her anchored to the deck plating. A holographic interface band encircles her left wrist, constantly feeding her data streams.*

Engineer Kowalski: *Kowalski's head pops up from an open access panel, his face smeared with grease. He's stripped down to his tank top, the upper half of his orange maintenance jumpsuit tied around his waist by the sleeves. Heavy work boots with reinforced toes complete his practical ensemble. A tool belt hangs at his hip, various implements jangling with his movements.*
"""
OUTPUT:
{
  "reasoning": "Sci-fi setting with futuristic uniforms. Commander Vex wears a form-fitting black naval jumpsuit (torso and legs as one piece), magnetic boots (footwear), wrist interface band (accessory). The jumpsuit has rank insignia and ship emblem. Kowalski has his orange maintenance jumpsuit half off - tank top visible (torso), jumpsuit tied around waist (legs), heavy reinforced work boots (footwear). Tool belt is equipment.",
  "outfits": [
    {
      "character": "Commander Vex",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "form-fitting black naval jumpsuit with silver rank insignia",
        "legs": "form-fitting black naval jumpsuit",
        "footwear": "magnetic boots",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Kowalski",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "tank top",
        "legs": "orange maintenance jumpsuit tied around waist",
        "footwear": "heavy reinforced work boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 10: Partial/Interrupted Dressing
INPUT:
"""
David: *The knock on the dressing room door makes David jump, nearly dropping his bow tie. He's half-dressed for the wedding - crisp white dress shirt still unbuttoned, charcoal dress pants on but no belt yet, one black sock on and one foot still bare. His suit jacket and vest hang on the rack behind him, and his polished oxfords wait by the mirror.*

"Give me five minutes!" *he calls out, fumbling with the tiny buttons on his shirt.*

Best Man (through door): "The photographer wants everyone in position in three!"
"""
OUTPUT:
{
  "reasoning": "David is mid-dressing for a wedding. Currently wearing: white dress shirt unbuttoned (torso), charcoal dress pants without belt (legs), one black sock (partial socks). Items NOT yet on: jacket and vest on rack, shoes by mirror, bow tie in hand. Track what he's actually wearing, not what he will wear. Only one sock is on.",
  "outfits": [
    {
      "character": "David",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "unbuttoned white dress shirt",
        "legs": "charcoal dress pants",
        "footwear": null,
        "socks": "one black sock (right foot bare)",
        "underwear": null
      }
    }
  ]
}

### Example 11: Character with Minimal Description (Reasonable Inferences)
INPUT:
"""
Narrator: *The coffee shop is quiet this early in the morning. John sits at his usual table by the window, laptop open, coffee steaming beside him. He's a regular - always here by 6 AM, always orders a large black coffee, always tips well. Today he seems more tired than usual, dark circles under his eyes visible even from across the room.*

*The barista, a young woman with bright purple hair, wipes down the counter. She's been working here for three months and still doesn't know his name - he pays with cash, says little, leaves no trace except the slight warmth on the chair after he's gone.*
"""
OUTPUT:
{
  "reasoning": "Minimal clothing description - making specific inferences based on context. John is a regular working remotely at 6 AM in a coffee shop - suggests casual professional type, probably wearing something comfortable but presentable like a henley or casual button-down with jeans or chinos. For a man in casual shoes, dark ankle socks and boxer briefs are reasonable defaults. The barista has purple hair suggesting alternative/creative style - she's working so would have the shop's apron, probably wearing something like a fitted t-shirt and black jeans (common service industry attire), with comfortable non-slip work shoes. For a young woman on her feet all day, ankle socks and basic underwear are reasonable.",
  "outfits": [
    {
      "character": "John",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "gray henley shirt",
        "legs": "dark blue jeans",
        "footwear": "brown leather casual shoes",
        "socks": "charcoal ankle socks",
        "underwear": "dark boxer briefs"
      }
    },
    {
      "character": "the barista",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "coffee shop apron",
        "back": null,
        "torso": "black fitted t-shirt",
        "legs": "black skinny jeans",
        "footwear": "black non-slip work shoes",
        "socks": "black ankle socks",
        "underwear": "basic underwear"
      }
    }
  ]
}

### Example 12: Traditional/Cultural Dress
INPUT:
"""
Akiko: *The tea ceremony room is serene, filled with the soft rustle of silk. Akiko kneels on the tatami mat, her kimono a masterwork of pale pink silk with delicate cherry blossom embroidery. The obi at her waist is a deeper rose color, tied in an elaborate butterfly knot at her back. Traditional white tabi socks peek out beneath the hem, and wooden geta sandals wait by the entrance where she removed them. Her black hair is styled simply, held back with a single jade hairpin.*

*Across from her, her American guest, Tom, does his best to imitate her posture, though his borrowed yukata - a simple navy blue cotton robe - keeps threatening to come undone. He's clearly unused to sitting seiza style.*
"""
OUTPUT:
{
  "reasoning": "Traditional Japanese attire. Akiko wears a formal kimono: jade hairpin (head), pale pink silk kimono (torso and legs), rose obi sash (part of the outfit at waist), white tabi socks visible (socks). Geta sandals are by the entrance - she removed them, so footwear is null. The obi butterfly knot is at her back but that's part of the obi/kimono ensemble, not a separate back item. Tom wears a borrowed navy blue cotton yukata (torso and legs as a robe), sitting without footwear on tatami.",
  "outfits": [
    {
      "character": "Akiko",
      "outfit": {
        "head": "jade hairpin",
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "pale pink silk kimono with cherry blossom embroidery and rose obi",
        "legs": "pale pink silk kimono",
        "footwear": null,
        "socks": "white tabi socks",
        "underwear": null
      }
    },
    {
      "character": "Tom",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "navy blue cotton yukata",
        "legs": "navy blue cotton yukata",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 13: Mixed Levels of Description
INPUT:
"""
Maya: *Maya adjusts her vintage band tee - a faded Nirvana shirt she found at a thrift store last summer - and checks her reflection one more time. Her ripped black jeans are held together more by patches than original denim, and her combat boots have seen better days but she loves them anyway. A leather jacket is draped over her arm - too warm to wear inside but essential for the motorcycle ride home.*

Rico: *Her boyfriend Rico emerges from the back room, still wiping his hands on a rag. Whatever he's wearing is obscured by his heavy mechanic's apron, grease-stained and practical. His work boots are visible beneath the apron's hem.*

"Ready to go?" *Maya asks.*
"""
OUTPUT:
{
  "reasoning": "Maya has detailed description: faded Nirvana band t-shirt (torso), ripped black jeans with patches (legs), combat boots (footwear), leather jacket draped over arm (not wearing it, so jacket slot is null). Rico is mostly obscured by a mechanic's apron (covers torso/legs), work boots visible (footwear). The apron obscures whatever else he's wearing underneath.",
  "outfits": [
    {
      "character": "Maya",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "faded vintage Nirvana band t-shirt",
        "legs": "ripped black jeans with patches",
        "footwear": "worn combat boots",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Rico",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "mechanic's apron",
        "legs": "mechanic's apron",
        "footwear": "work boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 14: Pokémon and Ponies (Non-Clothed Species)
INPUT:
"""
[Character Card: Pikachu is a small, yellow, mouse-like Pokémon with red cheeks that store electricity. Loyal and energetic.]

Narrator: *The Ponyville library was quiet this afternoon. Twilight Sparkle levitated another book from the shelf, her purple coat gleaming in the sunlight streaming through the window. Her horn glowed with magical energy as she added it to the growing stack.*

*On the reading cushion nearby, Pikachu's ears perked up at a sound outside. The electric mouse Pokémon stretched, yellow fur bristling slightly, before settling back down with a contented "Pika..."*

*Twilight glanced over at her unusual guest, a smile crossing her muzzle.* "Comfortable, little one?"
"""
OUTPUT:
{
  "reasoning": "Twilight Sparkle is a pony (MLP) - she has a coat and mane, not clothes. Ponies don't wear clothes unless explicitly dressed. Pikachu is a Pokémon - it has yellow fur, not clothes. Neither is wearing anything. All slots should be null for both characters as they are non-clothed species.",
  "outfits": [
    {
      "character": "Twilight Sparkle",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Pikachu",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 15: Animal with Explicit Accessory (Exception Case)
INPUT:
"""
Narrator: *The golden retriever bounded across the park, her red collar jingling with each leap. Luna was the friendliest dog in the neighborhood, always eager to greet everyone she met. Today she wore a festive bandana around her neck - her owner had put it on for the Fourth of July celebration.*

*She skidded to a halt in front of Marcus, tail wagging furiously, tongue lolling out in a doggy grin.*
"""
OUTPUT:
{
  "reasoning": "Luna is a dog (non-clothed species), so most slots are null. However, she IS explicitly described wearing two items: a red collar and a festive bandana, both around her neck. These are the ONLY items to include - everything else is null because dogs don't wear clothes.",
  "outfits": [
    {
      "character": "Luna",
      "outfit": {
        "head": null,
        "neck": "red collar with festive Fourth of July bandana",
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}

### Example 16: Context-Based Inference (Setting Implies Attire)
INPUT:
"""
Narrator: *The construction site was in full swing - the skeleton of the new office building rising against the morning sky. Mike climbed down from the scaffolding, wiping sweat from his forehead. He'd been up there since dawn, and his stomach was starting to rumble.*

*He spotted his wife Linda walking across the site, carefully picking her way around the debris. She worked at the law firm across the street and had brought him lunch - he could see the paper bag in her hand.*

"You're a lifesaver," *he called out, grinning.*
"""
OUTPUT:
{
  "reasoning": "No explicit clothing described, but context strongly implies appropriate attire. Mike is a construction worker on an active job site - he would be wearing safety gear and work clothes: hard hat (required on sites), work boots (required), high-visibility vest or work shirt, sturdy pants like jeans or Carhartt-style work pants. Linda works at a law firm across the street - she'd be in professional attire: blouse or dress shirt, dress pants or pencil skirt, professional shoes like flats or low heels. Both would have standard underwear appropriate to their clothing.",
  "outfits": [
    {
      "character": "Mike",
      "outfit": {
        "head": "yellow hard hat",
        "neck": null,
        "jacket": "high-visibility safety vest",
        "back": null,
        "torso": "worn work t-shirt",
        "legs": "tan work pants",
        "footwear": "steel-toed work boots",
        "socks": "thick work socks",
        "underwear": "boxer briefs"
      }
    },
    {
      "character": "Linda",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "white silk blouse",
        "legs": "charcoal pencil skirt",
        "footwear": "black leather flats",
        "socks": "nude pantyhose",
        "underwear": "underwear"
      }
    }
  ]
}

### Example 17: Multiple Settings Imply Different Attire
INPUT:
"""
Narrator: *The five-star restaurant was packed for Saturday night. At the corner table, Richard and his daughter Emma celebrated her college acceptance. The maître d' had given them one of the best spots - right by the window overlooking the city lights.*

*Meanwhile, in the alley behind the restaurant, dishwasher Tony stepped out for a smoke break. Another long shift ahead of him.*

*Back inside, their waitress approached the table with menus.*
"""
OUTPUT:
{
  "reasoning": "High-end restaurant setting implies formal attire for diners. Richard is celebrating a special occasion at a five-star restaurant - he'd be wearing a suit or at minimum dress shirt and slacks. Emma is a young woman (college age) at an upscale dinner - nice dress or elegant top with dress pants. Tony is a dishwasher on shift - kitchen workers wear practical, often provided uniforms: chef pants, work shirt, non-slip shoes, likely an apron. The waitress at a five-star establishment would have a formal uniform - typically black dress pants, white dress shirt, sometimes a vest or tie.",
  "outfits": [
    {
      "character": "Richard",
      "outfit": {
        "head": null,
        "neck": "silk tie",
        "jacket": "charcoal suit jacket",
        "back": null,
        "torso": "white dress shirt",
        "legs": "charcoal suit pants",
        "footwear": "polished black leather oxfords",
        "socks": "black dress socks",
        "underwear": "boxer briefs"
      }
    },
    {
      "character": "Emma",
      "outfit": {
        "head": null,
        "neck": "simple silver necklace",
        "jacket": null,
        "back": null,
        "torso": "elegant navy cocktail dress",
        "legs": "elegant navy cocktail dress",
        "footwear": "strappy heels",
        "socks": null,
        "underwear": "underwear"
      }
    },
    {
      "character": "Tony",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "stained kitchen apron",
        "back": null,
        "torso": "white kitchen t-shirt",
        "legs": "black kitchen pants",
        "footwear": "black non-slip kitchen shoes",
        "socks": "black socks",
        "underwear": "boxers"
      }
    },
    {
      "character": "the waitress",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "black server vest",
        "back": null,
        "torso": "crisp white dress shirt",
        "legs": "black dress pants",
        "footwear": "black flats",
        "socks": "black ankle socks",
        "underwear": "underwear"
      }
    }
  ]
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Inventing SPECIFIC Items Without Basis
INPUT:
"""
Alex sat at the bar, nursing a whiskey. The place was nearly empty - just him and the bartender and the weight of too many memories. The jukebox in the corner played something sad and slow. He'd been coming here every night for a week now, ever since the divorce was finalized. The bartender - a gruff older man who'd seen it all - refilled his glass without being asked.
"""
WRONG OUTPUT:
{
  "reasoning": "Alex is at a bar, probably wearing typical bar attire.",
  "outfits": [
    {
      "character": "Alex",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "black leather jacket",
        "back": null,
        "torso": "white t-shirt",
        "legs": "blue jeans",
        "footwear": "sneakers",
        "socks": "white athletic socks",
        "underwear": "boxer briefs"
      }
    }
  ]
}
WHY THIS IS WRONG: While reasonable inference IS encouraged, the SPECIFIC items here are too detailed without basis. Why "black leather jacket" instead of any other jacket? Why "white t-shirt"? There's no context to prefer these specific items. Better approach: use generic inferences like "casual shirt", "pants", "shoes" OR if you infer specific items, explain why based on context (e.g., "dive bar suggests casual wear"). Socks/underwear inference IS reasonable for a clothed adult.

### Bad Example 2: Wrong Slot Assignment
INPUT:
"""
Sophie wore her grandmother's pearl necklace with the antique clasp. Over her shoulders was draped a vintage fur stole, clearly a treasured heirloom. Her feet were tucked into fuzzy bunny slippers, and thick wool socks kept her toes warm. A silk headscarf, tied under her chin, protected her hair from the wind.
"""
WRONG OUTPUT:
{
  "reasoning": "Sophie has several accessories and clothing items.",
  "outfits": [
    {
      "character": "Sophie",
      "outfit": {
        "head": "pearl necklace",
        "neck": "silk headscarf",
        "jacket": "fuzzy bunny slippers",
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": "fur stole",
        "socks": "thick wool socks",
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: All the slot assignments are wrong. Pearl necklace goes on neck, not head. Silk headscarf goes on head, not neck. Fur stole could be jacket or back. Bunny slippers are footwear, not jacket. The slots need to match what the clothing item actually covers.

### Bad Example 3: Missing Characters
INPUT:
"""
The runway show was in full swing. Supermodel Katya strode down the catwalk in a shimmering gold gown that left little to the imagination - plunging neckline, thigh-high slit, and a train that seemed to go on forever. Diamond earrings caught the light with every step. Behind the curtain, designer Marcus Feng watched nervously, adjusting his signature round glasses and smoothing his black turtleneck. The makeup artist, Bree, put finishing touches on the next model - a young newcomer named Jade who fidgeted in her avant-garde feathered ensemble.
"""
WRONG OUTPUT:
{
  "reasoning": "Katya is the main model described.",
  "outfits": [
    {
      "character": "Katya",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "shimmering gold gown with plunging neckline",
        "legs": "shimmering gold gown with thigh-high slit",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The output only includes Katya but misses Marcus Feng (black turtleneck, round glasses), Bree (not described but present), and Jade (feathered ensemble). All characters with described outfits should be included.

### Bad Example 4: Confusing Held Items with Worn Items
INPUT:
"""
Detective Shaw stood in the rain, umbrella in one hand, badge in the other. Her trenchcoat was soaked through, water dripping from the hem onto her already ruined leather boots. A fedora would have been useful, but she'd left it in the car. Her backup piece was strapped to her ankle, hidden under her slacks.
"""
WRONG OUTPUT:
{
  "reasoning": "Detective Shaw has an umbrella, badge, and various clothing.",
  "outfits": [
    {
      "character": "Detective Shaw",
      "outfit": {
        "head": "umbrella",
        "neck": "badge",
        "jacket": "trenchcoat",
        "back": null,
        "torso": null,
        "legs": "slacks",
        "footwear": "ruined leather boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The umbrella is held, not worn on head. The badge is held in hand, not worn around neck. The fedora is mentioned but explicitly left in the car - she's not wearing it. Only actually worn items should be in slots: trenchcoat (jacket), slacks (legs), leather boots (footwear).

### Bad Example 5: Duplicate Items in Wrong Slots
INPUT:
"""
The bride was radiant in her white wedding gown, the long train flowing behind her. Delicate lace sleeves covered her arms, and a cathedral veil cascaded from her upswept hair.
"""
WRONG OUTPUT:
{
  "reasoning": "The bride wears a wedding gown.",
  "outfits": [
    {
      "character": "the bride",
      "outfit": {
        "head": "cathedral veil and white wedding gown",
        "neck": "lace from wedding gown",
        "jacket": "lace sleeves from wedding gown",
        "back": "wedding gown train",
        "torso": "white wedding gown bodice",
        "legs": "white wedding gown skirt",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The wedding gown is one garment being split artificially across multiple slots. It should be listed as the torso and legs item (it's a dress). The veil goes on head. The lace sleeves are part of the gown, not a separate jacket. Don't fragment a single garment across every slot.

### Bad Example 6: Including Removed or Changed Clothing
INPUT:
"""
Marcus threw his wet shirt into the corner, disgusted. The rainstorm had soaked him through. Now he stood shirtless, digging through his closet for something dry. His jeans were still damp but bearable. He kicked off his waterlogged sneakers, grimacing at the squelching sound. A fresh hoodie caught his eye - perfect.
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus was wearing a shirt and sneakers, now looking for a hoodie.",
  "outfits": [
    {
      "character": "Marcus",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "hoodie",
        "back": null,
        "torso": "wet shirt",
        "legs": "damp jeans",
        "footwear": "waterlogged sneakers",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The wet shirt was thrown in the corner - he's shirtless now. The sneakers were kicked off - he's not wearing them. The hoodie caught his eye but he hasn't put it on yet. Current state: shirtless (torso null), damp jeans (legs), no footwear.

### Bad Example 7: Wrong Character Names
INPUT:
"""
Sergeant Major Price checked his tactical vest one more time. The desert camo fatigues were standard issue, same as the tan combat boots. A balaclava covered the lower half of his face - old habits from covert ops days. Beside him, the rookie they called "Ghost" adjusted his own gear - identical fatigues, but his nervous energy gave away his inexperience.
"""
WRONG OUTPUT:
{
  "reasoning": "Military personnel with tactical gear.",
  "outfits": [
    {
      "character": "The Sergeant",
      "outfit": {
        "head": "balaclava",
        "neck": null,
        "jacket": "tactical vest",
        "back": null,
        "torso": "desert camo fatigues",
        "legs": "desert camo fatigues",
        "footwear": "tan combat boots",
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Rookie",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "fatigues",
        "legs": "fatigues",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The characters' names are wrong. It's "Sergeant Major Price" (or just "Price"), not "The Sergeant." It's "Ghost" (the rookie's nickname), not just "Rookie." Use the names as given in the text.

### Bad Example 8: Vague or Incomplete Descriptions
INPUT:
"""
Nina looked stunning in her vintage 1950s dress - a classic rockabilly number with a sweetheart neckline, fitted bodice, and full circle skirt in cherry red with white polka dots. She'd paired it with a white cardigan, red patent leather heels, and a matching red headband in her black curls.
"""
WRONG OUTPUT:
{
  "reasoning": "Nina is in vintage clothing.",
  "outfits": [
    {
      "character": "Nina",
      "outfit": {
        "head": "headband",
        "neck": null,
        "jacket": "cardigan",
        "back": null,
        "torso": "dress",
        "legs": "dress",
        "footwear": "heels",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The descriptions are too vague when detailed information is available. It should be "red headband" not just "headband", "white cardigan" not just "cardigan", "cherry red 1950s rockabilly dress with white polka dots and sweetheart neckline" not just "dress", "red patent leather heels" not just "heels".

### Bad Example 9: Treating Accessories as Clothing Slots
INPUT:
"""
The thief was dressed for stealth - all black, from his ski mask to his soft-soled shoes. Night vision goggles were pushed up on his forehead. A utility belt hung heavy with tools at his waist. Fingerless gloves protected his hands while maintaining dexterity. A grappling hook was clipped to his back.
"""
WRONG OUTPUT:
{
  "reasoning": "Thief in all-black stealth gear.",
  "outfits": [
    {
      "character": "the thief",
      "outfit": {
        "head": "ski mask and night vision goggles",
        "neck": "utility belt",
        "jacket": "fingerless gloves",
        "back": "grappling hook",
        "torso": "black outfit",
        "legs": "black outfit",
        "footwear": "soft-soled shoes",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The utility belt is worn at the waist, not the neck. Fingerless gloves aren't a jacket - they're hand accessories. The grappling hook is equipment clipped to the back, not a worn back item. Night vision goggles are on the forehead (head). The correct assignment: ski mask and goggles (head), some kind of black top (torso), black pants (legs), soft-soled shoes (footwear), null for neck/jacket/back.

### Bad Example 10: Ignoring Layered Clothing
INPUT:
"""
Professor Williams tugged at his bow tie - he never could get it straight. His tweed jacket was a size too large, deliberately chosen to hide the bulletproof vest he wore underneath his white oxford shirt. Wool trousers and brown brogues completed the absentminded academic look, though his eyes held a sharpness that belied the costume.
"""
WRONG OUTPUT:
{
  "reasoning": "Professor Williams is dressed as an academic.",
  "outfits": [
    {
      "character": "Professor Williams",
      "outfit": {
        "head": null,
        "neck": "bow tie",
        "jacket": "tweed jacket",
        "back": null,
        "torso": "white oxford shirt",
        "legs": "wool trousers",
        "footwear": "brown brogues",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The bulletproof vest is missing! It's mentioned as worn underneath the oxford shirt. The torso should mention both the vest and the shirt (e.g., "white oxford shirt over bulletproof vest" or include the vest in the description).

### Bad Example 11: Wrong Gender/Context Assumptions
INPUT:
"""
Ash sat on the park bench, feeding the pigeons. Their oversized flannel shirt hung loose over ripped jeans. Doc Martens were laced up tight, and a beanie covered their shaved head. A rainbow pin on the shirt pocket was the only spot of color.
"""
WRONG OUTPUT:
{
  "reasoning": "Ash is a woman wearing casual clothing.",
  "outfits": [
    {
      "character": "Ash",
      "outfit": {
        "head": "beanie over her long hair",
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "oversized flannel shirt with rainbow pin",
        "legs": "ripped jeans",
        "footwear": "Doc Martens",
        "socks": null,
        "underwear": "bra and panties"
      }
    }
  ]
}
WHY THIS IS WRONG: The text uses "their" pronouns and explicitly mentions a "shaved head" - the output incorrectly says "her long hair." Don't make gender assumptions that contradict the text. For underwear, generic "underwear" is a reasonable inference, but "bra and panties" assumes gender. Better: beanie over shaved head (not "her long hair"), and use gender-neutral "underwear" if inferring.

### Bad Example 12: Treating Character Card Descriptions as Current Outfit
INPUT:
"""
[Character Card: Elena is a spy who typically wears sleek black tactical gear, leather boots, and keeps her hair in a tight bun. She carries multiple concealed weapons.]

Elena: *Elena emerges from the bathroom in a hotel bathrobe, toweling off her wet hair. The mission briefing can wait - she hasn't slept in thirty-six hours. She collapses onto the bed, not even bothering to close the curtains.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is a spy who wears tactical gear and leather boots.",
  "outfits": [
    {
      "character": "Elena",
      "outfit": {
        "head": "hair in tight bun",
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "sleek black tactical gear",
        "legs": "sleek black tactical gear",
        "footwear": "leather boots",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: The current scene shows Elena in a hotel bathrobe with wet hair - she just got out of the shower. The character card describes her typical attire, but that's not what she's wearing RIGHT NOW. Current outfit: hotel bathrobe (torso/legs), wet hair down (head is null - no hair accessory), barefoot implied.

### Bad Example 13: Giving Clothes to Non-Clothed Species
INPUT:
"""
[Character Card: Eevee is a small, fox-like Pokémon with brown fur and a fluffy cream-colored tail and mane. Curious and playful.]

Narrator: *Eevee bounded through the tall grass, her brown fur rippling in the breeze. The little Pokémon's ears perked up at a rustling sound nearby - maybe another friend to play with?*

*She crouched low, fluffy tail swishing back and forth, ready to pounce.*
"""
WRONG OUTPUT:
{
  "reasoning": "Eevee is a small Pokémon, so she'd be wearing something appropriate for her size.",
  "outfits": [
    {
      "character": "Eevee",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "brown fur coat",
        "legs": "brown fur",
        "footwear": "small paws",
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: Eevee is a Pokémon - a non-clothed species. Her "brown fur" is her BODY, not clothing. "Small paws" are not footwear. Pokémon, ponies, and animals don't wear clothes by default. ALL slots should be null unless the character is EXPLICITLY described wearing something (like a collar, costume, or accessory). Correct output: all slots null.

### Bad Example 14: Inferring Clothes for Ponies
INPUT:
"""
Narrator: *Rainbow Dash zoomed through the clouds above Ponyville, her rainbow mane and tail streaming behind her. The cyan pegasus performed a quick barrel roll, showing off for anypony who might be watching below.*

"Twenty percent cooler," *she muttered to herself with a smirk.*
"""
WRONG OUTPUT:
{
  "reasoning": "Rainbow Dash is flying so she'd need appropriate athletic wear.",
  "outfits": [
    {
      "character": "Rainbow Dash",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": "Wonderbolts flight suit",
        "back": null,
        "torso": "athletic top",
        "legs": "athletic shorts",
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: Rainbow Dash is an MLP pony. Ponies have coats, manes, and tails - these are NOT clothes. She isn't described wearing her Wonderbolts uniform in this scene. Ponies don't wear "athletic wear" by default - they're naturally unclothed. ALL slots should be null. Only include items if EXPLICITLY mentioned (like if she were wearing her Wonderbolts suit or a costume).

### Bad Example 15: Meta-Commentary Instead of Actual Items
INPUT:
"""
Marcus walked into the office, coffee in hand. He wore a crisp blue dress shirt tucked into gray slacks, with polished oxford shoes. His tie was slightly loosened - it had been a long day already.
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is dressed in business casual attire for an office setting.",
  "outfits": [
    {
      "character": "Marcus",
      "outfit": {
        "head": null,
        "neck": "loosened tie",
        "jacket": null,
        "back": null,
        "torso": "crisp blue dress shirt",
        "legs": "gray slacks",
        "footwear": "polished oxford shoes",
        "socks": "socks (implied with dress shoes)",
        "underwear": "assumed underwear suitable for a human male"
      }
    }
  ]
}
WHY THIS IS WRONG: The socks and underwear fields contain meta-commentary about assumptions ("implied", "assumed", "suitable for") instead of actual item descriptions. When making reasonable inferences, just write the specific item: "black dress socks", "dark boxer briefs" - NOT explanations of why you're inferring them. Note: State parentheticals like "white dress shirt (top button undone)" or "jeans (ripped at knees)" ARE acceptable because they describe the item's current state, not your reasoning process.

### Bad Example 16: Parenthetical Qualifiers on Inferred Items
INPUT:
"""
Sarah stretched on her yoga mat, adjusting her sports bra and leggings. The morning sun warmed the studio as she moved into downward dog.
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is doing yoga in athletic wear.",
  "outfits": [
    {
      "character": "Sarah",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": "sports bra",
        "legs": "leggings",
        "footwear": "barefoot (typical for yoga)",
        "socks": "none (barefoot for yoga)",
        "underwear": "athletic underwear (assumed under leggings)"
      }
    }
  ]
}
WHY THIS IS WRONG: Don't add parenthetical explanations about your reasoning like "(typical for yoga)", "(assumed under leggings)", or "(pool setting)". If she's barefoot, footwear is null. If you're inferring underwear, just write the specific item like "seamless athletic briefs" - not "athletic underwear (assumed under leggings)". State descriptions ARE allowed: "sports bra (sweat-stained)" or "leggings (high-waisted)" are fine because they describe the item, not your assumptions.

### Bad Example 17: Writing "nothing" or Descriptive Absence Instead of null
INPUT:
"""
Derek stepped out of the shower, towel wrapped around his waist. Steam followed him into the bedroom as he searched for clean clothes.
"""
WRONG OUTPUT:
{
  "reasoning": "Derek just got out of the shower, only wearing a towel.",
  "outfits": [
    {
      "character": "Derek",
      "outfit": {
        "head": "nothing",
        "neck": "none",
        "jacket": "nothing",
        "back": "bare",
        "torso": "topless",
        "legs": "towel wrapped around waist",
        "footwear": "barefoot",
        "socks": "none",
        "underwear": "nothing underneath towel"
      }
    }
  ]
}
WHY THIS IS WRONG: Use null for empty slots, not words like "nothing", "none", "bare", "topless", or "barefoot". These are not clothing items. The correct output would have null for head, neck, jacket, back, torso, footwear, socks, and underwear - with only legs having "towel wrapped around waist".

### Bad Example 18: Assuming Naked Because Clothing Wasn't Explicitly Specified
INPUT:
"""
Narrator: *The morning sun streamed through the kitchen window as James poured himself a cup of coffee. His wife Rachel was already at the table, reading the newspaper and eating toast. Their teenage son Tyler stomped down the stairs, still half-asleep, and grabbed an apple from the fruit bowl.*

"Don't forget you have soccer practice after school," *Rachel reminded him without looking up.*
"""
WRONG OUTPUT:
{
  "reasoning": "No clothing is described for any character, so I cannot make assumptions. They could be wearing anything or nothing.",
  "outfits": [
    {
      "character": "James",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Rachel",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Tyler",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: This is a normal family morning scene - a father with coffee, mother reading the newspaper, teenager heading to school with soccer practice later. Just because their clothing isn't explicitly described doesn't mean they're naked! Make reasonable inferences: James would have casual morning clothes (t-shirt/henley, pajama pants or jeans, maybe slippers). Rachel reading the paper at breakfast would be similarly dressed casually. Tyler is a teenager going to school - he'd be dressed for school (t-shirt, jeans, sneakers). Returning all-null outfits implies they're naked, which is absurd for a mundane domestic scene. ALWAYS infer appropriate clothing from context - humans wear clothes!

### Bad Example 19: Refusing to Infer Professional Attire
INPUT:
"""
Narrator: *Dr. Martinez reviewed the patient's chart one more time before entering the exam room. Behind the reception desk, nurse practitioner Karen typed notes into the computer system. In the waiting room, Mr. Henderson flipped through a magazine, nervously bouncing his leg.*

"Mr. Henderson? The doctor will see you now," *Karen called out.*
"""
WRONG OUTPUT:
{
  "reasoning": "The text doesn't describe what anyone is wearing. I can only report what is explicitly stated.",
  "outfits": [
    {
      "character": "Dr. Martinez",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Karen",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    },
    {
      "character": "Mr. Henderson",
      "outfit": {
        "head": null,
        "neck": null,
        "jacket": null,
        "back": null,
        "torso": null,
        "legs": null,
        "footwear": null,
        "socks": null,
        "underwear": null
      }
    }
  ]
}
WHY THIS IS WRONG: This is a medical office with clearly defined professional roles. Context STRONGLY implies attire: Dr. Martinez is a doctor reviewing charts - white coat over professional clothes. Karen is a nurse practitioner at the reception desk - scrubs or professional medical attire. Mr. Henderson is a patient in a waiting room - regular civilian clothes. Healthcare professionals wear recognizable professional attire. Returning null for everything implies everyone in the doctor's office is naked - completely inappropriate when context provides clear professional setting cues. INFER from context!
`;

export const initialCharacterOutfitsPrompt: PromptTemplate<ExtractedCharacterOutfits> = {
	name: 'initial_character_outfits',
	description: 'Extract the outfits of characters present in the opening of a roleplay',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.characterName,
		PLACEHOLDERS.characterDescription,
		PLACEHOLDERS.userName,
		PLACEHOLDERS.userDescription,
		PLACEHOLDERS.charactersPresent,
	],

	systemPrompt: `You are analyzing roleplay messages to extract what characters are wearing.

## Your Task
Read the provided roleplay messages and determine what each present character is wearing. Extract outfit information for each character into the defined clothing slots.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of each character's described clothing
- "outfits": An array of outfit objects, each with:
  - "character": The character's name
  - "outfit": An object with slots (each slot is a string description or null if nothing/not described)

## Outfit Slots
- **head**: Hats, headbands, hair accessories, helmets, hoods, etc.
- **neck**: Necklaces, scarves, chokers, collars, ties, bowties, etc.
- **jacket**: Outer layer - jackets, coats, cardigans, cloaks, vests worn over shirts
- **back**: Backpacks, bags, capes, wings, quivers, etc.
- **torso**: Main upper body clothing - shirts, blouses, dresses (upper), tank tops, bras
- **legs**: Lower body - pants, skirts, shorts, dresses (lower), swimsuit bottoms
- **footwear**: Shoes, boots, sandals, slippers, etc.
- **socks**: Socks, stockings, tights, etc.
- **underwear**: Undergarments when visible or explicitly mentioned

## Important Rules
1. **Make reasonable inferences where information is not explicit** - If someone is at a formal dinner, they're probably wearing appropriate attire
2. **Include underwear/socks with reasonable assumptions for clothed HUMAN characters** - Someone in jeans and sneakers likely has socks; someone in a dress likely has underwear
3. **Track current state, not past or future** - Removed clothing doesn't count; clothes being "put on later" don't count yet
4. **Dresses/robes span multiple slots** - A dress covers torso and legs; describe it in both
5. **Be specific when details are given** - "red silk dress" not just "dress"
6. **Layers matter** - Note when items are worn over/under others
7. **Equipment vs clothing** - Weapons, tools, held items are NOT clothing
8. **Removed items don't count** - If they took it off, it's not part of their outfit
9. **Character card CAN inform defaults** - If character is described as "always wears X", use that when nothing else is specified
10. **Use correct slot assignment** - Necklaces go on neck, not head; shoes go on feet, not hands

## Non-Clothed Species (ALL SLOTS NULL unless explicitly dressed)
- **Pokémon** (non-anthro): Pikachu, Eevee, Charizard, etc. have fur/scales, NOT clothes. All slots null.
- **Ponies** (MLP-style): Twilight Sparkle, Rainbow Dash, etc. have coats, NOT clothes. All slots null.
- **Animals** (non-anthro): Dogs, cats, horses, wolves, etc. All slots null.
- **Exception**: If explicitly described wearing something (a collar, a saddle, a costume), include ONLY that item.
- Fur, scales, feathers, and natural body coverings are NOT outfit items.

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}
Description: {{characterDescription}}

## User/Persona Context
Name: {{userName}}
Description: {{userDescription}}

## Characters Present
{{charactersPresent}}

## Messages to Analyze
{{messages}}

## Task
For each character present in the scene, extract their current outfit. For each clothing slot:
- Describe the item if it's mentioned or clearly visible
- Make reasonable inferences for unmentioned items (socks with sneakers, underwear under clothes)
- Be specific with colors, materials, and styles when the text provides them
- Use character card descriptions as defaults when scene doesn't specify
- Use persona description for the user character's outfit when not specified in scene

Remember:
- Only include clothing that is CURRENTLY being worn
- Make reasonable assumptions for clothed human characters (they likely have underwear, socks with shoes)
- A single garment (like a dress) can span multiple slots
- Equipment and held items are NOT clothing
- The user/persona description can provide default outfit information for {{userName}}`,

	responseSchema: characterOutfitsSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedCharacterOutfits | null {
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
		if (!Array.isArray(parsed.outfits)) return null;

		// Validate each outfit entry has character name and outfit object
		for (const entry of parsed.outfits) {
			if (typeof entry !== 'object' || entry === null) return null;
			const e = entry as Record<string, unknown>;
			if (typeof e.character !== 'string') return null;
			if (typeof e.outfit !== 'object' || e.outfit === null) return null;
		}

		return parsed as unknown as ExtractedCharacterOutfits;
	},
};
