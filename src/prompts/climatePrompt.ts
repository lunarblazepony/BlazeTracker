// ============================================
// Climate Extraction Prompts
// ============================================

import type { PromptDefinition } from './types';
import { COMMON_PLACEHOLDERS } from './common';

export const CLIMATE_PROMPTS: Record<string, PromptDefinition> = {
	climate_initial: {
		key: 'climate_initial',
		name: 'Climate - Initial',
		description: 'Extracts weather and temperature from scene opening',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.narrativeTime,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.characterInfo,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze this roleplay scene and determine the current climate/weather. You must only return valid JSON with no commentary.

<instructions>
- Determine the weather and temperature for this scene.
- Consider the narrative time and location to infer season and typical weather.
- Look for explicit weather mentions: rain, snow, sunshine, etc.
- Look for contextual clues: characters wearing coats, sweating, mentioning cold/heat.
- If characters are indoors, weather should be what it is outside, but temperature should be indoor temperature.
- Consider the hemisphere: December is winter in the northern hemisphere, summer in the southern.
- Temperature should be in Fahrenheit.
</instructions>

<examples>
<example>
<narrative_time>Wednesday, January 15, 2024 at 7:30 PM</narrative_time>
<location>Minneapolis, Minnesota - Elena's Apartment (Living room)</location>
<input>
*Elena pressed her forehead against the cold window, watching the snow pile up on the fire escape outside. The forecast had warned about this—the worst blizzard in a decade, they said. Already the cars parked on the street below were nothing but white lumps, and the wind was howling loud enough to hear through the double-paned glass.*

*She pulled her cardigan tighter and retreated to the couch, where Marcus had made a nest of blankets. The radiator was clanking away in the corner, working overtime, but it could only do so much against a Minnesota winter.*

Marcus: "Power company says to expect outages tonight." *He held up his phone.* "I filled the bathtub just in case."

Elena: "Smart." *She curled up against him, stealing his warmth.* "I'm glad I'm not trying to drive in this."

*Another gust of wind rattled the windows, and somewhere in the building, a door slammed.*
</input>
<output>
{
  "weather": "Heavy snowfall with blizzard conditions, strong winds",
  "temperature": 68
}
</output>
<explanation>
WEATHER: Explicitly described - "worst blizzard in a decade," heavy snow visible on cars/fire escape, howling wind, windows rattling.

TEMPERATURE: 68°F - This is INDOOR temperature:
- They're inside the apartment (living room)
- Radiator is "working overtime" but "can only do so much"
- Elena is cold enough to pull cardigan tighter and seek Marcus's warmth
- 68°F represents a slightly cool but still heated indoor space during a blizzard
- Outside would be well below freezing (single digits or negative), but we report indoor temp since they're indoors

Key principle: When characters are indoors, report indoor temperature but outdoor weather. The weather affects the scene (visible through windows, wind rattling them) but temperature should reflect their immediate environment.
</explanation>
</example>

<example>
<narrative_time>Saturday, August 3, 2024 at 2:15 PM</narrative_time>
<location>Phoenix, Arizona - Desert Botanical Garden (Main pathway)</location>
<input>
*The heat was absolutely brutal. Marcus could feel sweat soaking through his shirt within minutes of leaving the air-conditioned visitor center. The sun beat down from a cloudless sky, reflecting off the pale gravel paths until he had to squint even with sunglasses.*

*Elena had insisted on seeing the saguaro collection, and he'd agreed before checking the weather. 115 degrees, the sign at the entrance had warned. Even the cacti looked like they were struggling. They passed a family heading back toward the buildings, the kids red-faced and whining, one of them being carried.*

Elena: *fanning herself with the park map* "Maybe we should have done this in the morning."

Marcus: "You think?" *He pointed to a shaded ramada up ahead.* "Let's at least get out of direct sun."

*They hurried to the shade, but it barely helped. The air itself felt like an oven, shimmering over the desert landscape in visible waves.*
</input>
<output>
{
  "weather": "Clear, cloudless, extreme sun exposure",
  "temperature": 115
}
</output>
<explanation>
WEATHER: "Clear, cloudless, extreme sun exposure"
- "cloudless sky" explicitly stated
- Emphasis on brutal direct sunlight
- No moisture, no clouds, no relief

TEMPERATURE: 115°F - OUTDOOR temperature:
- Explicitly stated on the entrance sign
- They're outdoors on the garden pathway
- Multiple heat indicators: soaking sweat, squinting, kids overheating, shimmering air
- This is actual ambient temperature, not just "feels like"

Phoenix in August commonly hits 115°F+. The scene confirms extreme heat through physical reactions (sweating through shirt, seeking shade desperately) and environmental details (shimmering air, heat waves).
</explanation>
</example>

<example>
<narrative_time>Friday, October 18, 2024 at 6:45 PM</narrative_time>
<location>Portland, Oregon - Waterfront Park (Riverside path)</location>
<input>
*The rain had been falling steadily all afternoon, the kind of gray Pacific Northwest drizzle that wasn't heavy enough for an umbrella but somehow still got you soaked. Elena pulled up the hood of her rain jacket and fell into step beside Marcus, their boots splashing through shallow puddles on the riverside path.*

*The Willamette River was high and fast-moving, swollen with runoff. Across the water, the lights of downtown Portland glowed soft and hazy through the mist. A few other hardy souls were out walking—joggers, mostly, seemingly immune to the weather.*

Marcus: "I love this, you know." *He spread his arms, letting the rain hit his face.* "Everyone else hides from it, but this is real Portland."

Elena: "You're insane." *But she was smiling.* "My socks are going to be wet for days."

*A gust of wind blew spray off the river, adding to the general dampness. The temperature had dropped since sunset, and Elena could see her breath now, thin wisps of vapor disappearing into the gray.*
</input>
<output>
{
  "weather": "Steady light rain, misty, overcast",
  "temperature": 48
}
</output>
<explanation>
WEATHER: "Steady light rain, misty, overcast"
- "Gray Pacific Northwest drizzle" - classic description of light but persistent rain
- "Mist" explicitly mentioned (downtown visible but hazy)
- Rain steady enough to soak through clothes over time
- Overcast implied by gray sky, no sun mentioned

TEMPERATURE: 48°F - OUTDOOR temperature:
- They're outside on the riverside path
- Cool enough to see breath ("thin wisps of vapor")
- Temperature "dropped since sunset" - evening in October
- 48°F is typical for Portland in October evening with rain
- Not cold enough for winter gear, but uncomfortable when wet

Note the difference from indoor scenes: here we track actual outdoor temperature since they're outside in the weather.
</explanation>
</example>
</examples>`,
		userTemplate: `<narrative_time>
{{narrativeTime}}
</narrative_time>

<location>
{{location}}
</location>

<character_info>
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

Extract the climate as valid JSON:`,
	},

	climate_update: {
		key: 'climate_update',
		name: 'Climate - Update',
		description: 'Updates weather/temperature based on recent messages',
		defaultTemperature: 0.3,
		placeholders: [
			COMMON_PLACEHOLDERS.narrativeTime,
			COMMON_PLACEHOLDERS.location,
			COMMON_PLACEHOLDERS.previousState,
			COMMON_PLACEHOLDERS.messages,
			COMMON_PLACEHOLDERS.schema,
			COMMON_PLACEHOLDERS.schemaExample,
		],
		systemPrompt: `Analyze these roleplay messages and determine if the climate has changed. You must only return valid JSON with no commentary.

<instructions>
- Check if weather or temperature has changed since the previous state.
- Weather can change: storm rolling in, rain stopping, etc.
- Temperature can change: moving indoors/outdoors, time passing, heating/AC mentioned.
- Consider the current narrative time when inferring temperature changes.
- If characters moved indoors/outdoors, adjust temperature accordingly.
- Temperature should be in Fahrenheit.
</instructions>

<examples>
<example>
<narrative_time>Saturday, August 3, 2024 at 2:45 PM</narrative_time>
<location>Phoenix, Arizona - Desert Botanical Garden (Visitor Center cafe)</location>
<previous_climate>
{
  "weather": "Clear, cloudless, extreme sun exposure",
  "temperature": 115
}
</previous_climate>
<input>
*The air conditioning hit them like a wall of blessed relief as they pushed through the visitor center doors. Marcus stood just inside the entrance for a moment, arms spread, letting the cool air wash over his sweat-soaked shirt.*

Marcus: "I'm never leaving this building."

Elena: *laughing* "Dramatic." *She made a beeline for the water fountain, drinking deeply.* "But also same."

*The cafe was sparsely populated—most sensible people had either come in the early morning or stayed home entirely. They found a table by the window, where they could watch the heat shimmer outside without being in it. A ceiling fan rotated lazily overhead, adding to the refrigerated chill.*

Elena: "I think my skin is still radiating heat."

Marcus: "Well, the sign says it's 72 in here, so you should cool down eventually." *He nodded toward a digital temperature display on the wall.*
</input>
<output>
{
  "weather": "Clear, cloudless, extreme sun exposure",
  "temperature": 72
}
</output>
<explanation>
WEATHER: UNCHANGED - "Clear, cloudless, extreme sun exposure"
- They moved indoors, but weather outside hasn't changed
- Still visible through the window (heat shimmer)
- Weather tracks outdoor conditions even when characters are inside

TEMPERATURE: 115°F -> 72°F - CHANGED due to moving indoors
- Explicitly stated on digital display: 72°F
- Strong AC indicated by "blessed relief" and "refrigerated chill"
- Dramatic contrast between outdoor heat and indoor comfort
- Temperature tracks characters' immediate environment

This is the key indoor/outdoor distinction: when characters move inside, temperature changes to reflect their environment, but weather remains the outdoor condition.
</explanation>
</example>

<example>
<narrative_time>Wednesday, January 15, 2024 at 11:30 PM</narrative_time>
<location>Minneapolis, Minnesota - Elena's Apartment (Living room)</location>
<previous_climate>
{
  "weather": "Heavy snowfall with blizzard conditions, strong winds",
  "temperature": 68
}
</previous_climate>
<input>
*The power had gone out two hours ago. Elena and Marcus huddled together on the couch under every blanket they owned, their breath visible in the flashlight beam. The radiator had gone cold and silent, and the temperature was dropping fast.*

*Outside, the storm had intensified—if that was even possible. The wind was screaming now, a constant howl that made the old building creak and groan. Through the frosted window, Elena couldn't even see the building across the street anymore, just a wall of swirling white.*

Marcus: *checking his phone* "Still no update on when power's coming back."

Elena: *shivering* "How cold do you think it is in here now?"

Marcus: "I'd guess low fifties? The pipes are going to freeze if this keeps up."

*She pulled the blankets tighter, pressing herself against him. At least body heat was free.*
</input>
<output>
{
  "weather": "Severe blizzard, whiteout conditions, dangerously high winds",
  "temperature": 52
}
</output>
<explanation>
WEATHER: Updated from "Heavy snowfall with blizzard conditions" -> "Severe blizzard, whiteout conditions, dangerously high winds"
- Storm has intensified ("if that was even possible")
- Visibility now zero (can't see building across street)
- Wind upgraded from "strong" to "screaming" and "constant howl"
- Weather can change during scenes; track these updates

TEMPERATURE: 68°F -> 52°F - DROPPED due to power outage
- Power out for 2 hours, radiator cold
- Breath now visible indoors (wasn't before)
- Marcus estimates "low fifties"
- Temperature dropping because heating failed
- Still indoor temp, but indoor conditions have changed dramatically

Both fields changed this time: weather intensified AND indoor temperature dropped. Track each independently based on what the scene describes.
</explanation>
</example>

<example>
<narrative_time>Friday, October 18, 2024 at 9:30 PM</narrative_time>
<location>Portland, Oregon - Marcus's House (Enclosed back porch)</location>
<previous_climate>
{
  "weather": "Steady light rain, misty, overcast",
  "temperature": 48
}
</previous_climate>
<input>
*The rain had finally stopped, though water still dripped from the gutters and the trees in Marcus's backyard. Elena stood on the enclosed back porch, a mug of tea warming her hands, watching the clouds break apart to reveal patches of stars.*

Marcus: *joining her* "Hey, look at that—you can actually see the moon."

*It was true. The clouds were moving fast, pushed by upper-level winds, and a three-quarter moon was emerging from behind them. The air felt cleaner now, washed fresh by the rain, though it had gotten noticeably colder since the sky cleared.*

Elena: "It's beautiful. But cold." *She pulled her sweater sleeves down over her hands.* "Probably thirty degrees colder than when we were at the waterfront."

Marcus: "Clear skies do that. All the heat radiates away." *He put an arm around her.* "Want to go back inside?"

Elena: "In a minute. I want to see if we can spot any constellations."
</input>
<output>
{
  "weather": "Clear and clearing, post-rain, partial moon visible",
  "temperature": 45
}
</output>
<explanation>
WEATHER: "Steady light rain, misty, overcast" -> "Clear and clearing, post-rain, partial moon visible"
- Rain stopped (major change)
- Clouds breaking up, moon and stars visible
- "Post-rain" captures the recent weather context (water dripping, fresh air)

TEMPERATURE: 48°F -> 45°F - SLIGHT drop
- They're on an ENCLOSED porch (semi-outdoor)
- Clear skies = radiative cooling (Marcus explains this)
- Elena notes it's "noticeably colder" since clouds cleared
- ~3°F drop is realistic for clearing skies in evening
- Not as cold as fully outdoors would be, but cooler than inside

The enclosed porch is a middle ground - affected by outdoor temperature but somewhat sheltered. Temperature reflects this semi-outdoor environment.
</explanation>
</example>
</examples>`,
		userTemplate: `<narrative_time>
{{narrativeTime}}
</narrative_time>

<current_location>
{{location}}
</current_location>

<previous_climate>
{{previousState}}
</previous_climate>

<recent_messages>
{{messages}}
</recent_messages>

<schema>
{{schema}}
</schema>

<output_example>
{{schemaExample}}
</output_example>

Extract the current climate as valid JSON:`,
	},
};
