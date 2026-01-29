/**
 * Initial Location Extraction Prompt
 *
 * Extracts the initial location (area, place, position) from the opening messages of a roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedInitialLocation } from '../../types/extraction';
import { isValidLocationType } from '../../types/common';
import { initialLocationSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Explicit Location Description
INPUT:
"""
Elena: *The fluorescent lights of the 24-hour diner cast harsh shadows across Elena's face as she slides into a corner booth. The Starlight Diner, last refuge of the sleepless in downtown Chicago, smells of stale coffee and frying bacon. A tired waitress in a pink uniform leans against the counter, watching the late-night news on a muted television. The vinyl seats crack with age as Elena settles in, placing her phone face-down on the chipped Formica table. Through the rain-streaked windows, she can see the blinking neon sign reflected in puddles on the empty street. The jukebox in the corner plays something soft and melancholy, barely audible over the hum of the ancient refrigeration unit.*
"""
OUTPUT:
{
  "reasoning": "The text explicitly names 'The Starlight Diner' in 'downtown Chicago'. Elena is seated in a 'corner booth'. This gives a clear area (downtown Chicago), place (The Starlight Diner), and position (corner booth). A 24-hour diner would have basic heating, so 'heated'.",
  "area": "Downtown Chicago",
  "place": "The Starlight Diner",
  "position": "Corner booth",
  "locationType": "heated"
}

### Example 2: Indoor Office Setting
INPUT:
"""
Marcus: *The corner office on the forty-seventh floor of the Meridian Tower offers a panoramic view of the Manhattan skyline, but Marcus has long since stopped noticing. He stands with his back to the floor-to-ceiling windows, hands clasped behind him, as his assistant delivers the morning report. The office is immaculate - glass desk, leather chairs, abstract art on the walls that cost more than most people's houses. His collection of first-edition books lines one wall, spines uncracked, purchased for appearance rather than content. The air smells faintly of expensive cologne and freshly brewed coffee. A single photograph sits on his desk - his daughter's graduation, the only personal touch in this monument to corporate success.*
"""
OUTPUT:
{
  "reasoning": "The location is explicitly described as 'the corner office on the forty-seventh floor of the Meridian Tower' in Manhattan. The scene is focused near the windows area of the office. A modern skyscraper would have HVAC, so 'modern'.",
  "area": "Manhattan",
  "place": "Meridian Tower - 47th floor corner office",
  "position": "By the floor-to-ceiling windows",
  "locationType": "modern"
}

### Example 3: Ambiguous Indoor/Outdoor - Resolving to Current
INPUT:
"""
Sarah: *The greenhouse is a world unto itself, humid and warm despite the February cold outside. Sarah pushes open the fogged glass door and steps inside, immediately enveloped by the scent of damp earth and growing things. Rows of exotic orchids stretch before her, their delicate blooms nodding in colors she has no names for. The university's botanical collection is her sanctuary, the one place on campus where she can think clearly. She makes her way past the tropical section, ducking under hanging ferns, until she reaches the small clearing where a stone bench sits beneath an ancient lemon tree. Water drips from the overhead misting system, catching the filtered sunlight like tiny diamonds.*
"""
OUTPUT:
{
  "reasoning": "Sarah enters a greenhouse and walks through it to a specific spot. The area is a university campus, the place is the university's botanical greenhouse, and her final position is at the stone bench under a lemon tree. I'm using her current position after movement, not where she started. A greenhouse is 'unheated' - it provides shelter but relies on passive solar heating.",
  "area": "University campus",
  "place": "University botanical greenhouse",
  "position": "Stone bench beneath the lemon tree",
  "locationType": "unheated"
}

### Example 4: Multiple Locations Mentioned - Current vs Remembered
INPUT:
"""
Detective Chen: *Three weeks ago, he had stood in a penthouse overlooking the bay, staring at a body that would change everything. Now, Chen sits in his cramped cubicle at the 14th Precinct, the memory of that crime scene burned into his retinas. The bullpen around him buzzes with activity - phones ringing, keyboards clacking, officers arguing about last night's game. His desk is a disaster of case files, empty coffee cups, and crumpled fast food wrappers. A half-dead plant sits in the corner, a gift from his ex-wife who clearly overestimated his nurturing abilities. Through the grimy windows, he can see the elevated train rumbling past, shaking the building with its passage.*
"""
OUTPUT:
{
  "reasoning": "The penthouse is a past memory ('Three weeks ago'). The current scene is at 'the 14th Precinct' where Chen 'sits in his cramped cubicle'. The area would be wherever the precinct is located (not explicitly stated, so I'll use a general description), the place is the 14th Precinct building, and his position is at his cubicle desk. A police station would have HVAC, so 'modern'.",
  "area": "City center",
  "place": "14th Precinct police station",
  "position": "Cramped cubicle desk in the bullpen",
  "locationType": "modern"
}

### Example 5: Fantasy Setting with Unusual Locations
INPUT:
"""
Narrator: *The Whispering Library exists between worlds, accessible only to those who know the proper words. Lyra finds herself standing in the grand atrium, a circular chamber so vast that the ceiling is lost in shadows. Bookshelves spiral upward infinitely, connected by staircases that seem to defy gravity, some running sideways, others upside down. Ghostly figures drift between the stacks, librarians who died centuries ago but refused to leave their posts. The air tastes of old paper and magic, heavy with the accumulated knowledge of a thousand civilizations. In the center of the atrium stands a massive astrolabe, its rings spinning slowly, marking the passage of time in dimensions Lyra cannot comprehend. She approaches it cautiously, her footsteps echoing in the impossible silence.*
"""
OUTPUT:
{
  "reasoning": "This is a fantasy location - 'The Whispering Library' that 'exists between worlds'. Lyra is in the 'grand atrium', specifically near 'the massive astrolabe' at the center. For fantasy settings, I describe the location as it exists within the narrative world. A magical library building would be 'heated' (traditional indoor structure).",
  "area": "Between worlds (extradimensional)",
  "place": "The Whispering Library",
  "position": "Grand atrium, approaching the central astrolabe",
  "locationType": "heated"
}

### Example 6: Sci-Fi Space Station Setting
INPUT:
"""
Commander Vex: *The observation deck of Deep Space Station Prometheus offers the best view of the gas giant below, its swirling storms visible through the reinforced transparent aluminum windows. Vex stands at the railing, watching the planet's great red spot rotate slowly past. The deck is nearly empty at this hour - just a young ensign running diagnostics on the far side and an elderly scientist dozing in one of the padded viewing chairs. The station's recycled air carries the faint metallic tang common to all spacecraft, mixed with the subtle ozone smell of the atmospheric processors working overtime. Holographic displays float near the windows, showing real-time data about the planet's weather patterns. Vex's reflection stares back at her from the glass, superimposed over the cosmic majesty outside.*
"""
OUTPUT:
{
  "reasoning": "The location is 'Deep Space Station Prometheus', an orbital space station. The specific place is the 'observation deck', and the scene is at the viewing railing near the windows. For sci-fi settings, I include the station name as part of the place. A space station has climate control systems, so 'modern'.",
  "area": "Orbit around gas giant",
  "place": "Deep Space Station Prometheus - Observation deck",
  "position": "At the viewing railing",
  "locationType": "modern"
}

### Example 7: Vague Description Requiring Inference
INPUT:
"""
Alex: *She had been walking for what felt like hours, though the unchanging gray sky made it impossible to tell. The path wound through dead trees, their bare branches reaching toward the heavens like skeletal fingers. No birds sang. No insects buzzed. Even her footsteps seemed muffled, swallowed by the oppressive silence. Finally, she spotted something ahead - a clearing where the trees parted around a small pond, its surface perfectly still, reflecting nothing but gray. A fallen log offered a place to rest, and she collapsed onto it gratefully, her legs aching from the journey. Somewhere in the distance, barely visible through the mist, the outline of a ruined tower broke the monotonous treeline.*
"""
OUTPUT:
{
  "reasoning": "The description is atmospheric but lacks specific place names. Alex is in a forest ('dead trees', 'bare branches'), and has reached a clearing with a pond. The scene is at a fallen log by the water. Without specific names, I use descriptive terms based on what's in the text. This is outdoors, exposed to weather.",
  "area": "Unnamed dead forest",
  "place": "Clearing with a small pond",
  "position": "Fallen log by the water's edge",
  "locationType": "outdoor"
}

### Example 8: Moving Between Locations - Use Final Position
INPUT:
"""
James: *The subway car lurches as it leaves the 42nd Street station, and James grabs the overhead rail to steady himself. The morning commute is in full swing - the car is packed with bodies, everyone studiously avoiding eye contact in that uniquely New York way. He had started his journey in Brooklyn, transferred twice, and still has three more stops to go before reaching his office in Midtown. A busker at the last platform had been playing saxophone, the notes following him down into the tunnel. Now, wedged between a man reading a newspaper and a teenager lost in her headphones, James watches the tunnel lights flicker past through the scratched windows. The train smells of sweat, cheap perfume, and the morning coffee clutched in countless hands.*
"""
OUTPUT:
{
  "reasoning": "James is on a moving subway train. He started in Brooklyn and is heading to Midtown, but currently he's on the train itself somewhere between 42nd Street and his destination. The train has just left 42nd Street station. A subway car is a 'vehicle' - enclosed transport.",
  "area": "New York City subway system",
  "place": "Subway car heading north from 42nd Street",
  "position": "Center of the car near the doors",
  "locationType": "vehicle"
}

### Example 9: Position Within a Place - Specific Details
INPUT:
"""
Mira: *The hospital room is painted in that particular shade of institutional beige designed to be inoffensive and succeeding only in being depressing. Mira sits in the uncomfortable plastic chair beside her father's bed, watching the steady rise and fall of his chest, listening to the rhythmic beep of the heart monitor. The room is private, at least - a small mercy paid for by insurance that's running out faster than his time. Get-well cards line the windowsill, sent by relatives who couldn't be bothered to visit in person. The IV bag drips silently, measuring out his remaining days. Outside, nurses move past with quiet efficiency, their rubber soles squeaking on the polished floors. Mira reaches out and takes her father's hand, careful not to disturb the tubes and wires that connect him to life.*
"""
OUTPUT:
{
  "reasoning": "The scene is in a hospital room. The area would be the hospital (general), the place is the private hospital room, and the scene is focused at the bedside area. Hospitals have climate-controlled environments, so 'modern'.",
  "area": "Hospital",
  "place": "Private hospital room",
  "position": "Bedside area",
  "locationType": "modern"
}

### Example 10: Outdoor Natural Setting
INPUT:
"""
Luna: *The mountain trail opens suddenly onto a vista that steals her breath. Luna stands at the edge of a granite cliff, the valley spreading out three thousand feet below like a map made real. The afternoon sun catches the distant river, turning it to a ribbon of silver threading through the patchwork of autumn forest. Behind her, the trail continues upward toward the summit, still two hours of climbing away. A cold wind tugs at her jacket, carrying the scent of pine and the first hints of the coming winter. She drops her pack and sits on a sun-warmed boulder, pulling out her water bottle and a protein bar. A hawk circles lazily overhead, riding the thermals with effortless grace. This is why she climbs - for moments like this, when the world shrinks to just sky and stone and silence.*
"""
OUTPUT:
{
  "reasoning": "Luna is hiking on a mountain trail and has stopped at a vista point - specifically 'at the edge of a granite cliff'. The scene is at a boulder near the cliff edge. The area is the mountain/valley region, the place is the mountain trail at a cliff overlook. This is outdoors on a mountain.",
  "area": "Mountain wilderness",
  "place": "Mountain trail - cliff overlook vista point",
  "position": "Boulder at the cliff edge",
  "locationType": "outdoor"
}

### Example 11: Underground/Subterranean Location
INPUT:
"""
Dr. Reyes: *The bunker has been her home for six months now, though 'home' feels like too generous a word. Dr. Reyes makes her way through the narrow corridor of Sub-Level 7, the deepest occupied level of the underground research facility. Motion-activated lights flicker on as she passes, then off again behind her, leaving trails of darkness in her wake. The concrete walls are cold and slightly damp, despite the best efforts of the dehumidifiers. She reaches the heavy steel door marked 'Lab 7-C' and presses her palm to the scanner. The mechanism whirs, clicks, and the door swings open to reveal her workspace - banks of computers, glass containment units, and the thing they had found three hundred feet beneath the desert floor. It pulses softly in its tank, aware of her presence.*
"""
OUTPUT:
{
  "reasoning": "The location is an underground research facility, specifically 'Sub-Level 7'. Dr. Reyes enters 'Lab 7-C'. The area is beneath the desert (underground), the place is the research bunker's Lab 7-C on Sub-Level 7, and the scene is at the lab entrance area. An underground bunker has stable temperature year-round, so 'underground'.",
  "area": "Underground (beneath desert - research facility)",
  "place": "Sub-Level 7, Lab 7-C",
  "position": "Near the laboratory entrance",
  "locationType": "underground"
}

### Example 12: Character Card Context for Setting
INPUT:
"""
[Character Card: Kira, a bounty hunter in the neon-soaked streets of Neo-Tokyo, 2089. She operates out of a seedy bar called The Burning Chrome in the Shibuya undercity.]

Kira: *Another night, another mark. Kira swirls the synthetic whiskey in her glass, watching the entrance through the mirror behind the bar. The place is packed with the usual crowd - off-duty corp drones looking for a thrill, black market dealers cutting deals in shadowy corners, and a few fellow hunters sizing each other up. The music is too loud, the air is too thick with smoke from illegal stimsticks, and the neon signs outside paint everything in shades of pink and blue. Her contact is late, which means either they're testing her patience or they're already dead. Neither option improves her mood. The bartender, a chrome-armed ex-soldier named Grit, slides her another drink without being asked. He knows better than to make conversation.*
"""
OUTPUT:
{
  "reasoning": "The character card establishes the setting as Neo-Tokyo 2089, specifically the Shibuya undercity, and mentions 'The Burning Chrome' bar. The scene confirms she's at a bar matching this description. The scene is focused at the bar counter area. A cyberpunk bar would have climate control, so 'modern'.",
  "area": "Shibuya undercity, Neo-Tokyo",
  "place": "The Burning Chrome bar",
  "position": "At the bar counter",
  "locationType": "modern"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Using Past Location Instead of Current
INPUT:
"""
Elena: *She left the apartment on 5th Street three hours ago. Now she stands on the observation deck of the Empire State Building, watching the city lights twinkle below like earthbound stars. The wind is fierce at this height, tugging at her coat and whipping her hair into a frenzy. Other tourists jostle around her, taking selfies and pointing at landmarks. Elena ignores them all, focused on the distant Jersey shore where somewhere, in a house she'll never see again, her old life continues without her.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena was at an apartment on 5th Street.",
  "area": "5th Street neighborhood",
  "place": "Apartment building",
  "position": "Inside the apartment"
}
WHY THIS IS WRONG: The apartment on 5th Street is where Elena WAS three hours ago. The CURRENT scene has her on the observation deck of the Empire State Building. Always extract the current location, not past ones mentioned in flashback or memory.

### Bad Example 2: Missing Position Details
INPUT:
"""
Marcus: *The library is quiet except for the soft rustle of pages and occasional cough. Marcus has claimed his usual spot - the leather armchair in the far corner of the reading room, partially hidden behind a towering bookshelf of ancient philosophy texts. From here, he can see the entrance without being easily spotted himself, an old habit from his military days that he can't seem to shake. His book lies open in his lap, but he hasn't turned a page in twenty minutes, too lost in thought to focus on the words.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus is at a library.",
  "area": "City",
  "place": "Library",
  "position": "Inside"
}
WHY THIS IS WRONG: The text provides specific position details - Marcus is in "the leather armchair in the far corner of the reading room, partially hidden behind a towering bookshelf." The output loses all this specificity with just "Inside." Always capture the detailed position when it's provided.

### Bad Example 3: Confusing Area/Place/Position Hierarchy
INPUT:
"""
Sarah: *The wedding venue is spectacular - a converted warehouse in Brooklyn's DUMBO neighborhood, with exposed brick walls and Edison bulbs strung from the rafters. Sarah stands near the dessert table, nursing a glass of champagne and watching the happy couple take their first dance. The dance floor is packed with relatives she barely recognizes, all swaying to a song she doesn't know. Her heels are killing her, but she refuses to be the first one to sit down.*
"""
WRONG OUTPUT:
{
  "reasoning": "Sarah is at a wedding in Brooklyn.",
  "area": "Near the dessert table",
  "place": "Brooklyn's DUMBO neighborhood",
  "position": "Wedding venue converted warehouse"
}
WHY THIS IS WRONG: The hierarchy is completely inverted. Area should be the broadest (DUMBO neighborhood, Brooklyn), place should be the specific venue (converted warehouse/wedding venue), and position should be the most specific (near the dessert table). The output has these reversed.

### Bad Example 4: Inventing Details Not in Text
INPUT:
"""
James: *The office feels smaller today, the walls closing in as James reviews the quarterly reports. His coffee has gone cold hours ago, forgotten beside a stack of unread memos. Through his window, he can see other buildings - other offices - other people probably feeling the same Monday dread. The clock on the wall ticks too loudly, each second an accusation.*
"""
WRONG OUTPUT:
{
  "reasoning": "James is in an office, probably in a skyscraper in the financial district of Manhattan based on the description of other buildings.",
  "area": "Manhattan Financial District",
  "place": "Corner office on the 35th floor of Goldman Tower",
  "position": "Behind his mahogany executive desk"
}
WHY THIS IS WRONG: The text never mentions Manhattan, the Financial District, Goldman Tower, the 35th floor, a corner office, or a mahogany desk. These are all invented details. When location specifics aren't given, use general descriptions based only on what IS in the text - like "City office building" for area and "Office" for place.

### Bad Example 5: Ignoring Character Card Context
INPUT:
"""
[Character Card: Lyra, a tavern keeper in the medieval fantasy town of Silverhollow, located in the Green Vale region. She runs The Weary Wanderer inn.]

Lyra: *The evening crowd has thinned, leaving only a few stubborn drunks nursing their ales in the corners. Lyra wipes down the bar, working out a sticky spot where someone spilled mead earlier. The fire in the hearth has burned down to embers, casting long shadows across the worn wooden floor. A bard in the corner plucks absently at his lute, too tired to play a proper tune. It's been a long day, and there are still glasses to wash and tables to clear before she can collapse into her own bed upstairs.*
"""
WRONG OUTPUT:
{
  "reasoning": "Lyra is in a generic tavern wiping down the bar.",
  "area": "Unknown medieval town",
  "place": "A tavern",
  "position": "Behind the bar counter"
}
WHY THIS IS WRONG: The character card explicitly establishes that Lyra runs "The Weary Wanderer inn" in "Silverhollow" in the "Green Vale region." This context should be used. The area is "Silverhollow, Green Vale" and the place is "The Weary Wanderer inn."

### Bad Example 6: Extracting Location from Dialogue About Elsewhere
INPUT:
"""
Detective Chen: *She leans forward in her chair, notepad ready. "Tell me again about the warehouse on Pike Street," she says, pen poised. "Start from when you arrived."

The witness shifts nervously. "It was dark when I got there. The warehouse - it's abandoned, you know? Has been for years. There was this smell, like rust and something worse..."

Chen nods, scribbling notes. The interrogation room feels smaller with each passing minute, its gray walls pressing in. "And what did you see inside?"*
"""
WRONG OUTPUT:
{
  "reasoning": "They're discussing a warehouse on Pike Street.",
  "area": "Pike Street",
  "place": "Abandoned warehouse",
  "position": "Inside the warehouse"
}
WHY THIS IS WRONG: The warehouse on Pike Street is being discussed in dialogue - it's not the current location. The actual scene takes place in an interrogation room where Detective Chen is interviewing a witness. The current location is the interrogation room, not the warehouse they're talking about.

### Bad Example 7: Too Vague When Details Exist
INPUT:
"""
Luna: *The rooftop garden is an oasis twenty stories above the city chaos. Luna kneels beside the tomato plants, checking for signs of blight, while the setting sun paints the surrounding skyscrapers in shades of amber and rose. The penthouse apartment below belongs to Mrs. Chen, who lets Luna tend this garden in exchange for fresh vegetables and occasional company. Raised beds line the rooftop perimeter, filled with everything from herbs to heirloom squash. A small greenhouse in the corner shelters the more delicate specimens from the harsh city elements. Luna pushes a strand of hair from her face, leaving a smudge of dirt on her cheek, and moves on to inspect the pepper plants.*
"""
WRONG OUTPUT:
{
  "reasoning": "Luna is on a rooftop.",
  "area": "A city",
  "place": "Rooftop",
  "position": "On the roof"
}
WHY THIS IS WRONG: The text provides rich details that are completely ignored. The rooftop garden is "twenty stories above" on top of "Mrs. Chen's penthouse apartment." Luna is specifically "kneeling beside the tomato plants." The output should capture these specifics rather than being generic.

### Bad Example 8: Confusing Current Position During Movement
INPUT:
"""
Alex: *Alex runs through the museum, his footsteps echoing off the marble floors. Past the dinosaur exhibit, through the Hall of Ancient Egypt, skidding around the corner by the gift shop - he doesn't have time to appreciate any of it. Security guards shout behind him, their voices bouncing off the vaulted ceilings. He bursts through the emergency exit into a back alley, the alarm screaming in his wake. Finally safe in the shadows between dumpsters, he catches his breath, clutching the stolen artifact to his chest.*
"""
WRONG OUTPUT:
{
  "reasoning": "Alex is running through a museum, passing the dinosaur exhibit and Egyptian hall.",
  "area": "Museum district",
  "place": "Natural History Museum",
  "position": "Hall of Ancient Egypt"
}
WHY THIS IS WRONG: The scene describes Alex running THROUGH the museum (past tense movement) and ending up in a back alley. His FINAL position is "in the shadows between dumpsters" in the back alley outside the museum, not inside the Egyptian hall which he already passed.

### Bad Example 9: Inventing Area When None Specified
INPUT:
"""
Mira: *The cabin is small but cozy, tucked away somewhere deep in the forest. Mira stokes the fire, adding another log from the dwindling pile by the hearth. Snow falls silently outside the frost-covered windows, piling up on the sill. The nearest town is hours away - that's the point - and the silence is both peaceful and oppressive in equal measure. She wraps the blanket tighter around her shoulders and returns to the worn armchair by the fire, picking up her book where she left off.*
"""
WRONG OUTPUT:
{
  "reasoning": "Mira is in a cabin in the forest.",
  "area": "Rocky Mountains, Colorado",
  "place": "Hunting cabin",
  "position": "By the fireplace"
}
WHY THIS IS WRONG: The text says the cabin is "deep in the forest" but never specifies it's in Colorado or the Rocky Mountains. That's an invention. Similarly, nothing indicates it's specifically a "hunting cabin." The area should simply be "Remote forest" or "Forested wilderness" based on what we actually know.

### Bad Example 10: Missing the "Position" Entirely
INPUT:
"""
Dr. Reyes: *The laboratory hums with the sound of machines doing work no human could. Dr. Reyes stands at the central workstation, manipulating holographic displays with precise gestures. Data streams past faster than the eye can follow, but she reads it like poetry. The experiment in Containment Chamber 3 is reaching critical phase - another hour and they'll know if three years of work has paid off or if they're back to square one. Her assistants move around the periphery, monitoring secondary systems, none of them daring to interrupt her concentration.*
"""
WRONG OUTPUT:
{
  "reasoning": "Dr. Reyes is working in a laboratory.",
  "area": "Research facility",
  "place": "Advanced laboratory",
  "position": ""
}
WHY THIS IS WRONG: Position cannot be empty when the text clearly states Dr. Reyes "stands at the central workstation." The position should capture where within the place the character is located.

### Bad Example 11: Using Destination Instead of Current Location
INPUT:
"""
Commander Vex: *The shuttle shudders as it enters the atmosphere of Kepler-442b. Through the viewport, Vex watches the alien landscape slowly resolve - blue-green vegetation, rust-colored mountains, and what might be structures near the designated landing zone. "Five minutes to touchdown," her pilot reports. The colonization equipment in the cargo hold shifts against its restraints as turbulence buffets the small craft. This will be humanity's first permanent settlement outside the solar system, assuming they survive the landing. Vex grips her armrests and tries not to think about the dozen ways this could go wrong.*
"""
WRONG OUTPUT:
{
  "reasoning": "They're landing on the planet Kepler-442b near the designated landing zone with structures.",
  "area": "Kepler-442b surface",
  "place": "Near alien structures at landing zone",
  "position": "On the ground"
}
WHY THIS IS WRONG: The shuttle hasn't landed yet - they're still "five minutes to touchdown" and experiencing turbulence in the atmosphere. The current location is the shuttle itself, still in the atmosphere of the planet, not on the ground at the landing zone.

### Bad Example 12: Guessing Geographic Location Without Context
INPUT:
"""
James: *The bar is crowded and loud, just the way James likes it. Anonymous. He nurses his whiskey at a corner stool, watching the sports game on the TV above the bottles without really seeing it. The bartender knows not to bother him with small talk - a generous tip on his first drink bought that silence. Someone at a nearby table laughs too loudly, and James shifts his weight, angling his body away from the noise. The door opens, letting in a blast of cold air and a woman in a red coat who scans the room with the practiced eye of someone looking for a specific face.*
"""
WRONG OUTPUT:
{
  "reasoning": "James is at a bar in what sounds like a major city, probably Chicago based on the sports culture.",
  "area": "Lincoln Park, Chicago",
  "place": "O'Malley's Irish Pub",
  "position": "Corner barstool near the emergency exit"
}
WHY THIS IS WRONG: Nothing in the text hints at Chicago or Lincoln Park - that's random guessing without context clues. "Emergency exit" isn't mentioned either. However, INVENTING a bar name is CORRECT - "O'Malley's Irish Pub" is better than generic "Bar". The fix: keep the invented bar name, but use a generic area since we have no geographic context. Better output would be: area "City neighborhood", place "O'Malley's Pub" (invented name is good!), position "Corner barstool".
`;

export const initialLocationPrompt: PromptTemplate<ExtractedInitialLocation> = {
	name: 'initial_location',
	description:
		'Extract the initial location (area, place, position) from the opening of a roleplay',

	placeholders: [PLACEHOLDERS.messages, PLACEHOLDERS.characterName],

	systemPrompt: `You are analyzing roleplay messages to extract the current location.

## Your Task
Read the provided roleplay messages and determine the precise location where the scene is taking place. Extract three levels of specificity plus the location type for climate calculations:
- **Area**: The broader geographic region, neighborhood, or district
- **Place**: The specific building, establishment, or landmark
- **Position**: The scene view or local landmark within the place (a room, corner, feature, or area - NOT a character's body position or posture)
- **Location Type**: Whether indoors/outdoors and what kind of climate the space has

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of location clues in the text
- "area": The neighborhood, district, region, or general area
- "place": The specific building, establishment, or location
- "position": The exact position within the place
- "locationType": One of: "outdoor", "modern", "heated", "unheated", "underground", "tent", "vehicle"

## Location Types (for climate calculations)
- **outdoor**: Outside, exposed to weather (streets, parks, forests, mountains, beaches)
- **modern**: Climate-controlled with HVAC (offices, malls, hotels, hospitals, modern apartments, space stations)
- **heated**: Traditional heating like fireplace/radiator (homes, cabins, taverns, castles, medieval buildings)
- **unheated**: Shelter but no climate control (barns, warehouses, sheds, greenhouses, garages)
- **underground**: Below ground, stable ~55°F year-round (caves, basements, bunkers, mines, tunnels)
- **tent**: Minimal shelter (tents, campsites, bivouacs, yurts)
- **vehicle**: Enclosed transport (cars, trains, planes, ships, carriages, spaceships)

## Location Hierarchy
Think of location as nested containers:
- **Area** = Largest (city, neighborhood, region, "Downtown Seattle", "Forest of Shadows")
- **Place** = Medium (building, establishment, landmark, "The Rusty Nail bar", "Ancient Temple")
- **Position** = Smallest (scene landmark or room, NOT character posture) - e.g., "Corner booth", "The kitchen", "By the fireplace", "Near the entrance"

IMPORTANT: Position describes WHERE in the scene the camera is focused, like a room, corner, or local feature. It is NOT about what characters are physically doing (sitting, standing, lying). "By the windows" is correct. "Standing by the windows" is wrong - remove the character's pose.

## Location Clue Priority (from highest to lowest)
1. Explicit location names in narration ("The Starlight Diner in downtown Chicago")
2. Character card/setting information specifying where the story takes place
3. Descriptive details about the environment (architecture, furniture, atmosphere)
4. Dialogue references to the current surroundings
5. Context clues (weather, sounds, smells suggesting indoor/outdoor/urban/rural)

## Important Rules
- Always extract the CURRENT location, not past locations mentioned in memory/flashback
- If the character is moving, use their FINAL position in the passage
- **If location is not explicit, infer from context clues and INVENT specific names that fit the setting**
- When a bar is mentioned, give it a name like "The Rusty Nail" or "The Blue Moon Lounge"
- When a city/neighborhood isn't specified, infer one that fits the context (e.g., "Shoreditch, London" for a nightclub scene)
- Character cards may specify the setting - use this if no explicit location is given
- For fantasy/sci-fi, describe locations as they exist within the narrative world
- Position should never be empty if the character's specific location is described
- The location being DISCUSSED in dialogue may differ from where the scene takes place
- Be creative with place names - "Downtown bar" should become "The Iron Horse Saloon" or similar
- **CRITICAL: Position is a SCENE location (room, corner, area), NOT a character's body position. Write "Corner booth" not "Sitting in corner booth". Write "By the fireplace" not "Seated by the fireplace". Write "Kitchen" not "Standing in the kitchen".**

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Messages to Analyze
{{messages}}

## Task
Extract the current location from these messages. Think through the location clues carefully, identifying area, place, position, and location type, then provide your answer as JSON.

Remember:
- Area = broadest (neighborhood, region, district)
- Place = specific (building, establishment, landmark)
- Position = scene landmark or room within the place (NOT character posture - write "Corner booth" not "Sitting in corner booth")
- locationType = "outdoor", "modern", "heated", "unheated", "underground", "tent", or "vehicle"
- Focus on CURRENT location, not past or discussed locations
- INVENT specific place names when not given (e.g., "The Rusty Nail bar" not just "a bar")
- Infer city/neighborhood from context clues`,

	responseSchema: initialLocationSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedInitialLocation | null {
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
		if (typeof parsed.area !== 'string' || parsed.area.trim() === '') return null;
		if (typeof parsed.place !== 'string' || parsed.place.trim() === '') return null;
		if (typeof parsed.position !== 'string' || parsed.position.trim() === '')
			return null;

		// Validate locationType - default to 'outdoor' if missing or invalid
		if (
			typeof parsed.locationType !== 'string' ||
			!isValidLocationType(parsed.locationType)
		) {
			parsed.locationType = 'outdoor';
		}

		return parsed as unknown as ExtractedInitialLocation;
	},
};
