/**
 * Initial Climate Extraction Prompt
 *
 * Extracts the initial climate (temperature, weather conditions) from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialClimate } from '../../types/extraction';
import { initialClimateSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Explicit Temperature Mention
INPUT:
"""
Elena: *The thermometer on the porch reads 87 degrees as Elena fans herself with a folded newspaper. The August heat is oppressive, the kind that makes you feel like you're breathing through a wet blanket. She's sitting on the front steps of her grandmother's farmhouse, watching heat mirages shimmer on the distant highway. The cicadas are deafening, their chorus rising and falling in waves. Inside the house, the ancient air conditioner wheezes and rattles, fighting a losing battle against the relentless sun. Elena takes another sip of her lemonade, the ice long since melted. Sweat trickles down her back despite the thin cotton sundress she's wearing. The sky is a pale, washed-out blue, not a cloud in sight.*
"""
OUTPUT:
{
  "reasoning": "The text explicitly states 'The thermometer on the porch reads 87 degrees' which gives us the temperature directly. The scene is outdoors ('sitting on the front steps', 'porch'). The conditions are described as clear ('not a cloud in sight') and extremely hot ('oppressive heat', 'relentless sun').",
  "temperature": 87,
  "conditions": "Clear, sunny, oppressively hot",
  "isIndoors": false
}

### Example 2: Winter Storm with Cold Temperature Inference
INPUT:
"""
Marcus: *The blizzard howls outside the cabin windows, snow piling against the glass in thick, wind-driven drifts. Marcus adds another log to the fire, watching the flames dance and crackle. The cabin's old walls creak under the assault of wind that must be gusting to fifty miles an hour. He checks his phone - still no signal, not that he expected one. The storm had been building all day, and now at its peak, visibility outside is near zero. He can barely make out the outline of his truck buried under a growing mound of white. The windows are frosted at the edges despite the roaring fire, and his breath would fog if he stepped more than ten feet from the hearth. The temperature outside had dropped to well below zero before the weather station went silent.*
"""
OUTPUT:
{
  "reasoning": "The text mentions 'well below zero' temperature before the weather station went silent, indicating sub-zero Fahrenheit conditions. However, the character is indoors in a cabin with a fire. The outdoor conditions are a severe blizzard with high winds and near-zero visibility. Since we're tracking scene climate and the character is indoors, I'll note indoors but the outdoor temperature context suggests around -10F to -20F for 'well below zero'.",
  "temperature": -15,
  "conditions": "Blizzard, heavy snow, high winds, near-zero visibility",
  "isIndoors": true
}

### Example 3: Rainy Urban Scene
INPUT:
"""
Detective Shaw: *Rain hammers against the windows of the precinct, the kind of cold November downpour that seeps into your bones and refuses to let go. Detective Shaw watches the drops race each other down the glass, her coffee growing cold in her hands. The city beyond is a blur of gray - gray buildings, gray sky, gray pavement slick with water. Lightning flashes in the distance, followed seconds later by a roll of thunder that makes the overhead lights flicker. She turns back to the case files spread across her desk, the photos of the crime scene already feeling like artifacts from another world. The rain makes everything feel isolated, contained, as if the precinct is a ship adrift in a storm-tossed sea. A colleague rushes in from outside, umbrella inverted and useless, shoes squelching with every step.*
"""
OUTPUT:
{
  "reasoning": "The scene is indoors (precinct, desk) but describes heavy rain, thunder and lightning outside. It's November, described as cold rain that 'seeps into your bones'. November in a city with this type of weather would typically be around 40-50F. The conditions are stormy with heavy rain and thunderstorms.",
  "temperature": 45,
  "conditions": "Heavy rain, thunderstorm, cold and gray",
  "isIndoors": true
}

### Example 4: Hot Desert Setting
INPUT:
"""
Zara: *The sun beats down mercilessly on the vast expanse of sand, each grain seeming to radiate heat back upward in shimmering waves. Zara adjusts her headscarf, trying to shield her neck from the relentless burning. The camel beneath her plods steadily forward, its feet somehow finding purchase on the shifting dunes. There's no shade for miles, no relief from the hammer of solar radiation that's been pounding them since dawn. Her water skin is half empty, and the next oasis is still a day's journey away. The sky is a perfect, cruel blue, not a single cloud to offer even momentary respite. Zara can feel her lips cracking despite the balm she applied this morning. The temperature must be well over a hundred degrees - the kind of heat that kills the unprepared.*
"""
OUTPUT:
{
  "reasoning": "This is an outdoor desert scene with extreme heat. The text states 'the temperature must be well over a hundred degrees' and describes merciless sun, shimmering heat waves, and cracking lips from dehydration. Desert temperatures matching this description would be around 105-115F. Conditions are clear and extremely sunny with no clouds.",
  "temperature": 110,
  "conditions": "Clear, extremely sunny, desert heat with no shade",
  "isIndoors": false
}

### Example 5: Character Reaction Inferring Temperature
INPUT:
"""
James: *James stamps his feet on the doormat, trying to restore feeling to his frozen toes. His breath comes out in thick white clouds as he fumbles with numb fingers for his keys. The walk from the bus stop was only ten minutes, but his ears are already aching from the cold, and he can feel ice crystals forming in his nostrils with each breath. The apartment building's door is warm to the touch when he finally gets it open - a small mercy. Inside, the lobby is heated, and the sudden contrast makes his cheeks flush painfully as blood rushes back to his face. He checks the weather app on his phone: 12 degrees with wind chill making it feel like negative five. No wonder the streets were empty.*
"""
OUTPUT:
{
  "reasoning": "The weather app shows '12 degrees with wind chill making it feel like negative five'. The scene starts outdoors (frozen toes, breath in white clouds, ice crystals in nostrils) but transitions to indoors (lobby is heated). Since the character ends up indoors and that's where the scene continues, I'll mark as indoors. The actual temperature is 12F (the app reading), conditions are cold and windy.",
  "temperature": 12,
  "conditions": "Cold, windy, wind chill below zero",
  "isIndoors": true
}

### Example 6: Indoor Climate-Controlled Environment
INPUT:
"""
Dr. Chen: *The laboratory is kept at a precise 68 degrees Fahrenheit, humidity controlled to exactly 45 percent - conditions necessary for the delicate experiments conducted here. Dr. Chen adjusts her lab coat, grateful for the climate control as she glances at the weather display showing a heat wave outside. The cleanroom protocols require the sealed environment, but even if they didn't, no one would want to be outside today. Through the small observation window, she can see the heat distortion on the parking lot asphalt, cars shimmering like mirages. Inside, the only sound is the soft hum of the HVAC system and the gentle whir of centrifuges. Chen turns back to her microscope, thankful for the artificial environment that lets her focus on work rather than survival.*
"""
OUTPUT:
{
  "reasoning": "The laboratory temperature is explicitly stated as 'a precise 68 degrees Fahrenheit'. The scene is clearly indoors in a climate-controlled lab. While a heat wave rages outside, the relevant temperature for the scene is the indoor 68F since that's where the action takes place.",
  "temperature": 68,
  "conditions": "Climate-controlled indoor laboratory, clear outside with heat wave",
  "isIndoors": true
}

### Example 7: Foggy Morning Scene
INPUT:
"""
Sarah: *The fog hangs thick over the harbor, muffling the sounds of the early morning fishing boats preparing to depart. Sarah pulls her peacoat tighter against the damp chill as she walks along the pier, the wooden boards slick with moisture. Visibility is down to maybe fifty feet, the lighthouse beam barely visible as a dim glow through the gray. The fog horn sounds its mournful warning every thirty seconds, the only thing cutting through the cottony silence. She can taste salt on her lips, feel the moisture condensing on her hair. It's the kind of morning where the cold doesn't bite so much as seep, working its way through layers of clothing with patient persistence. The fishermen move like ghosts, their voices carrying oddly in the thick air.*
"""
OUTPUT:
{
  "reasoning": "The scene is outdoors at a foggy harbor in early morning. The text describes 'damp chill', thick fog, and cold that 'seeps' through clothing. This suggests cool, damp conditions typical of foggy coastal mornings - around 50-55F. Visibility is severely reduced by dense fog.",
  "temperature": 52,
  "conditions": "Dense fog, damp and misty, low visibility, coastal humidity",
  "isIndoors": false
}

### Example 8: Spring Day with Pleasant Weather
INPUT:
"""
Emma: *The cherry blossoms are in full bloom, their delicate pink petals drifting down like snow as Emma walks through the park. It's one of those perfect spring days that makes you forget winter ever existed - warm enough for short sleeves, but with a gentle breeze that keeps things comfortable. Birds are singing in the branches overhead, and the grass is that brilliant green that only lasts a few weeks before summer's heat dulls it. Emma finds a bench beneath a flowering tree and opens her book, content to spend the afternoon doing absolutely nothing productive. A group of children run past, their laughter bright and carefree. The sky is a deep, cheerful blue with fluffy white clouds drifting lazily past. This is what people mean when they talk about perfect weather.*
"""
OUTPUT:
{
  "reasoning": "The text describes 'perfect spring' weather, 'warm enough for short sleeves, but with a gentle breeze that keeps things comfortable'. Cherry blossoms and the description of ideal springtime conditions suggest temperatures around 70-75F. The scene is outdoors in a park with clear skies and some clouds.",
  "temperature": 72,
  "conditions": "Clear with scattered clouds, gentle breeze, pleasant spring weather",
  "isIndoors": false
}

### Example 9: Tropical Beach Setting
INPUT:
"""
Miguel: *The turquoise waters of the Caribbean lap gently at Miguel's feet as he reclines in his beach chair, the white sand warm beneath his toes. Palm trees rustle overhead, providing dappled shade that keeps the tropical sun from being too intense. The humidity is high, but the constant ocean breeze makes it tolerable, even pleasant. A pelican dives into the water a hundred meters out, emerging with a fish. Miguel takes another sip of his rum punch, the ice cubes clinking against the glass. The weather has been perfect all week - mid-eighties, clear skies, the occasional fluffy cloud drifting past. This is exactly what the doctor ordered after months of stress. He can feel the tension melting out of his shoulders with each passing wave.*
"""
OUTPUT:
{
  "reasoning": "The text explicitly states 'mid-eighties' for temperature, describing tropical Caribbean beach weather. The scene is outdoors on a beach with clear skies, high humidity, and ocean breeze. Conditions are tropical and pleasant.",
  "temperature": 85,
  "conditions": "Clear, tropical, humid with ocean breeze, sunny",
  "isIndoors": false
}

### Example 10: Mixed Indoor/Outdoor Transition
INPUT:
"""
Lisa: *Lisa pushes through the revolving door from the sweltering street into the air-conditioned lobby of the hotel, and the temperature difference hits her like a wall. Outside, it was pushing 95 degrees, the Manhattan sidewalks radiating stored heat back at pedestrians like a convection oven. In here, it's at least 30 degrees cooler, the climate control working overtime to combat the July heat wave. She stands in the entrance for a moment, letting the cold air dry the sweat on her forehead. The marble floors gleam, the chandelier sparkles, and soft classical music plays from hidden speakers. It's like stepping into another world - one where summer doesn't exist and everything is perpetually comfortable. She checks her phone: 97 degrees outside, feels like 105 with humidity. No wonder the lobby is packed with people who look like they have nowhere particular to be.*
"""
OUTPUT:
{
  "reasoning": "The scene transitions from outdoors to indoors. Outside is '97 degrees' with humidity making it 'feel like 105'. Inside the hotel lobby is '30 degrees cooler' (about 65-67F). Since the character ends up indoors and the scene continues there, I'll use the indoor temperature. However, the outdoor conditions are relevant context - extremely hot and humid.",
  "temperature": 67,
  "conditions": "Air-conditioned indoors; extremely hot and humid outside (97F, heat wave)",
  "isIndoors": true
}

### Example 11: Fantasy World with Magical Climate
INPUT:
"""
Narrator: *The Frozen Wastes of Kyrthos stretch endlessly before the party, a landscape of perpetual winter where no natural spring has ever come. The magical cold here goes beyond mere temperature - it seeps into the soul, making even fire-resistant adventurers shiver. Frost giants are said to walk these plains, immune to a cold that would kill ordinary mortals in hours. The mage casts a warming spell, creating a bubble of tolerable air around the group, but beyond that thin barrier, the wind screams with the fury of elemental ice. Icicles hang from the warriors' beards, their breath freezing in their lungs. The sun is visible but gives no warmth, a pale disk in a white sky that seems to mock the concept of summer.*
"""
OUTPUT:
{
  "reasoning": "This is a fantasy setting with magically enhanced cold described as deadly and beyond natural. The 'Frozen Wastes' with perpetual winter and cold that 'would kill ordinary mortals in hours' suggests extreme subzero temperatures. The wind is described as 'elemental ice' fury. I'll estimate around -40F to -50F for such lethal magical cold. The party is outdoors in this frozen wasteland, though protected by a warming spell.",
  "temperature": -45,
  "conditions": "Magical perpetual winter, extreme cold, icy winds, snow-covered wasteland",
  "isIndoors": false
}

### Example 12: Sci-Fi Space Station Climate
INPUT:
"""
Commander Vex: *The environmental systems maintain a comfortable 71 degrees throughout the habitation ring of Station Artemis, a small slice of Earth normal in the void of space. Vex checks the exterior sensor readings: negative 270 degrees Celsius in the shadow of the station, plus 120 in direct sunlight - the extremes of space that only the station's hull separates them from. Inside, however, it could be any office building on Earth. The recycled air carries a faint metallic tang, but otherwise the environment is perfectly controlled. Artificial gravity at 0.9G, humidity at 40 percent, oxygen levels nominal. Through the observation window, the Earth rotates slowly below, a blue marble wrapped in white clouds. Vex takes a sip of her coffee, grateful for the engineering that makes life possible here.*
"""
OUTPUT:
{
  "reasoning": "The environmental systems maintain '71 degrees' inside the station, which is clearly Fahrenheit for comfort. The station is a climate-controlled indoor environment. While space outside has extreme temperatures, the scene takes place in the habitation ring at 71F.",
  "temperature": 71,
  "conditions": "Climate-controlled space station interior, recycled air, artificial environment",
  "isIndoors": true
}

### Example 13: Autumn Seasonal Scene
INPUT:
"""
Tom: *The leaves crunch satisfyingly beneath Tom's boots as he walks through the forest, a kaleidoscope of oranges, reds, and yellows surrounding him on all sides. The air has that crisp autumn quality - cool enough to need a light jacket, but warm enough in the patches of sunlight that break through the canopy to make you want to take it off. He estimates it's somewhere in the mid-fifties, maybe touching sixty in the sun. The smell of decaying leaves and damp earth fills his nostrils, the essence of fall distilled. A squirrel chatters at him from a nearby oak, cheeks bulging with acorns. In the distance, he can hear the honking of geese heading south for the winter. Tom pulls out his thermos and pours himself a cup of coffee, steam rising in the cool air.*
"""
OUTPUT:
{
  "reasoning": "The text estimates temperature as 'somewhere in the mid-fifties, maybe touching sixty in the sun' - I'll use 57F as a midpoint. The scene is outdoors in autumn forest with crisp air, cool conditions, and steam rising from hot coffee. Conditions are clear with fall foliage.",
  "temperature": 57,
  "conditions": "Clear, crisp autumn air, cool with patches of warmth in sunlight",
  "isIndoors": false
}

### Example 14: Underground Cave Environment
INPUT:
"""
Dr. Hayes: *The spelunking team descends deeper into the Mammoth Cave system, the constant 54-degree temperature of the underground providing welcome relief from the Kentucky summer above. Dr. Hayes notes the readings on her instruments - humidity at 87 percent, air quality good, no dangerous gas concentrations. The cave maintains this temperature year-round, regardless of the scorching summers or freezing winters on the surface. Water drips somewhere in the darkness beyond their headlamps, the only sound besides their breathing and footsteps echoing off ancient limestone. The formations here took millions of years to create, each stalactite a monument to patience. Hayes feels the cool, damp air on her face as they press onward into chambers that may have never seen human eyes.*
"""
OUTPUT:
{
  "reasoning": "The text explicitly states 'the constant 54-degree temperature' of the underground cave system. This is a controlled natural environment (cave) that maintains steady temperature year-round. The scene is indoors (underground) with high humidity and damp conditions.",
  "temperature": 54,
  "conditions": "Underground cave, constant temperature, high humidity, damp, no wind",
  "isIndoors": true
}

### Example 15: Monsoon Season Setting
INPUT:
"""
Priya: *The monsoon rains pound against the tin roof of the chai stall with a deafening rhythm, turning the Mumbai street outside into a rushing river. Priya cups her hands around the warm glass, watching steam rise from the masala chai while outside the world drowns. It's warm despite the rain - the humidity must be close to a hundred percent, making the air feel thick enough to swim through. The temperature hovers somewhere in the low eighties, but it feels hotter with all the moisture. Lightning cracks across the dark afternoon sky, followed almost immediately by thunder that rattles the stall's corrugated walls. Other patrons huddle together, some laughing at the absurdity of it all, others staring morosely at phones that won't work until the storm passes. The street vendors have long since given up, their carts abandoned under inadequate awnings.*
"""
OUTPUT:
{
  "reasoning": "The text states 'temperature hovers somewhere in the low eighties' during monsoon season in Mumbai. It's extremely humid ('close to a hundred percent', 'thick enough to swim through'). The character is sheltered inside a chai stall but the monsoon conditions dominate the scene. Low eighties with extreme humidity.",
  "temperature": 82,
  "conditions": "Monsoon heavy rain, thunderstorm, extremely high humidity, warm",
  "isIndoors": true
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Wrong Temperature Unit
INPUT:
"""
Elena: *The weather app shows 25 degrees as Elena steps outside, and she immediately regrets her choice of a light summer dress. The autumn wind cuts through the thin fabric, making her shiver. She wraps her arms around herself and hurries toward the train station, fallen leaves swirling around her ankles. The sky is overcast, threatening rain, and she wishes she'd checked the forecast before leaving.*
"""
WRONG OUTPUT:
{
  "reasoning": "The weather app shows 25 degrees. It's autumn with wind.",
  "temperature": 25,
  "conditions": "Overcast, windy, autumn",
  "isIndoors": false
}
WHY THIS IS WRONG: The text shows 25 degrees which, given the context (autumn, shivering in a summer dress, cold wind), is clearly 25 Celsius, not Fahrenheit. 25C equals 77F. The output should convert to Fahrenheit: approximately 77F, not 25. The context of shivering suggests it might actually be cooler than 25C, so careful reading is needed.

### Bad Example 2: Ignoring Indoor vs Outdoor Context
INPUT:
"""
Marcus: *The blizzard rages outside the cozy cabin, wind howling against the windows as snow piles in drifts against the door. But inside, the roaring fireplace keeps everything toasty, the temperature gauge on the wall reading a comfortable 72 degrees. Marcus sinks deeper into the armchair, a mug of hot cocoa in hand, watching the storm through frosted glass. The cabin's insulation is doing its job admirably.*
"""
WRONG OUTPUT:
{
  "reasoning": "There's a blizzard with snow, so it must be below freezing. Around 20 degrees.",
  "temperature": 20,
  "conditions": "Blizzard, heavy snow, freezing",
  "isIndoors": false
}
WHY THIS IS WRONG: The character is INSIDE the cabin where the temperature gauge shows 72 degrees. The scene takes place indoors. The answer should be 72F, isIndoors: true, with conditions noting the indoor warmth despite the outdoor blizzard.

### Bad Example 3: Guessing Temperature Without Evidence
INPUT:
"""
Sarah: *Sarah walks down the quiet suburban street, her thoughts a million miles away. The neighborhood is peaceful at this hour, most houses dark, only the occasional porch light breaking the shadows. A dog barks somewhere in the distance. She turns the corner, her footsteps echoing on the sidewalk, and wonders if she should have called ahead.*
"""
WRONG OUTPUT:
{
  "reasoning": "It's nighttime in a suburban area. Probably around 65 degrees.",
  "temperature": 65,
  "conditions": "Clear night",
  "isIndoors": false
}
WHY THIS IS WRONG: The text provides NO temperature clues at all. We don't know the season, there's no mention of weather, temperature, or even character reactions to temperature. The reasoning invents "probably around 65 degrees" with no basis. When no evidence exists, the reasoning should acknowledge the uncertainty and use contextual defaults carefully.

### Bad Example 4: Missing Conditions Description
INPUT:
"""
Jake: *The hurricane-force winds nearly knock Jake off his feet as he struggles toward the shelter, rain coming down in horizontal sheets that sting like needles. Debris flies through the air - a trash can lid, someone's lawn chair, bits of roofing. The street is flooded knee-deep already and rising. Lightning illuminates the chaos in strobe-like flashes, thunder crashing so close the ground shakes.*
"""
WRONG OUTPUT:
{
  "reasoning": "Hurricane conditions. Temperature is probably around 75 degrees since hurricanes need warm water.",
  "temperature": 75,
  "conditions": "Rainy",
  "isIndoors": false
}
WHY THIS IS WRONG: The conditions field drastically understates the severity - "Rainy" doesn't capture hurricane-force winds, flooding, flying debris, and dangerous lightning. The conditions should be comprehensive: "Hurricane, extreme winds, horizontal rain, flooding, lightning, flying debris, dangerous storm conditions."

### Bad Example 5: Confusing Mentioned Weather vs Current Weather
INPUT:
"""
Dr. Palmer: *"Last week's heatwave was brutal," Dr. Palmer says, leafing through the patient charts. "We had six heat stroke cases come through here in a single day. Temperature hit 108 degrees." She glances out the window at the overcast sky, rain beginning to patter against the glass. "Thank goodness that's over. The cooling rain is a blessing." The clinic's air conditioning hums steadily, keeping the examination room at a comfortable level despite the humidity outside.*
"""
WRONG OUTPUT:
{
  "reasoning": "The text mentions 108 degrees from the heatwave.",
  "temperature": 108,
  "conditions": "Heatwave, extremely hot",
  "isIndoors": true
}
WHY THIS IS WRONG: The 108 degrees was LAST WEEK's temperature, not the current scene. The current weather is overcast with rain - "cooling rain is a blessing." The current temperature would be much lower (probably 65-75F for cooling rain after a heatwave). Current conditions are rainy and overcast.

### Bad Example 6: Inverting Indoor/Outdoor Status
INPUT:
"""
Maria: *The rooftop garden offers a stunning view of the city skyline, the evening sun painting the skyscrapers in shades of gold and orange. Maria tends to her tomato plants, the warm summer air carrying the scent of flowers from the neighboring plots. A gentle breeze provides relief from the day's heat. She's been up here for an hour now, enjoying the peace and quiet above the bustling streets.*
"""
WRONG OUTPUT:
{
  "reasoning": "She's in a garden tending plants. The air is warm with a breeze. Probably around 78 degrees.",
  "temperature": 78,
  "conditions": "Clear, sunny evening, warm with gentle breeze",
  "isIndoors": true
}
WHY THIS IS WRONG: A rooftop garden is OUTDOORS, not indoors. The character is outside in open air, not in a building. isIndoors should be false.

### Bad Example 7: Using Wrong Scale for Extreme Temperatures
INPUT:
"""
Viktor: *The Siberian wind cuts through Viktor's parka like it isn't there. His beard is solid ice, his eyelashes frozen together between blinks. The temperature has plunged to forty below - at this point, Celsius and Fahrenheit don't matter, they're nearly the same. The survival instructor had warned them about these conditions, but experiencing it is something else entirely. Each breath burns his lungs, each exposed bit of skin risks frostbite within minutes.*
"""
WRONG OUTPUT:
{
  "reasoning": "Forty below, which could be either scale. I'll say -40C which is about -40F too.",
  "temperature": -40,
  "conditions": "Extreme cold, wind",
  "isIndoors": false
}
WHY THIS IS WRONG: While -40 is technically correct (the text even notes they're nearly the same at this point), the conditions description is severely lacking. "Extreme cold, wind" doesn't capture: Siberian wind, survival-level danger, beard freezing solid, frostbite risk within minutes. Conditions should be: "Extreme Arctic cold, dangerous Siberian wind chill, frostbite conditions, survival-threatening".

### Bad Example 8: Ignoring Seasonal Context
INPUT:
"""
Chen: *Christmas morning dawns gray and drizzly, a far cry from the white Christmas everyone had hoped for. Chen watches the rain streak down the windows, his coffee growing cold in his hands. The house is warm and full of the smell of cooking ham, but outside the dreary weather matches his mood. December 25th in Seattle - what did he expect? At least the temperature is mild enough that his parents didn't have trouble driving over.*
"""
WRONG OUTPUT:
{
  "reasoning": "It's Christmas and rainy. Seattle in December. Around 32 degrees for winter.",
  "temperature": 32,
  "conditions": "Light rain, gray",
  "isIndoors": true
}
WHY THIS IS WRONG: The text specifically says the temperature is "mild enough" that driving wasn't a problem. Seattle's December average is 40-45F, and "mild" during December drizzle suggests above-freezing, comfortable conditions - around 45-50F, not freezing 32F. The seasonal context should inform, not override, explicit clues about mildness.

### Bad Example 9: Not Accounting for Microclimate
INPUT:
"""
Rosa: *The greenhouse is a tropical paradise, a pocket of warmth and humidity in the middle of a Minnesota winter. Rosa adjusts the misters, checking that each exotic orchid is getting exactly the moisture it needs. Outside, snow blankets everything in white, but in here, surrounded by banana plants and bird-of-paradise flowers, she could almost forget the frozen landscape beyond the glass. The thermostat reads 82 degrees, perfect for her collection. Humidity at 75 percent.*
"""
WRONG OUTPUT:
{
  "reasoning": "It's Minnesota winter, so probably around 15-20 degrees outside. The greenhouse is warmer but still cold.",
  "temperature": 25,
  "conditions": "Snowy, winter, cold",
  "isIndoors": false
}
WHY THIS IS WRONG: The scene takes place INSIDE the greenhouse where the thermostat explicitly reads 82 degrees. The character is indoors in a controlled tropical environment. Temperature should be 82F, isIndoors: true, conditions should note the artificially maintained tropical climate.

### Bad Example 10: Misreading Climate Descriptions
INPUT:
"""
Alex: *The desert night is surprisingly cold, the temperature having dropped sharply once the sun went down. Alex huddles closer to the campfire, his thin jacket doing little against the chill. The stars are impossibly bright with no light pollution for miles, but he's too cold to appreciate them. His breath fogs in the firelight. The sand that burned his feet through his boots at noon is now cold against his back as he tries to get comfortable. He estimates it's somewhere in the mid-forties now, maybe colder.*
"""
WRONG OUTPUT:
{
  "reasoning": "Desert scene, and deserts are hot. Probably around 95 degrees.",
  "temperature": 95,
  "conditions": "Clear, hot desert",
  "isIndoors": false
}
WHY THIS IS WRONG: The text explicitly describes NIGHT in the desert which gets very cold. The character's breath is fogging, he's huddling by a fire, and he estimates "mid-forties now, maybe colder." The temperature should be around 45F or lower, not 95F. Conditions should be "Clear night, desert cold, starry sky".

### Bad Example 11: Confusing Character Preference with Actual Temperature
INPUT:
"""
Grandma Chen: *"It's freezing in here!" Grandma Chen declares, shuffling to adjust the thermostat even though it already reads 74 degrees. She pulls her cardigan tighter and glares at her grandson. "You young people run too cold. In my day, we kept houses at a proper temperature." Jason rolls his eyes; the apartment is perfectly comfortable to him in just a t-shirt. The afternoon sun streams through the windows, and if anything, he's feeling a bit too warm.*
"""
WRONG OUTPUT:
{
  "reasoning": "Grandma Chen says it's freezing, so the temperature must be low. Maybe around 60 degrees.",
  "temperature": 60,
  "conditions": "Indoor, cool",
  "isIndoors": true
}
WHY THIS IS WRONG: The thermostat explicitly reads 74 degrees. Grandma's complaint about it being "freezing" is subjective - she has different temperature preferences. The actual temperature is 74F. Conditions should note sunny afternoon, comfortable indoor temperature.

### Bad Example 12: Not Processing Complex Temperature Information
INPUT:
"""
News Anchor: *"Good evening. Tonight's forecast calls for a high of 78 and a low of 54, with a chance of scattered showers after midnight. Currently, we're sitting at 71 degrees under partly cloudy skies. Tomorrow looks even better, with highs in the mid-eighties expected. Now let's go to traffic with..." The television drones on in the background as Mike only half-listens, more focused on his dinner. Outside his window, the evening sky shows those promised partly cloudy conditions, the setting sun painting the clouds pink and orange.*
"""
WRONG OUTPUT:
{
  "reasoning": "The forecast mentions several temperatures. I'll use the high of 78 degrees.",
  "temperature": 78,
  "conditions": "Partly cloudy",
  "isIndoors": true
}
WHY THIS IS WRONG: The forecast mentions multiple temperatures, but the CURRENT temperature is explicitly stated: "Currently, we're sitting at 71 degrees." The high of 78 is a forecast, not the current temperature. The current temperature is 71F.
`;

export const initialClimatePrompt: PromptTemplate<ExtractedInitialClimate> = {
	name: 'initial_climate',
	description:
		'Extract the initial climate (temperature, conditions) from the opening of a roleplay',

	placeholders: [PLACEHOLDERS.messages, PLACEHOLDERS.characterName],

	systemPrompt: `You are analyzing roleplay messages to extract the current climate and weather conditions.

## Your Task
Read the provided roleplay messages and determine the temperature, weather conditions, and whether the scene is indoors or outdoors.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of climate clues in the text
- "temperature": Temperature as a number in Fahrenheit (not Celsius)
- "conditions": Brief description of weather/environmental conditions
- "isIndoors": Boolean indicating if the scene is indoors

## Climate Clue Priority (from highest to lowest)
1. Explicit temperature readings (thermometers, weather apps, gauges)
2. Explicit weather descriptions (rain, snow, sunny, etc.)
3. Character reactions to temperature (shivering, sweating, comfortable)
4. Seasonal context combined with geographic hints
5. Time of day and setting context
6. Character card/setting information

## Important Rules
- ALWAYS use Fahrenheit for temperature
- If temperature is given in Celsius, convert it (C × 9/5 + 32 = F)
- "Freezing" typically means around 32°F or below
- "Room temperature" is typically 68-72°F
- Consider CURRENT scene location - if character moves indoors, use indoor conditions
- Indoor temperatures may differ from outdoor weather
- For controlled environments (labs, climate control), use the stated indoor temperature
- For fantasy/sci-fi settings, map to reasonable real-world temperature equivalents
- When temperature is ambiguous, use seasonal and contextual clues

## Temperature Reference Guide
- Extreme cold: Below 0°F (Arctic, blizzards)
- Very cold: 0-32°F (Winter, snow)
- Cold: 32-50°F (Late fall, early spring)
- Cool: 50-65°F (Mild seasons)
- Comfortable: 65-75°F (Pleasant weather)
- Warm: 75-85°F (Summer days)
- Hot: 85-95°F (Heat waves)
- Extreme heat: Above 95°F (Desert, tropical midday)

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Messages to Analyze
{{messages}}

## Task
Extract the current climate from these messages. Think through the temperature and weather clues carefully, then provide your answer as JSON.

Remember:
- Use Fahrenheit for temperature (not Celsius)
- Consider whether the scene is indoors or outdoors
- Describe conditions comprehensively
- Focus on CURRENT conditions, not past or forecasted weather`,

	responseSchema: initialClimateSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedInitialClimate | null {
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
		if (typeof parsed.temperature !== 'number') return null;
		if (typeof parsed.conditions !== 'string') return null;
		if (typeof parsed.isIndoors !== 'boolean') return null;

		// Clamp temperature to reasonable range
		if (parsed.temperature < -100 || parsed.temperature > 150) return null;

		return parsed as unknown as ExtractedInitialClimate;
	},
};
