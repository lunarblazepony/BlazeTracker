/**
 * Climate Change Event Prompt
 *
 * Detects changes in weather conditions or temperature during roleplay.
 */

import type { PromptTemplate } from '../types';
import type { ExtractedClimateChange } from '../../types/extraction';
import { climateChangeSchema } from '../schemas';
import { PLACEHOLDERS } from '../placeholders';
import { parseJsonResponse } from '../../../utils/json';

const GOOD_EXAMPLES = `
## Good Examples

### Example 1: Storm Rolling In
INPUT:
Current climate: 72F, clear and sunny
"""
Marcus: *The first rumble of thunder caught them both off guard. Marcus looked up from his book to see dark clouds gathering on the horizon, their edges tinged an ominous green. "That came out of nowhere," he muttered, watching the wind pick up and send leaves skittering across the patio. The temperature seemed to drop ten degrees in minutes as the storm front approached. Elena started gathering their picnic supplies as the first fat raindrops began to fall, splattering against the stone table. Within moments, the sunny afternoon had transformed into a premature twilight.*
"""
OUTPUT:
{
  "reasoning": "The text describes a dramatic weather change: storm clouds gathering, thunder, wind picking up, temperature dropping 'ten degrees in minutes' (from 72F would be around 62F), and rain beginning to fall. The sunny conditions have changed to stormy. This is an explicit climate change.",
  "changed": true,
  "temperature": 62,
  "conditions": "Stormy, dark clouds, thunder, wind, beginning to rain"
}

### Example 2: No Change - Just Weather Observation
INPUT:
Current climate: 55F, overcast and drizzly
"""
Sarah: *She pulled her umbrella tighter against the persistent drizzle as she walked to her car. The gray sky offered no hope of sunshine, but at least the rain hadn't gotten any worse. Same dreary weather as yesterday, as the day before that. Seattle in November, she thought with resignation. Nothing changes but the date on the calendar.*
"""
OUTPUT:
{
  "reasoning": "The text describes the same weather conditions that are already tracked: drizzle, gray/overcast sky. The character notes it's 'same dreary weather' and 'nothing changes.' There's no indication of temperature change. The climate remains as it was.",
  "changed": false
}

### Example 3: Moving from Outdoor to Indoor Climate
INPUT:
Current climate: 28F, snowing heavily, outdoors
"""
Detective Reyes: *The apartment building's lobby was a blessed relief from the brutal cold outside. Reyes stamped the snow off her boots on the mat, feeling her frozen face begin to thaw in the heated air. The building superintendent kept it almost tropically warm, she noted with gratitude - must be at least 75 degrees in here. Steam rose from her damp coat as the moisture evaporated. Through the glass doors, she could see the snow still coming down in thick curtains, but in here, it might as well have been summer.*
"""
OUTPUT:
{
  "reasoning": "The character moves from outside (28F, heavy snow) to inside a heated lobby. The indoor temperature is explicitly noted as 'at least 75 degrees.' While the outdoor weather hasn't changed (still snowing heavily), the scene's climate has shifted because the character is now indoors in a controlled environment. I'll update to reflect the indoor climate.",
  "changed": true,
  "temperature": 75,
  "conditions": "Indoor heated lobby, warm, snow visible outside"
}

### Example 4: Gradual Temperature Rise
INPUT:
Current climate: 78F, sunny, morning
"""
Elena: *By noon, the heat had become oppressive. Elena fanned herself with a magazine, watching the shimmer of heat rising from the pavement. The morning's pleasant warmth had given way to the full fury of a Texas summer afternoon. The thermometer on the bank across the street flashed 97 degrees, and she believed every digit. Even the shade offered little relief, the air itself feeling thick and hostile. She'd need to find somewhere with air conditioning soon or risk melting into the sidewalk.*
"""
OUTPUT:
{
  "reasoning": "Clear time progression from morning to noon with significant temperature increase. The text explicitly shows the bank thermometer reading 97 degrees, up from the previous 78F. The conditions remain sunny but now explicitly described as oppressively hot. This is a definite climate change.",
  "changed": true,
  "temperature": 97,
  "conditions": "Sunny, oppressively hot, heat waves visible, summer intensity"
}

### Example 5: Fog Rolling In
INPUT:
Current climate: 60F, clear evening
"""
The harbor scene transformed as the sun dipped below the horizon. Within minutes, the crystal-clear evening gave way to a thick fog that rolled in from the sea like a living thing. Marcus could barely see ten feet in front of him now, the lighthouse beam reduced to a diffuse glow somewhere in the murk. The temperature hadn't changed much, but the fog brought a damp chill that seeped through his jacket. Ship horns began their mournful warnings somewhere in the invisible harbor, their sources impossible to locate.*
"""
OUTPUT:
{
  "reasoning": "The weather has changed significantly - clear conditions have given way to thick fog. The text says 'temperature hadn't changed much' suggesting only a slight drop, perhaps a few degrees due to the damp chill. I'll estimate 57F (slight cooling from fog). The main change is visibility and conditions.",
  "changed": true,
  "temperature": 57,
  "conditions": "Dense fog, low visibility, damp, foggy harbor evening"
}

### Example 6: Rain Stopping
INPUT:
Current climate: 65F, heavy rain, thunderstorm
"""
Narrator: *As suddenly as it had begun, the storm passed. The rain tapered off to a gentle patter, then stopped entirely, leaving the world washed clean and glistening. Elena stepped out from under the awning where she'd been sheltering, looking up at the sky. Patches of blue were already visible between the retreating clouds, and a rainbow arced across the eastern sky. The air smelled of wet earth and ozone, that peculiar freshness that only comes after a good storm. Puddles dotted the parking lot like mirrors reflecting the emerging sun.*
"""
OUTPUT:
{
  "reasoning": "The storm has ended - rain stopped, clouds retreating, blue sky appearing, rainbow visible. The temperature likely hasn't changed dramatically (post-storm air is often similar), but conditions have shifted completely from heavy rain and thunderstorm to clearing skies. This is a significant weather change.",
  "changed": true,
  "temperature": 65,
  "conditions": "Clearing, post-storm, wet surfaces, rainbow, patches of blue sky"
}

### Example 7: Night Bringing Temperature Drop
INPUT:
Current climate: 85F, clear, afternoon
"""
Marcus: *The desert night descended with shocking speed once the sun disappeared behind the dunes. One moment the sand was still radiating the day's heat, the next Marcus was reaching for his jacket as the temperature plummeted. He'd been warned about this - the desert gives nothing away for free, and every scorching day demands payment in a freezing night. His breath was beginning to fog as he added more wood to the campfire, the flames seeming more precious with each passing minute. The stars emerged in their countless thousands, a cold and distant audience to his shivering.*
"""
OUTPUT:
{
  "reasoning": "Clear description of significant temperature drop as night falls in the desert. The character's breath is fogging and he's shivering, needing a jacket and campfire. Desert night temperatures can drop 40-50 degrees from daytime. From 85F afternoon to breath-fogging cold suggests around 45-50F. The sky remains clear but it's now night.",
  "changed": true,
  "temperature": 48,
  "conditions": "Clear night, desert cold, stars visible, temperature dropped sharply"
}

### Example 8: Indoor Climate Control Change
INPUT:
Current climate: 72F, climate-controlled office
"""
IT Manager: *"The AC's been out since this morning," Chen explained, wiping sweat from his brow. "Building maintenance says three hours minimum." The server room was already approaching dangerous temperatures, fans whirring at maximum capacity in a futile attempt to compensate. The office floor wasn't much better - Chen had already sent half his team home rather than watch them wilt in the steadily climbing heat. His desktop thermometer read 86 degrees and rising. The windows didn't open, of course. Modern building design at its finest.*
"""
OUTPUT:
{
  "reasoning": "The AC failure has caused indoor temperature to rise from the normal 72F to a measured 86F (and still rising). This is a significant climate change caused by equipment failure rather than weather, but it still affects the scene's climate. The conditions have changed from comfortable to uncomfortably hot.",
  "changed": true,
  "temperature": 86,
  "conditions": "Indoor, no AC, hot and rising, uncomfortable"
}

### Example 9: Snow Starting
INPUT:
Current climate: 35F, overcast, winter
"""
Elena: *The first snowflake landed on her nose, so light she almost missed it. Then another, and another, until the air was thick with them. She held out her palm, watching the delicate crystals accumulate - already they were beginning to dust the cars in the parking lot, the trees, her own dark hair. "Finally," she breathed, a smile spreading across her face. She'd been waiting for this all December. The overcast sky seemed to lower, heavy with its burden, as the snow began falling in earnest. Within minutes, visibility had dropped significantly.*
"""
OUTPUT:
{
  "reasoning": "Snow has started falling, transitioning from plain overcast conditions to active snowfall. The temperature is likely unchanged or slightly lower (still around 35F or dropping toward 32F for snow to stick). The key change is the precipitation - from no snow to snow falling 'in earnest' with reduced visibility.",
  "changed": true,
  "temperature": 33,
  "conditions": "Snowing, moderate snowfall, reduced visibility, overcast"
}

### Example 10: Extreme Weather Event
INPUT:
Current climate: 88F, hot and humid, partly cloudy
"""
The tornado siren began its wail just as the sky turned that sickly yellow-green that every Midwesterner learns to fear. Marcus grabbed his daughter and ran for the basement, the wind already howling loud enough to be heard over the siren. Through the kitchen window, he caught a glimpse of the funnel cloud - close, too close, touching down in what looked like the Henderson's cornfield. The house shuddered as the pressure dropped, his ears popping painfully. Hail began hammering the roof, stones the size of golf balls leaving dents in his truck visible even through the chaos. Then the power went out, and there was only the roar.*
"""
OUTPUT:
{
  "reasoning": "Extreme weather change - a tornado is touching down with associated severe conditions: dangerous winds, dramatic pressure drop, large hail, power outage. Temperature often drops in such storms due to downdrafts, perhaps to 70F or lower. The conditions have changed catastrophically from partly cloudy to active tornado with hail.",
  "changed": true,
  "temperature": 70,
  "conditions": "Tornado, severe thunderstorm, large hail, dangerous winds, emergency"
}

### Example 11: Seasonal Transition Scene
INPUT:
Current climate: 45F, cool autumn
"""
Three months had passed since that autumn day. Sarah stood at the same window, but the view had transformed utterly. Snow blanketed everything now, the trees bare skeletons against a white world. The thermometer read 12 degrees, and frost had etched intricate patterns on the inside of the glass. She pressed her palm against it, feeling the cold bite through immediately. Winter had arrived with a vengeance while she'd been lost in her grief, and now it held the landscape in its frozen grip.*
"""
OUTPUT:
{
  "reasoning": "A three-month time skip has occurred, transitioning from autumn to deep winter. The thermometer explicitly shows 12 degrees (down from 45F). Everything is now snow-covered with frost on windows. This is a major climate change due to seasonal progression.",
  "changed": true,
  "temperature": 12,
  "conditions": "Winter, snow-covered, frost, deep cold"
}

### Example 12: Magical/Fantasy Weather Change
INPUT:
Current climate: 65F, clear day
"""
Archmage Theron: *The ritual reached its crescendo, and with a final word of power, Theron unleashed the spell. The effect was immediate and dramatic. Clouds boiled into existence from nothing, swirling in an unnatural vortex above the tower. Lightning crackled within them, purple and wrong, as the temperature plummeted. Frost began spreading across the battlements, ice crystals forming on stone that had been warm moments ago. "Winter's Touch," Theron breathed, watching his creation. "Let the siege break against eternal cold." Snow began to fall, impossibly, from the conjured storm - a supernatural blizzard contained within the castle's wards.*
"""
OUTPUT:
{
  "reasoning": "Magical weather manipulation creates an artificial winter storm. Temperature drops dramatically ('frost began spreading', 'ice crystals'), clouds and snow appear from nothing. The magical blizzard is localized but represents a complete climate change for the scene. I'll estimate a significant drop to below freezing, around 25F for frost and snow conditions.",
  "changed": true,
  "temperature": 25,
  "conditions": "Magical blizzard, supernatural cold, purple lightning, conjured snow and frost"
}
`;

