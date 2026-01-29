/**
 * Location Change Detection Prompt
 *
 * Detects whether the location has changed between messages and extracts new location details.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedLocationChange } from '../../types/extraction';
import { isValidLocationType } from '../../types/common';
import { locationChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Complete Location Change - Different Building
INPUT:
"""
Current location: Downtown Seattle - The Rusty Nail bar - Corner booth near the back

Elena: *The cold night air hit her like a wall as she pushed through the bar's heavy door and onto the street. She walked three blocks to the all-night diner on Pike Street, shoulders hunched against the wind. The Starlight Diner was nearly empty when she slid into a vinyl booth by the window. A tired waitress approached with a coffee pot and a questioning look.*
"""
OUTPUT:
{
  "reasoning": "Elena leaves The Rusty Nail bar, walks three blocks, and enters The Starlight Diner. This is a complete location change - new place (diner instead of bar), and new position (vinyl booth by window instead of corner booth in back).",
  "changed": true,
  "newArea": "Downtown Seattle",
  "newPlace": "The Starlight Diner",
  "newPosition": "Vinyl booth by the window"
}

### Example 2: Position Change Within Same Place
INPUT:
"""
Current location: Manhattan - Grand Central Terminal - Main concourse near the information booth

Marcus: *He spotted her at the far end of the terminal, near the Oyster Bar entrance. Weaving through the crowd of commuters, he made his way across the vast marble floor. The celestial ceiling stretched overhead, its painted constellations backwards but no less beautiful for it. He reached her side, slightly out of breath from the rush. She was leaning against the brass railing outside the restaurant, checking her phone.*
"""
OUTPUT:
{
  "reasoning": "Marcus moves from the main concourse near the information booth to near the Oyster Bar entrance. He's still in Grand Central Terminal, still in Manhattan, but his specific position has changed. This is a position-only change.",
  "changed": true,
  "newPosition": "Outside the Oyster Bar entrance, leaning against the brass railing"
}

### Example 3: No Change - Continuous Scene
INPUT:
"""
Current location: Chicago - The Drake Hotel - Presidential suite living room

Detective Chen: *She set down her glass of sparkling water and leaned forward, studying the suspect across the ornate coffee table. The afternoon light through the tall windows cast long shadows across the Persian rug. "Let's try this again," she said, her voice deceptively calm. "Where were you on the night of the murder?" The man shifted in his chair, not meeting her eyes. The tension in the room was palpable. Outside, a siren wailed in the distance, then faded.*
"""
OUTPUT:
{
  "reasoning": "The scene continues in the same location - the Presidential suite living room at The Drake Hotel. Detective Chen sets down her glass and speaks to the suspect, but no one moves to a new location. This is the same continuous scene.",
  "changed": false
}

### Example 4: Moving Between Rooms in Same Building
INPUT:
"""
Current location: Boston - Mass General Hospital - Emergency Room waiting area

Dr. Reyes: *The page came through just as she was finishing with the anxious father. She excused herself and hurried through the automatic doors, down the corridor painted in that particular shade of institutional green, and into Trauma Bay 3. The patient on the table was young - too young - with a gash across his forehead and blood soaking through the temporary bandages. Her team was already assembled and waiting. "What do we have?" she asked, snapping on her gloves.*
"""
OUTPUT:
{
  "reasoning": "Dr. Reyes moves from the ER waiting area to Trauma Bay 3. She's still in Mass General Hospital in Boston, but the specific room/area has changed. This is a position change within the same building.",
  "changed": true,
  "newPosition": "Trauma Bay 3"
}

### Example 5: Fantasy Location Change
INPUT:
"""
Current location: The Silverwood Forest - Ancient Oak clearing - Beside the moonwell

Lyra: *The portal's swirling energy embraced her, and for a moment she felt herself stretched across impossible distances. When reality snapped back into focus, she stood on the obsidian platform of the Shadow Citadel, high in the Ironspine Mountains. The air here was thin and cold, carrying the acrid smell of volcanic sulfur. Torches lined the walls, their purple flames casting unsettling shadows. A hooded figure waited at the far end of the chamber.*
"""
OUTPUT:
{
  "reasoning": "Lyra uses a portal to travel from the Silverwood Forest to the Shadow Citadel in the Ironspine Mountains. This is a complete location change - new area (mountains instead of forest), new place (citadel instead of clearing), new position (on the obsidian platform).",
  "changed": true,
  "newArea": "Ironspine Mountains",
  "newPlace": "The Shadow Citadel",
  "newPosition": "Obsidian platform in the entrance chamber"
}

### Example 7: Outdoor Position Change - Same General Area
INPUT:
"""
Current location: Central Park, New York - The Great Lawn - Near the old oak tree

Alex: *The concert was over, and the crowd was dispersing in all directions. Alex packed up the blanket and empty wine bottle, then followed the winding path toward the Bethesda Fountain. The evening had cooled, and the fountain's angel statue gleamed silver in the lamplight. He sat on the edge of the fountain, watching the last stragglers make their way home, enjoying the rare quiet of the park at night.*
"""
OUTPUT:
{
  "reasoning": "Alex moves from the Great Lawn to Bethesda Fountain. He's still in Central Park in New York, but the specific place within the park has changed (from open lawn to the fountain area), and the scene is now at the fountain edge.",
  "changed": true,
  "newPlace": "Bethesda Fountain",
  "newPosition": "Edge of the fountain"
}

### Example 8: Entering a Building from Outside
INPUT:
"""
Current location: San Francisco - North Beach neighborhood - Corner of Columbus and Broadway

Mira: *She pushed through the door of City Lights bookstore, the bell announcing her arrival with a cheerful jingle. The narrow aisles stretched before her, walls of books reaching toward the ceiling. The musty smell of old paper and ink wrapped around her like a familiar embrace. She made her way to the poetry section in the back, running her fingers along the spines as she walked, looking for that specific anthology her professor had mentioned.*
"""
OUTPUT:
{
  "reasoning": "Mira enters City Lights bookstore from the street corner. She's still in North Beach, San Francisco, but she's now inside the bookstore instead of on the street, and her position is in the poetry section.",
  "changed": true,
  "newPlace": "City Lights bookstore",
  "newPosition": "Poetry section in the back"
}

### Example 9: Vehicle as Transitional Location
INPUT:
"""
Current location: Brooklyn - Apartment on 5th Street - Living room couch

James: *The Lyft arrived exactly on time. James grabbed his overnight bag and headed downstairs, sliding into the back seat with a muttered greeting to the driver. The car pulled away from the curb, and he watched his neighborhood slide past the window - the corner bodega, the dog park, the elementary school where kids were just getting out. An hour and forty-five minutes later, the car deposited him at JFK Terminal 4. He stepped out into the organized chaos of departures, dragging his bag toward the Delta check-in.*
"""
OUTPUT:
{
  "reasoning": "James leaves his Brooklyn apartment and takes a Lyft to JFK Airport. The final location is JFK Terminal 4 - this is a significant area change (Brooklyn to JFK), place change (apartment to airport terminal), and position (outside Delta check-in).",
  "changed": true,
  "newArea": "JFK Airport",
  "newPlace": "Terminal 4",
  "newPosition": "Outside Delta check-in area"
}

### Example 10: Sci-Fi Location Change Between Ships/Stations
INPUT:
"""
Current location: Deep Space Station Prometheus - Observation deck - Viewing gallery

Commander Vex: *The shuttle docked with a gentle thump, and Vex released her harness. The trip from the station to the Artemis had taken six hours, and she was eager to stretch her legs on something larger than a personnel transport. She stepped through the airlock into the battleship's cavernous hangar bay, where rows of fighters sat in orderly lines. The air smelled of machine oil and recycled atmosphere. An ensign saluted and offered to escort her to the bridge.*
"""
OUTPUT:
{
  "reasoning": "Commander Vex travels by shuttle from Deep Space Station Prometheus to the battleship Artemis. The area changes (from the station to the ship), the place changes (from observation deck to hangar bay), and position is now in the hangar.",
  "changed": true,
  "newArea": "Battleship Artemis",
  "newPlace": "Hangar bay",
  "newPosition": "Near the airlock entrance"
}

### Example 11: Moving Deeper Into Same Building - Floor Change
INPUT:
"""
Current location: Tokyo - Shibuya 109 department store - Ground floor entrance

Luna: *The escalator carried her up past floors of trendy boutiques, each level a different explosion of fashion and sound. She rode all the way to the fifth floor, where the vintage shops clustered together in a maze of narrow aisles. The store she was looking for was tucked in a corner, its window display featuring a 1960s-inspired dress that had caught her eye online. She ducked inside, immediately enveloped by the sweet smell of old fabric and nostalgia.*
"""
OUTPUT:
{
  "reasoning": "Luna travels from the ground floor to the fifth floor of the same department store and enters a specific vintage shop. The area and building haven't changed, but the specific place within the building has (ground floor entrance to fifth floor vintage shop).",
  "changed": true,
  "newPlace": "Fifth floor vintage shop",
  "newPosition": "Inside the shop entrance"
}

### Example 12: Underground/Subterranean Movement
INPUT:
"""
Current location: London - Westminster Underground Station - Platform level

Dr. Reyes: *The tube train rattled through the darkness for what felt like an eternity before finally slowing at her stop. She pushed her way off the crowded car and up the escalator, emerging into the chaos of Oxford Circus. The November rain had started, and she ducked under the awning of a nearby Boots pharmacy to check her phone for directions. The address she was looking for was only three blocks away, past the tourist crowds on Regent Street.*
"""
OUTPUT:
{
  "reasoning": "Dr. Reyes takes the tube from Westminster to Oxford Circus and exits to street level. This is an area change (Westminster to Oxford Circus), place change (underground platform to street level), and specific position (under the Boots pharmacy awning).",
  "changed": true,
  "newArea": "Oxford Circus",
  "newPlace": "Regent Street",
  "newPosition": "Under the awning of Boots pharmacy"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Confusing Memory of Location for Actual Movement
INPUT:
"""
Current location: Seattle - Pike Place Market - Near the fish throwers

Elena: *She remembered the cabin in the mountains, the way the snow had piled against the windows that winter. They had been happy there, before everything fell apart. The memory ached like an old wound. Back in the present, a tourist jostled her shoulder, breaking the spell. The fish market continued its noisy chaos around her, vendors shouting their prices.*
"""
WRONG OUTPUT:
{
  "reasoning": "Elena is thinking about a cabin in the mountains, so she must be there now.",
  "changed": true,
  "newArea": "Mountains",
  "newPlace": "Cabin",
  "newPosition": "By the snow-covered windows"
}
WHY THIS IS WRONG: The cabin is a memory, not the current location. Elena is still at Pike Place Market - the text explicitly confirms this with "Back in the present" and describes the market around her.

### Bad Example 2: Reporting Location Change from Dialogue
INPUT:
"""
Current location: Chicago - O'Hare Airport - Terminal 3 food court

Marcus: *"So then I drove all the way to Milwaukee," he said, gesturing with his coffee cup. "Can you believe it? Three hours in traffic just to find out the meeting was cancelled." Sarah laughed sympathetically. "That's rough. Did you at least get good cheese curds while you were there?"*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus mentions driving to Milwaukee, so the location has changed to Milwaukee.",
  "changed": true,
  "newArea": "Milwaukee",
  "newPlace": "Unknown",
  "newPosition": "Unknown"
}
WHY THIS IS WRONG: Marcus is telling a story about something that happened in the past. The current scene is still at O'Hare Airport where Marcus and Sarah are having coffee.

### Bad Example 3: Using Vague Generic Descriptions Instead of Specifics
INPUT:
"""
Current location: London - St. Paul's Cathedral - Main nave

Elena: *She slipped away from the tour group and wandered deeper into the cathedral, finding a quiet corridor away from the crowds. The ancient stonework here was darker, less restored, and she could hear her own footsteps echo.*
"""
WRONG OUTPUT:
{
  "reasoning": "She moved to a different corridor in the cathedral.",
  "changed": true,
  "newPosition": "Different corridor or room within St. Paul's Cathedral"
}
WHY THIS IS WRONG: "Different corridor or room" is vague and unhelpful. When the exact location isn't stated, INVENT plausible specifics. The correct output should be something like "Quiet side corridor near the south transept" or "Dimly lit passage in the east wing". Also, Position should never restate the Place name - "within St. Paul's Cathedral" is redundant.

### Bad Example 4: Missing Partial Location Updates
INPUT:
"""
Current location: Boston - MIT Campus - Outside the Infinite Corridor

Detective Chen: *She walked inside, escaping the bitter wind. The corridor stretched before her, its famous length living up to its name. She made her way to Building 32, the Stata Center, where Professor Hammond's office waited on the third floor.*
"""
WRONG OUTPUT:
{
  "reasoning": "She went inside, but we don't know exactly where, so no change.",
  "changed": false
}
WHY THIS IS WRONG: There IS a location change - she's now inside Building 32 (Stata Center) on the third floor, heading to Professor Hammond's office. The correct response should update the place and position.

### Bad Example 5: Confusing Future Plans for Actual Movement
INPUT:
"""
Current location: Los Angeles - LAX Airport - Gate 34B waiting area

Mira: *"Once we land in Tokyo, we'll head straight to the hotel in Shinjuku," she explained to her travel companion, showing him the itinerary on her phone. "Then tomorrow morning, we'll visit the Meiji Shrine before lunch in Harajuku." The boarding announcement crackled overhead, and they gathered their carry-ons.*
"""
WRONG OUTPUT:
{
  "reasoning": "Mira discusses going to Tokyo and Shinjuku, so they must be there now.",
  "changed": true,
  "newArea": "Tokyo - Shinjuku",
  "newPlace": "Hotel",
  "newPosition": "Lobby"
}
WHY THIS IS WRONG: Mira is discussing future travel plans. They're still at LAX - the boarding announcement confirms they haven't even boarded the plane yet.

### Bad Example 6: Ignoring Significant Location Change
INPUT:
"""
Current location: San Francisco - Financial District - Office building lobby

James: *He took the elevator down to the parking garage, retrieved his car, and drove across the Golden Gate Bridge to Sausalito. The waterfront restaurant had been his suggestion for the meeting - neutral ground, good food, and far from prying eyes at the office. He pulled into the parking lot just as the sun began to set over the bay.*
"""
WRONG OUTPUT:
{
  "reasoning": "He's just getting to a meeting, but still in the general Bay Area.",
  "changed": false
}
WHY THIS IS WRONG: This is a significant location change - from the Financial District in SF to Sausalito, from an office building to a waterfront restaurant. The area, place, and position have all changed.

### Bad Example 7: Wrong Hierarchy of Location Components
INPUT:
"""
Current location: London - Soho - The Crown pub - Seat at the bar

Luna: *She excused herself and walked to the back of the pub, finding the bathroom down a narrow hallway. The lock was broken, as these things often were in old London pubs, so she wedged a foot against the door.*
"""
WRONG OUTPUT:
{
  "reasoning": "Luna moved to the bathroom, so a complete new location.",
  "changed": true,
  "newArea": "Pub bathroom",
  "newPlace": "London",
  "newPosition": "Soho"
}
WHY THIS IS WRONG: The hierarchy is completely wrong. Area should still be Soho (neighborhood), Place should still be The Crown pub (building), and only Position should change (to bathroom at the back). Also, the area/place shouldn't swap levels.

### Bad Example 8: Treating Brief Movement as Full Location Change
INPUT:
"""
Current location: Paris - Louvre Museum - In front of the Mona Lisa

Dr. Reyes: *She stepped back a few paces to get a better view, letting a group of tourists crowd in front of her. From this distance, she could better appreciate the subtle sfumato technique that made the painting famous. The crowds ebbed and flowed like tides, but she remained patient.*
"""
WRONG OUTPUT:
{
  "reasoning": "She moved back a few paces, so her position changed.",
  "changed": true,
  "newPosition": "A few paces back from the Mona Lisa"
}
WHY THIS IS WRONG: Stepping back a few paces in front of the same painting is not a meaningful position change for narrative tracking purposes. She's still in front of the Mona Lisa in the Louvre. Only report changes that affect the narrative setting.

### Bad Example 9: Not Including All Changed Components
INPUT:
"""
Current location: New York - Brooklyn Heights - Apartment living room

Alex: *The walk to Manhattan took him across the Brooklyn Bridge, the city skyline growing larger with each step. He continued through Chinatown, past the vendors selling knockoff handbags, until he reached the small tea shop on Mott Street. The bell above the door chimed as he entered, and the owner nodded in recognition.*
"""
WRONG OUTPUT:
{
  "reasoning": "He walked to a tea shop, so the place changed.",
  "changed": true,
  "newPlace": "Tea shop on Mott Street"
}
WHY THIS IS WRONG: The area also changed (from Brooklyn Heights to Chinatown in Manhattan), and the position should be specified (inside the tea shop). When multiple components change, report all of them.

### Bad Example 10: Reporting Location from Dream/Vision
INPUT:
"""
Current location: Seattle - Capitol Hill - Bedroom of small apartment

Commander Vex: *In the dream, she stood on the bridge of her old ship, the stars wheeling past the viewscreen as they jumped to hyperspace. The crew was there too, alive and whole, before the battle that took them. She could almost smell the recycled air, feel the vibration of the engines. Then the alarm blared, and she woke in her small apartment bedroom, disoriented and sweating.*
"""
WRONG OUTPUT:
{
  "reasoning": "She was on a ship's bridge in the dream, so location changed.",
  "changed": true,
  "newArea": "Space",
  "newPlace": "Ship bridge",
  "newPosition": "Command chair"
}
WHY THIS IS WRONG: The ship is a dream, not the actual location. She wakes up in her apartment bedroom in Seattle - the same place where she started.

### Bad Example 11: Changing Location Based on What Character Can See
INPUT:
"""
Current location: Miami - South Beach - Hotel balcony on the 15th floor

Mira: *From her vantage point, she could see the cruise ships lined up at the port, their lights twinkling like floating cities. Beyond them, the dark expanse of the ocean stretched to the horizon. A plane descended toward the airport, its lights blinking red and green. She sipped her wine and watched the city sparkle below.*
"""
WRONG OUTPUT:
{
  "reasoning": "She can see the port and cruise ships, so she must be at the port now.",
  "changed": true,
  "newArea": "Miami Port",
  "newPlace": "Cruise terminal",
  "newPosition": "Near the ships"
}
WHY THIS IS WRONG: Mira is looking at the port from her hotel balcony - she hasn't moved there. What a character sees doesn't mean they've traveled to that location.

### Bad Example 12: Not Recognizing Implicit Same-Building Movement
INPUT:
"""
Current location: Chicago - Willis Tower - 103rd floor Skydeck

James: *Security escorted him down to the building manager's office on the 45th floor. The elevator ride felt eternal, each floor ticking by as his anxiety mounted. When the doors finally opened, he was led through a maze of cubicles to a corner office with a spectacular view of Lake Michigan.*
"""
WRONG OUTPUT:
{
  "reasoning": "He's still in Willis Tower, so no location change occurred.",
  "changed": false
}
WHY THIS IS WRONG: While he's still in Willis Tower, there IS a meaningful location change - from the 103rd floor Skydeck (a tourist area) to the 45th floor building manager's office (a business area). The place/position within the building has significantly changed.
`;

export const locationChangePrompt: PromptTemplate<ExtractedLocationChange> = {
	name: 'location_change',
	description: 'Detect whether location has changed and extract new location details',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentArea,
		PLACEHOLDERS.currentPlace,
		PLACEHOLDERS.currentPosition,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to detect whether the narrative location has changed.

## Your Task
Read the provided roleplay messages and determine if characters have moved to a new location. Extract any changed location components (area, place, position).

## Output Format
Respond with a JSON object containing:
- "reasoning": Your step-by-step analysis of movement/location clues
- "changed": Boolean indicating whether location has changed
- "newArea": (Only if area changed) The new neighborhood, district, or general area
- "newPlace": (Only if place changed) The new specific building, establishment, or location
- "newPosition": (Only if position changed) The new exact spot within the place
- "newLocationType": (Only if indoor/outdoor status changed) One of: "outdoor", "modern", "heated", "unheated", "underground", "tent", "vehicle"

## Location Types (for climate calculations)
- **outdoor**: Outside, exposed to weather (streets, parks, forests, mountains, beaches)
- **modern**: Climate-controlled with HVAC (offices, malls, hotels, hospitals, modern apartments, space stations)
- **heated**: Traditional heating like fireplace/radiator (homes, cabins, taverns, castles, medieval buildings)
- **unheated**: Shelter but no climate control (barns, warehouses, sheds, greenhouses, garages)
- **underground**: Below ground, stable temperature (caves, basements, bunkers, mines, tunnels)
- **tent**: Minimal shelter (tents, campsites, bivouacs, yurts)
- **vehicle**: Enclosed transport (cars, trains, planes, ships, carriages, spaceships)

## Location Hierarchy
Think of location as nested containers:
- **Area** = Largest (city district, neighborhood, region - "Downtown Seattle", "Ironspine Mountains")
- **Place** = Medium (building, establishment, landmark - "The Rusty Nail bar", "Shadow Citadel")
- **Position** = Smallest (scene landmark or room, NOT character posture) - e.g., "Corner booth", "The kitchen", "Obsidian platform", "Near the entrance"

IMPORTANT: Position describes WHERE in the scene the camera is focused, like a room, corner, or local feature. It is NOT about what characters are physically doing (sitting, standing, lying). "By the windows" is correct. "Standing by the windows" is wrong - remove the character's pose.

## What Counts as Location Change
1. Moving to a different building/establishment (change place and position)
2. Moving to a different room/floor within a building (change position only)
3. Moving to a different district/neighborhood (change area, possibly place and position)
4. Teleportation/portals/vehicles completing a journey (may change all three)
5. Entering or exiting a building (change place and position)

## What Does NOT Count as Location Change
1. Brief movement within same spot (stepping back, turning around)
2. Memories or flashbacks to other locations
3. Locations mentioned in dialogue or storytelling
4. Future planned destinations not yet reached
5. Locations seen from a distance but not traveled to
6. Dream/vision sequences

## Important Rules
- Only include changed fields (don't repeat unchanged location components)
- If only position changes, omit newArea and newPlace
- If changed is false, don't include any new* fields
- Include newLocationType when moving between indoor/outdoor or different building types (e.g., entering a building, exiting to street)
- Vehicle journeys should report the final destination, not the vehicle
- Fantasy/sci-fi locations should be described as they exist in the narrative

## Inventing Specific Details
When the text is vague about exact location, INVENT plausible specific details rather than using generic descriptions:
- BAD: "Different corridor or room within the cathedral"
- GOOD: "West Wing corridor, ground floor" or "Side chapel near the entrance"
- BAD: "Another part of the building"
- GOOD: "Third floor hallway" or "East stairwell"

Be creative and specific - invent floor numbers, wing names, directional descriptions (north, south, east, west), or descriptive landmarks.

## Position Must Not Duplicate Place
Position describes WHERE within the Place - never restate or include the Place name:
- Place: "St. Cuthbert's Cathedral" + Position: "Near the altar" ✓
- Place: "St. Cuthbert's Cathedral" + Position: "Inside St. Cuthbert's Cathedral" ✗
- Place: "The Rusty Nail bar" + Position: "Corner booth" ✓
- Place: "The Rusty Nail bar" + Position: "In The Rusty Nail bar" ✗

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Current Location
Area: {{currentArea}}
Place: {{currentPlace}}
Position: {{currentPosition}}

## Messages to Analyze
{{messages}}

## Task
Determine if the location has changed. If yes, specify which components changed.

Remember:
- Area = broadest (neighborhood, region, district)
- Place = specific (building, establishment, landmark)
- Position = scene landmark or room (NOT character posture - write "By the windows" not "Standing by the windows")
- Position must NOT duplicate or restate the Place - it describes WHERE within the Place
- locationType = only include if indoor/outdoor status changed ("outdoor", "modern", "heated", "unheated", "underground", "tent", "vehicle")
- Only include fields that actually changed
- INVENT specific details when text is vague (e.g., "West corridor, 2nd floor" not "Different corridor")
- Ignore memories, dreams, and dialogue about other places`,

	responseSchema: locationChangeSchema,

	defaultTemperature: 0.5,

	parseResponse(response: string): ExtractedLocationChange | null {
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
		if (typeof parsed.changed !== 'boolean') return null;

		// If changed is true, validate optional fields
		if (parsed.changed) {
			// At least one new* field should be present
			const hasNewArea =
				typeof parsed.newArea === 'string' && parsed.newArea.trim() !== '';
			const hasNewPlace =
				typeof parsed.newPlace === 'string' &&
				parsed.newPlace.trim() !== '';
			const hasNewPosition =
				typeof parsed.newPosition === 'string' &&
				parsed.newPosition.trim() !== '';

			if (!hasNewArea && !hasNewPlace && !hasNewPosition) {
				// Changed is true but no new location specified - invalid
				return null;
			}

			// Validate that present fields are valid strings
			if (parsed.newArea !== undefined && typeof parsed.newArea !== 'string')
				return null;
			if (parsed.newPlace !== undefined && typeof parsed.newPlace !== 'string')
				return null;
			if (
				parsed.newPosition !== undefined &&
				typeof parsed.newPosition !== 'string'
			)
				return null;
		}

		// Validate newLocationType if present (optional field)
		if (parsed.newLocationType !== undefined) {
			if (
				typeof parsed.newLocationType !== 'string' ||
				!isValidLocationType(parsed.newLocationType)
			) {
				// Invalid locationType - remove it rather than failing
				delete parsed.newLocationType;
			}
		}

		return parsed as unknown as ExtractedLocationChange;
	},
};