const BAD_EXAMPLES = `
## Bad Examples (What NOT to do)

### Bad Example 1: Assuming Change Without Evidence
INPUT:
Current climate: 70F, partly cloudy
"""
Elena checked her watch - three hours had passed since she'd started reading. She stretched, working out the kinks in her neck, and went to refill her coffee.
"""
WRONG OUTPUT:
{
  "reasoning": "Three hours passed, so weather probably changed.",
  "changed": true,
  "temperature": 65,
  "conditions": "Cloudy"
}
WHY THIS IS WRONG: Time passing doesn't automatically mean weather changed. There's no description of weather in this passage. Without evidence of climate change, report changed: false.

### Bad Example 2: Confusing Character Sensation with Climate
INPUT:
Current climate: 72F, mild
"""
Marcus: *Fear gripped him, cold and absolute. He felt frozen in place, his blood turning to ice as the implications sank in. A chill ran down his spine that had nothing to do with the temperature.*
"""
WRONG OUTPUT:
{
  "reasoning": "Marcus feels cold and frozen, his blood is like ice.",
  "changed": true,
  "temperature": 55,
  "conditions": "Cold, chilling"
}
WHY THIS IS WRONG: The text explicitly states the chill "had nothing to do with the temperature." These are emotional/fear sensations, not actual climate conditions. The weather hasn't changed at all.

### Bad Example 3: Treating Description of Same Weather as Change
INPUT:
Current climate: 85F, hot and humid
"""
The humidity was oppressive, making every breath feel like drinking warm water. Sarah's shirt clung to her back with sweat as she trudged toward the bus stop. Summer in Houston was always like this - relentlessly, aggressively hot.
"""
WRONG OUTPUT:
{
  "reasoning": "The text describes oppressive humidity and relentless heat.",
  "changed": true,
  "temperature": 92,
  "conditions": "Extremely hot and humid, oppressive"
}
WHY THIS IS WRONG: This is a description of the SAME hot, humid weather already tracked (85F, hot and humid). The character is just experiencing and commenting on existing conditions. No actual change occurred. "Always like this" confirms it's the normal state.

### Bad Example 4: Changing Based on Memory/Flashback
INPUT:
Current climate: 68F, rainy
"""
Looking at the rain, Marcus was transported back to that summer in Arizona. The desert sun had been merciless, easily 110 degrees in the shade - if you could find shade. He'd nearly gotten heatstroke that day, a lesson he never forgot. The memory made him almost grateful for the dreary rain outside.*
"""
WRONG OUTPUT:
{
  "reasoning": "The scene mentions 110 degree desert heat in Arizona.",
  "changed": true,
  "temperature": 110,
  "conditions": "Desert heat, merciless sun"
}
WHY THIS IS WRONG: The Arizona heat is a MEMORY, not current conditions. The current scene is still rainy at 68F. The character is remembering the past while looking at present rain. Only report changes to CURRENT climate.

### Bad Example 5: Wrong Temperature Units
INPUT:
Current climate: 75F, warm
"""
The weather report on the radio announced temperatures reaching 30 degrees by afternoon. Elena groaned - she'd worn entirely the wrong outfit for this heat.
"""
WRONG OUTPUT:
{
  "reasoning": "Radio says 30 degrees.",
  "changed": true,
  "temperature": 30,
  "conditions": "Cold"
}
WHY THIS IS WRONG: Given the context (Elena complaining about heat, wrong outfit for heat), "30 degrees" is clearly Celsius, not Fahrenheit. 30C = 86F. The climate IS changing, but the temperature should be reported as 86F in Fahrenheit, not 30.

### Bad Example 6: Forecasting Future Weather as Current
INPUT:
Current climate: 72F, clear
"""
"Severe thunderstorms expected this evening," the weatherman droned. "We're looking at possible tornado watches for the tri-county area starting around 8 PM. For now, enjoy this beautiful afternoon while it lasts."
"""
WRONG OUTPUT:
{
  "reasoning": "Thunderstorms and tornadoes are coming.",
  "changed": true,
  "temperature": 72,
  "conditions": "Severe thunderstorms, tornado watches"
}
WHY THIS IS WRONG: The storms are FORECASTED for later (8 PM), not current. "For now, enjoy this beautiful afternoon" confirms current conditions are still clear and nice. Only report current conditions, not forecasts.

### Bad Example 7: Conflating Lighting with Weather
INPUT:
Current climate: 70F, overcast
"""
The stage lights blazed down on Elena, their heat intense after hours of rehearsal. Sweat dripped from her brow as she finished the final number, the spotlights turning everything into a sauna. The director finally called cut, and the harsh lights dimmed to blessed darkness.
"""
WRONG OUTPUT:
{
  "reasoning": "The scene is now hot due to lights, like a sauna.",
  "changed": true,
  "temperature": 95,
  "conditions": "Hot, intense heat from lights"
}
WHY THIS IS WRONG: Stage lights are not weather. The heat from lighting equipment doesn't change the climate/weather, which remains overcast at 70F. Artificial heat sources don't count as climate changes.

### Bad Example 8: Missing Obvious Climate Change
INPUT:
Current climate: 65F, light rain
"""
The hurricane made landfall just after midnight, 140-mile-per-hour winds tearing the roof off the neighbor's house like paper. Elena huddled in the bathtub, the house shaking around her, windows exploding inward despite the boards they'd nailed up. The rain came sideways, horizontal, forcing its way through every crack. She'd never known fear like this.*
"""
WRONG OUTPUT:
{
  "reasoning": "It's still raining, so the conditions are similar.",
  "changed": false
}
WHY THIS IS WRONG: A category 4+ hurricane is MASSIVELY different from "light rain"! This is an extreme weather change that absolutely needs to be tracked. The conditions should update to reflect hurricane-force winds, extreme rain, and dangerous conditions.

### Bad Example 9: Treating Mood Descriptions as Weather
INPUT:
Current climate: 55F, cloudy
"""
The atmosphere in the room turned cold as Elena's words hung in the air. Marcus felt a storm brewing between them, tension crackling like lightning. Dark clouds of anger gathered in his expression.
"""
WRONG OUTPUT:
{
  "reasoning": "The atmosphere is cold, there's a storm brewing with tension like lightning, and dark clouds are mentioned.",
  "changed": true,
  "temperature": 40,
  "conditions": "Cold, stormy, lightning"
}
WHY THIS IS WRONG: These are METAPHORS for emotional tension, not actual weather. "Atmosphere turned cold" refers to emotional coldness. "Storm brewing" means an argument. "Dark clouds of anger" is about facial expression. The actual climate hasn't changed.

### Bad Example 10: Changing Climate Due to Location Move (Wrongly)
INPUT:
Current climate: 78F, sunny (at the beach)
"""
Elena headed inside the beach house to make lunch, the screen door banging shut behind her. The kitchen was dim and cool after the brightness outside.
"""
WRONG OUTPUT:
{
  "reasoning": "She's now indoors where it's cool and dim.",
  "changed": true,
  "temperature": 68,
  "conditions": "Indoor, dim, cool"
}
WHY THIS IS WRONG: While moving indoors does change the immediate environment, the WEATHER hasn't changed. The outdoor climate is still 78F and sunny. If tracking overall scene climate includes the indoor transition, that's valid - but "dim" is lighting, not weather. The outdoor conditions remain unchanged.

### Bad Example 11: Treating Time of Day as Temperature Change
INPUT:
Current climate: 75F, clear
"""
The sun set over the mountains, painting the sky in brilliant oranges and pinks. Elena watched from the porch, a glass of wine in hand, as day gave way to night.
"""
WRONG OUTPUT:
{
  "reasoning": "Sunset means it's getting colder now.",
  "changed": true,
  "temperature": 60,
  "conditions": "Clear, sunset, cooling"
}
WHY THIS IS WRONG: While temperatures often drop at sunset, this passage doesn't describe any temperature change or cooling sensation. It only describes the visual beauty of sunset. Without evidence of temperature change (character getting cold, needing jacket, etc.), don't assume one happened.

### Bad Example 12: Changing Based on Unrelated Dialogue
INPUT:
Current climate: 82F, humid
"""
"Remember that blizzard last December?" Marcus asked. "Three feet of snow in one night. I was stuck at the office for two days."
Elena laughed. "How could I forget? My pipes froze."
"""
WRONG OUTPUT:
{
  "reasoning": "They're discussing a blizzard with heavy snow and freezing temperatures.",
  "changed": true,
  "temperature": 25,
  "conditions": "Blizzard, heavy snow, freezing"
}
WHY THIS IS WRONG: They're discussing a past blizzard from last December, not current conditions. The current climate remains 82F and humid. Conversation about past weather events doesn't change present conditions.
`;

export const climateChangePrompt: PromptTemplate<ExtractedClimateChange> = {
	name: 'climate_change',
	description: 'Detect changes in weather conditions or temperature',

	placeholders: [
		PLACEHOLDERS.messages,
		PLACEHOLDERS.currentWeather,
		PLACEHOLDERS.characterName,
	],

	systemPrompt: `You are analyzing roleplay messages to detect changes in climate (temperature and weather conditions).

## Your Task
Determine if the weather or temperature has changed from the current tracked conditions.

## Output Format
Respond with a JSON object containing:
- "reasoning": Your analysis of whether climate changed
- "changed": Boolean indicating if climate has changed
- If changed is true, also include:
  - "temperature": New temperature in Fahrenheit
  - "conditions": New weather conditions description

## What Counts as Climate Change
- Explicit weather changes (rain starting/stopping, storm arriving/passing, etc.)
- Explicit temperature changes (thermometer readings, "temperature dropped", etc.)
- Moving from outdoor to indoor (controlled climate) or vice versa
- Time-based changes with explicit weather description (morning to hot afternoon, etc.)
- Seasonal transitions (if time skip occurs)
- Magical or supernatural weather manipulation

## What Does NOT Count as Climate Change
- Character emotional states described with weather metaphors ("icy stare", "stormy mood")
- Memories or flashbacks to different weather
- Weather FORECASTS (unless they become current)
- Same weather being described again (commentary on existing conditions)
- Fear/emotion causing character to "feel cold"
- Artificial heat/cold sources (stage lights, open freezer) unless they define the scene
- Time passing without any weather description

## Temperature Guidelines
- Always report temperature in Fahrenheit
- If given in Celsius, convert: F = (C × 9/5) + 32
- Reference guide:
  - Extreme cold: Below 0°F
  - Very cold (snow, frost): 0-32°F
  - Cold: 32-50°F
  - Cool: 50-65°F
  - Comfortable: 65-75°F
  - Warm: 75-85°F
  - Hot: 85-95°F
  - Extreme heat: Above 95°F

## Conditions Description
- Be specific but concise
- Include: precipitation type, cloud cover, wind, visibility
- Note if indoors with climate control
- Include severity for extreme weather (light rain vs downpour)

${GOOD_EXAMPLES}

${BAD_EXAMPLES}
`,

	userTemplate: `## Character Context
Name: {{characterName}}

## Current Climate
{{currentWeather}}

## New Message to Analyze
{{messages}}

## Task
Determine if the weather or temperature has changed based on this message. Only report a change if there's explicit evidence.

Remember:
- Report temperature in Fahrenheit
- Metaphorical weather (emotional descriptions) is not real weather
- Memories/forecasts are not current conditions
- Same weather being described ≠ change`,

	responseSchema: climateChangeSchema,

	defaultTemperature: 0.3,

	parseResponse(response: string): ExtractedClimateChange | null {
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

		// If changed, validate optional fields
		if (parsed.changed) {
			if (
				parsed.temperature !== undefined &&
				typeof parsed.temperature !== 'number'
			)
				return null;
			if (
				parsed.conditions !== undefined &&
				typeof parsed.conditions !== 'string'
			)
				return null;

			// Clamp temperature to reasonable range if provided
			if (typeof parsed.temperature === 'number') {
				if (parsed.temperature < -100 || parsed.temperature > 150)
					return null;
			}
		}

		return parsed as unknown as ExtractedClimateChange;
	},
};
